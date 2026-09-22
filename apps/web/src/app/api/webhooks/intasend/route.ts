import { NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/service';
import { logger } from '@/lib/observability';
import { getPaymentStatus } from '@/lib/payments/orchestrator';
import {
  completeWithdrawalWithProviderRef,
  failWithdrawal,
} from '@/lib/payments/disburse-withdrawal';
import { verifyIntasendWebhook } from '@/lib/payments/intasend-webhook-auth';
import {
  finalizeWebhookEvent,
  ingestWebhookEvent,
  webhookFingerprint,
} from '@/lib/payments/webhook-inbox';
import { mirrorSettlementAfterComplete } from '@/lib/finance/settlements';

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

  const auth = verifyIntasendWebhook({ body, headers: request.headers });
  if (!auth.ok) {
    logger.warn('intasend webhook auth failed', { error: auth.error });
    return NextResponse.json({ ok: false, error: auth.error }, { status: 401 });
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

  const admin = createServiceRoleClient();
  const intentId =
    (/^[0-9a-f-]{36}$/i.test(apiRef) ? apiRef : null) ||
    (/^[0-9a-f-]{36}$/i.test(invoiceId) ? invoiceId : null);

  const fingerprint = webhookFingerprint('intasend', [
    state,
    apiRef,
    invoiceId,
    trackingId,
    String(invoice.updated_at ?? body.updated_at ?? ''),
  ]);

  const inbox = await ingestWebhookEvent(admin, {
    provider: 'intasend',
    fingerprint,
    payload: body,
    eventType: state || 'callback',
    externalId: invoiceId || trackingId || apiRef || null,
    paymentIntentId: intentId,
    headers: {
      'content-type': request.headers.get('content-type') ?? '',
    },
  });

  if (!inbox.ok) {
    logger.warn('intasend webhook inbox failed', { error: inbox.error });
  } else if (inbox.duplicate) {
    await finalizeWebhookEvent(admin, inbox.id, 'ignored', {
      paymentIntentId: intentId,
    });
    return NextResponse.json({ ok: true, duplicate: true });
  }

  // Harden: when settling a collection, confirm PSP status when we have an invoice id.
  if (intentId && invoiceId && (state === 'COMPLETE' || state === 'COMPLETED' || state === 'SUCCESS' || state === 'PAID')) {
    const verified = await getPaymentStatus(invoiceId, 'intasend');
    if (verified.ok && verified.status === 'failed') {
      await admin.rpc('fail_payment_intent', {
        p_intent_id: intentId,
        p_error_message: 'IntaSend verify: FAILED',
      });
      await finalizeWebhookEvent(admin, inbox.id, 'processed', {
        paymentIntentId: intentId,
      });
      return NextResponse.json({ ok: true, failed: true, verified: true });
    }
    if (verified.ok && verified.status !== 'success' && verified.status !== 'unknown') {
      await finalizeWebhookEvent(admin, inbox.id, 'ignored', {
        paymentIntentId: intentId,
        error: `verify_not_terminal:${verified.status}`,
      });
      return NextResponse.json({
        ok: true,
        pending: true,
        verified: verified.status,
      });
    }
  }

  const success =
    state === 'COMPLETE' ||
    state === 'COMPLETED' ||
    state === 'SUCCESS' ||
    state === 'PAID';
  const failed =
    state === 'FAILED' || state === 'CANCELLED' || state === 'CANCELED';

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
        await finalizeWebhookEvent(admin, inbox.id, 'failed', {
          error: error.message,
          paymentIntentId: intentId,
        });
        return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
      }
      await admin.rpc('mark_payment_intent_reconciled', {
        p_intent_id: intentId,
        p_settled: true,
      });
      await mirrorSettlementAfterComplete(admin, intentId, {
        source: 'intasend_webhook',
        raw: body,
      });
      await finalizeWebhookEvent(admin, inbox.id, 'processed', {
        paymentIntentId: intentId,
      });
      return NextResponse.json({ ok: true, settled: data });
    }

    if (failed) {
      await admin.rpc('fail_payment_intent', {
        p_intent_id: intentId,
        p_error_message: `IntaSend ${state}`,
      });
      await finalizeWebhookEvent(admin, inbox.id, 'processed', {
        paymentIntentId: intentId,
      });
      return NextResponse.json({ ok: true, failed: true });
    }
  }

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
        await finalizeWebhookEvent(admin, inbox.id, done.ok ? 'processed' : 'failed', {
          error: done.error,
        });
        return NextResponse.json({
          ok: done.ok,
          withdrawalId: withdrawal.id,
          settled: done.ok,
          error: done.error,
        });
      }
      await failWithdrawal(withdrawal.id, `IntaSend B2C ${state}`);
      await finalizeWebhookEvent(admin, inbox.id, 'processed');
      return NextResponse.json({ ok: true, withdrawalId: withdrawal.id, failed: true });
    }

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
        await finalizeWebhookEvent(admin, inbox.id, done.ok ? 'processed' : 'failed', {
          error: done.error,
        });
        return NextResponse.json({
          ok: done.ok,
          treasuryPayoutId: treasury.id,
          settled: done.ok,
          error: done.error,
        });
      }
      await failTreasuryPayout(treasury.id, `IntaSend B2B ${state}`);
      await finalizeWebhookEvent(admin, inbox.id, 'processed');
      return NextResponse.json({ ok: true, treasuryPayoutId: treasury.id, failed: true });
    }
  }

  if (invoiceId) {
    await getPaymentStatus(invoiceId, 'intasend');
  }

  await finalizeWebhookEvent(admin, inbox.id, 'ignored', {
    paymentIntentId: intentId,
  });

  return NextResponse.json({
    ok: true,
    pending: true,
    state,
    ignored: !intentId && refCandidates.length === 0,
  });
}
