'use client';

import { useActionState } from 'react';
import Link from 'next/link';
import type { Route } from 'next';
import { Alert, AlertDescription, Button, Input, Label } from '@jamiya/ui';
import { registerAction } from '../actions/auth-actions';
import { initialAuthActionState } from '../lib/types';
import { GoogleSignInButton } from './google-sign-in-button';
import { AuthFormMessage } from './auth-form-message';

export function RegisterForm({ next = '/dashboard' }: { next?: string }) {
  const [state, formAction, pending] = useActionState(registerAction, initialAuthActionState);
  const existsHint = Boolean(state.message?.toLowerCase().includes('already exists'));
  const phoneHref = `/phone?next=${encodeURIComponent(next)}` as Route;
  const loginHref = `/login?next=${encodeURIComponent(next)}` as Route;

  if (state.success) {
    return (
      <Alert variant="success">
        <AlertDescription>{state.message}</AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-6">
      <p className="rounded-lg border border-border bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
        You can also{' '}
        <Link href={phoneHref} className="font-medium text-primary hover:underline">
          join with phone SMS
        </Link>
        , or use Google below — email is optional.
      </p>

      {state.message ? (
        <Alert variant="destructive">
          <AlertDescription>
            {state.message}
            {existsHint ? (
              <>
                {' '}
                <Link href={'/forgot-password' as Route} className="font-medium underline">
                  Reset password
                </Link>
                {' · '}
                <Link href={loginHref} className="font-medium underline">
                  Sign in
                </Link>
              </>
            ) : null}
          </AlertDescription>
        </Alert>
      ) : null}

      <form action={formAction} className="space-y-4">
        <input type="hidden" name="next" value={next} />
        <div className="space-y-2">
          <Label htmlFor="fullName">Full name</Label>
          <Input id="fullName" name="fullName" autoComplete="name" required />
          {state.fieldErrors?.fullName?.[0] ? (
            <p className="text-sm text-destructive">{state.fieldErrors.fullName[0]}</p>
          ) : null}
        </div>
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
          <Label htmlFor="password">Password</Label>
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
          <Label htmlFor="confirmPassword">Confirm password</Label>
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
          {pending ? 'Creating account…' : 'Create email account'}
        </Button>
      </form>

      <GoogleSignInButton next={next} label="Continue with Google" />

      <AuthFormMessage>
        Already have an account?{' '}
        <Link href={loginHref} className="font-medium text-primary hover:underline">
          Sign in
        </Link>
        {' · '}
        <Link href={phoneHref} className="font-medium text-primary hover:underline">
          Phone SMS
        </Link>
      </AuthFormMessage>
    </div>
  );
}
