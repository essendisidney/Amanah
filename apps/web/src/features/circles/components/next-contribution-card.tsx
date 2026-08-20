import Link from 'next/link';
import type { Route } from 'next';
import { formatCurrency, formatDate } from '@jamiya/shared';
import { Button } from '@jamiya/ui';
import {
  payContributionAction,
  payContributionAheadAction,
} from '@/features/circles/actions/ledger-actions';

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

  return (
    <section
      id={showAnchor ? 'pay' : undefined}
      className="amanah-surface space-y-4 border-primary/20 px-4 py-4 md:px-5 md:py-5"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Your next contribution
          </p>
          <p className="amanah-money mt-1 text-2xl font-bold tracking-tight">
            {formatCurrency(remaining, currency)}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            {circleName ? `${circleName} · ` : ''}
            Due {formatDate(dueDate)}
            {status === 'late' ? ' · overdue' : ahead ? ' · pay ahead available' : ''}
            {amountPaid > 0
              ? ` · ${formatCurrency(amountPaid, currency)} already paid`
              : ''}
          </p>
        </div>
        {walletAvailable != null ? (
          <div className="rounded-xl bg-secondary/70 px-3 py-2 text-right">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              Wallet available
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
            ? 'Open Money to create your wallet, top up, then pay this contribution.'
            : `You need about ${formatCurrency(shortfall, currency)} more in your wallet to pay in full.`}
        </p>
      ) : (
        <p className="text-sm text-muted-foreground">
          Pays from your Amanah wallet into this circle account.
        </p>
      )}

      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
        {canCover ? (
          <form
            action={ahead ? payContributionAheadAction : payContributionAction}
            className="flex flex-1 flex-col gap-2 sm:flex-row sm:items-end"
          >
            <input type="hidden" name="contributionId" value={contributionId} />
            <input type="hidden" name="slug" value={slug} />
            <Button type="submit" className="min-h-11 w-full sm:w-auto">
              {ahead ? 'Pay ahead from wallet' : 'Pay from wallet'}
            </Button>
          </form>
        ) : (
          <Button asChild className="min-h-11 w-full sm:w-auto">
            <Link
              href={
                `/wallet?next=${encodeURIComponent(`/circles/${slug}#pay`)}&amount=${Math.max(Math.ceil(shortfall), 100)}#top-up` as Route
              }
            >
              {walletAvailable == null ? 'Open Money' : 'Top up, then pay'}
            </Link>
          </Button>
        )}

        {!canCover && walletAvailable != null && walletAvailable > 0 ? (
          <form action={ahead ? payContributionAheadAction : payContributionAction}>
            <input type="hidden" name="contributionId" value={contributionId} />
            <input type="hidden" name="slug" value={slug} />
            <input type="hidden" name="amount" value={String(walletAvailable)} />
            <Button type="submit" variant="outline" className="min-h-11 w-full sm:w-auto">
              Pay {formatCurrency(walletAvailable, currency)} now
            </Button>
          </form>
        ) : null}

        <Button asChild variant="ghost" size="sm" className="min-h-11">
          <Link href="#calendar">View calendar</Link>
        </Button>
      </div>
    </section>
  );
}
