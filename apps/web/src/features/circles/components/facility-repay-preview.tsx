'use client';

import { useEffect, useState } from 'react';
import { formatCurrency } from '@jamiya/shared';

/** Live hint under statement facility repayment fields. */
export function FacilityRepayPreview({
  currency,
  facilityBalance,
}: {
  currency: string;
  facilityBalance: number;
}) {
  const [amount, setAmount] = useState(0);
  const [profit, setProfit] = useState(0);

  useEffect(() => {
    const amountEl = document.getElementById('stmt-repay-amount') as HTMLInputElement | null;
    const profitEl = document.getElementById('stmt-repay-profit') as HTMLInputElement | null;
    const sync = () => {
      setAmount(Number(amountEl?.value || 0));
      setProfit(Number(profitEl?.value || 0));
    };
    amountEl?.addEventListener('input', sync);
    profitEl?.addEventListener('input', sync);
    sync();
    return () => {
      amountEl?.removeEventListener('input', sync);
      profitEl?.removeEventListener('input', sync);
    };
  }, []);

  if (!Number.isFinite(amount) || amount <= 0) {
    return (
      <p className="text-xs text-muted-foreground">
        Tip: fill Amount paid first. Profit portion alone will not save.
      </p>
    );
  }

  const profitClamped = Math.max(0, Math.min(profit, amount));
  const principal = amount - profitClamped;
  const next = Math.max(facilityBalance - principal, 0);
  const over = principal > facilityBalance + 0.001;

  return (
    <p className={`text-xs ${over ? 'text-destructive' : 'text-muted-foreground'}`}>
      {over
        ? `Too much principal — balance is only ${formatCurrency(facilityBalance, currency)}. Save a New facility first or lower the amount.`
        : `Principal ${formatCurrency(principal, currency)} · profit ${formatCurrency(profitClamped, currency)} · balance after ${formatCurrency(next, currency)}.`}
    </p>
  );
}
