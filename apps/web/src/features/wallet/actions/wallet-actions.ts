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

  if (!Number.isFinite(amount) || amount < 100) {
    return { success: false, message: 'Enter an amount of at least 100.' };
  }

  if (provider === 'mpesa' && phoneRaw && !toE164Kenya(phoneRaw)) {
    return {
      success: false,
      message: 'Use a Kenya mobile, e.g. 0712345678 or +254712345678.',
    };
  }

  const otp = String(formData.get('otp') ?? '').replace(/\D/g, '').slice(0, 6);
  const challenge = String(formData.get('otp_challenge') ?? '') === '1';
  const resend = String(formData.get('resend_otp') ?? '') === '1';
  const { sendWalletStepUpOtp, consumeWalletStepUpOtp } = await import(
    '@/lib/wallet/step-up'
  );
  const skipStepUp = provider === 'simulated' && !requireReal;
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

  if (provider === 'mpesa' && !/^\+[1-9]\d{7,14}$/.test(phone)) {
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
      message: 'Simulated payments disabled. Set PAYMENT_PROVIDER=mpesa|bank|paystack.',
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

  if (provider === 'simulated') {
    const { data: completeData, error: completeError } = await callRpc(
      'complete_payment_intent',
      {
        p_intent_id: created.intent_id,
        p_provider_reference: `sim:${created.intent_id}`,
        p_metadata: { source: 'simulated' },
      },
    );

    if (completeError) {
      return { success: false, message: completeError.message };
    }

    const completed = completeData as { ok?: boolean; error?: string } | null;
    if (!completed?.ok) {
      return {
        success: false,
        message: completed?.error ?? 'Failed to credit wallet.',
      };
    }

    revalidatePath('/wallet');
    revalidatePath('/dashboard');
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
      message: 'Wallet topped up (simulated payment).',
      intentId: created.intent_id,
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

  if (provider === 'paystack') {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    const { initializePaystackTransaction } = await import('@/lib/payments/paystack');
    const init = await initializePaystackTransaction({
      intentId: created.intent_id,
      amount,
      currency,
      email: user?.email,
      phone: phone || user?.phone || null,
      userId: user?.id,
      metadata: {
        kind: 'wallet_top_up',
        ...(returnPath ? { return_path: returnPath } : {}),
      },
    });
    if (!init.ok) {
      return {
        success: false,
        message: `Checkout failed: ${init.error}`,
        intentId: created.intent_id,
      };
    }

    redirect(init.authorization_url);
  }

  // M-Pesa STK via Edge Function
  const { invokeMpesaStk } = await import('@/lib/payments/mpesa');
  const stk = await invokeMpesaStk({
    intentId: created.intent_id,
    amount,
    phone,
    description: 'Amanah top-up',
  });

  revalidatePath('/wallet');
  revalidatePath('/dashboard');

  if (!stk.ok) {
    return {
      success: false,
      message: stk.error
        ? `M-Pesa failed: ${stk.error}`
        : 'Could not start M-Pesa prompt. Try again.',
      intentId: created.intent_id,
    };
  }

  if (stk.fallback === 'simulated') {
    return {
      success: true,
      message:
        'Wallet topped up (M-Pesa sandbox not configured — simulated completion).',
      intentId: created.intent_id,
    };
  }

  return {
    success: true,
    message:
      stk.customer_message ??
      'M-Pesa prompt sent. Approve on your phone to complete top-up.',
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

  if (created.provider === 'mpesa' && created.phone) {
    const { invokeMpesaStk } = await import('@/lib/payments/mpesa');
    const stk = await invokeMpesaStk({
      intentId: created.intent_id,
      amount: Number(created.amount ?? 0),
      phone: created.phone,
    });
    revalidatePath('/wallet');
    revalidatePath('/dashboard');
    if (!stk.ok) {
      return {
        success: false,
        message: stk.error ?? 'Could not start M-Pesa retry.',
        intentId: created.intent_id,
      };
    }
    return {
      success: true,
      message: stk.customer_message ?? 'M-Pesa prompt re-sent.',
      intentId: created.intent_id,
    };
  }

  if (created.provider === 'paystack') {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    const { initializePaystackTransaction } = await import('@/lib/payments/paystack');
    const init = await initializePaystackTransaction({
      intentId: created.intent_id,
      amount: Number(created.amount ?? 0),
      email: user?.email,
      phone: created.phone ?? user?.phone ?? null,
      userId: user?.id,
      metadata: { kind: 'wallet_top_up', retry: true },
    });
    if (!init.ok) {
      return {
        success: false,
        message: init.error,
        intentId: created.intent_id,
      };
    }
    redirect(init.authorization_url);
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
  const intentId = String(formData.get('intentId') ?? '');
  if (!intentId) return { success: false, message: 'Missing payment intent.' };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, message: 'Sign in again.' };

  const { data: intent } = await supabase
    .from('payment_intents')
    .select('id, user_id, provider, status, provider_reference')
    .eq('id', intentId)
    .maybeSingle();

  const row = intent as {
    id: string;
    user_id: string;
    provider: string;
    status: string;
    provider_reference: string | null;
  } | null;

  if (!row || row.user_id !== user.id) {
    return { success: false, message: 'Payment not found.' };
  }
  if (row.provider !== 'paystack') {
    return { success: false, message: 'Check status is only for card/M-Pesa checkout payments.' };
  }

  const { paystackReferenceForIntent, settlePaystackReference } = await import(
    '@/lib/payments/paystack'
  );
  const reference = row.provider_reference || paystackReferenceForIntent(intentId);
  const settled = await settlePaystackReference(reference);

  revalidatePath('/wallet');
  revalidatePath('/dashboard');

  if (!settled.ok) {
    return { success: false, message: settled.error ?? 'Could not verify payment yet.' };
  }
  if (settled.status === 'success') {
    return { success: true, message: 'Payment confirmed. Wallet updated.' };
  }
  if (settled.status === 'failed' || settled.status === 'abandoned') {
    return { success: false, message: `Payment marked as ${settled.status}.` };
  }
  return {
    success: false,
    message: 'Still pending. Finish checkout or wait a moment and check again.',
  };
}
