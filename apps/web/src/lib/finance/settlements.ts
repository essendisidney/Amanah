import type { SupabaseClient } from '@supabase/supabase-js';
import { toAmountMinor } from '@/lib/finance/money';
import {
  assertSettlementRecordTransition,
  type SettlementRecordStatus,
} from '@/lib/finance/state-machine';
import { logger } from '@/lib/observability';

type AdminClient = SupabaseClient;

export type RecordSettlementInput = {
  paymentIntentId: string;
  provider: string;
  providerReference?: string | null;
  amount: number | string;
  currency?: string;
  status?: SettlementRecordStatus;
  metadata?: Record<string, unknown>;
  /** Observed PSP snapshot (optional). */
  direction?: 'collection' | 'disbursement';
  raw?: Record<string, unknown>;
};

/**
 * Upsert a settlements row + provider_transactions mirror after a successful
 * complete_payment_intent. Idempotent on (provider, provider_reference).
 */
export async function recordSettlementForIntent(
  admin: AdminClient,
  input: RecordSettlementInput,
): Promise<{ ok: true; settlementId: string } | { ok: false; error: string }> {
  const amount = typeof input.amount === 'string' ? Number(input.amount) : input.amount;
  if (!Number.isFinite(amount) || amount <= 0) {
    return { ok: false, error: 'INVALID_AMOUNT' };
  }

  let amountMinor: number;
  try {
    amountMinor = toAmountMinor(amount);
  } catch {
    return { ok: false, error: 'INVALID_AMOUNT' };
  }

  const status: SettlementRecordStatus = input.status ?? 'settled';
  const currency = (input.currency ?? 'KES').toUpperCase().slice(0, 3);
  const providerRef = input.providerReference?.trim() || null;

  try {
    if (providerRef) {
      const { data: existing } = await admin
        .from('settlements')
        .select('id, status')
        .eq('provider', input.provider)
        .eq('provider_reference', providerRef)
        .maybeSingle();

      if (existing) {
        const row = existing as { id: string; status: SettlementRecordStatus };
        try {
          assertSettlementRecordTransition(row.status, status);
        } catch (err) {
          return {
            ok: false,
            error: err instanceof Error ? err.message : 'ILLEGAL_TRANSITION',
          };
        }
        if (row.status !== status) {
          await admin
            .from('settlements')
            .update({
              status,
              settled_at: status === 'settled' ? new Date().toISOString() : null,
              updated_at: new Date().toISOString(),
              payment_intent_id: input.paymentIntentId,
            })
            .eq('id', row.id);
        }
        await upsertProviderTx(admin, {
          provider: input.provider,
          providerReference: providerRef,
          paymentIntentId: input.paymentIntentId,
          direction: input.direction ?? 'collection',
          amount,
          amountMinor,
          currency,
          status,
          raw: input.raw ?? {},
        });
        return { ok: true, settlementId: row.id };
      }
    }

    const { data, error } = await admin
      .from('settlements')
      .insert({
        payment_intent_id: input.paymentIntentId,
        provider: input.provider,
        provider_reference: providerRef,
        amount,
        amount_minor: amountMinor,
        currency,
        status,
        settled_at: status === 'settled' ? new Date().toISOString() : null,
        metadata: input.metadata ?? {},
      })
      .select('id')
      .single();

    if (error || !data) {
      logger.warn('recordSettlement insert failed', {
        error: error?.message,
        intentId: input.paymentIntentId,
      });
      return { ok: false, error: error?.message ?? 'INSERT_FAILED' };
    }

    if (providerRef) {
      await upsertProviderTx(admin, {
        provider: input.provider,
        providerReference: providerRef,
        paymentIntentId: input.paymentIntentId,
        direction: input.direction ?? 'collection',
        amount,
        amountMinor,
        currency,
        status,
        raw: input.raw ?? {},
      });
    }

    return { ok: true, settlementId: (data as { id: string }).id };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'UNKNOWN';
    logger.warn('recordSettlement failed', { error: message });
    return { ok: false, error: message };
  }
}

async function upsertProviderTx(
  admin: AdminClient,
  opts: {
    provider: string;
    providerReference: string;
    paymentIntentId: string;
    direction: 'collection' | 'disbursement';
    amount: number;
    amountMinor: number;
    currency: string;
    status: string;
    raw: Record<string, unknown>;
  },
) {
  await admin.from('provider_transactions').upsert(
    {
      provider: opts.provider,
      provider_reference: opts.providerReference,
      payment_intent_id: opts.paymentIntentId,
      direction: opts.direction,
      amount: opts.amount,
      amount_minor: opts.amountMinor,
      currency: opts.currency,
      status: opts.status,
      raw: opts.raw,
      observed_at: new Date().toISOString(),
    },
    { onConflict: 'provider,provider_reference' },
  );
}

/**
 * After complete_payment_intent succeeds, load the intent and write settlement layers.
 */
function inferDirection(
  metadata: Record<string, unknown> | null | undefined,
): 'collection' | 'disbursement' {
  const kind = String(metadata?.kind ?? '').toLowerCase();
  if (
    kind.includes('withdraw') ||
    kind.includes('disburse') ||
    kind.includes('payout') ||
    kind.includes('b2c')
  ) {
    return 'disbursement';
  }
  return 'collection';
}

export async function mirrorSettlementAfterComplete(
  admin: AdminClient,
  paymentIntentId: string,
  opts?: { source?: string; raw?: Record<string, unknown> },
): Promise<void> {
  const { data } = await admin
    .from('payment_intents')
    .select('id, amount, currency, provider, provider_reference, status, metadata')
    .eq('id', paymentIntentId)
    .maybeSingle();

  if (!data) return;
  const intent = data as {
    id: string;
    amount: number | string;
    currency: string;
    provider: string;
    provider_reference: string | null;
    status: string;
    metadata: Record<string, unknown> | null;
  };

  if (intent.status !== 'completed') return;

  const result = await recordSettlementForIntent(admin, {
    paymentIntentId: intent.id,
    provider: intent.provider,
    providerReference: intent.provider_reference,
    amount: intent.amount,
    currency: intent.currency,
    status: 'settled',
    direction: inferDirection(intent.metadata),
    metadata: { source: opts?.source ?? 'post_complete' },
    raw: opts?.raw,
  });

  if (!result.ok) {
    logger.warn('mirrorSettlementAfterComplete skipped', {
      intentId: paymentIntentId,
      error: result.error,
    });
  }
}

/**
 * After process_withdrawal succeeds, mirror PSP cash as a disbursement settlement.
 */
export async function mirrorDisbursementSettlement(
  admin: AdminClient,
  withdrawalId: string,
  opts?: {
    provider?: string;
    providerReference?: string | null;
    source?: string;
  },
): Promise<void> {
  const { data, error } = await admin.rpc('record_disbursement_settlement', {
    p_withdrawal_id: withdrawalId,
    p_provider: opts?.provider ?? null,
    p_provider_reference: opts?.providerReference ?? null,
    p_metadata: { source: opts?.source ?? 'post_disburse' },
  });

  if (error || !(data as { ok?: boolean } | null)?.ok) {
    logger.warn('mirrorDisbursementSettlement skipped', {
      withdrawalId,
      error: error?.message ?? (data as { error?: string } | null)?.error,
    });
  }
}
