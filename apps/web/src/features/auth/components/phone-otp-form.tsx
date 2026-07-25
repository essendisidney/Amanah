'use client';

import { useActionState, useState } from 'react';
import Link from 'next/link';
import { Alert, AlertDescription, Button, Input, Label } from '@jamiya/ui';
import { requestPhoneOtpAction, verifyPhoneOtpAction } from '../actions/auth-actions';
import { initialAuthActionState, type AuthActionState } from '../lib/types';
import { AuthFormMessage } from './auth-form-message';

export function PhoneOtpForm() {
  const [phone, setPhone] = useState('');
  const [step, setStep] = useState<'request' | 'verify'>('request');

  const [requestState, requestAction, requestPending] = useActionState(
    async (prev: AuthActionState, formData: FormData): Promise<AuthActionState> => {
      const result = await requestPhoneOtpAction(prev, formData);
      if (result.success) {
        setPhone(String(formData.get('phone') ?? ''));
        setStep('verify');
      }
      return result;
    },
    initialAuthActionState,
  );

  const [verifyState, verifyAction, verifyPending] = useActionState(
    verifyPhoneOtpAction,
    initialAuthActionState,
  );

  const errorMessage =
    (step === 'request' && !requestState.success && requestState.message) ||
    (step === 'verify' && !verifyState.success && verifyState.message) ||
    null;

  return (
    <div className="space-y-6">
      {errorMessage ? (
        <Alert variant="destructive">
          <AlertDescription>{errorMessage}</AlertDescription>
        </Alert>
      ) : null}
      {step === 'verify' && requestState.success ? (
        <Alert variant="success">
          <AlertDescription>{requestState.message}</AlertDescription>
        </Alert>
      ) : null}

      {step === 'request' ? (
        <form action={requestAction} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="phone">Phone number</Label>
            <Input
              id="phone"
              name="phone"
              type="tel"
              autoComplete="tel"
              placeholder="+254712345678"
              required
            />
            <p className="text-xs text-muted-foreground">Use E.164 format including country code.</p>
            {requestState.fieldErrors?.phone?.[0] ? (
              <p className="text-sm text-destructive">{requestState.fieldErrors.phone[0]}</p>
            ) : null}
          </div>
          <Button type="submit" className="w-full" disabled={requestPending}>
            {requestPending ? 'Sending code…' : 'Send OTP'}
          </Button>
        </form>
      ) : (
        <form action={verifyAction} className="space-y-4">
          <input type="hidden" name="phone" value={phone} />
          <div className="space-y-2">
            <Label htmlFor="token">Verification code</Label>
            <Input
              id="token"
              name="token"
              inputMode="numeric"
              autoComplete="one-time-code"
              placeholder="123456"
              maxLength={6}
              required
            />
            {verifyState.fieldErrors?.token?.[0] ? (
              <p className="text-sm text-destructive">{verifyState.fieldErrors.token[0]}</p>
            ) : null}
          </div>
          <Button type="submit" className="w-full" disabled={verifyPending}>
            {verifyPending ? 'Verifying…' : 'Verify & continue'}
          </Button>
          <Button type="button" variant="ghost" className="w-full" onClick={() => setStep('request')}>
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
