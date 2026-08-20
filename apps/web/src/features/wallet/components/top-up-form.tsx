'use client';

import { useActionState } from 'react';
import { Button, Input, Label } from '@jamiya/ui';
import {
  topUpWalletAction,
  type WalletActionState,
} from '../actions/wallet-actions';
import type { Dictionary } from '@/i18n/dictionaries';
import { t } from '@/i18n/dictionaries';

const initial: WalletActionState = { success: false, message: '' };

export function TopUpForm({
  currency = 'KES',
  provider = 'simulated',
  labels,
  defaultAmount,
  returnPath,
}: {
  currency?: string;
  provider?: 'simulated' | 'mpesa' | 'bank' | 'paystack';
  labels: Dictionary['walletForms'];
  defaultAmount?: number;
  returnPath?: string | null;
}) {
  const [state, action, pending] = useActionState(topUpWalletAction, initial);
  const needsOtp = Boolean(state.needsOtp);
  const amountDefault =
    defaultAmount && Number.isFinite(defaultAmount) && defaultAmount >= 100
      ? Math.ceil(defaultAmount)
      : provider === 'simulated'
        ? 50000
        : 1000;

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="currency" value={currency} />
      {returnPath ? <input type="hidden" name="next" value={returnPath} /> : null}
      <div className="space-y-2">
        <Label htmlFor="amount">{t(labels.amount, { currency })}</Label>
        <Input
          id="amount"
          name="amount"
          type="number"
          inputMode="decimal"
          min={100}
          step={100}
          defaultValue={amountDefault}
          required
          className="h-11 text-base sm:h-10 sm:text-sm"
        />
      </div>
      {provider === 'mpesa' ? (
        <div className="space-y-2">
          <Label htmlFor="phone">{labels.mpesaPhone}</Label>
          <Input
            id="phone"
            name="phone"
            type="tel"
            inputMode="tel"
            placeholder="0712 345 678"
            required
            className="h-11 text-base sm:h-10 sm:text-sm"
          />
        </div>
      ) : provider === 'paystack' ? (
        <p className="text-xs text-muted-foreground">{labels.paystackHint}</p>
      ) : provider === 'bank' ? (
        <p className="text-xs text-muted-foreground">{labels.bankHint}</p>
      ) : (
        <p className="rounded-md border border-accent/30 bg-accent-muted/60 px-3 py-2 text-xs leading-relaxed text-foreground">
          <span className="font-semibold text-accent">Demo credit (UAT)</span>
          {' — '}
          {labels.simulatedHint} Default amount is KES 50,000 for testing. Not real M-Pesa money.
        </p>
      )}
      {provider !== 'simulated' ? (
        <p className="text-xs text-muted-foreground">{labels.stepUpHint}</p>
      ) : null}
      {provider === 'paystack' && !needsOtp ? (
        <p className="text-xs text-muted-foreground">{labels.paystackReturnHint}</p>
      ) : null}
      {returnPath ? (
        <p className="text-xs text-muted-foreground">
          After top-up you will continue back to pay your contribution.
        </p>
      ) : null}
      {needsOtp ? (
        <div className="space-y-2">
          <Label htmlFor="otp">{labels.verificationCode}</Label>
          <Input
            id="otp"
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
      {state.message ? (
        <p
          className={
            state.success ? 'text-sm text-primary' : 'text-sm text-destructive'
          }
          role="status"
        >
          {state.message}
        </p>
      ) : null}
      <Button type="submit" className="min-h-11 w-full" disabled={pending}>
        {pending
          ? labels.processing
          : needsOtp
            ? labels.confirmWithCode
            : provider === 'simulated'
              ? labels.topUpWallet
              : provider === 'paystack'
                ? labels.payPaystack
                : provider === 'mpesa'
                  ? labels.payMpesa
                  : provider === 'bank'
                    ? labels.startBank
                    : labels.sendCode}
      </Button>
    </form>
  );
}
