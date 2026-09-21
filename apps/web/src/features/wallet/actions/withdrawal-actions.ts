'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { toE164Kenya } from '@jamiya/shared';
import { callRpc } from '@/lib/supabase/rpc';
import { logger } from '@/lib/observability';
import { paymentProvider } from '@/lib/payments/provider';
import { withNoticeQuery } from '@/features/auth/lib/types';

export type WithdrawalActionState = {
  success: boolean;
  message: string;
  needsOtp?: boolean;
};

export async function requestWithdrawalAction(
  _prev: WithdrawalActionState,
  formData: FormData,
): Promise<WithdrawalActionState> {
  const amount = Number(formData.get('amount') ?? '');
  const currency = String(formData.get('currency') ?? 'KES').toUpperCase();
  const destinationType = String(formData.get('destinationType') ?? 'mpesa');
  const phoneRaw = String(formData.get('phone') ?? '').trim();
  const phone =
    destinationType === 'mpesa' && phoneRaw
      ? (toE164Kenya(phoneRaw) ?? phoneRaw)
      : phoneRaw;
  const bankName = String(formData.get('bankName') ?? '').trim();
  const bankAccountName = String(formData.get('bankAccountName') ?? '').trim();
  const bankAccountNumber = String(formData.get('bankAccountNumber') ?? '').trim();

  if (!Number.isFinite(amount) || amount < 100) {
    return { success: false, message: 'Enter an amount of at least 100.' };
  }

  if (destinationType === 'mpesa' && phoneRaw && !toE164Kenya(phoneRaw)) {
    return {
      success: false,
      message: 'Use a Kenya mobile, e.g. 07… or +254….',
    };
  }

  const otp = String(formData.get('otp') ?? '').replace(/\D/g, '').slice(0, 6);
  const challenge = String(formData.get('otp_challenge') ?? '') === '1';
  const resend = String(formData.get('resend_otp') ?? '') === '1';
  const { sendWalletStepUpOtp, consumeWalletStepUpOtp } = await import(
    '@/lib/wallet/step-up'
  );
  const provider = paymentProvider();
  const requireReal = process.env.REQUIRE_REAL_PROVIDERS === 'true';
  // Live M-Pesa B2C already targets the linked phone — skip Taifa SMS step-up.
  const stkProvider =
    provider === 'mpesa' || provider === 'intasend' || provider === 'tendepay';
  const skipStepUp =
    (provider === 'simulated' && !requireReal) ||
    (stkProvider && destinationType === 'mpesa');
  if (!skipStepUp) {
    if (resend) {
      return sendWalletStepUpOtp('wallet_withdraw');
    }
    if (!otp) {
      if (challenge) {
        return {
          success: false,
          needsOtp: true,
          message: 'Enter the 6-digit code from SMS.',
        };
      }
      return sendWalletStepUpOtp('wallet_withdraw');
    }
    const stepUp = await consumeWalletStepUpOtp('wallet_withdraw', otp);
    if (!stepUp.ok) {
      return { success: false, needsOtp: true, message: stepUp.error };
    }
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

  const result = data as {
    ok?: boolean;
    error?: string;
    destination_phone?: string | null;
    status?: string;
  } | null;
  if (!result?.ok) {
    const code = result?.error ?? 'FAILED';
    const messages: Record<string, string> = {
      KYC_REQUIRED: 'KYC approval required for withdrawals of 20,000+.',
      RISK_BLOCKED: 'Withdrawal blocked by risk controls. Contact support.',
      PHONE_REQUIRED: 'Provide an E.164 M-Pesa phone number.',
      DESTINATION_REQUIRED:
        'Link your M-Pesa number on Profile before withdrawing.',
      DESTINATION_MISMATCH:
        'Withdrawals must go to your linked M-Pesa number. Update it on Profile if needed.',
      BANK_DETAILS_REQUIRED: 'Provide bank name, account name, and account number.',
      INVALID_AMOUNT: 'Amount must be between 100 and 5,000,000.',
    };
    return { success: false, message: messages[code] ?? `Withdrawal failed (${code}).` };
  }

  revalidatePath('/wallet');
  revalidatePath('/notifications');
  const dest =
    typeof result.destination_phone === 'string' && result.destination_phone
      ? result.destination_phone
      : phone || null;
  const destBit = dest ? ` to ${dest}` : '';
  return {
    success: true,
    message:
      destinationType === 'mpesa'
        ? `Withdrawal requested${destBit}. An admin will approve & send — money arrives on M-Pesa (no PIN prompt). Watch status below.`
        : 'Withdrawal requested. Pending admin processing.',
  };
}

export async function processWithdrawalAction(formData: FormData): Promise<void> {
  const withdrawalId = String(formData.get('withdrawalId') ?? '');
  const approve = String(formData.get('approve') ?? 'true') === 'true';
  if (!withdrawalId) {
    redirect(withNoticeQuery('/admin/withdrawals', 'Missing withdrawal.', 'error'));
  }

  const { data, error } = await callRpc('propose_process_withdrawal', {
    p_withdrawal_id: withdrawalId,
    p_approve: approve,
    p_provider_reference: approve ? `manual:${withdrawalId}` : null,
    p_error_message: approve ? null : 'Rejected by admin',
  });

  revalidatePath('/admin/withdrawals');
  revalidatePath('/wallet');

  if (error) {
    redirect(withNoticeQuery('/admin/withdrawals', error.message, 'error'));
  }

  const result = data as {
    ok?: boolean;
    error?: string;
    pending_dual_approval?: boolean;
    ready_to_disburse?: boolean;
    withdrawal_id?: string;
  } | null;

  if (result?.pending_dual_approval) {
    redirect(
      withNoticeQuery(
        '/admin/withdrawals',
        'First approval recorded. A different admin must second-approve before send.',
        'info',
      ),
    );
  }

  if (!result?.ok) {
    const code = result?.error ?? 'FAILED';
    const message =
      code === 'SECOND_APPROVER_MUST_DIFFER'
        ? 'A different admin must second-approve. You already gave the first approval.'
        : `Could not process withdrawal (${code}).`;
    redirect(withNoticeQuery('/admin/withdrawals', message, 'error'));
  }

  if (!approve) {
    redirect(withNoticeQuery('/admin/withdrawals', 'Withdrawal rejected.', 'success'));
  }

  if (result.ready_to_disburse) {
    const { createClient } = await import('@/lib/supabase/server');
    const { runWithdrawalDisbursement } = await import(
      '@/lib/payments/disburse-withdrawal'
    );
    const supabase = await createClient();
    const { data: row } = await supabase
      .from('withdrawal_requests')
      .select(
        'id, user_id, amount, currency, status, destination_type, destination_phone, provider_reference, metadata',
      )
      .eq('id', result.withdrawal_id ?? withdrawalId)
      .maybeSingle();

    if (!row) {
      redirect(withNoticeQuery('/admin/withdrawals', 'Withdrawal not found.', 'error'));
    }

    const sent = await runWithdrawalDisbursement(
      row as {
        id: string;
        user_id: string;
        amount: number;
        currency: string;
        status: string;
        destination_type: string;
        destination_phone: string | null;
        provider_reference: string | null;
        metadata: Record<string, unknown> | null;
      },
    );

    revalidatePath('/admin/withdrawals');
    revalidatePath('/wallet');

    if (!sent.ok) {
      redirect(withNoticeQuery('/admin/withdrawals', sent.error, 'error'));
    }
    redirect(
      withNoticeQuery(
        '/admin/withdrawals',
        sent.message,
        sent.status === 'completed' ? 'success' : 'info',
      ),
    );
  }

  redirect(
    withNoticeQuery('/admin/withdrawals', 'Withdrawal processed.', 'success'),
  );
}

export async function confirmDualApprovalAction(formData: FormData): Promise<void> {
  const requestId = String(formData.get('requestId') ?? '');
  const approve = String(formData.get('approve') ?? 'true') === 'true';
  if (!requestId) {
    redirect(withNoticeQuery('/admin/withdrawals', 'Missing approval request.', 'error'));
  }

  const { data, error } = await callRpc('confirm_dual_approval', {
    p_request_id: requestId,
    p_approve: approve,
  });

  revalidatePath('/admin/withdrawals');
  revalidatePath('/wallet');

  if (error) {
    redirect(withNoticeQuery('/admin/withdrawals', error.message, 'error'));
  }
  const result = data as {
    ok?: boolean;
    error?: string;
    status?: string;
    ready_to_disburse?: boolean;
    withdrawal_id?: string;
  } | null;
  if (!result?.ok) {
    const code = result?.error ?? 'Could not complete second approval.';
    const message =
      code === 'SECOND_APPROVER_MUST_DIFFER'
        ? 'A different admin must second-approve. You already gave the first approval.'
        : code === 'FORBIDDEN'
          ? 'You do not have permission to second-approve this request.'
          : code;
    redirect(withNoticeQuery('/admin/withdrawals', message, 'error'));
  }

  if (approve && result.ready_to_disburse && result.withdrawal_id) {
    const { createClient } = await import('@/lib/supabase/server');
    const { runWithdrawalDisbursement } = await import(
      '@/lib/payments/disburse-withdrawal'
    );
    const supabase = await createClient();
    const { data: row } = await supabase
      .from('withdrawal_requests')
      .select(
        'id, user_id, amount, currency, status, destination_type, destination_phone, provider_reference, metadata',
      )
      .eq('id', result.withdrawal_id)
      .maybeSingle();

    if (row) {
      const sent = await runWithdrawalDisbursement(
        row as {
          id: string;
          user_id: string;
          amount: number;
          currency: string;
          status: string;
          destination_type: string;
          destination_phone: string | null;
          provider_reference: string | null;
          metadata: Record<string, unknown> | null;
        },
      );
      revalidatePath('/admin/withdrawals');
      revalidatePath('/wallet');
      if (!sent.ok) {
        redirect(withNoticeQuery('/admin/withdrawals', sent.error, 'error'));
      }
      redirect(
        withNoticeQuery(
          '/admin/withdrawals',
          sent.message,
          sent.status === 'completed' ? 'success' : 'info',
        ),
      );
    }
  }

  redirect(
    withNoticeQuery(
      '/admin/withdrawals',
      approve ? 'Second approval recorded.' : 'Request rejected.',
      'success',
    ),
  );
}

/** Circle payout cashout → orchestrator B2C (or simulated complete). */
export async function processPayoutCashoutAction(formData: FormData): Promise<void> {
  const withdrawalId = String(formData.get('withdrawalId') ?? '');
  if (!withdrawalId) return;

  const { createClient } = await import('@/lib/supabase/server');
  const { runWithdrawalDisbursement, shouldUseLiveDisburse } = await import(
    '@/lib/payments/disburse-withdrawal'
  );
  const supabase = await createClient();
  const { data: row } = await supabase
    .from('withdrawal_requests')
    .select(
      'id, user_id, amount, currency, status, destination_type, destination_phone, provider_reference, metadata',
    )
    .eq('id', withdrawalId)
    .maybeSingle();

  if (row && shouldUseLiveDisburse()) {
    const sent = await runWithdrawalDisbursement(
      row as {
        id: string;
        user_id: string;
        amount: number;
        currency: string;
        status: string;
        destination_type: string;
        destination_phone: string | null;
        provider_reference: string | null;
        metadata: Record<string, unknown> | null;
      },
      { narrative: 'Jameiyah circle payout cashout' },
    );
    revalidatePath('/admin/withdrawals');
    revalidatePath('/wallet');
    if (!sent.ok) {
      redirect(withNoticeQuery('/admin/withdrawals', sent.error, 'error'));
    }
    redirect(
      withNoticeQuery(
        '/admin/withdrawals',
        sent.message,
        sent.status === 'completed' ? 'success' : 'info',
      ),
    );
  }

  await callRpc('process_payout_cashout', {
    p_withdrawal_id: withdrawalId,
    p_simulate: true,
  });

  revalidatePath('/admin/withdrawals');
  revalidatePath('/wallet');
  redirect(
    withNoticeQuery('/admin/withdrawals', 'Payout cashout simulated.', 'success'),
  );
}
