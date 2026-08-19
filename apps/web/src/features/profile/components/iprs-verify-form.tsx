'use client';

import { useActionState } from 'react';
import { Alert, AlertDescription, Button, Input, Label } from '@jamiya/ui';
import { verifyIprsAction } from '../actions/profile-actions';
import { initialProfileActionState } from '../lib/state';

export function IprsVerifyForm({
  defaultFirstName = '',
  defaultLastName = '',
  defaultNationalId = '',
  iprsStatus = 'not_checked',
}: {
  defaultFirstName?: string;
  defaultLastName?: string;
  defaultNationalId?: string;
  iprsStatus?: string;
}) {
  const [state, formAction, pending] = useActionState(
    verifyIprsAction,
    initialProfileActionState,
  );

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Check the name and National ID against Kenya IPRS / NPDM (Maisha register). Live
        government access needs NPDM onboarding; until keys are set this uses demo lookup
        so chama testing can continue.
      </p>
      <p className="text-xs text-muted-foreground">
        Current IPRS status: <strong className="text-foreground">{iprsStatus.replaceAll('_', ' ')}</strong>
      </p>

      {state.message ? (
        <Alert variant={state.success ? 'success' : 'destructive'}>
          <AlertDescription>{state.message}</AlertDescription>
        </Alert>
      ) : null}

      <form action={formAction} className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="iprsFirstName">First name (as on ID)</Label>
            <Input
              id="iprsFirstName"
              name="firstName"
              required
              defaultValue={defaultFirstName}
              autoComplete="given-name"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="iprsLastName">Last name (as on ID)</Label>
            <Input
              id="iprsLastName"
              name="lastName"
              required
              defaultValue={defaultLastName}
              autoComplete="family-name"
            />
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="nationalId">National ID / Maisha Namba</Label>
          <Input
            id="nationalId"
            name="nationalId"
            inputMode="numeric"
            required
            placeholder="12345678"
            defaultValue={defaultNationalId}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="dateOfBirth">Date of birth (optional)</Label>
          <Input id="dateOfBirth" name="dateOfBirth" type="date" />
        </div>
        <Button type="submit" disabled={pending}>
          {pending ? 'Checking IPRS…' : 'Verify with IPRS'}
        </Button>
      </form>
    </div>
  );
}
