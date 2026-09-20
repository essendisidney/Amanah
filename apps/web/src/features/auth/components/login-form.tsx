'use client';

import { useActionState, useState } from 'react';
import Link from 'next/link';
import type { Route } from 'next';
import { Alert, AlertDescription, Button, Input, Label } from '@jamiya/ui';
import { cn } from '@/lib/utils';
import { loginAction } from '../actions/auth-actions';
import { initialAuthActionState } from '../lib/types';
import { GoogleSignInButton } from './google-sign-in-button';
import { AuthFormMessage } from './auth-form-message';

type Method = 'choose' | 'phone' | 'email' | 'google';

const METHODS: Array<{ id: Exclude<Method, 'choose'>; title: string; hint: string }> = [
  { id: 'phone', title: 'Phone', hint: 'SMS code — no password' },
  { id: 'email', title: 'Email', hint: 'Email and password' },
  { id: 'google', title: 'Google', hint: 'Continue with Google' },
];

export function LoginForm({
  next = '/dashboard',
  error,
  isReturning = true,
}: {
  next?: string;
  error?: string;
  /** False for invite / first-join flows. */
  isReturning?: boolean;
}) {
  const [method, setMethod] = useState<Method>(error ? 'email' : 'choose');
  const [state, formAction, pending] = useActionState(loginAction, initialAuthActionState);
  const showError = error || (state.message && !state.success);
  const phoneHref = `/phone?next=${encodeURIComponent(next)}` as Route;
  const registerHref = `/register?next=${encodeURIComponent(next)}` as Route;

  if (method === 'choose') {
    return (
      <div className="space-y-5">
        <p className="text-sm text-muted-foreground">
          {isReturning
            ? 'Pick how you usually sign in.'
            : 'Create or continue with any option below.'}
        </p>
        <ul className="space-y-2">
          {METHODS.map((item) => (
            <li key={item.id}>
              <button
                type="button"
                onClick={() => setMethod(item.id)}
                className={cn(
                  'amanah-surface flex w-full flex-col items-start gap-0.5 px-4 py-3.5 text-left transition-colors',
                  'hover:border-primary/30 hover:bg-secondary/40',
                )}
              >
                <span className="text-sm font-semibold text-foreground">{item.title}</span>
                <span className="text-xs text-muted-foreground">{item.hint}</span>
              </button>
            </li>
          ))}
        </ul>
        <AuthFormMessage>
          New here?{' '}
          <Link href={registerHref} className="font-medium text-primary hover:underline">
            Create an email account
          </Link>
        </AuthFormMessage>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex gap-1 rounded-xl border border-border/70 bg-muted/40 p-1">
        {METHODS.map((item) => {
          const active = method === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setMethod(item.id)}
              className={cn(
                'min-h-10 flex-1 rounded-lg px-2 text-sm font-medium transition-colors',
                active
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {item.title}
            </button>
          );
        })}
      </div>

      {showError && method === 'email' ? (
        <Alert variant="destructive">
          <AlertDescription>
            {error ?? state.message}{' '}
            <Link href={'/forgot-password' as Route} className="font-medium underline">
              Reset password
            </Link>
          </AlertDescription>
        </Alert>
      ) : null}

      {method === 'phone' ? (
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            We’ll text a 6-digit code to your Kenya mobile (07… or +254…).
          </p>
          <Button asChild className="w-full min-h-11" size="lg">
            <Link href={phoneHref}>Continue with phone</Link>
          </Button>
        </div>
      ) : null}

      {method === 'email' ? (
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
          <Button type="submit" className="w-full min-h-11" disabled={pending}>
            {pending ? 'Signing in…' : 'Sign in with email'}
          </Button>
          <p className="text-center text-sm text-muted-foreground">
            No account?{' '}
            <Link href={registerHref} className="font-medium text-primary hover:underline">
              Create one
            </Link>
          </p>
        </form>
      ) : null}

      {method === 'google' ? (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Use your Google account — same inbox you already trust.
          </p>
          <GoogleSignInButton next={next} label="Continue with Google" showDivider={false} />
        </div>
      ) : null}

      <button
        type="button"
        onClick={() => setMethod('choose')}
        className="w-full text-center text-sm font-medium text-muted-foreground hover:text-foreground"
      >
        ← All sign-in options
      </button>
    </div>
  );
}
