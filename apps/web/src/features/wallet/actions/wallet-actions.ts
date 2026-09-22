'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { toE164Kenya } from '@jamiya/shared';
import { callRpc } from '@/lib/supabase/rpc';
import { createClient } from '@/lib/supabase/server';
import { logger } from '@/lib/observability';
import { paymentProvider } from '@/lib/payments/provider';

export type WalletActionState = {
  success: boolean;
  message: string;
  intentId?: string;
  needsOtp?: boolean;
};

export async function topUpWalletAction(
  _prev: WalletActionState,
  formData: FormData,
): Promise<WalletActionState> {
  const amountRaw = String(formData.get('amount') ?? '');
  const currency = String(formData.get('currency') ?? 'KES').toUpperCase();
  const phoneRaw = String(formData.get('phone') ?? '').trim();
  const phone = phoneRaw ? toE164Kenya(phoneRaw) ?? phoneRaw : '';
  const amount = Number(amountRaw);
  const provider = paymentProvider();
  const requireReal = process.env.REQUIRE_REAL_PROVIDERS === 'true';
  const { getSafeReturnPath, withNoticeQuery } = await import('@/features/auth/lib/types');
  const returnPath = getSafeReturnPath(String(formData.get('next') ?? ''));

  if (!Number.isFinite(amount) || amount < 10) {
    return { success: false, message: 'Enter an amount of at least Ksh 10.' };
  }

  if (
    (provider === 'mpesa' || provider === 'intasend' || provider === 'tendepay') &&
    phoneRaw &&
    !toE164Kenya(phoneRaw)
  ) {
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
  // STK Push already proves phone possession (PIN on handset) — skip Taifa SMS step-up.
  const stkProvider =
    provider === 'mpesa' || provider === 'intasend' || provider === 'tendepay';
  const skipStepUp = (provider === 'simulated' && !requireReal) || stkProvider;
  if (!skipStepUp) {
    if (resend) {
      return sendWalletStepUpOtp('wallet_top_up');
    }
    if (!otp) {
      if (challenge) {
        return {
          success: false,
          needsOtp: true,
          message: 'Enter the 6-digit code from SMS.',
        };
      }
      return sendWalletStepUpOtp('wallet_top_up');
    }
    const stepUp = await consumeWalletStepUpOtp('wallet_top_up', otp);
    if (!stepUp.ok) {
      return { success: false, needsOtp: true, message: stepUp.error };
    }
  }

  if (
    (provider === 'mpesa' || provider === 'intasend' || provider === 'tendepay') &&
    !/^\+[1-9]\d{7,14}$/.test(phone)
  ) {
    return {
      success: false,
      message: 'M-Pesa requires an E.164 phone, e.g. +254712345678.',
    };
  }

  try {
    const { assertProviderConfigured, shouldBlockSimulatedPayments } = await import(
      '@/lib/production-cutover'
    );
    if (provider === 'simulated' && shouldBlockSimulatedPayments()) {
      return {
        success: false,
        message: 'Simulated payments disabled in this environment.',
      };
    }
    assertProviderConfigured(provider);
  } catch (err) {
    return {
      success: false,
      message: err instanceof Error ? err.message : 'Provider misconfigured.',
    };
  }

  if (requireReal && provider === 'simulated') {
    return {
      success: false,
      message:
        'Simulated payments disabled. Set PAYMENT_PROVIDER=mpesa|bank|paystack|intasend.',
    };
  }

  const { data, error } = await callRpc('create_payment_intent', {
    p_amount: amount,
    p_currency: currency,
    p_phone: phone || null,
    p_provider: provider,
    p_idempotency_key: `topup:${provider}:${currency}:${amount}:${Date.now()}`,
    p_metadata: {
      kind: 'wallet_top_up',
      source: 'wallet_ui',
      ...(returnPath ? { return_path: returnPath } : {}),
    },
  });

  if (error) {
    logger.error('create_payment_intent failed', { message: error.message });
    return { success: false, message: error.message };
  }

  const created = data as {
    ok?: boolean;
    error?: string;
    intent_id?: string;
  } | null;

  if (!created?.ok || !created.intent_id) {
    const code = created?.error ?? 'CREATE_FAILED';
    return {
      success: false,
      message:
        code === 'PHONE_REQUIRED'
          ? 'Phone number required for M-Pesa.'
          : code === 'INVALID_AMOUNT'
            ? 'Amount must be between 100 and 10,000,000.'
            : 'Could not start payment.',
    };
  }

  if (provider === 'bank') {
    const baseUrl =
      process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL ?? '';
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (baseUrl && serviceKey) {
      try {
        await fetch(`${baseUrl}/functions/v1/payments-bank`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${serviceKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            action: 'initiate',
            intent_id: created.intent_id,
            amount,
          }),
        });
      } catch (err) {
        logger.warn('bank initiate failed', {
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    revalidatePath('/wallet');
    return {
      success: true,
      message: 'Bank top-up initiated. Funds credit after bank confirmation.',
      intentId: created.intent_id,
    };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { collectPayment } = await import('@/lib/payments/orchestrator');
  const collected = await collectPayment({
    intentId: created.intent_id,
    amount,
    currency,
    phone: phone || user?.phone || null,
    email: user?.email,
    userId: user?.id,
    description: 'Jameiyah wallet top-up',
    metadata: {
      kind: 'wallet_top_up',
      ...(returnPath ? { return_path: returnPath } : {}),
    },
  });

  if (!collected.ok) {
    return {
      success: false,
      message: collected.error,
      intentId: created.intent_id,
    };
  }

  if (collected.redirectUrl) {
    redirect(collected.redirectUrl);
  }

  revalidatePath('/wallet');
  revalidatePath('/dashboard');

  if (collected.status === 'completed') {
    if (returnPath) {
      redirect(
        withNoticeQuery(
          returnPath,
          'Wallet topped up. You can pay your contribution now.',
          'success',
        ),
      );
    }
    return {
      success: true,
      message:
        collected.fallback === 'simulated'
          ? 'Wallet topped up (simulated payment).'
          : (collected.customerMessage ?? 'Wallet topped up.'),
      intentId: created.intent_id,
    };
  }

  return {
    success: true,
    message:
      collected.customerMessage ??
      'Payment started. Approve on your phone if prompted.',
    intentId: created.intent_id,
  };
}

/** Retry a failed/expired/cancelled payment intent (new intent + STK if mpesa). */
export async function retryPaymentIntentAction(
  _prev: WalletActionState,
  formData: FormData,
): Promise<WalletActionState> {
  const intentId = String(formData.get('intentId') ?? '');
  if (!intentId) return { success: false, message: 'Missing payment intent.' };

  const { data, error } = await callRpc('retry_payment_intent', {
    p_intent_id: intentId,
  });
  if (error) {
    logger.error('retry_payment_intent failed', { message: error.message });
    return { success: false, message: error.message };
  }

  const created = data as {
    ok?: boolean;
    error?: string;
    intent_id?: string;
    provider?: string;
    amount?: number;
    phone?: string | null;
  } | null;

  if (!created?.ok || !created.intent_id) {
    return { success: false, message: created?.error ?? 'Retry failed.' };
  }

  if (
    created.provider === 'mpesa' ||
    created.provider === 'intasend' ||
    created.provider === 'tendepay' ||
    created.provider === 'paystack'
  ) {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    const { collectPayment } = await import('@/lib/payments/orchestrator');
    const collected = await collectPayment(
      {
        intentId: created.intent_id,
        amount: Number(created.amount ?? 0),
        phone: created.phone ?? user?.phone ?? null,
        email: user?.email,
        userId: user?.id,
        description: 'Jameiyah wallet top-up',
        metadata: { kind: 'wallet_top_up', retry: true },
      },
      created.provider as 'mpesa' | 'intasend' | 'tendepay' | 'paystack',
    );
    revalidatePath('/wallet');
    revalidatePath('/dashboard');
    if (!collected.ok) {
      return {
        success: false,
        message: collected.error,
        intentId: created.intent_id,
      };
    }
    if (collected.redirectUrl) {
      redirect(collected.redirectUrl);
    }
    return {
      success: true,
      message: collected.customerMessage ?? 'Payment re-started.',
      intentId: created.intent_id,
    };
  }

  if (created.provider === 'simulated') {
    await callRpc('complete_payment_intent', {
      p_intent_id: created.intent_id,
      p_provider_reference: `retry-sim:${created.intent_id}`,
      p_metadata: { source: 'retry_simulated' },
    });
  }

  revalidatePath('/wallet');
  revalidatePath('/dashboard');
  return {
    success: true,
    message: 'Payment retry started.',
    intentId: created.intent_id,
  };
}

/** Re-verify a pending Paystack intent against Paystack and settle if paid. */
export async function checkPaystackIntentAction(
  _prev: WalletActionState,
  formData: FormData,
): Promise<WalletActionState> {
  return checkPaymentIntentAction(_prev, formData);
}

/** Re-verify a pending payment intent (Paystack / IntaSend / TendePay) and settle if paid. */
export async function checkPaymentIntentAction(
  _prev: WalletActionState,
  formData: FormData,
): Promise<WalletActionState> {
  const intentId = String(formData.get('intentId') ?? '');
  if (!intentId) return { success: false, message: 'Missing payment intent.' };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, message: 'Sign in again.' };

  const { data: intent } = await supabase
    .from('payment_intents')
    .select(
      'id, user_id, provider, status, provider_reference, checkout_request_id, metadata',
    )
    .eq('id', intentId)
    .maybeSingle();

  const row = intent as {
    id: string;
    user_id: string;
    provider: string;
    status: string;
    provider_reference: string | null;
    checkout_request_id: string | null;
    metadata: Record<string, unknown> | null;
  } | null;

  if (!row || row.user_id !== user.id) {
    return { success: false, message: 'Payment not found.' };
  }

  const meta = row.metadata ?? {};
  const isContribution = meta.kind === 'contribution';
  const circleSlug = typeof meta.slug === 'string' ? meta.slug : null;

  const revalidateMoneyAndCircle = () => {
    revalidatePath('/wallet');
    revalidatePath('/dashboard');
    if (circleSlug) revalidatePath(`/circles/${circleSlug}`);
  };

  if (row.status === 'completed' || row.status === 'succeeded') {
    return {
      success: true,
      message: isContribution
        ? 'Already paid — your due is up to date.'
        : 'Already credited to your wallet.',
    };
  }

  if (row.provider === 'paystack') {
    const { paystackReferenceForIntent, settlePaystackReference } = await import(
      '@/lib/payments/paystack'
    );
    const reference = row.provider_reference || paystackReferenceForIntent(intentId);
    const settled = await settlePaystackReference(reference);

    revalidateMoneyAndCircle();

    if (!settled.ok) {
      return { success: false, message: settled.error ?? 'Could not verify payment yet.' };
    }
    if (settled.status === 'success') {
      return {
        success: true,
        message: isContribution
          ? 'Payment confirmed. Your due is marked paid.'
          : 'Payment confirmed. Wallet updated.',
      };
    }
    if (settled.status === 'failed' || settled.status === 'abandoned') {
      return { success: false, message: `Payment marked as ${settled.status}.` };
    }
    return {
      success: false,
      message: 'Still pending. Finish checkout or wait a moment and check again.',
    };
  }

  if (row.provider === 'intasend' || row.provider === 'tendepay') {
    const ref =
      row.provider_reference?.trim() ||
      row.checkout_request_id?.trim() ||
      null;
    if (!ref) {
      return {
        success: false,
        message: 'Waiting for the M-Pesa prompt. Approve on your phone, then check again.',
      };
    }

    const { getPaymentStatus } = await import('@/lib/payments/orchestrator');
    const { createServiceRoleClient } = await import('@/lib/supabase/service');
    const status = await getPaymentStatus(
      ref,
      row.provider as 'intasend' | 'tendepay',
    );

    revalidateMoneyAndCircle();

    if (!status.ok) {
      return {
        success: false,
        message: status.error ?? 'Could not verify payment yet. Try again shortly.',
      };
    }

    if (status.status === 'success') {
      const admin = createServiceRoleClient();
      const { error } = await admin.rpc('complete_payment_intent', {
        p_intent_id: intentId,
        p_provider_reference: status.providerReference ?? ref,
        p_checkout_request_id: row.checkout_request_id,
        p_metadata: { source: 'wallet_check_status', provider: row.provider },
      });
      if (error) {
        return { success: false, message: error.message };
      }
      revalidateMoneyAndCircle();
      return {
        success: true,
        message: isContribution
          ? 'Payment confirmed. Your due is marked paid.'
          : 'Payment confirmed. Wallet updated.',
      };
    }

    if (status.status === 'failed') {
      const admin = createServiceRoleClient();
      await admin.rpc('fail_payment_intent', {
        p_intent_id: intentId,
        p_error_message: `${row.provider} reported failed`,
      });
      revalidateMoneyAndCircle();
      return {
        success: false,
        message: 'Payment failed or was cancelled. You can retry from Pay.',
      };
    }

    return {
      success: false,
      message:
        'Still processing. If you already entered your PIN, wait a few seconds and check again.',
    };
  }

  return {
    success: false,
    message: 'Status check is not available for this payment method yet.',
  };
}
