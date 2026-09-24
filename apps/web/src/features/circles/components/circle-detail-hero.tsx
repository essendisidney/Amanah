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
}: Props) {
  const accent = circleAccentClass(slug);
  const meta = [kindLabel, roleLabel].filter(Boolean).join(' · ');
  const dueRemaining = personalDue && personalDue.remaining > 0 ? personalDue.remaining : null;
  const heroAmount = dueRemaining ?? poolAmount;
  const heroLabel = dueRemaining != null ? 'You owe' : 'Pool so far';
  const overdue = personalDue?.status === 'late';

  return (
    <section className={`relative overflow-hidden ${accent}`}>
      <div className="amanah-surface relative border-l-4 border-l-primary px-4 py-4 sm:px-5 sm:py-5">
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
            <p className="amanah-money mt-0.5 text-3xl font-bold tracking-tight sm:text-4xl">
              {formatCurrency(heroAmount, currency)}
            </p>
            {dueRemaining != null ? (
              <p className="mt-1 text-xs text-muted-foreground sm:text-sm">
                Pool {formatCurrency(poolAmount, currency)}
                {personalDue?.dueDate ? ` · due ${formatDate(personalDue.dueDate)}` : ''}
                {' · '}
                <Link
                  href={`#pay-due` as Route}
                  className="font-semibold text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                >
                  Pay now
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
                <dd className="amanah-money mt-0.5 text-sm font-semibold text-foreground">
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
