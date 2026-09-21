import { createServiceRoleClient } from '@/lib/supabase/service';
import { getPaymentStatus } from '@/lib/payments/orchestrator';
import type { PaymentProviderId } from '@/lib/payments/types';
import {
  completeWithdrawalWithProviderRef,
  failWithdrawal,
} from '@/lib/payments/disburse-withdrawal';
import { logger } from '@/lib/observability';

export type ReconcileSummary = {
  intents_scanned: number;
  intents_settled: number;
  intents_failed: number;
  intents_flagged: number;
  withdrawals_scanned: number;
  withdrawals_settled: number;
  withdrawals_failed: number;
  withdrawals_flagged: number;
  needs_admin: Array<{
    entity_type: 'payment_intent' | 'withdrawal';
    entity_id: string;
    reason: string;
  }>;
};

const PROVIDERS: PaymentProviderId[] = [
  'simulated',
  'mpesa',
  'bank',
  'paystack',
  'intasend',
  'tendepay',
];

function asProvider(raw: string | null | undefined): PaymentProviderId | null {
  if (!raw) return null;
  const id = raw.toLowerCase();
  return PROVIDERS.includes(id as PaymentProviderId)
    ? (id as PaymentProviderId)
    : null;
}

/**
 * Poll stuck payment_intents + withdrawals via orchestrator getPaymentStatus,
 * settle or fail when PSP reports a terminal state; otherwise flag for admin.
 */
export async function runPaymentReconcile(opts?: {
  intentMaxAgeMinutes?: number;
  withdrawalMaxAgeMinutes?: number;
  limit?: number;
}): Promise<{ ok: boolean; runId: string; summary: ReconcileSummary; error?: string }> {
  const intentAgeMin = opts?.intentMaxAgeMinutes ?? 45;
  const withdrawalAgeMin = opts?.withdrawalMaxAgeMinutes ?? 60;
  const limit = opts?.limit ?? 40;

  const admin = createServiceRoleClient();
  const { data: runRow, error: runErr } = await admin
    .from('reconcile_runs')
    .insert({ status: 'running', summary: {} })
    .select('id')
    .single();

  if (runErr || !runRow) {
    return {
      ok: false,
      runId: '',
      summary: emptySummary(),
      error: runErr?.message ?? 'Could not start reconcile run.',
    };
  }

  const runId = (runRow as { id: string }).id;
  const summary = emptySummary();
  const intentCutoff = new Date(Date.now() - intentAgeMin * 60_000).toISOString();
  const withdrawalCutoff = new Date(
    Date.now() - withdrawalAgeMin * 60_000,
  ).toISOString();

  try {
    const { data: intents } = await admin
      .from('payment_intents')
      .select(
        'id, provider, status, provider_reference, checkout_request_id, updated_at, metadata',
      )
      .in('status', ['pending', 'processing'])
      .lt('updated_at', intentCutoff)
      .order('updated_at', { ascending: true })
      .limit(limit);

    for (const raw of intents ?? []) {
      const intent = raw as {
        id: string;
        provider: string;
        status: string;
        provider_reference: string | null;
        checkout_request_id: string | null;
        metadata: Record<string, unknown> | null;
      };
      summary.intents_scanned += 1;

      const ref =
        intent.provider_reference?.trim() ||
        intent.checkout_request_id?.trim() ||
        null;
      const provider = asProvider(intent.provider);

      if (!ref || !provider || provider === 'simulated' || provider === 'bank') {
        await flagItem(admin, runId, summary, {
          entity_type: 'payment_intent',
          entity_id: intent.id,
          provider: intent.provider,
          action: 'skip',
          result: 'needs_admin',
          reason: !ref ? 'NO_PROVIDER_REF' : `PROVIDER_NOT_POLLABLE:${provider}`,
        });
        continue;
      }

      const status = await getPaymentStatus(ref, provider);
      if (!status.ok || status.status === 'unknown' || status.status === 'processing') {
        await flagItem(admin, runId, summary, {
          entity_type: 'payment_intent',
          entity_id: intent.id,
          provider,
          action: 'poll',
          result: 'needs_admin',
          reason: status.error ?? status.status ?? 'STILL_OPEN',
          detail: { ref, polled: status.status },
        });
        continue;
      }

      if (status.status === 'success') {
        const { error } = await admin.rpc('complete_payment_intent', {
          p_intent_id: intent.id,
          p_provider_reference: status.providerReference ?? ref,
          p_checkout_request_id: intent.checkout_request_id,
          p_metadata: { source: 'daily_reconcile', polled_status: status.status },
        });
        if (error) {
          await flagItem(admin, runId, summary, {
            entity_type: 'payment_intent',
            entity_id: intent.id,
            provider,
            action: 'settle',
            result: 'error',
            reason: error.message,
          });
        } else {
          summary.intents_settled += 1;
          await insertItem(admin, runId, {
            entity_type: 'payment_intent',
            entity_id: intent.id,
            provider,
            action: 'settle',
            result: 'settled',
            detail: { ref },
          });
        }
        continue;
      }

      if (status.status === 'failed') {
        await admin.rpc('fail_payment_intent', {
          p_intent_id: intent.id,
          p_error_message: `Reconcile: provider reported ${status.status}`,
        });
        summary.intents_failed += 1;
        await insertItem(admin, runId, {
          entity_type: 'payment_intent',
          entity_id: intent.id,
          provider,
          action: 'fail',
          result: 'failed',
          detail: { ref },
        });
      }
    }

    // Only `processing` — pending = maker-checker queue, not a stuck PSP payout.
    const { data: withdrawals } = await admin
      .from('withdrawal_requests')
      .select(
        'id, status, provider_reference, destination_type, metadata, updated_at, created_at',
      )
      .eq('status', 'processing')
      .lt('updated_at', withdrawalCutoff)
      .order('updated_at', { ascending: true })
      .limit(limit);

    for (const raw of withdrawals ?? []) {
      const w = raw as {
        id: string;
        status: string;
        provider_reference: string | null;
        destination_type: string;
        metadata: Record<string, unknown> | null;
      };
      summary.withdrawals_scanned += 1;

      const ref = w.provider_reference?.trim() || null;
      const metaProvider = asProvider(
        typeof w.metadata?.disburse_provider === 'string'
          ? w.metadata.disburse_provider
          : null,
      );
      const provider = metaProvider;

      if (!ref || !provider || provider === 'simulated') {
        await flagItem(admin, runId, summary, {
          entity_type: 'withdrawal',
          entity_id: w.id,
          provider: metaProvider ?? undefined,
          action: 'skip',
          result: 'needs_admin',
          reason: !ref
            ? w.status === 'processing'
              ? 'PROCESSING_WITHOUT_REF'
              : 'AWAITING_ADMIN_OR_B2C'
            : 'PROVIDER_NOT_POLLABLE',
        });
        continue;
      }

      const status = await getPaymentStatus(ref, provider);
      if (!status.ok || status.status === 'unknown' || status.status === 'processing') {
        await flagItem(admin, runId, summary, {
          entity_type: 'withdrawal',
          entity_id: w.id,
          provider,
          action: 'poll',
          result: 'needs_admin',
          reason: status.error ?? status.status ?? 'STILL_OPEN',
          detail: { ref, polled: status.status },
        });
        continue;
      }

      if (status.status === 'success') {
        const done = await completeWithdrawalWithProviderRef(
          w.id,
          status.providerReference ?? ref,
        );
        if (done.ok) {
          summary.withdrawals_settled += 1;
          await insertItem(admin, runId, {
            entity_type: 'withdrawal',
            entity_id: w.id,
            provider,
            action: 'settle',
            result: 'settled',
            detail: { ref },
          });
        } else {
          await flagItem(admin, runId, summary, {
            entity_type: 'withdrawal',
            entity_id: w.id,
            provider,
            action: 'settle',
            result: 'error',
            reason: done.error ?? 'COMPLETE_FAILED',
          });
        }
        continue;
      }

      if (status.status === 'failed') {
        await failWithdrawal(w.id, `Reconcile: provider reported ${status.status}`);
        summary.withdrawals_failed += 1;
        await insertItem(admin, runId, {
          entity_type: 'withdrawal',
          entity_id: w.id,
          provider,
          action: 'fail',
          result: 'failed',
          detail: { ref },
        });
      }
    }

    await admin
      .from('reconcile_runs')
      .update({
        status: 'completed',
        finished_at: new Date().toISOString(),
        summary,
      })
      .eq('id', runId);

    logger.info('payment reconcile completed', { runId, summary });
    return { ok: true, runId, summary };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await admin
      .from('reconcile_runs')
      .update({
        status: 'failed',
        finished_at: new Date().toISOString(),
        error_message: message.slice(0, 500),
        summary,
      })
      .eq('id', runId);
    logger.warn('payment reconcile failed', { runId, error: message });
    return { ok: false, runId, summary, error: message };
  }
}

