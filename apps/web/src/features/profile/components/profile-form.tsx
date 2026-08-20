'use client';

import Link from 'next/link';
import type { Route } from 'next';
import { useActionState } from 'react';
import { Alert, AlertDescription, Button, Input, Label, Textarea } from '@jamiya/ui';
import { updateProfileAction } from '../actions/profile-actions';
import { initialProfileActionState } from '../lib/state';
import type { Dictionary } from '@/i18n/dictionaries';

export function ProfileForm({
  defaultValues,
  labels,
  continueHref,
  requirePhone = false,
}: {
  defaultValues: {
    fullName: string;
    phone: string;
    bio: string;
    countryCode: string;
  };
  labels: Dictionary['profile'];
  continueHref?: string;
  requirePhone?: boolean;
}) {
  const [state, formAction, pending] = useActionState(
    updateProfileAction,
    initialProfileActionState,
  );

  const next =
    continueHref &&
    continueHref.startsWith('/') &&
    !continueHref.startsWith('//') &&
    !continueHref.includes('://')
      ? (continueHref as Route)
      : null;

  return (
    <div className="space-y-4">
      {state.message ? (
        <Alert variant={state.success ? 'success' : 'destructive'}>
          <AlertDescription>{state.message}</AlertDescription>
        </Alert>
      ) : null}

      <form action={formAction} className="space-y-4">
        {requirePhone ? <input type="hidden" name="requirePhone" value="1" /> : null}
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
            required={requirePhone}
          />
          {requirePhone ? (
            <p className="text-xs text-muted-foreground">
              Required for wallet verification SMS and M-Pesa / Paystack step-up.
            </p>
          ) : null}
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
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <Button type="submit" disabled={pending}>
            {pending ? labels.saving : labels.saveProfile}
          </Button>
          {state.success && next ? (
            <Button asChild variant="outline">
              <Link href={next}>Continue to Amanah</Link>
            </Button>
          ) : null}
        </div>
      </form>
    </div>
  );
}
