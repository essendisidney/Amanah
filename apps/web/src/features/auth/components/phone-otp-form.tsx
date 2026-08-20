'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import Link from 'next/link';
import { formatPhoneHint, isValidKeMobile } from '@jamiya/shared';
import { Alert, AlertDescription, Button, Input, Label } from '@jamiya/ui';
import { createClient } from '@/lib/supabase/client';
import type { Dictionary } from '@/i18n/dictionaries';
import { t } from '@/i18n/dictionaries';
import { getSafeRedirectPath, buildPostAuthPath } from '../lib/types';
import { AuthFormMessage } from './auth-form-message';

type Step = 'request' | 'verify';
type PhoneLabels = Dictionary['phoneAuth'];

function readApiError(json: unknown, fallback: string): string {
  if (!json || typeof json !== 'object') return fallback;
  const record = json as Record<string, unknown>;
  const err = record.error;
  if (typeof err === 'string' && err.trim()) return err.trim();
  if (err && typeof err === 'object') {
    const nested = err as Record<string, unknown>;
    for (const key of ['error_description', 'message', 'msg', 'error']) {
      const value = nested[key];
      if (typeof value === 'string' && value.trim()) return value.trim();
    }
    // Never render "{}" from an empty error object
    const serialized = JSON.stringify(err);
    if (serialized && serialized !== '{}' && serialized !== 'null') {
      return fallback;
    }
  }
  if (typeof record.message === 'string' && record.message.trim()) {
    return record.message.trim();
  }
  return fallback;
}

