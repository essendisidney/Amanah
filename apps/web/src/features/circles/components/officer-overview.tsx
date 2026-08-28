import { formatCurrency, formatDate } from '@jamiya/shared';
import Link from 'next/link';
import type { Route } from 'next';
import { Button } from '@jamiya/ui';

export function OfficerOverviewStrip({
  slug,
  lateCount,
  pendingGrace,
  pendingQard = 0,
  pendingDual = 0,
  openCases = 0,
  nextPayoutLabel,
  nextPayoutDate,
  nextPayoutAmount,
  currency,
  unpaidMemberLabels = [],
  openPenaltyCount = 0,
  recordPaymentHref,
  recordPaymentLabel = 'Record payment',
  cycleLabel,
}: {
  slug: string;
  lateCount: number;
  pendingGrace: number;
  pendingQard?: number;
  pendingDual?: number;
  openCases?: number;
  nextPayoutLabel: string | null;
  nextPayoutDate: string | null;
  nextPayoutAmount: number | null;
  currency: string;
  /** Members who still owe this round / have open dues */
  unpaidMemberLabels?: string[];
  openPenaltyCount?: number;
  recordPaymentHref?: string;
  recordPaymentLabel?: string;
  cycleLabel?: string | null;
}) {
  const attention =
    lateCount + pendingGrace + pendingQard + pendingDual + openCases + openPenaltyCount;
  const unpaidPreview = unpaidMemberLabels.slice(0, 4);
  const unpaidMore = Math.max(unpaidMemberLabels.length - unpaidPreview.length, 0);

  return (
    <section className="amanah-surface px-5 py-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Today
          </p>
          <h2 className="mt-1 font-[family-name:var(--font-display)] text-xl font-semibold">
            Officer snapshot
          </h2>
          {cycleLabel ? (
            <p className="mt-1 text-sm text-muted-foreground">{cycleLabel}</p>
          ) : null}
          {attention > 0 ? (
            <p className="mt-1 text-sm font-medium text-accent">
              {attention} item{attention === 1 ? '' : 's'} need attention
            </p>
          ) : (
            <p className="mt-1 text-sm text-muted-foreground">All caught up for now</p>
          )}
        </div>
        {recordPaymentHref ? (
          <Button asChild size="sm" className="min-h-11 rounded-full">
            <Link href={recordPaymentHref as Route}>{recordPaymentLabel}</Link>
          </Button>
        ) : null}
      </div>

      {unpaidMemberLabels.length > 0 ? (
        <div className="mt-4 rounded-xl border border-accent/25 bg-accent/5 px-4 py-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Still owing ({unpaidMemberLabels.length})
          </p>
          <p className="mt-1 text-sm font-medium text-foreground">
            {unpaidPreview.join(', ')}
            {unpaidMore > 0 ? ` +${unpaidMore} more` : ''}
          </p>
        </div>
      ) : null}

      {attention > 0 ? (
        <div className="mt-4 flex flex-wrap gap-2">
          {unpaidMemberLabels.length > 0 && recordPaymentHref ? (
            <Link
              href={recordPaymentHref as Route}
              className="rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-semibold text-primary"
            >
              Collect {unpaidMemberLabels.length}
            </Link>
          ) : null}
          {lateCount > 0 ? (
            <a
              href="#calendar"
              className="rounded-full border border-border bg-secondary/60 px-3 py-1 text-xs font-semibold"
            >
              Late {lateCount}
            </a>
          ) : null}
          {openPenaltyCount > 0 ? (
            <Link
              href={`/circles/${slug}/statement` as Route}
              className="rounded-full border border-border bg-secondary/60 px-3 py-1 text-xs font-semibold"
            >
              Fines {openPenaltyCount}
            </Link>
          ) : null}
          {pendingGrace > 0 ? (
            <a
              href="#officer-grace"
              className="rounded-full border border-border bg-secondary/60 px-3 py-1 text-xs font-semibold"
            >
              Grace {pendingGrace}
            </a>
          ) : null}
          {pendingQard > 0 ? (
            <a
              href="#officer-qard"
              className="rounded-full border border-border bg-secondary/60 px-3 py-1 text-xs font-semibold"
            >
              Qard {pendingQard}
            </a>
          ) : null}
        </div>
      ) : null}

      <dl className="mt-4 grid gap-4 sm:grid-cols-3">
        <div>
          <dt className="text-xs uppercase tracking-wide text-muted-foreground">Open dues</dt>
          <dd className="mt-1 text-2xl font-semibold">{unpaidMemberLabels.length || lateCount}</dd>
        </div>
        <div>
          <dt className="text-xs uppercase tracking-wide text-muted-foreground">Pending grace</dt>
          <dd className="mt-1 text-2xl font-semibold">{pendingGrace}</dd>
        </div>
        <div>
          <dt className="text-xs uppercase tracking-wide text-muted-foreground">Next payout</dt>
          <dd className="mt-1 text-sm font-medium">
            {nextPayoutLabel && nextPayoutAmount != null
              ? `${nextPayoutLabel} · ${formatCurrency(nextPayoutAmount, currency)}`
              : 'None scheduled'}
          </dd>
          {nextPayoutDate ? (
            <p className="mt-1 text-xs text-muted-foreground">{formatDate(nextPayoutDate)}</p>
          ) : null}
        </div>
      </dl>
    </section>
  );
}
