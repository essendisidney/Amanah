/**
 * Production cutover helpers.
 * When REQUIRE_REAL_PROVIDERS=true, simulated payment/bank fallbacks are disabled.
 * Prefer PAYMENT_PROVIDER=paystack|mpesa in production — simulated is local-only.
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

export function assertProviderConfigured(
  provider: 'mpesa' | 'bank' | 'paystack' | 'intasend' | 'tendepay' | 'simulated',
): void {
  if (provider === 'simulated' && shouldBlockSimulatedPayments()) {
    throw new Error(
      'Simulated payments are disabled in this environment. Set PAYMENT_PROVIDER=mpesa|bank|paystack|intasend|tendepay.',
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
  if (provider === 'paystack') {
    if (!(process.env.PAYSTACK_SECRET_KEY ?? '').trim()) {
      throw new Error('Paystack requires PAYSTACK_SECRET_KEY on the web app.');
    }
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error('Paystack requires SUPABASE_SERVICE_ROLE_KEY to settle payment intents.');
    }
  }
  if (provider === 'intasend') {
    if (
      !(process.env.INTASEND_SECRET_KEY ?? '').trim() ||
      !(process.env.INTASEND_PUBLISHABLE_KEY ?? '').trim()
    ) {
      throw new Error(
        'IntaSend requires INTASEND_SECRET_KEY and INTASEND_PUBLISHABLE_KEY on the web app.',
      );
    }
  }
  if (provider === 'tendepay') {
    if (!(process.env.TENDEPAY_API_KEY ?? '').trim()) {
      throw new Error('TendePay requires TENDEPAY_API_KEY on the web app.');
    }
  }
}
