'use client';

import { useActionState } from 'react';
import { Alert, AlertDescription, Button, Input, Label } from '@jamiya/ui';
import { resetPasswordAction } from '../actions/auth-actions';
import { initialAuthActionState } from '../lib/types';

export function ResetPasswordForm() {
  const [state, formAction, pending] = useActionState(resetPasswordAction, initialAuthActionState);

  return (
    <div className="space-y-6">
      {state.message && !state.success ? (
        <Alert variant="destructive">
          <AlertDescription>{state.message}</AlertDescription>
        </Alert>
      ) : null}

      <form action={formAction} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="password">New password</Label>
          <Input
            id="password"
            name="password"
            type="password"
            autoComplete="new-password"
            required
          />
          {state.fieldErrors?.password?.[0] ? (
            <p className="text-sm text-destructive">{state.fieldErrors.password[0]}</p>
          ) : null}
        </div>
        <div className="space-y-2">
          <Label htmlFor="confirmPassword">Confirm new password</Label>
          <Input
            id="confirmPassword"
            name="confirmPassword"
            type="password"
            autoComplete="new-password"
            required
          />
          {state.fieldErrors?.confirmPassword?.[0] ? (
            <p className="text-sm text-destructive">{state.fieldErrors.confirmPassword[0]}</p>
          ) : null}
        </div>
        <Button type="submit" className="w-full" disabled={pending}>
          {pending ? 'Updating…' : 'Update password'}
        </Button>
      </form>
    </div>
  );
}
