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
  const showError = error || (state.message && !state.success);

  return (
    <div className="space-y-6">
      <Button asChild className="w-full min-h-11" size="lg">
        <Link href={`/phone?next=${encodeURIComponent(next)}` as Route}>
          Continue with phone
        </Link>
      </Button>

      <p className="text-center text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
        Or use email
      </p>

      {showError ? (
        <Alert variant="destructive">
          <AlertDescription>
            {error ?? state.message}{' '}
            <Link href={'/forgot-password' as Route} className="font-medium underline">
              Reset password
            </Link>
            {' · '}
            <Link
              href={`/phone?next=${encodeURIComponent(next)}` as Route}
              className="font-medium underline"
            >
              Phone OTP
            </Link>
          </AlertDescription>
        </Alert>
      ) : null}

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
        <Button type="submit" variant="outline" className="w-full" disabled={pending}>
          {pending ? 'Signing in…' : 'Sign in with email'}
        </Button>
      </form>

      <GoogleSignInButton next={next} />

      <AuthFormMessage>
        New to Amanah?{' '}
        <Link href={'/phone' as Route} className="font-medium text-primary hover:underline">
          Start with phone
        </Link>
        {' · '}
        <Link href={'/register' as Route} className="font-medium text-primary hover:underline">
          Email account
        </Link>
      </AuthFormMessage>
    </div>
  );
}
