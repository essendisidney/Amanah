import Link from 'next/link';
import type { Route } from 'next';
import {
  Plus,
  ArrowUpFromLine,
  LayoutGrid,
  CircleDollarSign,
} from 'lucide-react';
import { formatCurrency, formatRelativeTime, isValidKeMobile } from '@jamiya/shared';
import type { Dictionary } from '@/i18n/dictionaries';
import type { DashboardData } from '../types';

function greetingForHour(hour: number) {
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
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
  const nextDue = data.contributions[0];
  const needsPhone =
    Boolean(data.profile) &&
    !isValidKeMobile(String(data.profile?.phone ?? '').trim());
  const needsProfile = Boolean(data.profile && !data.profile.profile_completed);

  const quickActions = [
    { href: '/wallet#top-up' as Route, label: 'Add', icon: Plus, tint: 'amanah-tint-add' },
    {
      href: (nextDue
        ? `/circles/${nextDue.jamiyaSlug}#pay`
        : '/circles') as Route,
      label: nextDue ? 'Pay due' : 'Circles',
      icon: CircleDollarSign,
      tint: 'amanah-tint-pay',
    },
    { href: '/circles' as Route, label: 'Circles', icon: LayoutGrid, tint: 'amanah-tint-send' },
    {
      href: '/wallet#withdraw' as Route,
      label: 'Withdraw',
      icon: ArrowUpFromLine,
      tint: 'amanah-tint-withdraw',
    },
  ] as const;

  // Avoid two identical Circles tiles when there is no due.
  const actions =
    nextDue != null
      ? quickActions
      : ([
          quickActions[0],
          {
            href: '/wallet' as Route,
            label: 'Money',
            icon: CircleDollarSign,
            tint: 'amanah-tint-pay',
          },
          quickActions[2],
          quickActions[3],
        ] as const);

  const circle = data.jamiyas[0] ?? null;
  const recent = data.activity.slice(0, 3);

  return (
    <div className="mx-auto w-full max-w-[390px] space-y-10 md:max-w-none md:grid md:grid-cols-[minmax(0,1fr)_minmax(280px,360px)] md:items-start md:gap-16 md:space-y-0">
      <div className="space-y-10">
        <header className="space-y-1">
          <p className="text-[15px] text-muted-foreground">
            {greeting},{' '}
            <span className="font-medium text-foreground">{firstName}</span>
          </p>
          {(needsPhone || needsProfile) && (
            <Link
              href={
                (needsPhone
                  ? '/profile?onboarding=1&next=/dashboard#personal-details'
                  : '/profile') as Route
              }
              className="inline-block text-sm font-medium text-primary"
            >
              {needsPhone ? 'Add phone' : labels.completeProfile}
            </Link>
          )}
        </header>

        <section className="relative space-y-1.5 pt-2">
          <div
            aria-hidden
            className="pointer-events-none absolute -inset-x-4 -top-6 h-40 rounded-[2rem] bg-[radial-gradient(ellipse_at_center,_rgba(25,184,121,0.08)_0%,_rgba(91,141,239,0.05)_45%,_transparent_70%)]"
          />
          <p className="amanah-money relative text-[3.25rem] font-bold leading-none tracking-tight text-foreground md:text-6xl">
            {formatCurrency(available, currency)}
          </p>
          <p className="relative text-sm text-muted-foreground">Available</p>
        </section>

        <section className="flex items-start justify-between gap-2 px-1">
          {actions.map((action) => {
            const Icon = action.icon;
            return (
              <Link
                key={action.label}
                href={action.href}
                className="group flex w-[4.5rem] flex-col items-center gap-2"
              >
                <span
                  className={`inline-flex h-12 w-12 items-center justify-center rounded-[1.15rem] shadow-[0_8px_20px_rgba(18,40,32,0.06)] transition-transform duration-200 group-active:scale-95 ${action.tint}`}
                >
                  <Icon className="h-[18px] w-[18px]" strokeWidth={1.75} />
                </span>
                <span className="text-[11px] font-medium text-foreground">{action.label}</span>
              </Link>
            );
          })}
        </section>

        {nextDue ? (
          <p className="text-sm text-muted-foreground">
            Due{' '}
            <Link
              href={`/circles/${nextDue.jamiyaSlug}#pay` as Route}
              className="font-semibold text-foreground"
            >
              {formatCurrency(nextDue.amount - nextDue.amountPaid, nextDue.currency)}
            </Link>
            {nextDue.jamiyaName ? (
              <span>
                {' '}
                · {nextDue.jamiyaName}
              </span>
            ) : null}
          </p>
        ) : null}

        <section className="space-y-3">
          <h2 className="text-sm font-medium text-muted-foreground">Circles</h2>

          {!circle ? (
            <Link
              href={'/circles/new' as Route}
              className="block text-sm font-medium text-foreground"
            >
              {labels.createACircle}
            </Link>
          ) : (
            <Link
              href={`/circles/${circle.jamiya.slug}` as Route}
              className="amanah-glass amanah-circle-mint block rounded-[1.75rem] px-5 py-4 transition-transform duration-200 active:scale-[0.99]"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-[15px] font-semibold tracking-tight text-foreground">
                    {circle.jamiya.name}
                  </p>
                  <p className="mt-1 text-xs capitalize text-muted-foreground">
                    {circle.jamiya.status.replaceAll('_', ' ')} · {circle.jamiya.memberCount}{' '}
                    {common.members}
                  </p>
                </div>
                <p className="amanah-money shrink-0 text-lg font-semibold text-foreground">
                  {formatCurrency(circle.jamiya.contributionAmount, circle.jamiya.currency)}
                </p>
              </div>
              <div className="amanah-progress mt-3 h-1 overflow-hidden rounded-full">
                <span
                  className="amanah-progress-fill block h-full rounded-full"
                  style={{
                    width: `${Math.min(100, Math.max(8, circle.jamiya.memberCount * 12))}%`,
                  }}
                />
              </div>
            </Link>
          )}
        </section>

        <section className="space-y-3 md:hidden">
          <div className="flex items-baseline justify-between">
            <h2 className="text-sm font-medium text-muted-foreground">Recent</h2>
            <Link
              href={'/notifications' as Route}
              className="text-sm font-medium text-primary"
            >
              Activity
            </Link>
          </div>
          <RecentList rows={recent} />
        </section>
      </div>

      <aside className="hidden space-y-6 md:block">
        <div className="flex items-baseline justify-between">
          <h2 className="text-sm font-medium text-muted-foreground">Recent</h2>
          <Link href={'/notifications' as Route} className="text-sm font-medium text-primary">
            Activity
          </Link>
        </div>
        <RecentList rows={recent} />
      </aside>
    </div>
  );
}

function RecentList({
  rows,
}: {
  rows: DashboardData['activity'];
}) {
  if (rows.length === 0) {
    return <p className="text-sm text-muted-foreground">Nothing yet</p>;
  }

  return (
    <ul>
      {rows.map((row) => {
        const inflow = row.direction === 'credit';
        return (
          <li key={row.id} className="flex items-center justify-between gap-3 py-3.5">
            <div className="min-w-0">
              <p className="truncate text-[15px] font-medium capitalize">
                {row.type.replaceAll('_', ' ')}
              </p>
              <p className="text-xs text-muted-foreground">
                {formatRelativeTime(row.createdAt)}
              </p>
            </div>
            <p
              className={
                inflow
                  ? 'amanah-money amanah-money-in text-[15px] font-semibold'
                  : 'amanah-money amanah-money-out text-[15px] font-semibold'
              }
            >
              {inflow ? '+' : '−'}
              {formatCurrency(row.amount, row.currency)}
            </p>
          </li>
        );
      })}
    </ul>
  );
}
