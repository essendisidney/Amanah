'use client';

import { useActionState, useMemo, useState } from 'react';
import { formatCurrency, KE_PHONE_PLACEHOLDER } from '@jamiya/shared';
import { Button, Input, Label } from '@jamiya/ui';
import {
  topUpWalletAction,
  type WalletActionState,
} from '../actions/wallet-actions';
import type { Dictionary } from '@/i18n/dictionaries';
import { t } from '@/i18n/dictionaries';
import type { PaymentProviderId } from '@/lib/payments/types';

const initial: WalletActionState = { success: false, message: '' };

export function TopUpForm({
  currency = 'KES',
  provider = 'simulated',
  labels,
  defaultAmount,
  defaultPhone = '',
  returnPath,
}: {
  currency?: string;
  provider?: PaymentProviderId;
  labels: Dictionary['walletForms'];
  defaultAmount?: number;
  defaultPhone?: string;
  returnPath?: string | null;
}) {
  const [state, action, pending] = useActionState(topUpWalletAction, initial);
  const needsOtp = Boolean(state.needsOtp);
  const amountDefault =
    defaultAmount && Number.isFinite(defaultAmount) && defaultAmount >= 10
      ? Math.ceil(defaultAmount)
      : provider === 'simulated'
        ? 50000
        : 10;
  const [amountText, setAmountText] = useState(String(amountDefault));
  const needsPhone =
    provider === 'mpesa' || provider === 'intasend' || provider === 'tendepay';
  const linkedPhone = defaultPhone.trim();
  const hasLinkedPhone = /^\+[1-9]\d{7,14}$/.test(linkedPhone);
  const amountValue = Number(amountText);
  const amountValid =
    amountText.trim() !== '' && Number.isFinite(amountValue) && amountValue >= 10;

  const destinationHint = useMemo(() => {
    if (needsPhone) return hasLinkedPhone ? linkedPhone : 'M-Pesa (enter phone)';
    if (provider === 'paystack') return 'Paystack checkout';
    if (provider === 'bank' || provider === 'coop' || provider === 'kcb') {
      return 'Bank settlement';
    }
    if (provider === 'simulated') return 'Wallet (demo credit)';
    return 'Wallet';
  }, [hasLinkedPhone, linkedPhone, needsPhone, provider]);

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="currency" value={currency} />
      {returnPath ? <input type="hidden" name="next" value={returnPath} /> : null}
      {needsOtp ? <input type="hidden" name="otp_challenge" value="1" /> : null}

      <div className="space-y-1.5">
        <Label htmlFor="amount">{t(labels.amount, { currency })}</Label>
        <Input
          id="amount"
          name="amount"
          type="number"
          inputMode="decimal"
          min={10}
          step={1}
          value={amountText}
          onChange={(e) => setAmountText(e.target.value)}
          required
          className="h-12 text-lg font-semibold tabular-nums sm:h-11 sm:text-base"
        />
        {provider === 'intasend' || provider === 'mpesa' || provider === 'tendepay' ? (
          <p className="text-xs text-muted-foreground">Minimum {formatCurrency(10, currency)}.</p>
        ) : null}
      </div>

      {needsPhone ? (
        <div className="space-y-1.5">
          <Label htmlFor="phone">{labels.mpesaPhone}</Label>
          <Input
            id="phone"
            name="phone"
            type="tel"
            inputMode="tel"
            placeholder={KE_PHONE_PLACEHOLDER}
            defaultValue={hasLinkedPhone ? linkedPhone : undefined}
            required
            className="h-11 text-base sm:h-10 sm:text-sm"
          />
          <p className="text-xs text-muted-foreground">{labels.stkPromptHint}</p>
        </div>
      ) : provider === 'paystack' ? (
        <p className="text-xs text-muted-foreground">{labels.paystackHint}</p>
      ) : provider === 'bank' || provider === 'coop' || provider === 'kcb' ? (
        <p className="text-xs text-muted-foreground">{labels.bankHint}</p>
      ) : provider === 'simulated' ? (
        <p className="rounded-lg border border-accent/30 bg-accent-muted/60 px-3 py-2 text-xs leading-relaxed text-foreground">
          <span className="font-semibold text-accent">Demo credit (UAT)</span>
          {' — '}
          {labels.simulatedHint}
        </p>
      ) : (
        <p className="text-xs text-muted-foreground">{labels.bankHint}</p>
      )}

      {provider !== 'simulated' &&
      !needsOtp &&
      provider !== 'mpesa' &&
      provider !== 'intasend' &&
      provider !== 'tendepay' ? (
        <p className="text-xs text-muted-foreground">{labels.stepUpHint}</p>
      ) : null}

      {returnPath && !needsOtp ? (
        <p className="text-xs text-muted-foreground">
          After top-up you will continue to your contribution.
        </p>
      ) : null}

      {amountValid && !needsOtp ? (
        <div className="rounded-lg border border-border bg-muted/40 px-3.5 py-3 text-sm">
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
            Before you confirm
          </p>
          <dl className="mt-2 space-y-1.5">
            <div className="flex items-baseline justify-between gap-3">
              <dt className="text-muted-foreground">Amount</dt>
              <dd className="amanah-money font-semibold text-foreground">
                {formatCurrency(amountValue, currency)}
              </dd>
            </div>
            <div className="flex items-baseline justify-between gap-3">
              <dt className="text-muted-foreground">Paying from</dt>
              <dd className="text-right font-medium text-foreground">{destinationHint}</dd>
            </div>
            {needsPhone ? (
              <p className="pt-1 text-xs text-muted-foreground">
                The payment prompt is sent to this number.
              </p>
            ) : null}
            <div className="flex items-baseline justify-between gap-3">
              <dt className="text-muted-foreground">Jameiyah fee</dt>
              <dd className="font-medium text-foreground">None</dd>
            </div>
          </dl>
        </div>
      ) : null}

      {needsOtp ? (
        <div className="space-y-1.5">
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
            state.success
              ? 'text-sm text-primary'
              : needsOtp && !state.message.toLowerCase().includes('wrong')
                ? 'text-sm text-muted-foreground'
                : 'text-sm text-destructive'
          }
          role="status"
        >
          {state.message}
        </p>
      ) : null}

      <div className="flex flex-col gap-2">
        <Button type="submit" className="min-h-11 w-full" disabled={pending || !amountValid}>
          {pending
            ? labels.processing
            : needsOtp
              ? labels.confirmWithCode
              : provider === 'simulated'
                ? labels.topUpWallet
                : provider === 'paystack'
                  ? labels.payPaystack
                  : provider === 'mpesa' ||
                      provider === 'intasend' ||
                      provider === 'tendepay'
                    ? labels.payMpesa
                    : provider === 'bank' || provider === 'coop' || provider === 'kcb'
                      ? labels.startBank
                      : labels.sendCode}
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
