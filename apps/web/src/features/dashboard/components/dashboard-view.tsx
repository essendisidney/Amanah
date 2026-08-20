import Link from 'next/link';
import type { Route } from 'next';
import {
  ArrowDownLeft,
  ArrowUpRight,
  Plus,
  QrCode,
  Send,
} from 'lucide-react';
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
  const available = data.wallet?.availableBalance ?? data.wallet?.balance ?? 0;
  const monthInflow = data.stats.monthInflow;
  const nextDue = data.contributions[0];
  const needsPhone =
    Boolean(data.profile) &&
    !isValidKeMobile(String(data.profile?.phone ?? '').trim());
  const needsProfile = Boolean(data.profile && !data.profile.profile_completed);

  const quickActions = [
    { href: '/wallet#top-up' as Route, label: 'Add', icon: Plus },
    { href: '/pay' as Route, label: 'Send', icon: Send },
    { href: '/pay' as Route, label: 'Pay', icon: QrCode },
  ];

  const featuredCircles = data.jamiyas.slice(0, 2);
  const recent = data.activity.slice(0, 3);

  return (
    <div className="mx-auto max-w-lg space-y-8 md:max-w-none">
      <header className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm text-muted-foreground">
            {greeting}, <span className="font-semibold text-foreground">{firstName}</span>
          </p>
        </div>
        {needsPhone || needsProfile ? (
          <Button asChild size="sm" variant="outline" className="rounded-full">
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

      <section className="space-y-2 text-center sm:text-left">
        <p className="amanah-money text-5xl font-bold tracking-tight text-foreground md:text-6xl">
          {formatCurrency(available, currency)}
        </p>
        <p className="text-sm text-muted-foreground">
          available
          {monthInflow > 0 ? (
            <span className="ml-2 font-medium text-primary">
              +{formatCurrency(monthInflow, currency)}
            </span>
          ) : null}
        </p>
      </section>

      <section className="amanah-glass mx-auto flex max-w-md items-stretch justify-around gap-2 rounded-[1.75rem] px-3 py-4">
        {quickActions.map((action) => {
          const Icon = action.icon;
          return (
            <Link
              key={action.label}
              href={action.href}
              className="flex min-w-[4.5rem] flex-col items-center gap-2 rounded-2xl px-2 py-1 transition-transform active:scale-[0.97]"
            >
              <span className="amanah-glass-pill inline-flex h-12 w-12 items-center justify-center rounded-2xl text-primary">
                <Icon className="h-5 w-5" />
              </span>
              <span className="text-xs font-semibold text-foreground">{action.label}</span>
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

      <section className="space-y-4">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="text-base font-semibold tracking-tight">Your circles</h2>
          <Link
            href={'/circles' as Route}
            className="text-sm font-medium text-primary hover:underline"
          >
            See all
          </Link>
        </div>

        {featuredCircles.length === 0 ? (
          <div className="space-y-3 py-2">
            <p className="text-sm text-muted-foreground">{labels.noCirclesDesc}</p>
            <Button asChild className="rounded-full">
              <Link href={'/circles/new' as Route}>{labels.createACircle}</Link>
            </Button>
          </div>
        ) : (
          <ul className="space-y-3">
            {featuredCircles.map((item) => {
              const progress = circleProgress(
                item.jamiya.currentCycle,
                item.jamiya.cycleCount,
              );
              return (
                <li key={item.membershipId}>
                  <Link
                    href={`/circles/${item.jamiya.slug}` as Route}
                    className="amanah-glass block rounded-3xl px-5 py-4 transition-transform active:scale-[0.99]"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-base font-semibold">{item.jamiya.name}</p>
                        <p className="mt-1 text-xs capitalize text-muted-foreground">
                          {item.jamiya.status.replaceAll('_', ' ')} · {item.jamiya.memberCount}{' '}
                          {common.members}
                        </p>
                      </div>
                      <p className="amanah-money shrink-0 text-lg font-bold">
                        {formatCurrency(
                          item.jamiya.contributionAmount * Math.max(item.jamiya.currentCycle, 1),
                          item.jamiya.currency,
                        )}
                      </p>
                    </div>
                    <div className="mt-3 h-1 overflow-hidden rounded-full bg-black/5 dark:bg-white/10">
                      <div
                        className="h-full rounded-full bg-primary transition-[width] duration-500"
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="space-y-4">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="text-base font-semibold tracking-tight">Recent</h2>
          <Link
            href={'/notifications' as Route}
            className="text-sm font-medium text-primary hover:underline"
          >
            See all
          </Link>
        </div>

        {recent.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nothing here yet.</p>
        ) : (
          <ul className="space-y-0 divide-y divide-border/50">
            {recent.map((row) => {
              const inflow = row.direction === 'credit';
              return (
                <li key={row.id} className="flex items-center gap-3 py-3.5">
                  <span
                    className={
                      inflow
                        ? 'inline-flex h-9 w-9 items-center justify-center rounded-full bg-secondary text-primary'
                        : 'inline-flex h-9 w-9 items-center justify-center rounded-full bg-muted text-muted-foreground'
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
    </div>
  );
}
