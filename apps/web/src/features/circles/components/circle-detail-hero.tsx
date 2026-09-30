import Link from 'next/link';
import type { Route } from 'next';
import { formatCurrency, formatDate } from '@jamiya/shared';
import { StatusBadge } from '@/features/dashboard/components/dashboard-stats';
import { circleAccentClass } from '@/features/circles/lib/circle-accent';

type Stat = {
  label: string;
  value: string;
};

type PersonalDue = {
  remaining: number;
  dueDate?: string | null;
  status?: string;
};

type Props = {
  slug: string;
  name: string;
  status: string;
  roleLabel?: string | null;
  segmentLabel?: string | null;
  kindLabel?: string | null;
  description?: string | null;
  poolAmount: number;
  currency: string;
  memberSummary: string;
  stats: Stat[];
  personalDue?: PersonalDue | null;
  /** Share groups keep these three totals apart. */
  moneyBooks?: {
    shares: number;
    bookContributions: number;
    schedulePaid: number;
  } | null;
};

export function CircleDetailHero({
  slug,
  name,
  status,
  roleLabel,
  segmentLabel: _segmentLabel,
  kindLabel,
  description: _description,
  poolAmount,
  currency,
  memberSummary,
  stats,
  personalDue = null,
  moneyBooks = null,
}: Props) {
  const accent = circleAccentClass(slug);
  const meta = [kindLabel, roleLabel].filter(Boolean).join(' · ');
  const dueRemaining = personalDue && personalDue.remaining > 0 ? personalDue.remaining : null;
  const heroAmount = dueRemaining ?? poolAmount;
  const overdue = personalDue?.status === 'late';
  // "You owe" only when the payment is due within a week (or late); further out it is the next contribution.
  const daysToDue = personalDue?.dueDate
    ? Math.ceil((Date.parse(`${personalDue.dueDate.slice(0, 10)}T00:00:00Z`) - Date.now()) / 86_400_000)
    : null;
  const upcoming = !overdue && daysToDue != null && daysToDue > 7;
  const heroLabel =
    dueRemaining != null
      ? upcoming
        ? 'Next contribution'
        : 'You owe'
      : moneyBooks
        ? 'Group money'
        : 'Pool so far';

  return (
    <section className={`relative overflow-hidden ${accent}`}>
      <div className="jameiyah-surface relative border-l-4 border-l-primary px-4 py-4 sm:px-5 sm:py-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="truncate font-[family-name:var(--font-display)] text-xl font-semibold tracking-tight sm:text-2xl">
              {name}
            </h1>
            <p className="mt-1 text-xs text-muted-foreground sm:text-sm">
              {[meta, memberSummary].filter(Boolean).join(' · ')}
            </p>
          </div>
          <StatusBadge status={status} />
        </div>

        <div className="mt-4 flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              {heroLabel}
              {dueRemaining != null && overdue ? ' · overdue' : ''}
            </p>
            {dueRemaining != null || !moneyBooks ? (
              <p className="jameiyah-money mt-0.5 text-3xl font-bold tracking-tight sm:text-4xl">
                <span className="jm-amount">{formatCurrency(heroAmount, currency)}</span>
              </p>
            ) : null}
            {moneyBooks ? (
              <dl className="mt-3 max-w-md space-y-1.5 text-sm">
                <div className="flex items-baseline justify-between gap-3">
                  <dt className="text-muted-foreground">Shares</dt>
                  <dd className="font-semibold">{formatCurrency(moneyBooks.shares, currency)}</dd>
                </div>
                <div className="flex items-baseline justify-between gap-3">
                  <dt className="text-muted-foreground">Contributions in the books</dt>
                  <dd className="font-semibold">
                    <span className="jm-amount">{formatCurrency(moneyBooks.bookContributions, currency)}</span>
                  </dd>
                </div>
                <div className="flex items-baseline justify-between gap-3">
                  <dt className="text-muted-foreground">Paid on the schedule</dt>
                  <dd className="font-semibold">
                    <span className="jm-amount">{formatCurrency(moneyBooks.schedulePaid, currency)}</span>
                  </dd>
                </div>
                <p className="pt-1 text-xs text-muted-foreground">
                  Three separate records. The schedule line is only payments marked paid.
                </p>
              </dl>
            ) : null}
            {dueRemaining != null ? (
              <p className="mt-1 text-xs text-muted-foreground sm:text-sm">
                {moneyBooks ? null : <>Pool {formatCurrency(poolAmount, currency)} · </>}
                {personalDue?.dueDate ? `due ${formatDate(personalDue.dueDate)} · ` : ''}
                <Link
                  href={`#pay-due` as Route}
                  className="font-semibold text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                >
                  {upcoming ? 'Pay ahead' : 'Pay now'}
                </Link>
              </p>
            ) : null}
          </div>
        </div>

        {stats.length > 0 ? (
          <dl className="mt-4 grid grid-cols-2 gap-3 border-t border-border/70 pt-3 sm:grid-cols-4">
            {stats.slice(0, 4).map((stat) => (
              <div key={stat.label}>
                <dt className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                  {stat.label}
                </dt>
                <dd className="jameiyah-money mt-0.5 text-sm font-semibold text-foreground">
                  {stat.value}
                </dd>
              </div>
            ))}
          </dl>
        ) : null}
      </div>
    </section>
  );
}
