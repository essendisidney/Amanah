'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { formatPhoneHint, isValidKeMobile } from '@jamiya/shared';
import { Alert, AlertDescription, Button, Input, Label } from '@jamiya/ui';
import { createClient } from '@/lib/supabase/client';
import { AuthFormMessage } from './auth-form-message';

type Step = 'request' | 'verify';

export function PhoneOtpForm({ next = '/dashboard' }: { next?: string }) {
  const router = useRouter();
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
      setError('Enter a valid Kenya mobile (e.g. 0712 345 678).');
      return false;
    }
    const res = await fetch('/api/auth/phone/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone: rawPhone }),
    });
    const json = (await res.json().catch(() => ({}))) as {
      success?: boolean;
      error?: string;
      retry_after?: number;
      hint?: string;
      dev_otp?: string;
    };
    if (!res.ok || !json.success) {
      setError(json.error ?? 'Could not send code.');
      if (json.retry_after) setCooldown(json.retry_after);
      return false;
    }
    setCooldown(json.retry_after ?? 60);
    setInfo(
      json.hint
        ? `${json.hint} Code sent to ${formatPhoneHint(rawPhone)}.`
        : `Code sent to ${formatPhoneHint(rawPhone)}.`,
    );
    if (json.dev_otp) setDevOtp(json.dev_otp);
    lastVerifiedToken.current = null;
    return true;
  }

  async function verifyCode(rawPhone: string, code: string) {
    const trimmed = code.trim();
    if (verifyingRef.current) return false;
    if (lastVerifiedToken.current === trimmed) return false;

    verifyingRef.current = true;
    setError(null);

    try {
      const res = await fetch('/api/auth/phone/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: rawPhone, otp: trimmed }),
      });
      const json = (await res.json().catch(() => ({}))) as {
        success?: boolean;
        error?: string;
        access_token?: string;
        refresh_token?: string;
      };
      if (!res.ok || !json.success || !json.access_token || !json.refresh_token) {
        setError(json.error ?? 'Invalid or expired code.');
        return false;
      }

      lastVerifiedToken.current = trimmed;

      const supabase = createClient();
      const { error: sessionError } = await supabase.auth.setSession({
        access_token: json.access_token,
        refresh_token: json.refresh_token,
      });
      if (sessionError) {
        setError(sessionError.message);
        lastVerifiedToken.current = null;
        return false;
      }
      router.replace(next);
      router.refresh();
      return true;
    } finally {
      verifyingRef.current = false;
    }
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
          <AlertDescription>{error}</AlertDescription>
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
            <Label htmlFor="phone">Phone number</Label>
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
            <p className="text-xs text-muted-foreground">
              Kenya mobiles — 07… or +254… both work.
            </p>
          </div>
          <Button type="submit" className="w-full" disabled={pending || cooldown > 0}>
            {pending ? 'Sending code…' : cooldown > 0 ? `Resend in ${cooldown}s` : 'Send OTP'}
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
            <Label htmlFor="token">Verification code</Label>
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
              Sent to {formatPhoneHint(phone)}
            </p>
          </div>
          <Button type="submit" className="w-full" disabled={pending || token.length !== 6}>
            {pending ? 'Verifying…' : 'Verify & continue'}
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
            {cooldown > 0 ? `Resend in ${cooldown}s` : 'Resend code'}
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
            Use a different number
          </Button>
        </form>
      )}

      <AuthFormMessage>
        Prefer email?{' '}
        <Link href="/login" className="font-medium text-primary hover:underline">
          Sign in with password
        </Link>
      </AuthFormMessage>
    </div>
  );
}
