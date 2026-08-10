import Link from 'next/link';
import type { Route } from 'next';
import { formatCurrency, formatDate } from '@jamiya/shared';

export function OfficerOverviewStrip({
  slug,
  lateCount,
  pendingGrace,
  nextPayoutLabel,
  nextPayoutDate,
  nextPayoutAmount,
  currency,
}: {
  slug: string;
  lateCount: number;
  pendingGrace: number;
  nextPayoutLabel: string | null;
  nextPayoutDate: string | null;
  nextPayoutAmount: number | null;
  currency: string;
}) {
  return (
    <section className="rounded-xl border border-border bg-card p-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Officer overview
          </p>
          <h2 className="mt-1 font-[family-name:var(--font-display)] text-xl font-semibold">
            Treasurer snapshot
          </h2>
        </div>
        <Link
          href={`/circles/${slug}/officer` as Route}
          className="text-sm font-medium text-accent hover:underline"
        >
          Officer console
        </Link>
      </div>
      <dl className="mt-4 grid gap-4 sm:grid-cols-3">
        <div>
          <dt className="text-xs uppercase tracking-wide text-muted-foreground">Late dues</dt>
          <dd className="mt-1 text-2xl font-semibold">{lateCount}</dd>
        </div>
        <div>
          <dt className="text-xs uppercase tracking-wide text-muted-foreground">
            Pending grace
          </dt>
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
