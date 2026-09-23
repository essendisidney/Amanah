import { notFound } from 'next/navigation';
import Link from 'next/link';
import type { Route } from 'next';
import {
  Activity,
  ArrowDownLeft,
  ArrowUpRight,
  Home,
  LayoutGrid,
  Plus,
  UserRound,
  Wallet,
} from 'lucide-react';
import { formatCurrency, formatRelativeTime } from '@jamiya/shared';
import { Button } from '@jamiya/ui';
import { dictionaries } from '@/i18n/dictionaries';
import { DashboardView } from '@/features/dashboard/components/dashboard-view';
import type { DashboardData } from '@/features/dashboard/types';
import { StatusBadge } from '@/features/dashboard/components/dashboard-stats';
import { TopUpForm } from '@/features/wallet/components/top-up-form';
import { WithdrawalForm } from '@/features/wallet/components/withdrawal-form';
import { PaySheet } from '@/features/wallet/components/pay-sheet';
import { cn } from '@/lib/utils';
import { JameiyahLogo } from '@/components/amanah-logo';
import { AppPage, PageHeader } from '@/components/app-page';

export const dynamic = 'force-dynamic';

/** Local / preview-only visual QA. Clearly labelled sample data — never production. */
export default function UiPreviewPage() {
  if (process.env.VERCEL_ENV === 'production') {
    notFound();
  }
  if (process.env.NODE_ENV === 'production' && process.env.VERCEL_ENV !== 'preview') {
    notFound();
  }

  const dict = dictionaries.en;
  const emptyDashboard: DashboardData = {
    profile: {
      full_name: 'Amina Sample',
      email: 'sample@preview.local',
      phone: '+254712345678',
      mpesa_phone: '+254712345678',
      platform_role: 'member',
      kyc_status: 'unverified',
      profile_completed: true,
    },
    jamiyas: [],
    contributions: [],
    payouts: [],
    notifications: [],
    activity: [
      {
        id: 'act-1',
        type: 'wallet_top_up',
        direction: 'credit',
        amount: 10,
        currency: 'KES',
        status: 'completed',
        reference: null,
        createdAt: new Date(Date.now() - 2 * 86400000).toISOString(),
      },
      {
        id: 'act-2',
        type: 'wallet_top_up',
        direction: 'credit',
        amount: 100,
        currency: 'KES',
        status: 'completed',
        reference: null,
        createdAt: new Date(Date.now() - 35 * 86400000).toISOString(),
      },
    ],
    wallet: {
      id: 'wallet-sample',
      balance: 110,
      availableBalance: 110,
      currency: 'KES',
    },
    unreadNotificationCount: 0,
    reservedSeatCount: 0,
    stats: {
      activeCircles: 0,
      pendingContributions: 0,
      upcomingPayouts: 0,
      committedAmount: 0,
      monthInflow: 110,
    },
  };

  const withCircle: DashboardData = {
    ...emptyDashboard,
    jamiyas: [
      {
        membershipId: 'mem-sample',
        role: 'member',
        status: 'active',
        payoutPosition: 3,
        jamiya: {
          id: 'jamiya-sample',
          name: 'Sisters Circle',
          slug: 'sisters-circle-sample',
          status: 'active',
          contributionAmount: 2000,
          currency: 'KES',
          maxMembers: 10,
          memberCount: 8,
          cycleCount: 8,
          currentCycle: 2,
          startDate: '2026-01-15',
          challengeKind: null,
        },
      },
    ],
    contributions: [
      {
        id: 'due-sample',
        cycleNumber: 2,
        amount: 2000,
        amountPaid: 0,
        currency: 'KES',
        status: 'pending',
        dueDate: '2026-09-30',
        jamiyaName: 'Sisters Circle',
        jamiyaSlug: 'sisters-circle-sample',
        jamiyaId: 'jamiya-sample',
      },
    ],
    payouts: [
      {
        id: 'payout-sample',
        cycleNumber: 4,
        amount: 16000,
        currency: 'KES',
        status: 'scheduled',
        scheduledDate: '2026-11-15',
        jamiyaName: 'Sisters Circle',
        jamiyaSlug: 'sisters-circle-sample',
        jamiyaId: 'jamiya-sample',
      },
    ],
    stats: {
      activeCircles: 1,
      pendingContributions: 1,
      upcomingPayouts: 1,
      committedAmount: 2000,
      monthInflow: 110,
    },
  };

  const sampleTx = [
    {
      id: 'tx-1',
      type: 'wallet_top_up',
      status: 'completed',
      amount: 10,
      currency: 'KES',
      direction: 'credit',
      created_at: new Date(Date.now() - 2 * 86400000).toISOString(),
    },
    {
      id: 'tx-2',
      type: 'wallet_top_up',
      status: 'completed',
      amount: 100,
      currency: 'KES',
      direction: 'credit',
      created_at: new Date(Date.now() - 35 * 86400000).toISOString(),
    },
  ];

  const tabs = [
    { href: '/dashboard' as Route, short: dict.nav.dashboardShort, icon: Home, active: true },
    { href: '/circles' as Route, short: dict.nav.circlesShort, icon: LayoutGrid, active: false },
    {
      href: '/wallet' as Route,
      short: dict.nav.walletShort,
      icon: Wallet,
      active: false,
      center: true,
    },
    {
      href: '/notifications' as Route,
      short: dict.nav.activityShort,
      icon: Activity,
      active: false,
    },
    { href: '/profile' as Route, short: dict.nav.profileShort, icon: UserRound, active: false },
  ];

  return (
    <div className="amanah-ambient min-h-dvh overflow-x-hidden">
      <div className="sticky top-0 z-50 border-b border-accent/40 bg-accent/15 px-4 py-2 text-center text-xs font-semibold uppercase tracking-[0.12em] text-accent-foreground">
        Sample preview — not live data
      </div>

      <header className="sticky top-8 z-40 border-b border-border/60 bg-background/90 backdrop-blur-md">
        <div className="mx-auto flex h-12 w-full max-w-6xl items-center justify-between gap-3 px-4">
          <JameiyahLogo href={'/' as Route} size="md" tone="brand" />
          <nav className="flex gap-3 text-xs font-semibold">
            <a href="#dashboard-empty" className="text-primary">
              Dashboard
            </a>
            <a href="#dashboard-circle" className="text-primary">
              With circle
            </a>
            <a href="#money" className="text-primary">
              Money
            </a>
            <a href="#pay" className="text-primary">
              Pay
            </a>
          </nav>
        </div>
      </header>

      <main className="relative mx-auto w-full max-w-6xl space-y-12 px-4 pb-[calc(5.25rem+env(safe-area-inset-bottom))] pt-4 md:px-6 md:pb-12">
        <section id="dashboard-empty" className="scroll-mt-28 space-y-3" aria-label="Dashboard empty">
          <h2 className="text-sm font-semibold text-foreground">Dashboard · no circles</h2>
          <DashboardView
            data={emptyDashboard}
            email="sample@preview.local"
            labels={dict.dashboard}
            common={dict.common}
          />
        </section>

        <section
          id="dashboard-circle"
          className="scroll-mt-28 space-y-3"
          aria-label="Dashboard with circle"
        >
          <h2 className="text-sm font-semibold text-foreground">
            Dashboard · circle with next contribution & payout
          </h2>
          <DashboardView
            data={withCircle}
            email="sample@preview.local"
            labels={dict.dashboard}
            common={dict.common}
          />
        </section>

        <section id="money" className="scroll-mt-28 space-y-5" aria-label="Money sample">
          <h2 className="text-sm font-semibold text-foreground">Money</h2>

          <div className="amanah-surface space-y-3.5 px-4 py-4 sm:px-5">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                {dict.wallet.availableLabel}
              </p>
              <p className="amanah-money mt-1 text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
                {formatCurrency(110, 'KES')}
              </p>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <Button className="min-h-11 w-full px-2" disabled>
                <Plus className="h-4 w-4" />
                <span className="truncate">{dict.wallet.topUp}</span>
              </Button>
              <Button variant="outline" className="min-h-11 w-full px-2" disabled>
                <ArrowDownLeft className="h-4 w-4" />
                <span className="truncate">{dict.wallet.quickPay}</span>
              </Button>
              <Button variant="outline" className="min-h-11 w-full px-2" disabled>
                <ArrowUpRight className="h-4 w-4" />
                <span className="truncate">{dict.wallet.withdraw}</span>
              </Button>
            </div>
          </div>

          <div className="grid gap-5 md:grid-cols-2">
            <div className="space-y-2.5">
              <h3 className="text-sm font-semibold text-foreground">{dict.wallet.topUp}</h3>
              <div className="amanah-surface p-4 sm:p-5">
                <TopUpForm
                  currency="KES"
                  labels={dict.walletForms}
                  provider="simulated"
                  defaultPhone="+254712345678"
                  defaultAmount={500}
                />
              </div>
            </div>
            <div className="space-y-2.5">
              <h3 className="text-sm font-semibold text-foreground">{dict.wallet.withdraw}</h3>
              <div className="amanah-surface p-4 sm:p-5">
                <WithdrawalForm
                  currency="KES"
                  labels={dict.walletForms}
                  defaultPhone="+254712345678"
                  availableBalance={110}
                />
              </div>
            </div>
          </div>

          <div className="space-y-2.5">
            <h3 className="text-sm font-semibold text-foreground">{dict.wallet.historyTitle}</h3>
            <ul className="amanah-surface divide-y divide-border/70">
              {sampleTx.map((row) => {
                const inflow = row.direction === 'credit';
                return (
                  <li key={row.id} className="flex items-center gap-3 px-4 py-3">
                    <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                      <ArrowDownLeft className="h-4 w-4" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="truncate text-sm font-semibold capitalize text-foreground">
                          {row.type.replaceAll('_', ' ')}
                        </p>
                        <StatusBadge status={row.status} />
                      </div>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {formatRelativeTime(row.created_at)}
                      </p>
                    </div>
                    <p className="amanah-money amanah-money-in shrink-0 text-sm font-semibold">
                      {inflow ? '+' : '−'}
                      {formatCurrency(row.amount, row.currency)}
                    </p>
                  </li>
                );
              })}
            </ul>
          </div>
        </section>

        <section id="pay" className="scroll-mt-28 space-y-3" aria-label="Pay sample">
          <h2 className="text-sm font-semibold text-foreground">Pay</h2>
          <AppPage width="medium" className="!space-y-5">
            <PageHeader title={dict.paySheet.title} subtitle={dict.paySheet.subtitle} />
            <PaySheet
              labels={dict.paySheet}
              available={110}
              currency="KES"
              dues={[
                {
                  href: '/circles/sisters-circle-sample#pay-due' as Route,
                  amountLabel: formatCurrency(2000, 'KES'),
                  circleName: 'Sisters Circle',
                  overdue: false,
                },
              ]}
            />
          </AppPage>
          <div className="space-y-2">
            <h3 className="text-sm font-semibold text-foreground">Pay · no dues</h3>
            <PaySheet labels={dict.paySheet} available={110} currency="KES" dues={[]} />
          </div>
        </section>
      </main>

      <nav
        className="fixed inset-x-0 bottom-0 z-50 border-t border-border/70 bg-background/95 px-2 pb-[env(safe-area-inset-bottom)] pt-1 backdrop-blur-md md:hidden"
        aria-label="Mobile primary sample"
      >
        <ul className="mx-auto grid max-w-lg grid-cols-5 items-center gap-0.5">
          {tabs.map((item) => {
            const Icon = item.icon;
            if (item.center) {
              return (
                <li key={item.href} className="flex justify-center">
                  <Link
                    href={item.href}
                    className="flex min-h-12 flex-col items-center justify-center gap-0.5 px-1"
                  >
                    <span
                      className={cn(
                        'inline-flex h-10 w-10 items-center justify-center rounded-xl',
                        item.active
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-primary/12 text-primary',
                      )}
                    >
                      <Icon className="h-5 w-5" />
                    </span>
                    <span className="text-[10px] font-semibold text-muted-foreground">
                      {item.short}
                    </span>
                  </Link>
                </li>
              );
            }
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={cn(
                    'relative flex min-h-12 flex-col items-center justify-center gap-0.5 rounded-lg px-1 text-[10px] font-semibold',
                    item.active ? 'bg-primary/10 text-primary' : 'text-muted-foreground',
                  )}
                >
                  <Icon className="h-5 w-5" strokeWidth={item.active ? 2.4 : 1.6} />
                  {item.short}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </div>
  );
}
