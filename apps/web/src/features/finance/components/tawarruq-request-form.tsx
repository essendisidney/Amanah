'use client';

import { useActionState, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { formatCurrency } from '@jamiya/shared';
import { Button, Input, Label, Textarea } from '@jamiya/ui';
import {
  respondTawarruqGuaranteeAction,
  submitTawarruqAction,
  type FinanceActionState,
} from '@/features/finance/actions';
import {
  TAWARRUQ_DEFAULT_TENOR,
  TAWARRUQ_TENORS,
  quoteTawarruq,
  tawarruqRateFor,
  type TawarruqRates,
} from '@/features/finance/lib/tawarruq-quote';

export type TawarruqQualification = {
  room: number;
  owed: number;
  phoneOk: boolean;
  kycApproved: boolean;
  companyLeft: number;
  overdue: boolean;
};

export type TawarruqGuarantor = { id: string; name: string };

const guaranteeInitial: FinanceActionState = { success: false, message: '' };

export function TawarruqGuaranteeButtons({ guaranteeId }: { guaranteeId: string }) {
  const [state, action, pending] = useActionState(respondTawarruqGuaranteeAction, guaranteeInitial);
  return (
    <form action={action} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="guaranteeId" value={guaranteeId} />
      <Button type="submit" name="accept" value="1" className="min-h-11" disabled={pending}>
        Accept guarantee
      </Button>
      <Button type="submit" name="accept" value="0" variant="outline" className="min-h-11" disabled={pending}>
        Decline
      </Button>
      {state.message ? (
        <p className={state.success ? 'text-sm text-foreground' : 'text-sm text-destructive'}>
          {state.message}
        </p>
      ) : null}
    </form>
  );
}

export function TawarruqRequestForm({
  qualification,
  guarantors,
  rates,
}: {
  qualification: TawarruqQualification;
  guarantors: TawarruqGuarantor[];
  /** Jameiyah's profit rate for each term; the applicant does not choose it. */
  rates: TawarruqRates;
}) {
  const router = useRouter();
  const [cash, setCash] = useState('');
  const tenors = TAWARRUQ_TENORS.filter((months) => tawarruqRateFor(rates, months) !== null);
  const [tenor, setTenor] = useState(
    String(tenors.includes(TAWARRUQ_DEFAULT_TENOR) ? TAWARRUQ_DEFAULT_TENOR : (tenors[0] ?? '')),
  );
  const profitBps = tawarruqRateFor(rates, Number(tenor));
  const [wakalah, setWakalah] = useState(false);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [ok, setOk] = useState(false);

  const amountValue = Number(cash);
  const needsGuarantor = Number.isFinite(amountValue) && amountValue > 20000;
  const aboveRoom = Number.isFinite(amountValue) && amountValue > qualification.room;
  const quote = useMemo(
    () =>
      profitBps === null
        ? null
        : quoteTawarruq({
            cashAmount: Number(cash),
            profitRateBps: profitBps,
            tenorMonths: Number(tenor),
          }),
    [cash, profitBps, tenor],
  );

  async function onSubmit(formData: FormData) {
    setPending(true);
    setMessage(null);
    const state = await submitTawarruqAction(formData);
    setPending(false);
    setOk(state.success);
    setMessage(state.message);
    if (state.success) {
      setCash('');
      setWakalah(false);
      router.refresh();
    }
  }

  return (
    <form action={onSubmit} className="jameiyah-surface max-w-xl space-y-4 p-5 sm:p-6">
      <h2 className="font-[family-name:var(--font-display)] text-xl font-semibold">
        Request from Jameiyah
      </h2>
      <p className="text-sm text-muted-foreground">
        Jameiyah buys a commodity and sells it to you at cost plus the profit below. You repay
        Jameiyah. A broker then sells that commodity so the cash reaches you. Nothing is bought or
        paid on this screen. Your group is not told.
      </p>
      <div className="rounded-lg border border-border bg-muted/40 px-3.5 py-3 text-sm">
        <p className="font-medium text-foreground">
          You qualify for up to {formatCurrency(qualification.room, 'KES')}
        </p>
        <p className="mt-1 text-muted-foreground">
          Open financing already counted: {formatCurrency(qualification.owed, 'KES')}. Jameiyah can
          still offer {formatCurrency(qualification.companyLeft, 'KES')} in total.
        </p>
        {qualification.overdue ? (
          <p className="mt-1 text-destructive">Clear the overdue loan before asking for more.</p>
        ) : null}
        {!qualification.phoneOk ? (
          <p className="mt-1 text-destructive">Add a Kenya mobile on your profile first.</p>
        ) : null}
      </div>

      <div className="space-y-2">
        <Label htmlFor="amount">Cash you want (KES)</Label>
        <Input
          id="amount"
          name="amount"
          type="number"
          min="1000"
          max="5000000"
          inputMode="numeric"
          required
          value={cash}
          onChange={(event) => setCash(event.target.value)}
          className="min-h-11"
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="tenorMonths">Months</Label>
          <select
            id="tenorMonths"
            name="tenorMonths"
            value={tenor}
            onChange={(event) => setTenor(event.target.value)}
            className="flex h-11 w-full border border-input bg-background px-3 text-sm"
          >
            {tenors.map((months) => (
              <option key={months} value={months}>
                {months}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-2">
          <p className="text-sm font-medium">Jameiyah profit</p>
          <p className="flex h-11 items-center text-sm font-semibold">
            {profitBps === null ? 'Not available' : `${profitBps / 100}% once`}
          </p>
          {profitBps !== null ? <input type="hidden" name="profitRateBps" value={profitBps} /> : null}
          <p className="text-xs text-muted-foreground">
            Set by Jameiyah for the term you choose. Added once to the cash, for the whole
            facility. Not per year, per month, or per day.
          </p>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="purpose">What the cash is for</Label>
        <Textarea id="purpose" name="purpose" minLength={5} required className="min-h-24" />
      </div>

      {quote ? (
        <dl className="space-y-2 border border-border bg-muted/30 p-4 text-sm">
          <div className="flex justify-between gap-3">
            <dt>Cash you receive</dt>
            <dd className="font-medium">{formatCurrency(quote.cashAmount, 'KES')}</dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt>You repay Jameiyah</dt>
            <dd className="font-medium">{formatCurrency(quote.deferredAmount, 'KES')}</dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt>Each month</dt>
            <dd className="font-medium">
              <span className="jm-amount">{formatCurrency(quote.installmentAmount, 'KES')}</span>
              {quote.lastInstallmentAmount !== quote.installmentAmount
                ? `, last ${formatCurrency(quote.lastInstallmentAmount, 'KES')}`
                : ''}
            </dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt>Jameiyah earns</dt>
            <dd className="font-medium">{formatCurrency(quote.profitAmount, 'KES')}</dd>
          </div>
          <p className="pt-1 text-xs text-muted-foreground">
            The total is split into equal months. The profit does not fall as you repay.
          </p>
        </dl>
      ) : (
        <p className="text-sm text-muted-foreground">
          Enter at least KES 1,000 to see what you repay Jameiyah.
        </p>
      )}

      {needsGuarantor ? (
        <div className="space-y-2">
          <Label htmlFor="guarantorUserId">Guarantor</Label>
          <select
            id="guarantorUserId"
            name="guarantorUserId"
            required
            className="flex h-11 w-full rounded-md border border-input bg-background px-3 text-sm"
            defaultValue=""
          >
            <option value="" disabled>
              Choose a member you share a circle with
            </option>
            {guarantors.map((person) => (
              <option key={person.id} value={person.id}>
                {person.name}
              </option>
            ))}
          </select>
          <p className="text-xs text-muted-foreground">
            Above KES 20,000 one guarantor must accept. Above KES 100,000 two Jameiyah admins must
            also approve. Above KES 5,000 an approved identity check is required.
          </p>
          {guarantors.length === 0 ? (
            <p className="text-xs text-destructive">
              No other active member shares a circle with you yet.
            </p>
          ) : null}
        </div>
      ) : null}

      {aboveRoom ? (
        <p className="text-sm text-destructive">
          That amount is above the {formatCurrency(qualification.room, 'KES')} your records support.
        </p>
      ) : null}

      <label className="flex min-h-11 items-start gap-3 text-sm">
        <input
          type="checkbox"
          name="wakalah"
          value="1"
          checked={wakalah}
          onChange={(event) => setWakalah(event.target.checked)}
          className="mt-1 h-4 w-4"
          required
        />
        <span>
          I appoint Jameiyah’s broker to buy the commodity and sell it for me. I will repay the
          deferred price to Jameiyah.
        </span>
      </label>

      {message ? (
        <p className={ok ? 'text-sm text-foreground' : 'text-sm text-destructive'}>{message}</p>
      ) : null}

      <Button
        type="submit"
        className="min-h-11"
        disabled={pending || !quote || !wakalah || aboveRoom || qualification.overdue || !qualification.phoneOk}
      >
        {pending ? 'Submitting…' : 'Submit request'}
      </Button>
    </form>
  );
}
