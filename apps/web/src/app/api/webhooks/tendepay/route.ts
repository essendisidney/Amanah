import { NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/service';
import { logger } from '@/lib/observability';
import { getPaymentStatus } from '@/lib/payments/orchestrator';
import {
  completeWithdrawalWithProviderRef,
  failWithdrawal,
} from '@/lib/payments/disburse-withdrawal';
import {
  finalizeWebhookEvent,
  ingestWebhookEvent,
  webhookFingerprint,
} from '@/lib/payments/webhook-inbox';
import { mirrorSettlementAfterComplete } from '@/lib/finance/settlements';

/**
 * TendePay collection / B2C callbacks (bake-off).
 * Body shape is flexible until official webhook schema is confirmed.
 */
export async function POST(request: Request) {
  const raw = await request.text();
  let body: Record<string, unknown> = {};
  try {
    body = JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ ok: false, error: 'INVALID_JSON' }, { status: 400 });
  }

  const data =
    (body.data as Record<string, unknown> | undefined) ??
    (body.payload as Record<string, unknown> | undefined) ??
    body;

  const state = String(
    data.state ?? data.status ?? body.state ?? body.status ?? '',
  ).toUpperCase();
  const apiRef = String(
    data.external_reference ??
      data.reference ??
      body.external_reference ??
      body.reference ??
      data.api_ref ??
      '',
  ).trim();
  const providerRef = String(
    data.transaction_id ??
      data.tracking_id ??
      body.transaction_id ??
      body.tracking_id ??
      apiRef,
  ).trim();

  logger.info('tendepay webhook', { state, apiRef, providerRef });

  const admin = createServiceRoleClient();
  const intentId = /^[0-9a-f-]{36}$/i.test(apiRef) ? apiRef : null;

  const fingerprint = webhookFingerprint('tendepay', [
    state,
    apiRef,
    providerRef,
  ]);
  const inbox = await ingestWebhookEvent(admin, {
    provider: 'tendepay',
    fingerprint,
    payload: body,
    eventType: state || 'callback',
    externalId: providerRef || apiRef || null,
    paymentIntentId: intentId,
  });

  if (inbox.duplicate) {
    await finalizeWebhookEvent(admin, inbox.id, 'ignored', {
      paymentIntentId: intentId,
    });
    return NextResponse.json({ ok: true, duplicate: true });
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
      const { data: settled, error } = await admin.rpc('complete_payment_intent', {
        p_intent_id: intentId,
        p_provider_reference: providerRef || apiRef,
        p_checkout_request_id: providerRef || null,
        p_metadata: { source: 'tendepay_webhook', state },
      });
      if (error) {
        logger.warn('tendepay complete failed', { error: error.message, intentId });
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
        source: 'tendepay_webhook',
        raw: body,
      });
      await finalizeWebhookEvent(admin, inbox.id, 'processed', {
        paymentIntentId: intentId,
      });
      return NextResponse.json({ ok: true, settled });
    }
    if (failed) {
      await admin.rpc('fail_payment_intent', {
        p_intent_id: intentId,
        p_error_message: `TendePay ${state}`,
      });
      await finalizeWebhookEvent(admin, inbox.id, 'processed', {
        paymentIntentId: intentId,
      });
      return NextResponse.json({ ok: true, failed: true });
    }
  }

  const refs = [providerRef, apiRef].filter(Boolean);
  if (refs.length > 0 && (success || failed)) {
    let withdrawal: { id: string } | null = null;
    for (const ref of refs) {
      const { data: row } = await admin
        .from('withdrawal_requests')
        .select('id')
        .eq('provider_reference', ref)
        .in('status', ['pending', 'processing'])
        .maybeSingle();
      if (row) {
        withdrawal = row as { id: string };
        break;
      }
    }
    if (withdrawal) {
      if (success) {
        const done = await completeWithdrawalWithProviderRef(
          withdrawal.id,
          providerRef || apiRef || `tendepay:${withdrawal.id}`,
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
      await failWithdrawal(withdrawal.id, `TendePay B2C ${state}`);
      await finalizeWebhookEvent(admin, inbox.id, 'processed');
      return NextResponse.json({ ok: true, withdrawalId: withdrawal.id, failed: true });
    }
  }

  if (providerRef) {
    await getPaymentStatus(providerRef, 'tendepay');
  }

  await finalizeWebhookEvent(admin, inbox.id, 'ignored', {
    paymentIntentId: intentId,
  });

  return NextResponse.json({ ok: true, pending: true, state });
}
