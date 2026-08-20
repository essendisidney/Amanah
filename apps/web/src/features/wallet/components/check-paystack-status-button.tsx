'use client';

import { useActionState } from 'react';
import { Button } from '@jamiya/ui';
import {
  checkPaystackIntentAction,
  type WalletActionState,
} from '../actions/wallet-actions';
import type { Dictionary } from '@/i18n/dictionaries';

const initial: WalletActionState = { success: false, message: '' };

export function CheckPaystackStatusButton({
  intentId,
  labels,
}: {
  intentId: string;
  labels: Pick<Dictionary['walletForms'], 'checkStatus' | 'checkingStatus'>;
}) {
  const [state, action, pending] = useActionState(checkPaystackIntentAction, initial);

  return (
    <form action={action} className="space-y-1 text-right">
      <input type="hidden" name="intentId" value={intentId} />
      <Button type="submit" size="sm" variant="outline" disabled={pending}>
        {pending ? labels.checkingStatus : labels.checkStatus}
      </Button>
      {state.message ? (
        <p className={`text-xs ${state.success ? 'text-primary' : 'text-destructive'}`}>
          {state.message}
        </p>
      ) : null}
    </form>
  );
}
