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
          min={100}
          step={100}
          defaultValue={1000}
          required
        />
      </div>

      <div className="flex gap-2">
        <Button
          type="button"
          size="sm"
          variant={destinationType === 'mpesa' ? 'default' : 'outline'}
          onClick={() => setDestinationType('mpesa')}
        >
          M-Pesa
        </Button>
        <Button
          type="button"
          size="sm"
          variant={destinationType === 'bank' ? 'default' : 'outline'}
          onClick={() => setDestinationType('bank')}
        >
          Bank
        </Button>
      </div>

      {destinationType === 'mpesa' ? (
        <div className="space-y-2">
          <Label htmlFor="phone">M-Pesa phone</Label>
          <Input id="phone" name="phone" type="tel" placeholder="+254712345678" required />
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

      <Button type="submit" variant="outline" disabled={pending}>
        {pending ? 'Submitting…' : 'Request withdrawal'}
      </Button>
    </form>
  );
}
