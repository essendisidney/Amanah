'use client';

import { useActionState } from 'react';
import { Alert, AlertDescription, Button, Input, Label } from '@jamiya/ui';
import { linkMpesaPhoneAction } from '../actions/profile-actions';
import { initialProfileActionState } from '../lib/state';
import type { Dictionary } from '@/i18n/dictionaries';

export function MpesaLinkForm({
  defaultPhone,
  labels,
}: {
  defaultPhone: string;
  labels: Dictionary['profile'];
}) {
  const [state, formAction, pending] = useActionState(
    linkMpesaPhoneAction,
    initialProfileActionState,
  );

  return (
    <div className="space-y-4">
      {state.message ? (
        <Alert variant={state.success ? 'success' : 'destructive'}>
          <AlertDescription>{state.message}</AlertDescription>
        </Alert>
      ) : null}
      <form action={formAction} className="space-y-3">
        <div className="space-y-2">
          <Label htmlFor="mpesaPhone">{labels.mpesaNumber}</Label>
          <Input
            id="mpesaPhone"
            name="mpesaPhone"
            type="tel"
            placeholder="+254712345678"
            defaultValue={defaultPhone}
            required
          />
          <p className="text-xs text-muted-foreground">{labels.mpesaHint}</p>
        </div>
        <Button type="submit" disabled={pending} variant="outline">
          {pending ? labels.linking : labels.linkMpesa}
        </Button>
      </form>
    </div>
  );
}
