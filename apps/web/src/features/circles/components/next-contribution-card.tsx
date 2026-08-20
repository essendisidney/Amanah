import Link from 'next/link';
import type { Route } from 'next';
import { formatCurrency, formatDate } from '@jamiya/shared';
import { Button } from '@jamiya/ui';
import {
  payContributionAction,
  payContributionAheadAction,
} from '@/features/circles/actions/ledger-actions';
import type { Dictionary } from '@/i18n/dictionaries';
import { t } from '@/i18n/dictionaries';

type Props = {
  contributionId: string;
  slug: string;
  amount: number;
  amountPaid: number;
  currency: string;
  dueDate: string;
  status: string;
  walletAvailable: number | null;
  walletCurrency: string;
  circleName?: string;
  /** When false, omit id="pay" (use for stacked lists). Default true. */
  showAnchor?: boolean;
  labels: Dictionary['contributionCard'];
};

export function NextContributionCard({
  contributionId,
  slug,
  amount,
  amountPaid,
  currency,
  dueDate,
  status,
  walletAvailable,
  walletCurrency,
  circleName,
  showAnchor = true,
  labels,
}: Props) {
  const remaining = Math.max(amount - amountPaid, 0);
  const ahead = new Date(dueDate) > new Date(new Date().toISOString().slice(0, 10));
  const canCover =
    walletAvailable != null &&
    walletCurrency === currency &&
    walletAvailable + 1e-9 >= remaining;
  const shortfall =
    walletAvailable != null && walletCurrency === currency
      ? Math.max(remaining - walletAvailable, 0)
      : remaining;
  const maxPartial =
    walletAvailable != null && walletCurrency === currency
      ? Math.min(remaining, walletAvailable)
      : remaining;

  const dueMeta = [
    circleName,
    `${labels.due} ${formatDate(dueDate)}`,
    status === 'late' ? labels.overdue : ahead ? labels.payAheadAvailable : null,
    amountPaid > 0
      ? t(labels.alreadyPaid, { amount: formatCurrency(amountPaid, currency) })
      : null,
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <section
      id={showAnchor ? 'pay' : undefined}
      className="amanah-surface space-y-4 border-primary/20 px-4 py-4 md:px-5 md:py-5"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {labels.nextTitle}
          </p>
          <p className="amanah-money mt-1 text-2xl font-bold tracking-tight">
            {formatCurrency(remaining, currency)}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">{dueMeta}</p>
        </div>
        {walletAvailable != null ? (
          <div className="rounded-xl bg-secondary/70 px-3 py-2 text-right">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              {labels.moneyAvailable}
            </p>
            <p className="mt-0.5 text-sm font-semibold">
              {formatCurrency(walletAvailable, walletCurrency)}
            </p>
          </div>
        ) : null}
      </div>

      {!canCover ? (
        <p className="text-sm text-muted-foreground">
          {walletAvailable == null
            ? labels.needWallet
            : t(labels.needMore, { amount: formatCurrency(shortfall, currency) })}
        </p>
      ) : (
        <p className="text-sm text-muted-foreground">{labels.paysFromBalance}</p>
      )}

      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-end">
        {canCover ? (
          <form
            action={ahead ? payContributionAheadAction : payContributionAction}
            className="flex flex-1 flex-col gap-2 sm:flex-row sm:items-end"
          >
            <input type="hidden" name="contributionId" value={contributionId} />
            <input type="hidden" name="slug" value={slug} />
            <label className="block text-xs text-muted-foreground">
              {labels.amountOptional}
              <input
                name="amount"
                type="number"
                inputMode="decimal"
                min={1}
                step="0.01"
                max={remaining}
                placeholder={String(remaining)}
                className="mt-1 block h-11 w-full rounded-md border border-input bg-background px-3 text-base text-foreground sm:h-10 sm:w-36 sm:text-sm"
              />
            </label>
            <Button type="submit" className="min-h-11 w-full sm:w-auto">
              {ahead ? labels.payAhead : labels.pay}
            </Button>
          </form>
        ) : (
          <Button asChild className="min-h-11 w-full sm:w-auto">
            <Link
              href={
                `/wallet?next=${encodeURIComponent(`/circles/${slug}#pay`)}&amount=${Math.max(Math.ceil(shortfall), 100)}#top-up` as Route
              }
            >
              {walletAvailable == null ? labels.addMoney : labels.addMoneyToPay}
            </Link>
          </Button>
        )}

        {!canCover && walletAvailable != null && walletAvailable > 0 ? (
          <form
            action={ahead ? payContributionAheadAction : payContributionAction}
            className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-end"
          >
            <input type="hidden" name="contributionId" value={contributionId} />
            <input type="hidden" name="slug" value={slug} />
            <label className="block text-xs text-muted-foreground">
              {labels.partialAmount}
              <input
                name="amount"
                type="number"
                inputMode="decimal"
                min={1}
                step="0.01"
                max={maxPartial}
                defaultValue={maxPartial}
                className="mt-1 block h-11 w-full rounded-md border border-input bg-background px-3 text-base text-foreground sm:h-10 sm:w-36 sm:text-sm"
              />
            </label>
            <Button type="submit" variant="outline" className="min-h-11 w-full sm:w-auto">
              {labels.payPartial}
            </Button>
          </form>
        ) : null}

        <Button asChild variant="ghost" size="sm" className="min-h-11">
          <Link href="#calendar">{labels.calendar}</Link>
        </Button>
      </div>
    </section>
  );
}
