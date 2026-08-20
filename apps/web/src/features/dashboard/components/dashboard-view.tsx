import Link from 'next/link';
import type { Route } from 'next';
import { ArrowDownLeft, ArrowUpRight, ChartNoAxesCombined, PiggyBank, Plus } from 'lucide-react';
import { formatCurrency, formatRelativeTime, isValidKeMobile } from '@jamiya/shared';
import { Button } from '@jamiya/ui';
import type { Dictionary } from '@/i18n/dictionaries';
import type { DashboardData } from '../types';
import { NextContributionCard } from '@/features/circles/components/next-contribution-card';

function greetingForHour(hour: number) {
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

function circleProgress(current: number, total: number | null) {
  if (!total || total <= 0) return 0;
  return Math.min(100, Math.round((current / total) * 100));
}

function AmanahScoreCard({
  consistency,
  circles,
  kycOk,
}: {
  consistency: number;
  circles: number;
  kycOk: boolean;
}) {
  const score = Math.min(
    850,
    620 + consistency * 18 + Math.min(circles, 4) * 25 + (kycOk ? 40 : 0),
  );
  const label = score >= 750 ? 'Excellent' : score >= 680 ? 'Strong' : 'Building';
  return (
    <section className="amanah-surface p-5">
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-accent">
        Amanah Score
      </p>
      <div className="mt-3 flex items-end justify-between gap-4">
        <div>
          <p className="amanah-money text-4xl font-bold tracking-tight text-foreground">{score}</p>
          <p className="mt-1 text-sm font-medium text-primary">{label}</p>
        </div>
        <div className="max-w-[12rem] text-right">
          <p className="text-xs leading-relaxed text-muted-foreground">
            Based on contribution consistency, circle participation, and account activity.
          </p>
          <Button asChild size="sm" variant="ghost" className="mt-2 h-8 px-2">
            <Link href={'/finance/insights' as Route}>View Insights</Link>
          </Button>
        </div>
      </div>
    </section>
  );
}

export function DashboardView({
  data,
  email,
  labels,
  common,
}: {
  data: DashboardData;
  email?: string | null;
  labels: Dictionary['dashboard'];
  common: Dictionary['common'];
}) {
  const firstName =
    data.profile?.full_name?.split(/\s+/)[0] ||
    email?.split('@')[0] ||
    'there';
  const greeting = greetingForHour(new Date().getHours());
  const currency = data.wallet?.currency ?? 'KES';
  const total = data.wallet?.balance ?? 0;
  const available = data.wallet?.availableBalance ?? total;
  const committed = data.stats.committedAmount;
  const monthInflow = data.stats.monthInflow;
  const nextDue = data.contributions[0];
  const needsPhone =
    Boolean(data.profile) &&
    !isValidKeMobile(String(data.profile?.phone ?? '').trim());
  const needsProfile = Boolean(data.profile && !data.profile.profile_completed);

  const quickActions: Array<{
    href: Route;
    label: string;
    icon: typeof Plus;
  }> = [
    { href: '/wallet' as Route, label: 'Add money', icon: Plus },
    { href: '/finance/insights' as Route, label: 'Insights', icon: ChartNoAxesCombined },
    { href: '/finance/goals' as Route, label: 'Save', icon: PiggyBank },
    { href: '/wallet' as Route, label: 'Withdraw', icon: ArrowUpRight },
  ];

  return (
    <div className="space-y-7 md:space-y-8">
      <header className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm text-muted-foreground">
            {greeting}, <span className="font-semibold text-foreground">{firstName}</span>
          </p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-foreground md:text-3xl">
            Your Amanah
          </h1>
        </div>
        {needsPhone || needsProfile ? (
          <Button asChild size="sm" variant="outline">
            <Link
              href={
                (needsPhone
                  ? '/profile?onboarding=1&next=/dashboard#personal-details'
                  : '/profile') as Route
              }
            >
              {needsPhone ? 'Add phone' : labels.completeProfile}
            </Link>
          </Button>
        ) : null}
      </header>

      <section className="amanah-surface overflow-hidden bg-[linear-gradient(145deg,#0b5c42_0%,#0f766e_55%,#0b5c42_100%)] p-5 text-primary-foreground shadow-[0_12px_40px_rgba(11,92,66,0.22)] md:p-7">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-white/70">
          Total Amanah
        </p>
        <p className="amanah-money mt-2 text-4xl font-bold tracking-tight md:text-5xl">
          {formatCurrency(total, currency)}
        </p>
        <p className="mt-2 text-sm text-white/80">
          {monthInflow > 0 ? (
            <>
              ↑ {formatCurrency(monthInflow, currency)} this month
            </>
          ) : (
            <>Available {formatCurrency(available, currency)}</>
          )}
        </p>
        <div className="mt-5 grid grid-cols-2 gap-3 text-sm">
          <div className="rounded-xl bg-white/10 px-3 py-2.5 backdrop-blur-sm">
            <p className="text-[11px] uppercase tracking-wide text-white/65">Available</p>
            <p className="amanah-money mt-1 font-semibold">
              {formatCurrency(available, currency)}
            </p>
          </div>
          <div className="rounded-xl bg-white/10 px-3 py-2.5 backdrop-blur-sm">
            <p className="text-[11px] uppercase tracking-wide text-white/65">Committed</p>
            <p className="amanah-money mt-1 font-semibold">
              {formatCurrency(committed, currency)}
            </p>
          </div>
        </div>
      </section>

      <section className="grid grid-cols-4 gap-2 sm:gap-3">
        {quickActions.map((action) => {
          const Icon = action.icon;
          return (
            <Link
              key={action.label}
              href={action.href}
              className="amanah-surface flex flex-col items-center gap-2 px-2 py-3 text-center transition-transform active:scale-[0.98] hover:border-primary/25"
            >
              <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-secondary text-primary">
                <Icon className="h-4 w-4" />
              </span>
              <span className="text-[11px] font-semibold leading-tight text-foreground sm:text-xs">
                {action.label}
              </span>
            </Link>
          );
        })}
      </section>

      {nextDue ? (
        <NextContributionCard
          contributionId={nextDue.id}
          slug={nextDue.jamiyaSlug}
          amount={nextDue.amount}
          amountPaid={nextDue.amountPaid}
          currency={nextDue.currency}
          dueDate={nextDue.dueDate}
          status={nextDue.status}
          walletAvailable={data.wallet?.availableBalance ?? null}
          walletCurrency={data.wallet?.currency ?? nextDue.currency}
          circleName={nextDue.jamiyaName}
        />
      ) : null}

      <section className="space-y-3">
        <div className="flex items-end justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold tracking-tight">Your Circles</h2>
            <p className="text-sm text-muted-foreground">Trusted community accounts</p>
          </div>
          <Button asChild size="sm" variant="ghost">
            <Link href={'/circles' as Route}>{common.viewAll}</Link>
          </Button>
        </div>

        {data.jamiyas.length === 0 ? (
          <div className="amanah-surface space-y-3 p-5">
            <p className="font-semibold">{labels.noCirclesTitle}</p>
            <p className="text-sm text-muted-foreground">{labels.noCirclesDesc}</p>
            <Button asChild>
              <Link href={'/circles/new' as Route}>{labels.createACircle}</Link>
            </Button>
          </div>
        ) : (
          <ul className="space-y-3">
            {data.jamiyas.slice(0, 4).map((item) => {
              const progress = circleProgress(
                item.jamiya.currentCycle,
                item.jamiya.cycleCount,
              );
              return (
                <li key={item.membershipId}>
                  <Link
                    href={`/circles/${item.jamiya.slug}` as Route}
                    className="amanah-surface block p-4 transition-colors hover:border-primary/30"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate font-semibold text-foreground">
                          {item.jamiya.name}
                        </p>
                        <p className="mt-1 text-xs capitalize text-muted-foreground">
                          {item.jamiya.status.replaceAll('_', ' ')} · {item.jamiya.memberCount}{' '}
                          {common.members}
                        </p>
                      </div>
                      <p className="amanah-money shrink-0 text-base font-bold">
                        {formatCurrency(
                          item.jamiya.contributionAmount * Math.max(item.jamiya.currentCycle, 1),
                          item.jamiya.currency,
                        )}
                      </p>
                    </div>
                    <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full bg-primary transition-[width] duration-500"
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                    <p className="mt-2 text-xs text-muted-foreground">
                      {progress}% complete · next{' '}
                      {formatCurrency(item.jamiya.contributionAmount, item.jamiya.currency)}
                    </p>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <div className="grid gap-4 lg:grid-cols-5">
        <section className="space-y-3 lg:col-span-3">
          <div className="flex items-end justify-between gap-3">
            <h2 className="text-lg font-bold tracking-tight">Recent activity</h2>
            <Button asChild size="sm" variant="ghost">
              <Link href={'/wallet' as Route}>{common.viewAll}</Link>
            </Button>
          </div>
          {data.activity.length === 0 ? (
            <div className="amanah-surface p-5 text-sm text-muted-foreground">
              Top-ups, contributions, and payouts will appear here.
            </div>
          ) : (
            <ul className="amanah-surface divide-y divide-border/70">
              {data.activity.slice(0, 6).map((row) => {
                const inflow = row.direction === 'credit';
                return (
                  <li key={row.id} className="flex items-center gap-3 px-4 py-3.5">
                    <span
                      className={
                        inflow
                          ? 'inline-flex h-9 w-9 items-center justify-center rounded-xl bg-secondary text-primary'
                          : 'inline-flex h-9 w-9 items-center justify-center rounded-xl bg-muted text-muted-foreground'
                      }
                    >
                      {inflow ? (
                        <ArrowDownLeft className="h-4 w-4" />
                      ) : (
                        <ArrowUpRight className="h-4 w-4" />
                      )}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold capitalize">
                        {row.type.replaceAll('_', ' ')}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {formatRelativeTime(row.createdAt)}
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

        <div className="space-y-4 lg:col-span-2">
          <AmanahScoreCard
            consistency={Math.max(0, 8 - data.stats.pendingContributions)}
            circles={data.stats.activeCircles}
            kycOk={data.profile?.kyc_status === 'approved'}
          />
          <section className="amanah-surface overflow-hidden bg-[linear-gradient(135deg,#121816_0%,#1f2a24_55%,#0b5c42_120%)] p-5 text-white">
            <div className="flex items-start justify-between">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-accent">
                Amanah
              </p>
              <span className="text-accent">✦</span>
            </div>
            <p className="mt-8 font-mono text-lg tracking-[0.22em] text-white/90">
              {String(data.wallet?.id ?? '0000').replace(/-/g, '').slice(0, 4)} ···· ····{' '}
              {String(data.profile?.full_name ?? 'AMAN')
                .replace(/\s+/g, '')
                .slice(0, 4)
                .toUpperCase()
                .padEnd(4, 'X')}
            </p>
            <p className="mt-6 text-sm font-semibold tracking-wide">
              {(data.profile?.full_name ?? firstName).toUpperCase()}
            </p>
            <p className="mt-1 text-[11px] uppercase tracking-[0.16em] text-white/55">
              Virtual card · Coming with live rails
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
