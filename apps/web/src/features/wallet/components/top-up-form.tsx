'use client';

import { useActionState } from 'react';
import { Button, Input, Label } from '@jamiya/ui';
import {
  topUpWalletAction,
  type WalletActionState,
} from '../actions/wallet-actions';
import type { Dictionary } from '@/i18n/dictionaries';
import { t } from '@/i18n/dictionaries';

const initial: WalletActionState = { success: false, message: '' };

export function TopUpForm({
  currency = 'KES',
  provider = 'simulated',
  labels,
}: {
  currency?: string;
  provider?: 'simulated' | 'mpesa' | 'bank' | 'paystack';
  labels: Dictionary['walletForms'];
}) {
  const [state, action, pending] = useActionState(topUpWalletAction, initial);

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="currency" value={currency} />
      <div className="space-y-2">
        <Label htmlFor="amount">{t(labels.amount, { currency })}</Label>
        <Input
          id="amount"
          name="amount"
          type="number"
          inputMode="decimal"
          min={100}
          step={100}
          defaultValue={1000}
          required
          className="h-11 text-base sm:h-10 sm:text-sm"
        />
      </div>
      {provider === 'mpesa' ? (
        <div className="space-y-2">
          <Label htmlFor="phone">{labels.mpesaPhone}</Label>
          <Input
            id="phone"
            name="phone"
            type="tel"
            inputMode="tel"
            placeholder="0712 345 678"
            required
            className="h-11 text-base sm:h-10 sm:text-sm"
          />
        </div>
      ) : provider === 'paystack' ? (
        <p className="text-xs text-muted-foreground">{labels.paystackHint}</p>
      ) : provider === 'bank' ? (
        <p className="text-xs text-muted-foreground">{labels.bankHint}</p>
      ) : (
        <p className="text-xs text-muted-foreground">{labels.simulatedHint}</p>
      )}
      {state.message ? (
        <p
          className={
            state.success ? 'text-sm text-primary' : 'text-sm text-destructive'
          }
          role="status"
        >
          {state.message}
        </p>
      ) : null}
      <Button type="submit" className="min-h-11 w-full" disabled={pending}>
        {pending
          ? labels.processing
          : provider === 'mpesa'
            ? labels.payMpesa
            : provider === 'paystack'
              ? labels.payPaystack
              : provider === 'bank'
                ? labels.startBank
                : labels.topUpWallet}
      </Button>
    </form>
  );
}
