'use client';

import { useActionState } from 'react';
import Link from 'next/link';
import { Alert, AlertDescription, Button, Input, Label } from '@jamiya/ui';
import { forgotPasswordAction } from '../actions/auth-actions';
import { initialAuthActionState } from '../lib/types';
import { AuthFormMessage } from './auth-form-message';

export function ForgotPasswordForm() {
  const [state, formAction, pending] = useActionState(
    forgotPasswordAction,
    initialAuthActionState,
  );

  if (state.success) {
    return (
      <div className="space-y-6">
        <Alert variant="success">
          <AlertDescription>{state.message}</AlertDescription>
        </Alert>
        <AuthFormMessage>
          <Link href="/login" className="font-medium text-primary hover:underline">
            Back to sign in
          </Link>
        </AuthFormMessage>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {state.message ? (
        <Alert variant="destructive">
          <AlertDescription>{state.message}</AlertDescription>
        </Alert>
      ) : null}

      <form action={formAction} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input id="email" name="email" type="email" autoComplete="email" required />
          {state.fieldErrors?.email?.[0] ? (
            <p className="text-sm text-destructive">{state.fieldErrors.email[0]}</p>
          ) : null}
        </div>
        <Button type="submit" className="w-full" disabled={pending}>
          {pending ? 'Sending…' : 'Send reset link'}
        </Button>
      </form>

      <AuthFormMessage>
        <Link href="/login" className="font-medium text-primary hover:underline">
          Back to sign in
        </Link>
      </AuthFormMessage>
    </div>
  );
}
