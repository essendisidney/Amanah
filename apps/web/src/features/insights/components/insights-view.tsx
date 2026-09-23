import Link from 'next/link';
import type { Route } from 'next';
import {
  Calculator,
  HandHeart,
  Landmark,
  Target,
} from 'lucide-react';
import { formatCurrency, formatRelativeTime, toE164Kenya } from '@jamiya/shared';
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
  const payPhoneRaw =
    dashboard.profile?.mpesa_phone?.trim() || dashboard.profile?.phone?.trim() || '';
  const payDefaultPhone =
    toE164Kenya(payPhoneRaw) ?? (/^\+[1-9]\d{7,14}$/.test(payPhoneRaw) ? payPhoneRaw : '');

  // Skip Circles / Money — those are already tabs.
  const nextStops = [
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
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-primary">
          {payLabels.insights}
        </p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
          {payLabels.insights}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">This month for {name}.</p>
      </div>

      <section className="amanah-surface space-y-1 px-4 py-4 sm:px-5">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
          Inflow this month
        </p>
        <p className="amanah-money text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
          {formatCurrency(monthInflow, currency)}
        </p>
        <p className="text-sm text-muted-foreground">
          Outflow {formatCurrency(monthOutflow, currency)} · Available{' '}
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
        <div>
          <h2 className="text-sm font-semibold text-foreground">Upcoming dues</h2>
        </div>
        {dashboard.contributions.length === 0 ? (
          <p className="amanah-surface px-4 py-5 text-sm text-muted-foreground">
            No open contributions.
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
                defaultPhone={payDefaultPhone}
                showAnchor={index === 0}
                labels={contributionLabels}
              />
            ))}
          </div>
        )}
      </section>

      <section className="space-y-3">
        <div>
          <h2 className="text-sm font-semibold text-foreground">{payLabels.sectionSee}</h2>
        </div>
        <ul className="amanah-surface divide-y divide-border/70 overflow-hidden">
          {nextStops.map((item) => {
            const Icon = item.icon;
            return (
              <li key={`${item.href}-${item.label}`}>
                <Link
                  href={item.href}
                  className="flex min-h-11 items-center gap-3 px-4 py-3 transition-colors hover:bg-muted/40"
                >
                  <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-secondary text-primary">
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
        <div>
          <h2 className="text-sm font-semibold text-foreground">Recent activity</h2>
        </div>
        {dashboard.activity.length === 0 ? (
          <EmptyState
            title="No wallet activity yet"
            description="Top up to start tracking here."
            actionLabel={payLabels.addMoney}
            actionHref={'/wallet?focus=top-up#top-up' as Route}
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
