'use client';

import { useActionState } from 'react';
import Link from 'next/link';
import type { Route } from 'next';
import { Alert, AlertDescription, Button, Input, Label } from '@jamiya/ui';
import { loginAction } from '../actions/auth-actions';
import { initialAuthActionState } from '../lib/types';
import { GoogleSignInButton } from './google-sign-in-button';
import { AuthFormMessage } from './auth-form-message';

export function LoginForm({
  next = '/dashboard',
  error,
}: {
  next?: string;
  error?: string;
}) {
  const [state, formAction, pending] = useActionState(loginAction, initialAuthActionState);

  return (
    <div className="space-y-6">
      {(error || (state.message && !state.success)) && (
        <Alert variant="destructive">
          <AlertDescription>{error ?? state.message}</AlertDescription>
        </Alert>
      )}

      <form action={formAction} className="space-y-4">
        <input type="hidden" name="next" value={next} />
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            required
            placeholder="you@example.com"
          />
          {state.fieldErrors?.email?.[0] ? (
            <p className="text-sm text-destructive">{state.fieldErrors.email[0]}</p>
          ) : null}
        </div>
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="password">Password</Label>
            <Link
              href={'/forgot-password' as Route}
              className="text-sm text-primary hover:underline"
            >
              Forgot password?
            </Link>
          </div>
          <Input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
          />
          {state.fieldErrors?.password?.[0] ? (
            <p className="text-sm text-destructive">{state.fieldErrors.password[0]}</p>
          ) : null}
        </div>
        <Button type="submit" className="w-full" disabled={pending}>
          {pending ? 'Signing in…' : 'Sign in'}
        </Button>
      </form>

      <GoogleSignInButton next={next} />

      <p className="text-center text-sm text-muted-foreground">
        Prefer phone?{' '}
        <Link href={'/phone' as Route} className="font-medium text-primary hover:underline">
          Sign in with OTP
        </Link>
      </p>

      <AuthFormMessage>
        New to Amanah?{' '}
        <Link href={'/register' as Route} className="font-medium text-primary hover:underline">
          Create an account
        </Link>
      </AuthFormMessage>
    </div>
  );
}
