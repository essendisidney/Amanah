import { createServiceRoleClient } from '@/lib/supabase/service';
import {
  disbursePayment,
  disburseProvider,
  orchestratorHealth,
} from '@/lib/payments/orchestrator';
import { logger } from '@/lib/observability';

export type WithdrawalRow = {
  id: string;
  user_id: string;
  amount: number;
  currency: string;
  status: string;
  destination_type: string;
  destination_phone: string | null;
  provider_reference: string | null;
  metadata: Record<string, unknown> | null;
};

/** True when B2C should hit a live adapter (IntaSend / Daraja), not RPC sim. */
export function shouldUseLiveDisburse(): boolean {
  const id = disburseProvider();
  if (id === 'simulated' || id === 'bank') return false;
  if (process.env.REQUIRE_REAL_PROVIDERS === 'true') return true;
  const health = orchestratorHealth();
  return Boolean(health.adapters[id]?.configured);
}

export async function markWithdrawalDisbursing(
  withdrawalId: string,
  providerReference: string,
  extra?: Record<string, unknown>,
): Promise<void> {
  const admin = createServiceRoleClient();
  const { data: row } = await admin
    .from('withdrawal_requests')
    .select('metadata')
    .eq('id', withdrawalId)
    .maybeSingle();
  const prev = (row?.metadata as Record<string, unknown> | null) ?? {};
  await admin
    .from('withdrawal_requests')
    .update({
      status: 'processing',
      provider_reference: providerReference,
      metadata: {
        ...prev,
        disburse_provider: disburseProvider(),
        disbursing_at: new Date().toISOString(),
        ...extra,
      },
      updated_at: new Date().toISOString(),
    })
    .eq('id', withdrawalId)
    .in('status', ['pending', 'processing']);
}

export async function failWithdrawal(
  withdrawalId: string,
  errorMessage: string,
): Promise<void> {
  const admin = createServiceRoleClient();
  await admin
    .from('withdrawal_requests')
    .update({
      status: 'failed',
      error_message: errorMessage.slice(0, 500),
      updated_at: new Date().toISOString(),
    })
    .eq('id', withdrawalId)
    .in('status', ['pending', 'processing']);
}

export async function completeWithdrawalWithProviderRef(
  withdrawalId: string,
  providerReference: string,
): Promise<{ ok: boolean; error?: string }> {
  const admin = createServiceRoleClient();
  const { data, error } = await admin.rpc('process_withdrawal', {
    p_withdrawal_id: withdrawalId,
    p_approve: true,
    p_provider_reference: providerReference,
    p_error_message: null,
  });
  if (error) {
    logger.warn('process_withdrawal after B2C failed', {
      error: error.message,
      withdrawalId,
    });
    return { ok: false, error: error.message };
  }
  const result = data as { ok?: boolean; error?: string } | null;
  if (!result?.ok) {
    return { ok: false, error: result?.error ?? 'PROCESS_FAILED' };
  }
  return { ok: true };
}

/**
 * Send wallet withdrawal / payout cashout to phone via orchestrator.
 * - simulated / sync complete → debit via process_withdrawal
 * - async processing → mark processing; webhook finishes
 */
export async function runWithdrawalDisbursement(
  withdrawal: WithdrawalRow,
  opts?: { narrative?: string; beneficiaryName?: string },
): Promise<
  | { ok: true; status: 'completed' | 'processing'; message: string; providerReference?: string }
  | { ok: false; error: string }
> {
  const phone = (withdrawal.destination_phone ?? '').trim();
  if (!/^\+[1-9]\d{7,14}$/.test(phone)) {
    return { ok: false, error: 'PHONE_REQUIRED' };
  }

  if (withdrawal.status !== 'pending' && withdrawal.status !== 'processing') {
    return { ok: false, error: 'NOT_PROCESSABLE' };
  }

  const collected = await disbursePayment({
    disbursementId: withdrawal.id,
    amount: Number(withdrawal.amount),
    currency: withdrawal.currency || 'KES',
    phone,
    beneficiaryName: opts?.beneficiaryName,
    narrative:
      opts?.narrative ?? 'Jameiyah withdraw',
    method: 'mpesa_b2c',
    metadata: {
      kind: 'withdrawal',
      withdrawal_id: withdrawal.id,
      user_id: withdrawal.user_id,
    },
  });

  if (!collected.ok) {
    await failWithdrawal(withdrawal.id, collected.error);
    return { ok: false, error: collected.error };
  }

  const ref =
    collected.providerReference ??
    collected.trackingId ??
    `disburse:${withdrawal.id}`;

  if (collected.status === 'completed' || collected.fallback === 'simulated') {
    const done = await completeWithdrawalWithProviderRef(withdrawal.id, ref);
    if (!done.ok) {
      return { ok: false, error: done.error ?? 'COMPLETE_FAILED' };
    }
    return {
      ok: true,
      status: 'completed',
      message:
        collected.fallback === 'simulated'
          ? 'Withdrawal completed (simulated B2C).'
          : 'Funds sent to M-Pesa.',
      providerReference: ref,
    };
  }

  await markWithdrawalDisbursing(withdrawal.id, ref, {
    tracking_id: collected.trackingId ?? ref,
  });

  return {
    ok: true,
    status: 'processing',
    message: 'M-Pesa send started. Status updates when the provider confirms.',
    providerReference: ref,
  };
}
