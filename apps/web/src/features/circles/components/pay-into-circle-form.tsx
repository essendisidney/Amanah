import { formatCurrency, KE_PHONE_PLACEHOLDER } from '@jamiya/shared';
import { Button } from '@jamiya/ui';
import {
  payIntoCircleMpesaAction,
  payIntoCircleWalletAction,
} from '@/features/circles/actions/ledger-actions';

type Props = {
  jamiyaId: string;
  slug: string;
  circleName: string;
  defaultAmount: number;
  currency?: string;
  defaultPhone?: string | null;
  /** Pay page stays on Pay after submit. */
  returnTo?: '/pay';
  anchorId?: string;
};

export function PayIntoCircleForm({
  jamiyaId,
  slug,
  circleName,
  defaultAmount,
  currency = 'KES',
  defaultPhone = '',
  returnTo,
  anchorId = 'pay-into',
}: Props) {
  const linked = (defaultPhone ?? '').trim();
  const hasLinked = /^\+[1-9]\d{7,14}$/.test(linked);
  const amountDefault =
    Number.isFinite(defaultAmount) && defaultAmount > 0 ? String(defaultAmount) : '';
  const amountLabel =
    Number.isFinite(defaultAmount) && defaultAmount > 0
      ? formatCurrency(defaultAmount, currency)
      : null;

  return (
    <section
      id={anchorId}
      className="jameiyah-surface space-y-4 border-primary/20 px-4 py-4 sm:px-5"
    >
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
          Make a contribution
        </p>
        <h2 className="mt-1 text-base font-semibold tracking-tight text-foreground sm:text-lg">
          {circleName}
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {amountLabel
            ? `Your contribution is ${amountLabel}. Pay it from your wallet, or with M-Pesa.`
            : 'Enter your contribution, then pay from your wallet or with M-Pesa.'}
        </p>
      </div>
      <form className="space-y-3">
        <input type="hidden" name="jamiyaId" value={jamiyaId} />
        <input type="hidden" name="slug" value={slug} />
        {returnTo === '/pay' ? <input type="hidden" name="returnTo" value="/pay" /> : null}
        <label className="block text-xs text-muted-foreground">
          Amount
          <input
            name="amount"
            type="number"
            inputMode="decimal"
            min="1"
            step="0.01"
            required
            defaultValue={amountDefault}
            className="mt-1 block h-11 w-full rounded-md border border-input bg-background px-3 text-base text-foreground sm:h-10 sm:text-sm"
          />
        </label>
        <label className="block text-xs text-muted-foreground">
          M-Pesa number
          <input
            name="phone"
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            placeholder={KE_PHONE_PLACEHOLDER}
            defaultValue={hasLinked ? linked : undefined}
            className="mt-1 block h-11 w-full rounded-md border border-input bg-background px-3 text-base text-foreground sm:h-10 sm:text-sm"
          />
        </label>
        <Button type="submit" formAction={payIntoCircleWalletAction} className="min-h-11 w-full">
          Contribute from wallet
        </Button>
        <Button
          type="submit"
          formAction={payIntoCircleMpesaAction}
          variant="outline"
          className="min-h-11 w-full"
        >
          Contribute with M-Pesa
        </Button>
      </form>
    </section>
  );
}
