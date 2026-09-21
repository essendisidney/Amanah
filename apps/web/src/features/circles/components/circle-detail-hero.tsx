import { formatCurrency } from '@jamiya/shared';
import { StatusBadge } from '@/features/dashboard/components/dashboard-stats';
import { circleAccentClass } from '@/features/circles/lib/circle-accent';

type Stat = {
  label: string;
  value: string;
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
};

export function CircleDetailHero({
  slug,
  name,
  status,
  roleLabel,
  segmentLabel,
  kindLabel,
  description,
  poolAmount,
  currency,
  memberSummary,
  stats,
}: Props) {
  const accent = circleAccentClass(slug);
  const meta = [kindLabel, roleLabel].filter(Boolean).join(' · ');

  return (
    <section className={`relative overflow-hidden rounded-2xl ${accent}`}>
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,_rgba(255,255,255,0.55)_0%,_transparent_52%)] dark:bg-[radial-gradient(ellipse_at_top_left,_rgba(255,255,255,0.08)_0%,_transparent_52%)]"
        aria-hidden
      />
      <div className="amanah-surface relative border-primary/15 px-5 py-6 sm:px-6 sm:py-7">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h1 className="truncate font-[family-name:var(--font-display)] text-2xl font-semibold tracking-tight sm:text-3xl">
              {name}
            </h1>
            <p className="mt-1 text-sm capitalize text-muted-foreground">
              {status.replaceAll('_', ' ')}
              {meta ? ` · ${meta}` : ''}
              {memberSummary ? ` · ${memberSummary}` : ''}
            </p>
          </div>
          <StatusBadge status={status} />
        </div>

        <p className="amanah-money mt-6 text-4xl font-bold tracking-tight sm:text-5xl">
          {formatCurrency(poolAmount, currency)}
        </p>

        {stats.length > 0 ? (
          <dl className="mt-6 grid grid-cols-2 gap-4 border-t border-border/60 pt-5 sm:grid-cols-4">
            {stats.slice(0, 4).map((stat) => (
              <div key={stat.label}>
                <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  {stat.label}
                </dt>
                <dd className="amanah-money mt-1 text-base font-semibold text-foreground">
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
