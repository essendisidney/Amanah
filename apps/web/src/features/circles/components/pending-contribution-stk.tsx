'use client';

import { formatCurrency } from '@jamiya/shared';
import { CheckPaymentStatusButton } from '@/features/wallet/components/check-paystack-status-button';

type PendingIntent = {
  id: string;
  amount: number;
  currency: string;
  phone: string | null;
  status: string;
};

/** Shown after STK starts — waiting for PIN confirmation. */
export function PendingContributionStk({
  intents,
  checkStatus,
  checkingStatus,
}: {
  intents: PendingIntent[];
  checkStatus: string;
  checkingStatus: string;
}) {
  if (intents.length === 0) return null;

  return (
    <section
      id="stk-waiting"
      className="amanah-surface space-y-3 border-primary/30 px-4 py-4 md:px-5"
    >
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">
          M-Pesa
        </p>
        <h2 className="mt-1 text-base font-semibold tracking-tight">
          Waiting for your PIN
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Approve the prompt on your phone. This due marks paid when confirmed.
        </p>
      </div>
      <ul className="divide-y divide-border/60">
        {intents.map((intent) => (
          <li
            key={intent.id}
            className="flex flex-wrap items-center justify-between gap-3 py-3 first:pt-0 last:pb-0"
          >
            <div className="min-w-0">
              <p className="amanah-money text-sm font-semibold">
                {formatCurrency(intent.amount, intent.currency)}
              </p>
              <p className="text-xs capitalize text-muted-foreground">
                {intent.phone ? `${intent.phone} · ` : ''}
                {intent.status}
              </p>
            </div>
            <CheckPaymentStatusButton
              intentId={intent.id}
              labels={{ checkStatus, checkingStatus }}
            />
          </li>
        ))}
      </ul>
    </section>
  );
}
