import Link from 'next/link';
import type { Route } from 'next';
import { formatCurrency, formatDate, formatRelativeTime } from '@jamiya/shared';
import { Button } from '@jamiya/ui';
import type { InsightsData } from '../lib/get-insights-data';

export function InsightsView({ data }: { data: InsightsData }) {
  const { dashboard, monthInflow, monthOutflow, currency, onTimeRate, openDueTotal } = data;
  const name = dashboard.profile?.full_name?.split(' ')[0] ?? 'there';

  return (
    <div className="space-y-8">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-accent">Insights</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight md:text-4xl">Your money story</h1>
        <p className="mt-2 text-muted-foreground">
          A quiet snapshot of how {name} is saving and contributing this month.
        </p>
      </div>

      <section className="amanah-surface overflow-hidden bg-[linear-gradient(145deg,#0b5c42_0%,#0f766e_55%,#0b5c42_100%)] p-5 text-primary-foreground md:p-7">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/70">
          Inflow this month
        </p>
        <p className="amanah-money mt-2 text-4xl font-bold tracking-tight md:text-5xl">
          {formatCurrency(monthInflow, currency)}
        </p>
        <p className="mt-2 text-sm text-white/80">
          Outflow {formatCurrency(monthOutflow, currency)} · Wallet available{' '}
          {formatCurrency(dashboard.wallet?.availableBalance ?? 0, currency)}
        </p>
      </section>

      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          {
            label: 'On-time rate',
            value: onTimeRate == null ? '—' : `${onTimeRate}%`,
            hint:
              onTimeRate == null
                ? 'Pay a few cycles to unlock'
                : `${data.paidCount} on time · ${data.lateCount} late`,
          },
          {
            label: 'Active circles',
            value: String(dashboard.stats.activeCircles),
            hint: 'Memberships in good standing',
          },
          {
            label: 'Open dues',
            value: String(dashboard.stats.pendingContributions),
            hint: formatCurrency(openDueTotal, currency),
          },
          {
            label: 'Upcoming payouts',
            value: String(dashboard.stats.upcomingPayouts),
            hint: 'Turns headed your way',
          },
        ].map((stat) => (
          <div key={stat.label} className="amanah-surface px-3 py-3.5">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              {stat.label}
            </p>
            <p className="amanah-money mt-1 text-2xl font-bold tracking-tight">{stat.value}</p>
            <p className="mt-1 text-[11px] text-muted-foreground">{stat.hint}</p>
          </div>
        ))}
      </section>

      <section className="space-y-3">
        <div className="flex items-end justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold tracking-tight">Upcoming dues</h2>
            <p className="text-sm text-muted-foreground">What still needs settling</p>
          </div>
          <Button asChild size="sm" variant="ghost">
            <Link href={'/circles' as Route}>Circles</Link>
          </Button>
        </div>
        {dashboard.contributions.length === 0 ? (
          <p className="amanah-surface px-4 py-5 text-sm text-muted-foreground">
            No open contributions. You are clear for now.
          </p>
        ) : (
          <ul className="amanah-surface divide-y divide-border/70 overflow-hidden p-0">
            {dashboard.contributions.map((item) => {
              const remaining = Math.max(item.amount - item.amountPaid, 0);
              return (
                <li
                  key={item.id}
                  className="flex flex-wrap items-center justify-between gap-3 px-4 py-3.5"
                >
                  <div>
                    <p className="text-sm font-semibold">{item.jamiyaName}</p>
                    <p className="text-xs text-muted-foreground">
                      Cycle {item.cycleNumber} · due {formatDate(item.dueDate)} · {item.status}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <p className="amanah-money text-sm font-bold">
                      {formatCurrency(remaining, item.currency)}
                    </p>
                    <Button asChild size="sm">
                      <Link href={`/circles/${item.jamiyaSlug}#pay` as Route}>Pay</Link>
                    </Button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="space-y-3">
        <div className="flex items-end justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold tracking-tight">Recent activity</h2>
            <p className="text-sm text-muted-foreground">Latest wallet movements</p>
          </div>
          <Button asChild size="sm" variant="ghost">
            <Link href={'/wallet' as Route}>Money</Link>
          </Button>
        </div>
        {dashboard.activity.length === 0 ? (
          <p className="amanah-surface px-4 py-5 text-sm text-muted-foreground">
            No wallet activity yet. Top up to get started.
          </p>
        ) : (
          <ul className="amanah-surface divide-y divide-border/70 overflow-hidden p-0">
            {dashboard.activity.map((row) => {
              const inflow = row.direction === 'credit';
              return (
                <li
                  key={row.id}
                  className="flex items-center justify-between gap-3 px-4 py-3.5"
                >
                  <div>
                    <p className="text-sm font-semibold capitalize">
                      {row.type.replaceAll('_', ' ')}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {formatRelativeTime(row.createdAt)}
                      {row.reference ? ` · ${row.reference}` : ''}
                    </p>
                  </div>
                  <p
                    className={
                      inflow
                        ? 'amanah-money text-sm font-bold text-primary'
                        : 'amanah-money text-sm font-bold text-foreground'
                    }
                  >
                    {inflow ? '+' : '−'}
                    {formatCurrency(row.amount, row.currency)}
                  </p>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="flex flex-wrap gap-2">
        <Button asChild variant="outline">
          <Link href={'/finance/goals' as Route}>Savings goals</Link>
        </Button>
        <Button asChild variant="ghost">
          <Link href={'/wallet' as Route}>Back to Money</Link>
        </Button>
      </section>
    </div>
  );
}
