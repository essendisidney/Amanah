'use client';

import { useActionState } from 'react';
import { Button, Input, Label } from '@jamiya/ui';
import {
  topUpWalletAction,
  type WalletActionState,
} from '../actions/wallet-actions';

const initial: WalletActionState = { success: false, message: '' };

export function TopUpForm({
  currency = 'KES',
  provider = 'simulated',
}: {
  currency?: string;
  provider?: 'simulated' | 'mpesa' | 'bank';
}) {
  const [state, action, pending] = useActionState(topUpWalletAction, initial);

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="currency" value={currency} />
      <div className="space-y-2">
        <Label htmlFor="amount">Amount ({currency})</Label>
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
          <Label htmlFor="phone">M-Pesa phone</Label>
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
      ) : provider === 'bank' ? (
        <p className="text-xs text-muted-foreground">
          Bank top-up creates a pending intent for settlement against your bank flow.
        </p>
      ) : (
        <p className="text-xs text-muted-foreground">
          Instant demo wallet credit (no M-Pesa). Use this to pay dues, fund pockets, and repay
          loans while testing.
        </p>
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
          ? 'Processing…'
          : provider === 'mpesa'
            ? 'Pay with M-Pesa'
            : provider === 'bank'
              ? 'Start bank top-up'
              : 'Top up wallet'}
      </Button>
    </form>
  );
}
