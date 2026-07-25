'use client';

import { useRouter } from 'next/navigation';
import type { Route } from 'next';
import { useState, useTransition } from 'react';
import { Alert, AlertDescription, Button } from '@jamiya/ui';
import {
  acceptInvitationAction,
  declineInvitationAction,
} from '../actions/invitation-actions';

export function InvitationDecisionButtons({
  token,
  disabled,
}: {
  token: string;
  disabled?: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="space-y-4">
      {error ? (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}
      {message ? (
        <Alert variant="success">
          <AlertDescription>{message}</AlertDescription>
        </Alert>
      ) : null}

      <div className="flex flex-wrap gap-3">
        <Button
          type="button"
          disabled={disabled || pending}
          onClick={() => {
            setError(null);
            startTransition(async () => {
              const result = await acceptInvitationAction(token);
              if (!result.success) {
                setError(result.message ?? 'Accept failed');
                return;
              }
              setMessage(result.message ?? 'Joined');
              if (result.inviteUrl) {
                router.push(result.inviteUrl as Route);
                router.refresh();
              }
            });
          }}
        >
          {pending ? 'Working…' : 'Accept invitation'}
        </Button>
        <Button
          type="button"
          variant="outline"
          disabled={disabled || pending}
          onClick={() => {
            setError(null);
            startTransition(async () => {
              const result = await declineInvitationAction(token);
              if (!result.success) {
                setError(result.message ?? 'Decline failed');
                return;
              }
              setMessage(result.message ?? 'Declined');
              router.push('/dashboard' as Route);
              router.refresh();
            });
          }}
        >
          Decline
        </Button>
      </div>
    </div>
  );
}
