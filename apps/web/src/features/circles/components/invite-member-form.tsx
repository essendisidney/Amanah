'use client';

import { useActionState, useEffect, useRef } from 'react';
import { Alert, AlertDescription, Button, Input, Label } from '@jamiya/ui';
import { createInvitationAction } from '../actions/invitation-actions';
import { initialActionState } from '../lib/action-state';
import { InviteSharePanel } from './invite-share-panel';

export function InviteMemberForm({
  jamiyaId,
  circleName,
}: {
  jamiyaId: string;
  circleName?: string;
}) {
  const [state, formAction, pending] = useActionState(
    createInvitationAction,
    initialActionState,
  );
  const shareRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (state.success && state.inviteUrl && state.inviteCode) {
      shareRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [state.success, state.inviteUrl, state.inviteCode]);

  return (
    <div className="space-y-4">
      {state.message ? (
        <Alert variant={state.success ? 'success' : 'destructive'}>
          <AlertDescription>{state.message}</AlertDescription>
        </Alert>
      ) : null}

      <form action={formAction} className="space-y-4">
        <input type="hidden" name="jamiyaId" value={jamiyaId} />
        <div className="space-y-2">
          <Label htmlFor="phone">Phone</Label>
          <Input
            id="phone"
            name="phone"
            type="tel"
            placeholder="+254712345678 or 0712345678"
            autoComplete="tel"
          />
          {state.fieldErrors?.phone?.[0] ? (
            <p className="text-sm text-destructive">{state.fieldErrors.phone[0]}</p>
          ) : null}
        </div>
        <div className="space-y-2">
          <Label htmlFor="email">Email (optional)</Label>
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
        <Button type="submit" disabled={pending} className="min-h-11">
          {pending ? 'Creating invite…' : 'Create invitation'}
        </Button>
      </form>

      {state.success && state.inviteUrl && state.inviteCode ? (
        <div ref={shareRef}>
          <InviteSharePanel
            inviteUrl={state.inviteUrl}
            inviteCode={state.inviteCode}
            circleName={circleName}
          />
        </div>
      ) : null}
    </div>
  );
}
