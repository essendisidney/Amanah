'use client';

import { useActionState } from 'react';
import { Alert, AlertDescription, Button, Input, Label } from '@jamiya/ui';
import { createInvitationAction } from '../actions/invitation-actions';
import { initialActionState } from '../lib/action-state';

export function InviteMemberForm({
  jamiyaId,
}: {
  jamiyaId: string;
}) {
  const [state, formAction, pending] = useActionState(
    createInvitationAction,
    initialActionState,
  );

  return (
    <div className="space-y-4">
      {state.message ? (
        <Alert variant={state.success ? 'success' : 'destructive'}>
          <AlertDescription>
            {state.message}
            {state.inviteUrl ? (
              <span className="mt-2 block break-all text-xs text-foreground">
                Invite link: {state.inviteUrl}
              </span>
            ) : null}
          </AlertDescription>
        </Alert>
      ) : null}

      <form action={formAction} className="space-y-4">
        <input type="hidden" name="jamiyaId" value={jamiyaId} />
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            name="email"
            type="email"
            placeholder="member@example.com"
            autoComplete="email"
          />
          {state.fieldErrors?.email?.[0] ? (
            <p className="text-sm text-destructive">{state.fieldErrors.email[0]}</p>
          ) : null}
        </div>
        <div className="space-y-2">
          <Label htmlFor="phone">Phone (optional)</Label>
          <Input
            id="phone"
            name="phone"
            type="tel"
            placeholder="+254712345678"
            autoComplete="tel"
          />
          {state.fieldErrors?.phone?.[0] ? (
            <p className="text-sm text-destructive">{state.fieldErrors.phone[0]}</p>
          ) : null}
        </div>
        <Button type="submit" disabled={pending}>
          {pending ? 'Creating invite…' : 'Create invitation'}
        </Button>
      </form>
    </div>
  );
}
