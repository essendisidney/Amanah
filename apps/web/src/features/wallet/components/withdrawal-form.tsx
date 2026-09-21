'use client';

import Link from 'next/link';
import type { Route } from 'next';
import { useActionState, useState } from 'react';
import { KE_PHONE_PLACEHOLDER } from '@jamiya/shared';
import { Button, Input, Label } from '@jamiya/ui';
import {
  requestWithdrawalAction,
  type WithdrawalActionState,
} from '../actions/withdrawal-actions';
import type { Dictionary } from '@/i18n/dictionaries';
import { t } from '@/i18n/dictionaries';

const initial: WithdrawalActionState = { success: false, message: '' };

export function WithdrawalForm({
  currency = 'KES',
  labels,
  defaultPhone = '',
}: {
  currency?: string;
  labels: Dictionary['walletForms'];
  defaultPhone?: string;
}) {
  const [state, action, pending] = useActionState(requestWithdrawalAction, initial);
  const [destinationType, setDestinationType] = useState<'mpesa' | 'bank'>('mpesa');
  const needsOtp = Boolean(state.needsOtp);
  const linkedPhone = defaultPhone.trim();
  const hasLinkedMpesa = /^\+[1-9]\d{7,14}$/.test(linkedPhone);

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="currency" value={currency} />
      <input type="hidden" name="destinationType" value={destinationType} />

      <div className="space-y-2">
        <Label htmlFor="withdraw-amount">{t(labels.amount, { currency })}</Label>
        <Input
          id="withdraw-amount"
          name="amount"
          type="number"
          inputMode="decimal"
          min={100}
          step={100}
          defaultValue={1000}
          required
          className="h-11 text-base sm:h-10 sm:text-sm"
        />
      </div>

      <div className="grid grid-cols-2 gap-2">
        <Button
          type="button"
          className="min-h-11"
          variant={destinationType === 'mpesa' ? 'default' : 'outline'}
          onClick={() => setDestinationType('mpesa')}
        >
          M-Pesa
        </Button>
        <Button
          type="button"
          className="min-h-11"
          variant={destinationType === 'bank' ? 'default' : 'outline'}
          onClick={() => setDestinationType('bank')}
        >
          {labels.bank}
        </Button>
      </div>

      {destinationType === 'mpesa' ? (
        <div className="space-y-2">
          <Label htmlFor="phone">{labels.mpesaPhone}</Label>
          {hasLinkedMpesa ? (
            <>
              <input type="hidden" name="phone" value={linkedPhone} />
              <p className="rounded-md border border-border bg-secondary/40 px-3 py-2 text-sm">
                Pays to linked number <span className="font-medium">{linkedPhone}</span>
              </p>
              <p className="text-xs text-muted-foreground">
                Change on{' '}
                <Link href={'/profile' as Route} className="underline underline-offset-2">
                  Profile
                </Link>
                . {labels.withdrawMpesaHint}
              </p>
            </>
          ) : (
            <>
              <Input
                id="phone"
                name="phone"
                type="tel"
                inputMode="tel"
                placeholder={KE_PHONE_PLACEHOLDER}
                required
                className="h-11 text-base sm:h-10 sm:text-sm"
              />
              <p className="text-xs text-muted-foreground">
                Link this number on Profile after your first withdraw so future cash-outs stay
                locked to you.
              </p>
            </>
          )}
        </div>
      ) : (
        <>
          <div className="space-y-2">
            <Label htmlFor="bankName">{labels.bankName}</Label>
            <Input id="bankName" name="bankName" required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="bankAccountName">{labels.accountName}</Label>
            <Input id="bankAccountName" name="bankAccountName" required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="bankAccountNumber">{labels.accountNumber}</Label>
            <Input id="bankAccountNumber" name="bankAccountNumber" required />
          </div>
        </>
      )}

      {needsOtp ? <input type="hidden" name="otp_challenge" value="1" /> : null}

      {state.message ? (
        <p
          className={
            state.success
              ? 'text-sm text-primary'
              : needsOtp && !state.message.toLowerCase().includes('wrong')
                ? 'text-sm text-muted-foreground'
                : 'text-sm text-destructive'
          }
        >
          {state.message}
        </p>
      ) : null}

      {needsOtp ? (
        <div className="space-y-2">
          <Label htmlFor="withdraw-otp">{labels.verificationCode}</Label>
          <Input
            id="withdraw-otp"
            name="otp"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            pattern="\d{6}"
            required
            autoFocus
            className="h-11 tracking-[0.3em] text-base sm:h-10 sm:text-sm"
          />
        </div>
      ) : null}

      <div className="flex flex-col gap-2">
        <Button type="submit" variant="outline" className="min-h-11 w-full" disabled={pending}>
          {pending
            ? labels.submitting
            : needsOtp
              ? labels.confirmWithCode
              : labels.requestWithdrawal}
        </Button>
        {needsOtp ? (
          <Button
            type="submit"
            name="resend_otp"
            value="1"
            variant="ghost"
            className="min-h-11 w-full"
            disabled={pending}
            formNoValidate
          >
            {labels.sendCode}
          </Button>
        ) : null}
      </div>
    </form>
  );
}
