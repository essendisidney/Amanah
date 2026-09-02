export type BankHealthResult = {
  ok: boolean;
  bank_configured?: boolean;
  require_real?: boolean;
  simulated_fallback?: boolean;
  error?: string;
  hint?: string | null;
};

/** Probe Edge Function `payments-bank` health (service role). */
export async function bankHealth(): Promise<BankHealthResult> {
  const baseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL ?? '';
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!baseUrl || !serviceKey) {
    return { ok: false, error: 'Missing Supabase env' };
  }

  try {
    const res = await fetch(`${baseUrl}/functions/v1/payments-bank`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${serviceKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ action: 'health' }),
    });
    const data = (await res.json().catch(() => ({}))) as BankHealthResult & {
      error?: string;
    };
    if (!res.ok) {
      return {
        ok: false,
        error: data.error ?? `BANK_HTTP_${res.status}`,
        hint: data.hint ?? null,
      };
    }
    return {
      ok: Boolean(data.ok),
      bank_configured: Boolean(data.bank_configured),
      require_real: Boolean(data.require_real),
      simulated_fallback: Boolean(data.simulated_fallback),
      hint: data.hint ?? null,
    };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'BANK_HEALTH_FAILED',
    };
  }
}
