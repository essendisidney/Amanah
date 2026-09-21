import { NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/service';
import { logger } from '@/lib/observability';
import { getPaymentStatus } from '@/lib/payments/orchestrator';
import {
  completeWithdrawalWithProviderRef,
  failWithdrawal,
} from '@/lib/payments/disburse-withdrawal';

/**
 * IntaSend collection / send-money callbacks.
 * - Collections: settle payment_intents
 * - Disbursements: complete withdrawal_requests by provider_reference / tracking id
 */
export async function POST(request: Request) {
  const raw = await request.text();
  let body: Record<string, unknown> = {};
  try {
    body = JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ ok: false, error: 'INVALID_JSON' }, { status: 400 });
  }

  const invoice =
    (body.invoice as Record<string, unknown> | undefined) ??
    (body.data as Record<string, unknown> | undefined) ??
    body;

  const state = String(
    invoice.state ?? body.state ?? body.status ?? '',
  ).toUpperCase();
  const apiRef = String(
    invoice.api_ref ?? body.api_ref ?? invoice.apiRef ?? '',
  ).trim();
  const invoiceId = String(
    invoice.invoice_id ?? invoice.id ?? body.invoice_id ?? body.id ?? '',
  ).trim();
  const trackingId = String(
    body.tracking_id ??
      invoice.tracking_id ??
      body.batch_reference ??
      invoice.batch_reference ??
      '',
  ).trim();

  logger.info('intasend webhook', { state, apiRef, invoiceId, trackingId });

  const expectedChallenge = (process.env.INTASEND_WEBHOOK_CHALLENGE ?? '').trim();
  if (expectedChallenge) {
    const challenge = String(
      body.challenge ?? invoice.challenge ?? '',
    ).trim();
    if (challenge && challenge !== expectedChallenge) {
      logger.warn('intasend webhook challenge mismatch');
      return NextResponse.json({ ok: false, error: 'INVALID_CHALLENGE' }, { status: 401 });
    }
  }

  const admin = createServiceRoleClient();

  const intentId =
    (/^[0-9a-f-]{36}$/i.test(apiRef) ? apiRef : null) ||
    (/^[0-9a-f-]{36}$/i.test(invoiceId) ? invoiceId : null);

  const success =
    state === 'COMPLETE' ||
    state === 'COMPLETED' ||
    state === 'SUCCESS' ||
    state === 'PAID';
  const failed =
    state === 'FAILED' || state === 'CANCELLED' || state === 'CANCELED';

  // Prefer payment_intent settle when api_ref is an intent UUID.
  if (intentId) {
    if (success) {
      const { data, error } = await admin.rpc('complete_payment_intent', {
        p_intent_id: intentId,
        p_provider_reference: invoiceId || apiRef,
        p_checkout_request_id: invoiceId || null,
        p_metadata: { source: 'intasend_webhook', state },
      });
      if (error) {
        logger.warn('intasend complete failed', { error: error.message, intentId });
        return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
      }
      return NextResponse.json({ ok: true, settled: data });
    }

    if (failed) {
      await admin.rpc('fail_payment_intent', {
        p_intent_id: intentId,
        p_error_message: `IntaSend ${state}`,
      });
      return NextResponse.json({ ok: true, failed: true });
    }
  }

  // B2C / send-money → withdrawal_requests
  const refCandidates = [trackingId, apiRef, invoiceId].filter(Boolean);
  if (refCandidates.length > 0 && (success || failed)) {
    let withdrawal: { id: string; status: string } | null = null;
    for (const ref of refCandidates) {
      const { data } = await admin
        .from('withdrawal_requests')
        .select('id, status')
        .eq('provider_reference', ref)
        .in('status', ['pending', 'processing'])
        .maybeSingle();
      if (data) {
        withdrawal = data as { id: string; status: string };
        break;
      }
    }

    // Also match tracking_id stored in metadata
    if (!withdrawal && trackingId) {
      const { data } = await admin
        .from('withdrawal_requests')
        .select('id, status')
        .contains('metadata', { tracking_id: trackingId })
        .in('status', ['pending', 'processing'])
        .maybeSingle();
      if (data) withdrawal = data as { id: string; status: string };
    }

    if (withdrawal) {
      if (success) {
        const done = await completeWithdrawalWithProviderRef(
          withdrawal.id,
          trackingId || apiRef || invoiceId || `intasend:${withdrawal.id}`,
        );
        return NextResponse.json({
          ok: done.ok,
          withdrawalId: withdrawal.id,
          settled: done.ok,
          error: done.error,
        });
      }
      await failWithdrawal(withdrawal.id, `IntaSend B2C ${state}`);
      return NextResponse.json({ ok: true, withdrawalId: withdrawal.id, failed: true });
    }

    // Treasury B2B payouts
    let treasury: { id: string; status: string } | null = null;
    for (const ref of refCandidates) {
      const { data } = await admin
        .from('treasury_payout_requests')
        .select('id, status')
        .eq('provider_reference', ref)
        .in('status', ['pending', 'approved', 'processing'])
        .maybeSingle();
      if (data) {
        treasury = data as { id: string; status: string };
        break;
      }
    }
    if (!treasury && trackingId) {
      const { data } = await admin
        .from('treasury_payout_requests')
        .select('id, status')
        .contains('metadata', { tracking_id: trackingId })
        .in('status', ['pending', 'approved', 'processing'])
        .maybeSingle();
      if (data) treasury = data as { id: string; status: string };
    }
    if (treasury) {
      const {
        completeTreasuryPayoutWithRef,
        failTreasuryPayout,
      } = await import('@/lib/payments/disburse-treasury');
      if (success) {
        const done = await completeTreasuryPayoutWithRef(
          treasury.id,
          trackingId || apiRef || invoiceId || `intasend-b2b:${treasury.id}`,
        );
        return NextResponse.json({
          ok: done.ok,
          treasuryPayoutId: treasury.id,
          settled: done.ok,
          error: done.error,
        });
      }
      await failTreasuryPayout(treasury.id, `IntaSend B2B ${state}`);
      return NextResponse.json({ ok: true, treasuryPayoutId: treasury.id, failed: true });
    }
  }

  if (invoiceId) {
    await getPaymentStatus(invoiceId, 'intasend');
  }

  return NextResponse.json({
    ok: true,
    pending: true,
    state,
    ignored: !intentId && refCandidates.length === 0,
  });
}
