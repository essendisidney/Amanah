'use client';

import { useActionState } from 'react';
import { Alert, AlertDescription, Button, Input, Label, Textarea } from '@jamiya/ui';
import { updateProfileAction } from '../actions/profile-actions';
import { initialProfileActionState } from '../lib/state';
import type { Dictionary } from '@/i18n/dictionaries';

export function ProfileForm({
  defaultValues,
  labels,
}: {
  defaultValues: {
    fullName: string;
    phone: string;
    bio: string;
    countryCode: string;
  };
  labels: Dictionary['profile'];
}) {
  const [state, formAction, pending] = useActionState(
    updateProfileAction,
    initialProfileActionState,
  );

  return (
    <div className="space-y-4">
      {state.message ? (
        <Alert variant={state.success ? 'success' : 'destructive'}>
          <AlertDescription>{state.message}</AlertDescription>
        </Alert>
      ) : null}

      <form action={formAction} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="fullName">{labels.fullName}</Label>
          <Input
            id="fullName"
            name="fullName"
            defaultValue={defaultValues.fullName}
            required
          />
          {state.fieldErrors?.fullName?.[0] ? (
            <p className="text-sm text-destructive">{state.fieldErrors.fullName[0]}</p>
          ) : null}
        </div>
        <div className="space-y-2">
          <Label htmlFor="phone">{labels.phone}</Label>
          <Input
            id="phone"
            name="phone"
            type="tel"
            placeholder="+254712345678"
            defaultValue={defaultValues.phone}
          />
          {state.fieldErrors?.phone?.[0] ? (
            <p className="text-sm text-destructive">{state.fieldErrors.phone[0]}</p>
          ) : null}
        </div>
        <div className="space-y-2">
          <Label htmlFor="countryCode">{labels.countryCode}</Label>
          <Input
            id="countryCode"
            name="countryCode"
            maxLength={2}
            placeholder="KE"
            defaultValue={defaultValues.countryCode}
          />
          {state.fieldErrors?.countryCode?.[0] ? (
            <p className="text-sm text-destructive">{state.fieldErrors.countryCode[0]}</p>
          ) : null}
        </div>
        <div className="space-y-2">
          <Label htmlFor="bio">{labels.bio}</Label>
          <Textarea id="bio" name="bio" defaultValue={defaultValues.bio} />
          {state.fieldErrors?.bio?.[0] ? (
            <p className="text-sm text-destructive">{state.fieldErrors.bio[0]}</p>
          ) : null}
        </div>
        <Button type="submit" disabled={pending}>
          {pending ? labels.saving : labels.saveProfile}
        </Button>
      </form>
    </div>
  );
}
