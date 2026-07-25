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
          min={100}
          step={100}
          defaultValue={1000}
          required
        />
      </div>
      {provider === 'mpesa' ? (
        <div className="space-y-2">
          <Label htmlFor="phone">M-Pesa phone</Label>
          <Input
            id="phone"
            name="phone"
            type="tel"
            placeholder="+254712345678"
            required
          />
        </div>
      ) : provider === 'bank' ? (
        <p className="text-xs text-muted-foreground">
          Bank top-up creates a pending intent for settlement against your bank flow.
        </p>
      ) : (
        <p className="text-xs text-muted-foreground">
          Simulated funding (set <code>PAYMENT_PROVIDER=mpesa</code> or{' '}
          <code>bank</code>).
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
      <Button type="submit" disabled={pending}>
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