export function PhoneOtpForm({
  next = '/dashboard',
  labels,
}: {
  next?: string;
  labels: PhoneLabels;
}) {
  const dest = getSafeRedirectPath(next);
  const [phone, setPhone] = useState('');
  const [token, setToken] = useState('');
  const [step, setStep] = useState<Step>('request');
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [devOtp, setDevOtp] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(0);
  const [pending, startTransition] = useTransition();
  const verifyingRef = useRef(false);
  const lastVerifiedToken = useRef<string | null>(null);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = window.setTimeout(() => setCooldown((c) => Math.max(0, c - 1)), 1000);
    return () => window.clearTimeout(t);
  }, [cooldown]);

  async function sendCode(rawPhone: string) {
    setError(null);
    setInfo(null);
    setDevOtp(null);
    if (!isValidKeMobile(rawPhone)) {
      setError(labels.invalidPhone);
      return false;
    }
    const res = await fetch('/api/auth/phone/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone: rawPhone }),
    });
    const json = (await res.json().catch(() => ({}))) as {
      success?: boolean;
      error?: unknown;
      retry_after?: number;
      hint?: string;
      dev_otp?: string;
    };
    if (!res.ok || !json.success) {
      setError(readApiError(json, labels.sendFailed));
      if (json.retry_after) setCooldown(json.retry_after);
      return false;
    }
    setCooldown(json.retry_after ?? 60);
    setInfo(
      json.hint
        ? `${json.hint} ${t(labels.codeSent, { phone: formatPhoneHint(rawPhone) })}`
        : t(labels.codeSent, { phone: formatPhoneHint(rawPhone) }),
    );
    if (json.dev_otp) setDevOtp(json.dev_otp);
    lastVerifiedToken.current = null;
    return true;
  }

  async function verifyCode(rawPhone: string, code: string) {
    const trimmed = code.trim();
    if (verifyingRef.current) return false;
    if (lastVerifiedToken.current === trimmed) {
      // Same code already tried (often already consumed). Do not silent-no-op.
      setError('This code was already used or failed. Request a new code.');
      return false;
    }

    // Lock immediately to prevent autofill + button double-submit races.
    verifyingRef.current = true;
    lastVerifiedToken.current = trimmed;
    setError(null);

    let json: {
      success?: boolean;
      error?: unknown;
      cookies_set?: boolean;
      access_token?: string;
      refresh_token?: string;
      profile_completed?: boolean;
    } = {};

    try {
      const res = await fetch('/api/auth/phone/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: rawPhone, otp: trimmed }),
        credentials: 'same-origin',
        cache: 'no-store',
      });
      json = (await res.json().catch(() => ({}))) as typeof json;
      if (!res.ok || !json.success) {
        setError(readApiError(json, 'Invalid or expired code. Request a new one.'));
        return false;
      }
    } catch (err) {
      lastVerifiedToken.current = null;
      const msg =
        err instanceof Error && err.message.trim()
          ? err.message.trim()
          : 'Network error verifying code. Check connection and try again.';
      setError(msg);
      return false;
    } finally {
      verifyingRef.current = false;
    }

    // Auth API succeeded (cookies usually already Set-Cookie'd). Navigate first;
    // never let client setSession failures surface as a dead-end on this screen.
    // Server logs showed login succeeding while the UI still showed a generic error.
    if (json.access_token && json.refresh_token && !json.cookies_set) {
      try {
        const supabase = createClient();
        const { error: sessionError } = await supabase.auth.setSession({
          access_token: json.access_token,
          refresh_token: json.refresh_token,
        });
        if (sessionError) {
          setError(sessionError.message || 'Signed in, but session failed. Try again.');
          lastVerifiedToken.current = null;
          return false;
        }
      } catch (sessionErr) {
        const msg =
          sessionErr instanceof Error && sessionErr.message
            ? sessionErr.message
            : 'Signed in, but session failed. Try again.';
        setError(msg);
        lastVerifiedToken.current = null;
        return false;
      }
    } else if (json.access_token && json.refresh_token) {
      // Best-effort mirror into client storage; ignore failures — cookies already set.
      void createClient()
        .auth.setSession({
          access_token: json.access_token,
          refresh_token: json.refresh_token,
        })
        .catch(() => undefined);
    }

    window.location.replace(buildPostAuthPath(dest, json.profile_completed === true));
    return true;
  }

  useEffect(() => {
    if (step !== 'verify' || token.length !== 6) return;
    if (verifyingRef.current || lastVerifiedToken.current === token) return;
    startTransition(async () => {
      await verifyCode(phone, token);
    });
    // Auto-submit once when the 6-digit code is complete — do not depend on `pending`
    // or a resettable flag, or a failed attempt will immediately retry a used code.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional: only token/step/phone
  }, [token, step, phone]);

  return (
    <div className="space-y-6">
      {error ? (
        <Alert variant="destructive">
          <AlertDescription>
            {typeof error === 'string' && error.trim() && error !== '{}'
              ? error
              : 'Could not verify code. Request a new one.'}
          </AlertDescription>
        </Alert>
      ) : null}
      {info && !error ? (
        <Alert variant="success">
          <AlertDescription>{info}</AlertDescription>
        </Alert>
      ) : null}
      {devOtp ? (
        <Alert>
          <AlertDescription>Dev OTP: {devOtp}</AlertDescription>
        </Alert>
      ) : null}

      {step === 'request' ? (
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            startTransition(async () => {
              const ok = await sendCode(phone);
              if (ok) {
                setStep('verify');
                setToken('');
                lastVerifiedToken.current = null;
              }
            });
          }}
        >
          <div className="space-y-2">
            <Label htmlFor="phone">{labels.phoneLabel}</Label>
            <Input
              id="phone"
              name="phone"
              type="tel"
              autoComplete="tel"
              inputMode="tel"
              placeholder="0712 345 678"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              required
            />
            <p className="text-xs text-muted-foreground">{labels.phoneHint}</p>
          </div>
          <Button type="submit" className="w-full" disabled={pending || cooldown > 0}>
            {pending
              ? labels.sending
              : cooldown > 0
                ? t(labels.resendIn, { seconds: cooldown })
                : labels.sendOtp}
          </Button>
        </form>
      ) : (
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (token.length !== 6) return;
            startTransition(async () => {
              await verifyCode(phone, token);
            });
          }}
        >
          <div className="space-y-2">
            <Label htmlFor="token">{labels.codeLabel}</Label>
            <Input
              id="token"
              name="token"
              inputMode="numeric"
              autoComplete="one-time-code"
              placeholder="123456"
              maxLength={6}
              value={token}
              onChange={(e) => setToken(e.target.value.replace(/\D/g, '').slice(0, 6))}
              required
            />
            <p className="text-xs text-muted-foreground">
              {t(labels.sentTo, { phone: formatPhoneHint(phone) })}
            </p>
          </div>
          <Button type="submit" className="w-full" disabled={pending || token.length !== 6}>
            {pending ? labels.verifying : labels.verify}
          </Button>
          <Button
            type="button"
            variant="ghost"
            className="w-full"
            disabled={pending || cooldown > 0}
            onClick={() => {
              startTransition(async () => {
                lastVerifiedToken.current = null;
                await sendCode(phone);
              });
            }}
          >
            {cooldown > 0 ? t(labels.resendIn, { seconds: cooldown }) : labels.sendOtp}
          </Button>
          <Button
            type="button"
            variant="ghost"
            className="w-full"
            onClick={() => {
              setStep('request');
              setToken('');
              setInfo(null);
              setDevOtp(null);
              lastVerifiedToken.current = null;
            }}
          >
            {labels.changeNumber}
          </Button>
        </form>
      )}

      <AuthFormMessage>
        {labels.preferEmail}{' '}
        <Link href="/login" className="font-medium text-primary hover:underline">
          {labels.signInPassword}
        </Link>
        {' · '}
        <Link href="/register" className="font-medium text-primary hover:underline">
          {labels.createEmailAccount}
        </Link>
      </AuthFormMessage>
    </div>
  );
}
