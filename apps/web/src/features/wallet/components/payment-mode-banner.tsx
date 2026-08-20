import type { PaymentProviderMode } from '@/lib/payments/provider';

const COPY: Record<
  PaymentProviderMode,
  { title: string; body: string; tone: 'demo' | 'live' | 'warn' }
> = {
  simulated: {
    title: 'Payment mode · Demo (UAT)',
    body: 'Top-ups credit your wallet instantly for testing. Not real M-Pesa or card money.',
    tone: 'demo',
  },
  mpesa: {
    title: 'Payment mode · M-Pesa STK',
    body: 'Top-ups send a Safaricom prompt to your phone. Approve to fund your Amanah wallet.',
    tone: 'live',
  },
  paystack: {
    title: 'Payment mode · Paystack',
    body: 'Top-ups open a Paystack checkout. Funds settle into your wallet after confirmation.',
    tone: 'live',
  },
  bank: {
    title: 'Payment mode · Bank transfer',
    body: 'Top-ups queue a bank transfer job. Settlement depends on your banking rails.',
    tone: 'live',
  },
};

export function PaymentModeBanner({
  provider,
  requireReal,
  simulatedBlocked,
}: {
  provider: PaymentProviderMode;
  requireReal: boolean;
  simulatedBlocked: boolean;
}) {
  const copy = COPY[provider];
  const toneClass =
    copy.tone === 'demo'
      ? 'border-accent/35 bg-accent/10 text-foreground'
      : copy.tone === 'warn'
        ? 'border-destructive/40 bg-destructive/10 text-destructive'
        : 'border-primary/30 bg-primary/10 text-foreground';

  return (
    <div className={`amanah-surface px-4 py-3.5 ${toneClass}`} role="status">
      <p className="text-sm font-semibold tracking-tight">{copy.title}</p>
      <p className="mt-1 text-sm opacity-90">{copy.body}</p>
      {requireReal || simulatedBlocked ? (
        <p className="mt-2 text-xs opacity-80">
          {simulatedBlocked
            ? 'Simulated fallbacks are blocked in this environment.'
            : 'Live providers required (REQUIRE_REAL_PROVIDERS).'}
        </p>
      ) : null}
    </div>
  );
}
