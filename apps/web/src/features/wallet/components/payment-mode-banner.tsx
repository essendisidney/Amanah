import type { PaymentProviderMode } from '@/lib/payments/provider';

const COPY: Record<
  PaymentProviderMode,
  { title: string; body: string; tone: 'demo' | 'live' | 'warn' } | null
> = {
  simulated: {
    title: 'Demo mode',
    body: 'Top-ups credit your balance instantly for testing — not real M-Pesa.',
    tone: 'demo',
  },
  mpesa: {
    title: 'M-Pesa',
    body: 'Approve the prompt on your phone to add money.',
    tone: 'live',
  },
  // Checkout is obvious from the button — no provider brand banner.
  paystack: null,
  bank: {
    title: 'Bank transfer',
    body: 'Top-ups queue a bank transfer for settlement.',
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
  if (!copy && !requireReal && !simulatedBlocked) return null;

  const toneClass =
    !copy || copy.tone === 'demo'
      ? 'border-accent/35 bg-accent/10 text-foreground'
      : copy.tone === 'warn'
        ? 'border-destructive/40 bg-destructive/10 text-destructive'
        : 'border-primary/30 bg-primary/10 text-foreground';

  if (!copy) {
    return simulatedBlocked || requireReal ? (
      <div className={`amanah-surface px-4 py-3.5 ${toneClass}`} role="status">
        <p className="text-xs opacity-80">
          {simulatedBlocked
            ? 'Simulated fallbacks are blocked in this environment.'
            : 'Live providers required.'}
        </p>
      </div>
    ) : null;
  }

  return (
    <div className={`amanah-surface px-4 py-3.5 ${toneClass}`} role="status">
      <p className="text-sm font-semibold tracking-tight">{copy.title}</p>
      <p className="mt-1 text-sm opacity-90">{copy.body}</p>
      {requireReal || simulatedBlocked ? (
        <p className="mt-2 text-xs opacity-80">
          {simulatedBlocked
            ? 'Simulated fallbacks are blocked in this environment.'
            : 'Live providers required.'}
        </p>
      ) : null}
    </div>
  );
}
