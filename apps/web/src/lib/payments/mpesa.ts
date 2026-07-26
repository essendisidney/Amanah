import { logger } from '@/lib/observability';

export type MpesaStkResult = {
  ok: boolean;
  fallback?: 'simulated';
  checkout_request_id?: string;
  customer_message?: string | null;
  error?: string;
};

/** Invoke Edge Function `payments-mpesa` STK push (service role). */
export async function invokeMpesaStk(input: {
  intentId: string;
  amount: number;
  phone: string;
  description?: string;
}): Promise<MpesaStkResult> {
  const baseUrl =
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL ?? '';
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!baseUrl || !serviceKey) {
    return { ok: false, error: 'Supabase URL or service role key missing.' };
  }

  try {
    const res = await fetch(`${baseUrl}/functions/v1/payments-mpesa`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${serviceKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        action: 'stk_push',
        intent_id: input.intentId,
        amount: input.amount,
        phone: input.phone,
        description: input.description,
      }),
    });

    const json = (await res.json().catch(() => ({}))) as {
      ok?: boolean;
      fallback?: 'simulated';
      checkout_request_id?: string;
      customer_message?: string | null;
      error?: unknown;
    };

    if (!res.ok || !json.ok) {
      const err =
        typeof json.error === 'string'
          ? json.error
          : json.error
            ? JSON.stringify(json.error)
            : `STK HTTP ${res.status}`;
      logger.warn('payments-mpesa stk_push failed', { error: err });
      return { ok: false, error: err };
    }

    return {
      ok: true,
      fallback: json.fallback,
      checkout_request_id: json.checkout_request_id,
      customer_message: json.customer_message ?? null,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.warn('payments-mpesa invoke error', { error: message });
    return { ok: false, error: message };
  }
}

export async function mpesaHealth(): Promise<{
  ok: boolean;
  daraja_configured?: boolean;
  error?: string;
}> {
  const baseUrl =
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL ?? '';
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!baseUrl || !serviceKey) {
    return { ok: false, error: 'Missing Supabase env' };
  }
  try {
    const res = await fetch(`${baseUrl}/functions/v1/payments-mpesa`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${serviceKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ action: 'health' }),
    });
    const json = (await res.json()) as {
      ok?: boolean;
      daraja_configured?: boolean;
      error?: string;
    };
    return {
      ok: Boolean(json.ok),
      daraja_configured: json.daraja_configured,
      error: json.error,
    };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}
