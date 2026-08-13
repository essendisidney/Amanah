import { createHmac, timingSafeEqual } from 'node:crypto';
import { createServiceRoleClient } from '@/lib/supabase/service';
import { appBaseUrl } from '@/lib/payments/provider';
import { logger } from '@/lib/observability';

const PAYSTACK_API = 'https://api.paystack.co';

export type PaystackInitResult =
  | {
      ok: true;
      authorization_url: string;
      access_code: string;
      reference: string;
    }
  | { ok: false; error: string };

type PaystackVerifyData = {
  status?: string;
  reference?: string;
  amount?: number;
  currency?: string;
  metadata?: Record<string, unknown> | null;
  gateway_response?: string;
  paid_at?: string | null;
};

function secretKey(): string {
  return (process.env.PAYSTACK_SECRET_KEY ?? '').trim();
}

export function isPaystackConfigured(): boolean {
  return Boolean(secretKey());
}

export function paystackReferenceForIntent(intentId: string): string {
  return `amanah_${intentId.replace(/-/g, '')}`;
}

export function intentIdFromPaystackReference(reference: string): string | null {
  const raw = reference.trim();
  if (!raw.startsWith('amanah_') || raw.length !== 'amanah_'.length + 32) return null;
  const hex = raw.slice('amanah_'.length);
  if (!/^[0-9a-f]{32}$/i.test(hex)) return null;
  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    hex.slice(12, 16),
    hex.slice(16, 20),
    hex.slice(20),
  ].join('-');
}

/** Amount in major units (KES) → Paystack subunit (cents). */
export function toPaystackAmount(amount: number): number {
  return Math.round(Number(amount) * 100);
}

/**
 * Paystack rejects phone-OTP synthetic emails (`*@amanah.internal`) and `.local`.
 * Map those to a valid customer email while keeping phone in metadata.
 */
export function resolvePaystackCustomerEmail(input: {
  email?: string | null;
  phone?: string | null;
  userId?: string | null;
}): string | null {
  const candidate = (input.email ?? '').trim().toLowerCase();
  if (candidate && isPaystackAcceptableEmail(candidate)) {
    return candidate;
  }

  const phoneDigits = (input.phone ?? '').replace(/\D/g, '');
  if (phoneDigits.length >= 9) {
    return `${phoneDigits}@customers.amanah.app`;
  }

  const internalMatch = candidate.match(/^(\d{9,15})@amanah\.internal$/);
  if (internalMatch) {
    return `${internalMatch[1]}@customers.amanah.app`;
  }

  const userId = (input.userId ?? '').replace(/-/g, '');
  if (userId.length >= 8) {
    return `user-${userId.slice(0, 16)}@customers.amanah.app`;
  }

  return null;
}

function isPaystackAcceptableEmail(email: string): boolean {
  if (!/^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(email)) return false;
  if (email.endsWith('.internal') || email.endsWith('.local')) return false;
  if (email.includes('@amanah.internal')) return false;
  if (email.includes('@amanah.paystack.local')) return false;
  return true;
}

