export type PaymentProviderMode = 'simulated' | 'mpesa' | 'bank' | 'paystack';

export function paymentProvider(): PaymentProviderMode {
  const mode = (process.env.PAYMENT_PROVIDER ?? 'simulated').toLowerCase();
  if (mode === 'mpesa') return 'mpesa';
  if (mode === 'bank') return 'bank';
  if (mode === 'paystack') return 'paystack';
  return 'simulated';
}

export function appBaseUrl(): string {
  return (
    process.env.NEXT_PUBLIC_APP_URL ??
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000')
  ).replace(/\/$/, '');
}
