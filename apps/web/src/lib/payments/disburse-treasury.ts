import { createServiceRoleClient } from '@/lib/supabase/service';
import {
  disbursePayment,
  disburseProvider,
} from '@/lib/payments/orchestrator';
import { shouldUseLiveDisburse } from '@/lib/payments/disburse-withdrawal';
import { logger } from '@/lib/observability';
import type { DisburseMethod } from '@/lib/payments/types';

export type TreasuryPayoutRow = {
  id: string;
  jamiya_id: string;
  amount: number;
  currency: string;
  status: string;
  narrative: string | null;
  provider_reference: string | null;
  metadata: Record<string, unknown> | null;
};

export type TreasuryDestinationRow = {
  id: string;
  kind: 'paybill' | 'till' | 'bank' | string;
  label: string;
  shortcode: string | null;
  account_reference: string | null;
  bank_name: string | null;
  bank_account_number: string | null;
  bank_account_name: string | null;
};

export async function completeTreasuryPayoutWithRef(
  payoutId: string,
  providerReference: string,
): Promise<{ ok: boolean; error?: string }> {
  const admin = createServiceRoleClient();
  const { data, error } = await admin.rpc('complete_treasury_payout', {
    p_payout_id: payoutId,
    p_provider_reference: providerReference,
    p_error_message: null,
    p_fail: false,
  });
  if (error) return { ok: false, error: error.message };
  const result = data as { ok?: boolean; error?: string } | null;
  if (!result?.ok) return { ok: false, error: result?.error ?? 'COMPLETE_FAILED' };
  return { ok: true };
}

export async function failTreasuryPayout(
  payoutId: string,
  errorMessage: string,
): Promise<void> {
  const admin = createServiceRoleClient();
  await admin.rpc('complete_treasury_payout', {
    p_payout_id: payoutId,
    p_provider_reference: null,
    p_error_message: errorMessage.slice(0, 500),
    p_fail: true,
  });
}

/**
 * Send treasury B2B (Paybill/Till) or settle simulated/bank via orchestrator.
 */
export async function runTreasuryB2bDisbursement(
  payout: TreasuryPayoutRow,
  destination: TreasuryDestinationRow,
): Promise<
  | { ok: true; status: 'completed' | 'processing'; message: string; providerReference?: string }
  | { ok: false; error: string }
> {
  if (payout.status !== 'approved' && payout.status !== 'processing') {
    return { ok: false, error: 'NOT_PROCESSABLE' };
  }

  const kind = destination.kind;
  const method: DisburseMethod =
    kind === 'paybill' || kind === 'till'
      ? 'mpesa_b2b'
      : kind === 'bank'
        ? 'bank'
        : 'simulated';

  const shortcode = (destination.shortcode ?? '').replace(/\D/g, '');
  if (method === 'mpesa_b2b' && !shortcode) {
    return { ok: false, error: 'SHORTCODE_REQUIRED' };
  }

  const live = shouldUseLiveDisburse() && method === 'mpesa_b2b';
  const admin = createServiceRoleClient();

  if (!live) {
    const ref = `sim-b2b:${payout.id}:${Date.now()}`;
    const done = await completeTreasuryPayoutWithRef(payout.id, ref);
    if (!done.ok) return { ok: false, error: done.error ?? 'COMPLETE_FAILED' };
    return {
      ok: true,
      status: 'completed',
      message:
        method === 'bank'
          ? 'Bank payout recorded in cashbook (manual / simulated rail).'
          : 'Supplier payout settled (simulated).',
      providerReference: ref,
    };
  }

  const result = await disbursePayment({
    disbursementId: payout.id,
    amount: Number(payout.amount),
    currency: payout.currency,
    method: 'mpesa_b2b',
    accountNumber: shortcode,
    accountType: kind === 'till' ? 'TillNumber' : 'Paybill',
    accountReference: destination.account_reference ?? undefined,
    beneficiaryName: destination.label,
    narrative: payout.narrative ?? `Treasury B2B ${destination.label}`,
    metadata: { kind: 'treasury_b2b', jamiya_id: payout.jamiya_id },
  });

  if (!result.ok) {
    await failTreasuryPayout(payout.id, result.error);
    return { ok: false, error: result.error };
  }

  const ref = result.providerReference ?? result.trackingId ?? null;
  await admin
    .from('treasury_payout_requests')
    .update({
      status: 'processing',
      provider: disburseProvider(),
      provider_reference: ref,
      metadata: {
        ...(payout.metadata ?? {}),
        disburse_provider: disburseProvider(),
        tracking_id: result.trackingId ?? ref,
        disbursing_at: new Date().toISOString(),
      },
      updated_at: new Date().toISOString(),
    })
    .eq('id', payout.id);

  if (result.status === 'completed' && ref) {
    const done = await completeTreasuryPayoutWithRef(payout.id, ref);
    if (!done.ok) {
      logger.warn('treasury b2b sync complete failed', {
        payoutId: payout.id,
        error: done.error,
      });
      return { ok: false, error: done.error ?? 'COMPLETE_FAILED' };
    }
    return {
      ok: true,
      status: 'completed',
      message: 'Supplier payout completed.',
      providerReference: ref,
    };
  }

  return {
    ok: true,
    status: 'processing',
    message: 'B2B send initiated. Cashbook updates when the provider confirms.',
    providerReference: ref ?? undefined,
  };
}
