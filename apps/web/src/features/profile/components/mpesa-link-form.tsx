'use client';

import { useActionState } from 'react';
import { formatPhoneHint, KE_PHONE_PLACEHOLDER } from '@jamiya/shared';
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
  const phoneDisplay = defaultPhone ? formatPhoneHint(defaultPhone) : '';

  return (
    <div className="space-y-4">
      {state.message ? (
        <Alert variant={state.success ? 'success' : 'destructive'}>
          <AlertDescription>
            {state.success && phoneDisplay
              ? `${state.message} · ${phoneDisplay}`
              : state.message}
          </AlertDescription>
        </Alert>
      ) : null}
      <form action={formAction} className="space-y-3">
        <div className="space-y-2">
          <Label htmlFor="mpesaPhone">{labels.mpesaNumber}</Label>
          <Input
            id="mpesaPhone"
            name="mpesaPhone"
            type="tel"
            placeholder={KE_PHONE_PLACEHOLDER}
            defaultValue={phoneDisplay}
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
