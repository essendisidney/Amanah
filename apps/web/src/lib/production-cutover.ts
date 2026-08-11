/**
 * Production cutover helpers.
 * When REQUIRE_REAL_PROVIDERS=true, simulated payment/bank fallbacks are disabled.
 */

export function requireRealProviders(): boolean {
  return process.env.REQUIRE_REAL_PROVIDERS === 'true';
}

export function isProductionRuntime(): boolean {
  return process.env.NODE_ENV === 'production' || process.env.VERCEL_ENV === 'production';
}

/**
 * Block simulated wallet top-ups only when real providers are required.
 * M-Pesa/Daraja remains optional — demos use PAYMENT_PROVIDER=simulated.
 */
export function shouldBlockSimulatedPayments(): boolean {
  if (process.env.ALLOW_SIMULATED_IN_PROD === 'true') return false;
  return requireRealProviders();
}

export function assertProviderConfigured(provider: 'mpesa' | 'bank' | 'simulated'): void {
  if (provider === 'simulated' && shouldBlockSimulatedPayments()) {
    throw new Error(
      'Simulated payments are disabled in this environment. Set PAYMENT_PROVIDER=mpesa|bank.',
    );
  }
  // Daraja credentials live on Edge Function `payments-mpesa`, not Next.js.
  // Next only needs SUPABASE URL + service role to invoke STK.
  if (provider === 'mpesa') {
    const base =
      process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
    if (!base || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error(
        'M-Pesa requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY to call payments-mpesa.',
      );
    }
  }
  if (provider === 'bank' && requireRealProviders()) {
    if (!process.env.BANK_API_KEY || !process.env.BANK_API_URL) {
      throw new Error('Missing BANK_API_KEY / BANK_API_URL for real bank provider.');
    }
  }
}
