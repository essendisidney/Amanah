'use server';

import { revalidatePath } from 'next/cache';
import { callRpc } from '@/lib/supabase/rpc';
import { logger } from '@/lib/observability';

export type WithdrawalActionState = {
  success: boolean;
  message: string;
};

export async function requestWithdrawalAction(
  _prev: WithdrawalActionState,
  formData: FormData,
): Promise<WithdrawalActionState> {
  const amount = Number(formData.get('amount') ?? '');
  const currency = String(formData.get('currency') ?? 'KES').toUpperCase();
  const destinationType = String(formData.get('destinationType') ?? 'mpesa');
  const phone = String(formData.get('phone') ?? '').trim();
  const bankName = String(formData.get('bankName') ?? '').trim();
  const bankAccountName = String(formData.get('bankAccountName') ?? '').trim();
  const bankAccountNumber = String(formData.get('bankAccountNumber') ?? '').trim();

  if (!Number.isFinite(amount) || amount < 100) {
    return { success: false, message: 'Enter an amount of at least 100.' };
  }

  const { data, error } = await callRpc('request_withdrawal', {
    p_amount: amount,
    p_currency: currency,
    p_destination_type: destinationType,
    p_destination_phone: phone || null,
    p_bank_name: bankName || null,
    p_bank_account_name: bankAccountName || null,
    p_bank_account_number: bankAccountNumber || null,
  });

  if (error) {
    logger.error('request_withdrawal failed', { message: error.message });
    return { success: false, message: error.message };
  }

  const result = data as { ok?: boolean; error?: string } | null;
  if (!result?.ok) {
    const code = result?.error ?? 'FAILED';
    const messages: Record<string, string> = {
      KYC_REQUIRED: 'KYC approval required for withdrawals of 20,000+.',
      RISK_BLOCKED: 'Withdrawal blocked by risk controls. Contact support.',
      PHONE_REQUIRED: 'Provide an E.164 M-Pesa phone number.',
      BANK_DETAILS_REQUIRED: 'Provide bank name, account name, and account number.',
      INVALID_AMOUNT: 'Amount must be between 100 and 5,000,000.',
    };
    return { success: false, message: messages[code] ?? `Withdrawal failed (${code}).` };
  }

  revalidatePath('/wallet');
  revalidatePath('/notifications');
  return { success: true, message: 'Withdrawal requested. Pending processing.' };
}

export async function processWithdrawalAction(formData: FormData): Promise<void> {
  const withdrawalId = String(formData.get('withdrawalId') ?? '');
  const approve = String(formData.get('approve') ?? 'true') === 'true';
  if (!withdrawalId) return;

  await callRpc('propose_process_withdrawal', {
    p_withdrawal_id: withdrawalId,
    p_approve: approve,
    p_provider_reference: approve ? `manual:${withdrawalId}` : null,
    p_error_message: approve ? null : 'Rejected by admin',
  });

  revalidatePath('/admin/withdrawals');
  revalidatePath('/wallet');
}

export async function confirmDualApprovalAction(formData: FormData): Promise<void> {
  const requestId = String(formData.get('requestId') ?? '');
  const approve = String(formData.get('approve') ?? 'true') === 'true';
  if (!requestId) return;

  await callRpc('confirm_dual_approval', {
    p_request_id: requestId,
    p_approve: approve,
  });

  revalidatePath('/admin/withdrawals');
  revalidatePath('/wallet');
}

/** Simulated B2C for circle payout cashouts until live Daraja. */
export async function processPayoutCashoutAction(formData: FormData): Promise<void> {
  const withdrawalId = String(formData.get('withdrawalId') ?? '');
  if (!withdrawalId) return;

  await callRpc('process_payout_cashout', {
    p_withdrawal_id: withdrawalId,
    p_simulate: true,
  });

  revalidatePath('/admin/withdrawals');
  revalidatePath('/wallet');
}