export function verifyPaystackSignature(rawBody: string, signature: string | null): boolean {
  const key = secretKey();
  if (!key || !signature) return false;
  const hash = createHmac('sha512', key).update(rawBody).digest('hex');
  try {
    const a = Buffer.from(hash, 'utf8');
    const b = Buffer.from(signature, 'utf8');
    return a.length === b.length && timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

export async function initializePaystackTransaction(input: {
  intentId: string;
  amount: number;
  currency?: string;
  email?: string | null;
  phone?: string | null;
  userId?: string | null;
  callbackPath?: string;
  metadata?: Record<string, unknown>;
}): Promise<PaystackInitResult> {
  const key = secretKey();
  if (!key) return { ok: false, error: 'PAYSTACK_SECRET_KEY is not configured.' };

  const email = resolvePaystackCustomerEmail({
    email: input.email,
    phone: input.phone,
    userId: input.userId,
  });
  if (!email) {
    return {
      ok: false,
      error: 'A valid customer email or phone is required for Paystack.',
    };
  }

  const reference = paystackReferenceForIntent(input.intentId);
  const callbackUrl = `${appBaseUrl()}${input.callbackPath ?? '/api/payments/paystack/callback'}`;

  const res = await fetch(`${PAYSTACK_API}/transaction/initialize`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      email,
      amount: toPaystackAmount(input.amount),
      currency: (input.currency ?? 'KES').toUpperCase(),
      reference,
      callback_url: callbackUrl,
      channels: ['card', 'mobile_money', 'bank', 'ussd', 'bank_transfer'],
      metadata: {
        intent_id: input.intentId,
        phone: input.phone ?? undefined,
        ...input.metadata,
      },
    }),
  });

  const json = (await res.json().catch(() => ({}))) as {
    status?: boolean;
    message?: string;
    data?: {
      authorization_url?: string;
      access_code?: string;
      reference?: string;
    };
  };

  if (!res.ok || !json.status || !json.data?.authorization_url || !json.data.reference) {
    const err = json.message ?? `Paystack initialize HTTP ${res.status}`;
    logger.warn('paystack initialize failed', { error: err, intentId: input.intentId });
    return { ok: false, error: err };
  }

  const admin = createServiceRoleClient();
  const { error: markError } = await admin.rpc('mark_payment_intent_processing', {
    p_intent_id: input.intentId,
    p_checkout_request_id: json.data.access_code ?? null,
    p_merchant_request_id: null,
    p_provider_reference: json.data.reference,
  });
  if (markError) {
    logger.warn('mark_payment_intent_processing failed', { error: markError.message });
  }

  return {
    ok: true,
    authorization_url: json.data.authorization_url,
    access_code: json.data.access_code ?? '',
    reference: json.data.reference,
  };
}

export async function verifyPaystackTransaction(
  reference: string,
): Promise<{ ok: boolean; data?: PaystackVerifyData; error?: string }> {
  const key = secretKey();
  if (!key) return { ok: false, error: 'PAYSTACK_SECRET_KEY is not configured.' };

  const res = await fetch(
    `${PAYSTACK_API}/transaction/verify/${encodeURIComponent(reference)}`,
    {
      headers: { Authorization: `Bearer ${key}` },
      cache: 'no-store',
    },
  );
  const json = (await res.json().catch(() => ({}))) as {
    status?: boolean;
    message?: string;
    data?: PaystackVerifyData;
  };
  if (!res.ok || !json.status || !json.data) {
    return { ok: false, error: json.message ?? `Verify HTTP ${res.status}` };
  }
  return { ok: true, data: json.data };
}

/** Verify with Paystack API and settle the matching payment intent (service role). */
export async function settlePaystackReference(
  reference: string,
): Promise<{ ok: boolean; intentId?: string; status?: string; error?: string }> {
  const verified = await verifyPaystackTransaction(reference);
  if (!verified.ok || !verified.data) {
    return { ok: false, error: verified.error ?? 'VERIFY_FAILED' };
  }

  const intentId =
    (typeof verified.data.metadata?.intent_id === 'string'
      ? verified.data.metadata.intent_id
      : null) ?? intentIdFromPaystackReference(reference);

  if (!intentId) {
    return { ok: false, error: 'INTENT_NOT_FOUND' };
  }

  const admin = createServiceRoleClient();
  const status = (verified.data.status ?? '').toLowerCase();

  if (status === 'success') {
    const { data, error } = await admin.rpc('complete_payment_intent', {
      p_intent_id: intentId,
      p_provider_reference: reference,
      p_checkout_request_id: null,
      p_metadata: {
        source: 'paystack',
        gateway_response: verified.data.gateway_response ?? null,
        paid_at: verified.data.paid_at ?? null,
        amount_subunit: verified.data.amount ?? null,
        currency: verified.data.currency ?? null,
      },
    });
    if (error) return { ok: false, intentId, error: error.message };
    const result = data as {
      ok?: boolean;
      error?: string;
      already_completed?: boolean;
    } | null;
    if (!result?.ok) {
      return { ok: false, intentId, error: result?.error ?? 'COMPLETE_FAILED' };
    }
    return { ok: true, intentId, status: 'success' };
  }

  if (status === 'failed' || status === 'abandoned') {
    await admin.rpc('fail_payment_intent', {
      p_intent_id: intentId,
      p_error_message: verified.data.gateway_response ?? `Paystack ${status}`,
    });
    return { ok: true, intentId, status };
  }

  return { ok: true, intentId, status: status || 'pending' };
}
