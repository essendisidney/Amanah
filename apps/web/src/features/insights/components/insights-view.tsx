import Link from 'next/link';
import type { Route } from 'next';
import {
  Calculator,
  HandHeart,
  Landmark,
  LayoutGrid,
  Target,
  Wallet,
} from 'lucide-react';
import { formatCurrency, formatRelativeTime } from '@jamiya/shared';
import { Button } from '@jamiya/ui';
import type { InsightsData } from '../lib/get-insights-data';
import { NextContributionCard } from '@/features/circles/components/next-contribution-card';
import { EmptyState } from '@/features/dashboard/components/empty-state';
import type { Dictionary } from '@/i18n/dictionaries';

export function InsightsView({
  data,
  contributionLabels,
  payLabels,
}: {
  data: InsightsData;
  contributionLabels: Dictionary['contributionCard'];
  payLabels: Dictionary['paySheet'];
}) {
  const { dashboard, monthInflow, monthOutflow, currency, onTimeRate, openDueTotal } = data;
  const name = dashboard.profile?.full_name?.split(' ')[0] ?? 'there';

  const nextStops = [
    {
      href: '/pay' as Route,
      label: payLabels.title,
      hint: payLabels.subtitle,
      icon: Wallet,
    },
    {
      href: '/wallet' as Route,
      label: payLabels.openMoney,
      hint: payLabels.openMoneyHint,
      icon: Wallet,
    },
    {
      href: '/circles' as Route,
      label: payLabels.payCircle,
      hint: payLabels.payCircleHint,
      icon: LayoutGrid,
    },
    {
      href: '/finance/goals' as Route,
      label: payLabels.goals,
      hint: payLabels.goalsHint,
      icon: Target,
    },
    {
      href: '/finance/qard' as Route,
      label: payLabels.qard,
      hint: payLabels.qardHint,
      icon: Landmark,
    },
    {
      href: '/sadaka' as Route,
      label: payLabels.sadaka,
      hint: payLabels.sadakaHint,
      icon: HandHeart,
    },
    {
      href: '/zakat' as Route,
      label: payLabels.zakat,
      hint: payLabels.zakatHint,
      icon: Calculator,
    },
  ];

  return (
    <div className="space-y-8">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-accent">
          <Link href={'/pay' as Route} className="hover:text-primary">
            {payLabels.title}
          </Link>
          <span className="text-muted-foreground"> · </span>
          {payLabels.insights}
        </p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight md:text-4xl">
          {payLabels.insights}
        </h1>
        <p className="mt-2 text-muted-foreground">
          A quiet snapshot of how {name} is saving and contributing this month.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button asChild className="min-h-11">
            <Link href={'/pay' as Route}>{payLabels.title}</Link>
          </Button>
          <Button asChild variant="outline" className="min-h-11">
            <Link href={'/wallet#top-up' as Route}>{payLabels.addMoney}</Link>
          </Button>
        </div>
      </div>

      <section className="amanah-forest overflow-hidden rounded-[1.75rem] p-5 text-white md:p-7">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/70">
          Inflow this month
        </p>
        <p className="amanah-money mt-2 text-4xl font-bold tracking-tight md:text-5xl">
          {formatCurrency(monthInflow, currency)}
        </p>
        <p className="mt-2 text-sm text-white/80">
          Outflow {formatCurrency(monthOutflow, currency)} · Money available{' '}
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
            <p className="text-sm text-muted-foreground">Pay from wallet or top up, then settle</p>
          </div>
          <Button asChild size="sm" variant="ghost">
            <Link href={'/circles' as Route}>{payLabels.payCircle}</Link>
          </Button>
        </div>
        {dashboard.contributions.length === 0 ? (
          <p className="amanah-surface px-4 py-5 text-sm text-muted-foreground">
            No open contributions. You are clear for now.
          </p>
        ) : (
          <div className="space-y-3">
            {dashboard.contributions.map((item, index) => (
              <NextContributionCard
                key={item.id}
                contributionId={item.id}
                slug={item.jamiyaSlug}
                amount={item.amount}
                amountPaid={item.amountPaid}
                currency={item.currency}
                dueDate={item.dueDate}
                status={item.status}
                walletAvailable={dashboard.wallet?.availableBalance ?? null}
                walletCurrency={dashboard.wallet?.currency ?? item.currency}
                circleName={item.jamiyaName}
                showAnchor={index === 0}
                labels={contributionLabels}
              />
            ))}
          </div>
        )}
      </section>

      <section className="space-y-3">
        <div>
          <h2 className="text-lg font-bold tracking-tight">{payLabels.sectionSee}</h2>
          <p className="text-sm text-muted-foreground">
            Everything under Pay — tap any tool to continue.
          </p>
        </div>
        <ul className="overflow-hidden rounded-[1.35rem] border border-border/70 bg-card/40">
          {nextStops.map((item) => {
            const Icon = item.icon;
            return (
              <li
                key={item.href}
                className="border-b border-border/60 last:border-0"
              >
                <Link
                  href={item.href}
                  className="flex items-center gap-3 px-4 py-3.5 transition-colors active:bg-secondary/40"
                >
                  <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-secondary text-primary">
                    <Icon className="h-4 w-4" strokeWidth={1.75} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold text-foreground">
                      {item.label}
                    </span>
                    <span className="mt-0.5 block text-xs text-muted-foreground">
                      {item.hint}
                    </span>
                  </span>
                  <span className="text-muted-foreground" aria-hidden>
                    →
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </section>

      <section className="space-y-3">
        <div className="flex items-end justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold tracking-tight">Recent activity</h2>
            <p className="text-sm text-muted-foreground">Latest wallet movements</p>
          </div>
          <Button asChild size="sm" variant="ghost">
            <Link href={'/wallet' as Route}>{payLabels.openMoney}</Link>
          </Button>
        </div>
        {dashboard.activity.length === 0 ? (
          <EmptyState
            title="No wallet activity yet"
            description="Top up to start tracking inflows and outflows here."
            actionLabel={payLabels.addMoney}
            actionHref={'/wallet#top-up' as Route}
          />
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
    </div>
  );
}
