'use server';

import { revalidatePath } from 'next/cache';
import { callRpc } from '@/lib/supabase/rpc';
import { logger } from '@/lib/observability';

export type CharityActionState = { success: boolean; message: string };

function paymentProvider(): 'simulated' | 'mpesa' | 'bank' {
  const mode = (process.env.PAYMENT_PROVIDER ?? 'simulated').toLowerCase();
  if (mode === 'mpesa') return 'mpesa';
  if (mode === 'bank') return 'bank';
  return 'simulated';
}

async function initiateAndSettleCharityPayment(input: {
  kind: 'sadaka' | 'platform_tip';
  amount: number;
  phone: string;
  metadata: Record<string, unknown>;
}): Promise<CharityActionState & { intentId?: string }> {
  const provider = paymentProvider();
  const requireReal = process.env.REQUIRE_REAL_PROVIDERS === 'true';

  if (provider === 'mpesa' && !/^\+[1-9]\d{7,14}$/.test(input.phone)) {
    return {
      success: false,
      message: 'M-Pesa requires an E.164 phone, e.g. +254712345678.',
    };
  }

  if (requireReal && provider === 'simulated') {
    return {
      success: false,
      message: 'Simulated payments disabled. Set PAYMENT_PROVIDER=mpesa.',
    };
  }

  const { data, error } = await callRpc('create_payment_intent', {
    p_amount: input.amount,
    p_currency: 'KES',
    p_phone: input.phone || null,
    p_provider: provider,
    p_idempotency_key: `${input.kind}:${provider}:${input.amount}:${Date.now()}`,
    p_metadata: { kind: input.kind, ...input.metadata },
  });

  if (error) {
    const msg = error.message.toLowerCase();
    if (msg.includes('unauthenticated') || msg.includes('jwt')) {
      return {
        success: false,
        message: 'Sign in to complete a paid donation.',
      };
    }
    return { success: false, message: error.message };
  }

  const created = data as { ok?: boolean; error?: string; intent_id?: string } | null;
  if (!created?.ok || !created.intent_id) {
    return {
      success: false,
      message:
        created?.error === 'UNAUTHENTICATED'
          ? 'Sign in to complete a paid donation.'
          : created?.error ?? 'Could not start payment.',
    };
  }

  if (provider === 'simulated') {
    const { data: completeData, error: completeError } = await callRpc(
      'complete_payment_intent',
      {
        p_intent_id: created.intent_id,
        p_provider_reference: `sim:${created.intent_id}`,
        p_metadata: { source: 'simulated', kind: input.kind },
      },
    );
    if (completeError) return { success: false, message: completeError.message };
    const completed = completeData as {
      ok?: boolean;
      error?: string;
      receipt_code?: string;
    } | null;
    if (!completed?.ok) {
      return { success: false, message: completed?.error ?? 'Payment completion failed.' };
    }
    return {
      success: true,
      message: completed.receipt_code
        ? `Payment recorded. Receipt: ${completed.receipt_code}`
        : 'Payment recorded. Thank you.',
      intentId: created.intent_id,
    };
  }

  if (provider === 'mpesa') {
    const baseUrl =
      process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL ?? '';
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (baseUrl && serviceKey) {
      try {
        await fetch(`${baseUrl}/functions/v1/payments-mpesa`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${serviceKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            action: 'stk_push',
            intent_id: created.intent_id,
            amount: input.amount,
            phone: input.phone,
          }),
        });
      } catch (err) {
        logger.warn('sadaka stk_push failed', {
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }
    return {
      success: true,
      message: 'M-Pesa prompt sent. Confirm on your phone — receipt arrives when paid.',
      intentId: created.intent_id,
    };
  }

  return {
    success: true,
    message: 'Payment initiated.',
    intentId: created.intent_id,
  };
}

export async function donateAction(formData: FormData): Promise<CharityActionState> {
  const campaignId = String(formData.get('campaignId') ?? '');
  const slug = String(formData.get('slug') ?? '');
  const amount = Number(formData.get('amount'));
  const phone = String(formData.get('donorPhone') ?? '').trim();
  if (!campaignId || !Number.isFinite(amount) || amount < 10) {
    return { success: false, message: 'Enter a donation of at least KES 10.' };
  }

  const paid = await initiateAndSettleCharityPayment({
    kind: 'sadaka',
    amount,
    phone,
    metadata: {
      campaign_id: campaignId,
      donor_name: String(formData.get('donorName') ?? '').trim() || null,
      donor_phone: phone || null,
      donor_email: String(formData.get('donorEmail') ?? '').trim() || null,
      is_anonymous: formData.get('anonymous') === 'on',
    },
  });

  // Fallback for guests on simulated: direct record without intent
  if (!paid.success && paid.message.includes('Sign in')) {
    const { data, error } = await callRpc('record_charity_donation', {
      p_campaign_id: campaignId,
      p_amount: amount,
      p_donor_name: String(formData.get('donorName') ?? '').trim() || null,
      p_donor_phone: phone || null,
      p_donor_email: String(formData.get('donorEmail') ?? '').trim() || null,
      p_is_anonymous: formData.get('anonymous') === 'on',
    });
    if (error) return { success: false, message: error.message };
    const result = data as { ok?: boolean; error?: string; receipt_code?: string } | null;
    if (!result?.ok) {
      return { success: false, message: result?.error ?? 'Could not record donation.' };
    }
    revalidatePath('/sadaka');
    if (slug) revalidatePath(`/sadaka/${slug}`);
    return {
      success: true,
      message: result.receipt_code
        ? `Donation recorded (no STK). Receipt: ${result.receipt_code}`
        : 'Donation recorded. Thank you.',
    };
  }

  if (paid.success) {
    revalidatePath('/sadaka');
    if (slug) revalidatePath(`/sadaka/${slug}`);
  }
  return paid;
}

export async function tipAction(formData: FormData): Promise<CharityActionState> {
  const amount = Number(formData.get('amount'));
  const phone = String(formData.get('phone') ?? '').trim();
  if (!Number.isFinite(amount) || amount < 10) {
    return { success: false, message: 'Enter a tip of at least KES 10.' };
  }

  const paid = await initiateAndSettleCharityPayment({
    kind: 'platform_tip',
    amount,
    phone,
    metadata: {},
  });

  if (!paid.success && paid.message.includes('Sign in')) {
    const { data, error } = await callRpc('record_platform_tip', {
      p_amount: amount,
      p_phone: phone || null,
    });
    if (error) return { success: false, message: error.message };
    const result = data as { ok?: boolean; error?: string } | null;
    if (!result?.ok) {
      return { success: false, message: result?.error ?? 'Could not record tip.' };
    }
    return { success: true, message: 'Tip recorded. Thank you for supporting Amanah.' };
  }

  return paid;
}

export async function donateFormAction(formData: FormData): Promise<void> {
  await donateAction(formData);
}

export async function tipFormAction(formData: FormData): Promise<void> {
  await tipAction(formData);
}
