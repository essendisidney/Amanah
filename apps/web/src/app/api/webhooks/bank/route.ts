import { timingSafeEqual } from 'node:crypto';
import { NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/service';
import { logger } from '@/lib/observability';
import {
  finalizeWebhookEvent,
  ingestWebhookEvent,
  webhookFingerprint,
} from '@/lib/payments/webhook-inbox';
import { mirrorSettlementAfterComplete } from '@/lib/finance/settlements';
import {
  completeWithdrawalWithProviderRef,
  failWithdrawal,
} from '@/lib/payments/disburse-withdrawal';
import type { PaymentProviderId } from '@/lib/payments/types';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function safeEqual(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ba.length !== bb.length) return false;
  return timingSafeEqual(ba, bb);
}

function verifyBankWebhook(headers: Headers): { ok: true } | { ok: false; error: string } {
  const expected =
    process.env.BANK_WEBHOOK_SECRET?.trim() ||
    process.env.BANK_ALERT_WEBHOOK_SECRET?.trim() ||
    '';
  if (!expected) {
    // Allow open only when real providers are not required (local/dev).
    if ((process.env.REQUIRE_REAL_PROVIDERS ?? '').toLowerCase() === 'true') {
      return { ok: false, error: 'BANK_WEBHOOK_SECRET_REQUIRED' };
    }
    return { ok: true };
  }

  const header =
    headers.get('x-jameiyah-webhook-secret') ??
    headers.get('x-amanah-webhook-secret') ??
    headers.get('authorization')?.replace(/^Bearer\s+/i, '') ??
    '';

  if (!header || !safeEqual(header, expected)) {
    return { ok: false, error: 'INVALID_SECRET' };
  }
  return { ok: true };
}

function asProvider(rail: string): PaymentProviderId {
  const r = rail.toLowerCase();
  if (r === 'coop' || r === 'coop_bank') return 'coop';
  if (r === 'kcb' || r === 'kcb_bank') return 'kcb';
  return 'bank';
}

/**
 * Direct bank (Co-op / KCB / generic) payment callbacks.
 * Configure bank dashboards to POST here:
 *   https://jameiyah.com/api/webhooks/bank
 *
 * Auth: `x-jameiyah-webhook-secret` (or Bearer) = BANK_WEBHOOK_SECRET
 * Body (flexible): { status, reference, intent_id|api_ref, rail?, tracking_id? }
 */
export async function POST(request: Request) {
  const raw = await request.text();
  let body: Record<string, unknown> = {};
  try {
    body = JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ ok: false, error: 'INVALID_JSON' }, { status: 400 });
  }

  const auth = verifyBankWebhook(request.headers);
  if (!auth.ok) {
    logger.warn('bank webhook auth failed', { error: auth.error });
    return NextResponse.json({ ok: false, error: auth.error }, { status: 401 });
  }

  const data =
    (body.data as Record<string, unknown> | undefined) ??
    (body.payload as Record<string, unknown> | undefined) ??
    body;

  const rail = String(data.rail ?? body.rail ?? 'generic').toLowerCase();
  const provider = asProvider(rail);
  const state = String(data.status ?? body.status ?? data.state ?? '').toUpperCase();
  const reference = String(
    data.reference ?? body.reference ?? data.provider_reference ?? '',
  ).trim();
  const apiRef = String(
    data.intent_id ??
      body.intent_id ??
      data.api_ref ??
      body.api_ref ??
      data.external_reference ??
      '',
  ).trim();
  const trackingId = String(
    data.tracking_id ?? body.tracking_id ?? data.disbursement_id ?? '',
  ).trim();

  const intentId = /^[0-9a-f-]{36}$/i.test(apiRef) ? apiRef : null;

  logger.info('bank webhook', { rail, provider, state, reference, intentId, trackingId });

  const admin = createServiceRoleClient();
  const fingerprint = webhookFingerprint(provider, [
    state,
    reference,
    apiRef,
    trackingId,
    rail,
  ]);

  const inbox = await ingestWebhookEvent(admin, {
    provider,
    fingerprint,
    payload: body,
    eventType: state || 'callback',
    externalId: reference || trackingId || apiRef || null,
    paymentIntentId: intentId,
    headers: {
      'content-type': request.headers.get('content-type') ?? '',
      rail,
    },
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
    state === 'PAID' ||
    state === 'SETTLED';
  const failed =
    state === 'FAILED' ||
    state === 'REJECTED' ||
    state === 'CANCELLED' ||
    state === 'CANCELED';

  if (intentId) {
    if (success) {
      const { data: settled, error } = await admin.rpc('complete_payment_intent', {
        p_intent_id: intentId,
        p_provider_reference: reference || apiRef,
        p_checkout_request_id: reference || null,
        p_metadata: { source: 'bank_webhook', rail, state },
      });
      if (error) {
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
        source: 'bank_webhook',
        raw: body,
      });
      await finalizeWebhookEvent(admin, inbox.id, 'processed', {
        paymentIntentId: intentId,
      });
      return NextResponse.json({ ok: true, settled, provider, rail });
    }

    if (failed) {
      await admin.rpc('fail_payment_intent', {
        p_intent_id: intentId,
        p_error_message: `Bank ${rail} ${state}`,
      });
      await finalizeWebhookEvent(admin, inbox.id, 'processed', {
        paymentIntentId: intentId,
      });
      return NextResponse.json({ ok: true, failed: true, provider, rail });
    }
  }

  const refs = [trackingId, reference, apiRef].filter(Boolean);
  if (refs.length > 0 && (success || failed)) {
    for (const ref of refs) {
      const { data: withdrawal } = await admin
        .from('withdrawal_requests')
        .select('id, status')
        .eq('provider_reference', ref)
        .in('status', ['pending', 'processing'])
        .maybeSingle();
      if (withdrawal) {
        if (success) {
          await completeWithdrawalWithProviderRef(
            (withdrawal as { id: string }).id,
            reference || ref,
          );
        } else {
          await failWithdrawal(
            (withdrawal as { id: string }).id,
            `Bank ${rail} ${state}`,
          );
        }
        await finalizeWebhookEvent(admin, inbox.id, 'processed');
        return NextResponse.json({
          ok: true,
          withdrawal: true,
          success,
          provider,
          rail,
        });
      }
    }
  }

  await finalizeWebhookEvent(admin, inbox.id, 'ignored', {
    error: 'NO_MATCH',
    paymentIntentId: intentId,
  });
  return NextResponse.json({ ok: true, ignored: true, provider, rail });
}
