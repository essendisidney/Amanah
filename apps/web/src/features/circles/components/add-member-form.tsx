'use client';

import { useActionState } from 'react';
import { Alert, AlertDescription, Button, Input, Label } from '@jamiya/ui';
import { addMemberAction } from '../actions/add-member';
import { initialActionState } from '../lib/action-state';
import { InviteSharePanel } from './invite-share-panel';

export function AddMemberForm({
  jamiyaId,
  circleName,
}: {
  jamiyaId: string;
  circleName?: string;
}) {
  const [state, formAction, pending] = useActionState(
    addMemberAction,
    initialActionState,
  );

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Existing Amanah users join immediately. New people get an account invite and a
        reserved seat — share the claim link with them.
      </p>

      {state.message ? (
        <Alert variant={state.success ? 'success' : 'destructive'}>
          <AlertDescription>{state.message}</AlertDescription>
        </Alert>
      ) : null}

      {state.success && state.inviteUrl && state.inviteCode ? (
        <InviteSharePanel
          inviteUrl={state.inviteUrl}
          inviteCode={state.inviteCode}
          circleName={circleName}
        />
      ) : null}

      <form action={formAction} className="space-y-4">
        <input type="hidden" name="jamiyaId" value={jamiyaId} />
        <div className="space-y-2">
          <Label htmlFor="fullName">Full name (optional)</Label>
          <Input
            id="fullName"
            name="fullName"
            type="text"
            placeholder="Amina Wanjiku"
            autoComplete="name"
          />
        </div>
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
          <p className="text-[11px] text-muted-foreground">
            Email is required when the person is not already on Amanah.
          </p>
        </div>
        <Button type="submit" disabled={pending}>
          {pending ? 'Adding…' : 'Add member'}
        </Button>
      </form>
    </div>
  );
}
