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

/** Prefer hard cutover automatically in production unless explicitly opted out. */
export function shouldBlockSimulatedPayments(): boolean {
  if (process.env.ALLOW_SIMULATED_IN_PROD === 'true') return false;
  if (requireRealProviders()) return true;
  return isProductionRuntime();
}

export function assertProviderConfigured(provider: 'mpesa' | 'bank' | 'simulated'): void {
  if (provider === 'simulated' && shouldBlockSimulatedPayments()) {
    throw new Error(
      'Simulated payments are disabled in this environment. Set PAYMENT_PROVIDER=mpesa|bank.',
    );
  }
  if (provider === 'mpesa' && requireRealProviders()) {
    const required = [
      'MPESA_CONSUMER_KEY',
      'MPESA_CONSUMER_SECRET',
      'MPESA_SHORTCODE',
      'MPESA_PASSKEY',
      'MPESA_CALLBACK_URL',
    ];
    const missing = required.filter((key) => !process.env[key]);
    if (missing.length > 0) {
      throw new Error(`Missing M-Pesa env: ${missing.join(', ')}`);
    }
  }
  if (provider === 'bank' && requireRealProviders()) {
    if (!process.env.BANK_API_KEY || !process.env.BANK_API_URL) {
      throw new Error('Missing BANK_API_KEY / BANK_API_URL for real bank provider.');
    }
  }
}
