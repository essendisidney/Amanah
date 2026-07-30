'use client';

import { useActionState } from 'react';
import { Button } from '@jamiya/ui';
import {
  retryPaymentIntentAction,
  type WalletActionState,
} from '../actions/wallet-actions';

const initial: WalletActionState = { success: false, message: '' };

export function RetryIntentButton({ intentId }: { intentId: string }) {
  const [state, action, pending] = useActionState(
    async (_prev: WalletActionState, formData: FormData) =>
      retryPaymentIntentAction(_prev, formData),
    initial,
  );

  return (
    <form action={action} className="space-y-2">
      <input type="hidden" name="intentId" value={intentId} />
      <Button type="submit" size="sm" disabled={pending}>
        {pending ? 'Retrying…' : 'Retry'}
      </Button>
      {state.message ? (
        <p className={`text-xs ${state.success ? 'text-primary' : 'text-destructive'}`}>
          {state.message}
        </p>
      ) : null}
    </form>
  );
}