function emptySummary(): ReconcileSummary {
  return {
    intents_scanned: 0,
    intents_settled: 0,
    intents_failed: 0,
    intents_flagged: 0,
    withdrawals_scanned: 0,
    withdrawals_settled: 0,
    withdrawals_failed: 0,
    withdrawals_flagged: 0,
    needs_admin: [],
  };
}

async function insertItem(
  admin: ReturnType<typeof createServiceRoleClient>,
  runId: string,
  item: {
    entity_type: 'payment_intent' | 'withdrawal';
    entity_id: string;
    provider?: string;
    action: string;
    result: string;
    detail?: Record<string, unknown>;
  },
) {
  await admin.from('reconcile_run_items').insert({
    run_id: runId,
    entity_type: item.entity_type,
    entity_id: item.entity_id,
    provider: item.provider ?? null,
    action: item.action,
    result: item.result,
    detail: item.detail ?? {},
  });
}

async function flagItem(
  admin: ReturnType<typeof createServiceRoleClient>,
  runId: string,
  summary: ReconcileSummary,
  item: {
    entity_type: 'payment_intent' | 'withdrawal';
    entity_id: string;
    provider?: string;
    action: string;
    result: string;
    reason: string;
    detail?: Record<string, unknown>;
  },
) {
  if (item.entity_type === 'payment_intent') summary.intents_flagged += 1;
  else summary.withdrawals_flagged += 1;
  summary.needs_admin.push({
    entity_type: item.entity_type,
    entity_id: item.entity_id,
    reason: item.reason,
  });
  await insertItem(admin, runId, {
    entity_type: item.entity_type,
    entity_id: item.entity_id,
    provider: item.provider,
    action: item.action,
    result: item.result,
    detail: { reason: item.reason, ...(item.detail ?? {}) },
  });
}
