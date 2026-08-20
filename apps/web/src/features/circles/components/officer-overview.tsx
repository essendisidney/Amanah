import Link from 'next/link';
import type { Route } from 'next';
import { formatCurrency, formatDate } from '@jamiya/shared';

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
}) {
  const attention =
    lateCount + pendingGrace + pendingQard + pendingDual + openCases;

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
          {attention > 0 ? (
            <p className="mt-1 text-sm font-medium text-accent">
              {attention} item{attention === 1 ? '' : 's'} need attention
            </p>
          ) : (
            <p className="mt-1 text-sm text-muted-foreground">Queues look clear</p>
          )}
        </div>
        <Link
          href={`/circles/${slug}` as Route}
          className="text-sm font-medium text-accent hover:underline"
        >
          Back to circle
        </Link>
      </div>

      {attention > 0 ? (
        <div className="mt-4 flex flex-wrap gap-2">
          {lateCount > 0 ? (
            <a
              href="#officer-dues"
              className="rounded-full border border-border bg-secondary/60 px-3 py-1 text-xs font-semibold"
            >
              Dues {lateCount}
            </a>
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
          {pendingDual > 0 ? (
            <a
              href="#officer-dual"
              className="rounded-full border border-border bg-secondary/60 px-3 py-1 text-xs font-semibold"
            >
              Dual {pendingDual}
            </a>
          ) : null}
          {openCases > 0 ? (
            <a
              href="#officer-cases"
              className="rounded-full border border-border bg-secondary/60 px-3 py-1 text-xs font-semibold"
            >
              Cases {openCases}
            </a>
          ) : null}
        </div>
      ) : null}

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
