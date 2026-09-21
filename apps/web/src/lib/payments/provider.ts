import type { PaymentProviderId } from './types';

export type PaymentProviderMode = PaymentProviderId;

/** @deprecated Prefer `paymentProvider()` from `@/lib/payments/orchestrator`. */
export function paymentProvider(): PaymentProviderId {
  const mode = (process.env.PAYMENT_PROVIDER ?? 'simulated').toLowerCase();
  if (mode === 'mpesa') return 'mpesa';
  if (mode === 'bank') return 'bank';
  if (mode === 'paystack') return 'paystack';
  if (mode === 'intasend') return 'intasend';
  if (mode === 'tendepay') return 'tendepay';
  return 'simulated';
}

export function appBaseUrl(): string {
  return (
    process.env.NEXT_PUBLIC_APP_URL ??
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000')
  ).replace(/\/$/, '');
}
