'use client';

import { useActionState, useState } from 'react';
import { Button, Input, Label } from '@jamiya/ui';
import {
  requestWithdrawalAction,
  type WithdrawalActionState,
} from '../actions/withdrawal-actions';

const initial: WithdrawalActionState = { success: false, message: '' };

export function WithdrawalForm({ currency = 'KES' }: { currency?: string }) {
  const [state, action, pending] = useActionState(requestWithdrawalAction, initial);
  const [destinationType, setDestinationType] = useState<'mpesa' | 'bank'>('mpesa');

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="currency" value={currency} />
      <input type="hidden" name="destinationType" value={destinationType} />

      <div className="space-y-2">
        <Label htmlFor="withdraw-amount">Amount ({currency})</Label>
        <Input
          id="withdraw-amount"
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

      <div className="grid grid-cols-2 gap-2">
        <Button
          type="button"
          className="min-h-11"
          variant={destinationType === 'mpesa' ? 'default' : 'outline'}
          onClick={() => setDestinationType('mpesa')}
        >
          M-Pesa
        </Button>
        <Button
          type="button"
          className="min-h-11"
          variant={destinationType === 'bank' ? 'default' : 'outline'}
          onClick={() => setDestinationType('bank')}
        >
          Bank
        </Button>
      </div>

      {destinationType === 'mpesa' ? (
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
      ) : (
        <>
          <div className="space-y-2">
            <Label htmlFor="bankName">Bank name</Label>
            <Input id="bankName" name="bankName" required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="bankAccountName">Account name</Label>
            <Input id="bankAccountName" name="bankAccountName" required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="bankAccountNumber">Account number</Label>
            <Input id="bankAccountNumber" name="bankAccountNumber" required />
          </div>
        </>
      )}

      {state.message ? (
        <p
          className={
            state.success ? 'text-sm text-primary' : 'text-sm text-destructive'
          }
        >
          {state.message}
        </p>
      ) : null}

      <Button type="submit" variant="outline" className="min-h-11 w-full" disabled={pending}>
        {pending ? 'Submitting…' : 'Request withdrawal'}
      </Button>
    </form>
  );
}
