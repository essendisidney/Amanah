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
import { CircleDetailHero } from '@/features/circles/components/circle-detail-hero';
import { MemberCircleLinks } from '@/features/circles/components/member-circle-links';
import { CircleActionHub } from '@/features/circles/components/circle-action-hub';
import { CirclesListCard } from '@/features/circles/components/circles-list-card';
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
            <a href="#circle-detail" className="text-primary">
              Circle
            </a>
            <a href="#circles" className="text-primary">
              Circles
            </a>
            <a href="#activity" className="text-primary">
              Activity
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

        <section
          id="circle-detail"
          className="scroll-mt-28 space-y-5"
          aria-label="Circle detail sample"
        >
          <h2 className="text-sm font-semibold text-foreground">Circle detail · member</h2>
          <CircleDetailHero
            slug="sisters-circle-sample"
            name="Sisters Circle"
            status="active"
            roleLabel="Member"
            kindLabel="Merry-go-round"
            poolAmount={16000}
            currency="KES"
            memberSummary="8/10 members"
            personalDue={{ remaining: 2000, dueDate: '2026-09-30', status: 'pending' }}
            stats={[
              { label: 'Each month', value: 'KES 2,000' },
              { label: 'This month’s pot', value: 'Asha' },
            ]}
          />
          <div id="pay-due" className="amanah-surface space-y-3 border-primary/20 px-4 py-4 sm:px-5">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              Your next contribution
            </p>
            <p className="amanah-money text-2xl font-bold text-foreground">{formatCurrency(2000, 'KES')}</p>
            <p className="text-sm text-muted-foreground">Due 30 Sept 2026 · Sisters Circle</p>
            <Button className="min-h-11 w-full" disabled>
              Pay {formatCurrency(2000, 'KES')}
            </Button>
          </div>
          <MemberCircleLinks slug="sisters-circle-sample" hasDue showGoals={false} />
          <CircleActionHub
            groups={[
              {
                title: 'Money',
                items: [
                  { href: '/wallet' as Route, label: 'Wallet', hint: 'Balance and top-up', primary: true },
                  { href: '/pay' as Route, label: 'Pay', hint: 'Dues and tools' },
                ],
              },
              {
                title: 'Circle',
                items: [
                  {
                    href: '/circles/sisters-circle-sample/statement' as Route,
                    label: 'Statement',
                    hint: 'Your 360',
                  },
                  {
                    href: '/circles/sisters-circle-sample' as Route,
                    label: 'Members',
                    hint: 'Who is in',
                  },
                ],
              },
            ]}
          />
        </section>

        <section id="circles" className="scroll-mt-28 space-y-5" aria-label="Circles list sample">
          <h2 className="text-sm font-semibold text-foreground">Circles · with due</h2>
          <AppPage className="!space-y-5">
            <PageHeader
              title={dict.circles.title}
              subtitle={dict.circles.subtitle}
              action={
                <Button className="min-h-11 shrink-0" disabled>
                  {dict.circles.createCircle}
                </Button>
              }
            />
            <details className="amanah-surface px-4 py-4 sm:px-5">
              <summary className="cursor-pointer text-sm font-semibold text-foreground">
                Have an invite code?
              </summary>
            </details>
            <ul className="grid gap-3 sm:grid-cols-2">
              <li>
                <CirclesListCard
                  href={'/circles/sisters-circle-sample#pay-due' as Route}
                  name="Sisters Circle"
                  status="active"
                  memberLabel={`8/10 ${dict.common.members}`}
                  monthlyAmount={2000}
                  currency="KES"
                  due={{
                    remaining: 2000,
                    currency: 'KES',
                    dueDate: '2026-09-30',
                    status: 'pending',
                  }}
                  nextContributionLabel={dict.dashboard.nextContribution}
                />
              </li>
              <li>
                <CirclesListCard
                  href={'/circles/youth-chama-sample' as Route}
                  name="Youth Chama"
                  status="active"
                  memberLabel={`5/8 ${dict.common.members}`}
                  monthlyAmount={1000}
                  currency="KES"
                  due={null}
                  nextContributionLabel={dict.dashboard.nextContribution}
                />
              </li>
            </ul>
          </AppPage>

          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-foreground">Circles · empty</h3>
            <div className="amanah-surface space-y-3.5 border-primary/20 px-4 py-4 sm:px-5">
              <div>
                <h2 className="text-base font-semibold tracking-tight text-foreground sm:text-lg">
                  {dict.circles.emptyTitle}
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">{dict.circles.emptyDesc}</p>
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                <Button className="min-h-11 w-full" disabled>
                  {dict.circles.createACircle}
                </Button>
                <Button variant="outline" className="min-h-11 w-full" disabled>
                  {dict.dashboard.joinWithInvite}
                </Button>
              </div>
            </div>
          </div>
        </section>

        <section id="activity" className="scroll-mt-28 space-y-5" aria-label="Activity sample">
          <h2 className="text-sm font-semibold text-foreground">Activity · with updates</h2>
          <AppPage width="medium" className="!space-y-5">
            <PageHeader
              title={dict.notificationsPage.title}
              subtitle={dict.notificationsPage.unreadOne.replace('{count}', '1')}
              action={
                <Button variant="outline" className="min-h-11 shrink-0" disabled>
                  {dict.notificationsPage.markAllRead}
                </Button>
              }
            />
            <section className="space-y-2.5">
              <h3 className="text-sm font-semibold text-foreground">Updates</h3>
              <ul className="amanah-surface divide-y divide-border/70">
                <li className="flex items-start justify-between gap-3 bg-primary/[0.04] px-4 py-3.5 sm:px-5">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-semibold text-foreground">Contribution due</p>
                      <StatusBadge status="pending" />
                    </div>
                    <p className="mt-0.5 line-clamp-2 text-sm text-muted-foreground">
                      Sisters Circle · Ksh 2,000 due 30 Sept 2026
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">2 days ago</p>
                  </div>
                  <Button variant="outline" className="min-h-11 shrink-0 px-3" disabled>
                    {dict.notificationsPage.markRead}
                  </Button>
                </li>
                <li className="flex items-start justify-between gap-3 px-4 py-3.5 sm:px-5">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-foreground">Wallet top-up completed</p>
                    <p className="mt-0.5 line-clamp-2 text-sm text-muted-foreground">
                      Ksh 100 added to your available balance
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">last month</p>
                  </div>
                </li>
              </ul>
            </section>
            <section className="space-y-2.5">
              <div className="flex items-baseline justify-between gap-3 px-0.5">
                <h3 className="text-sm font-semibold text-foreground">
                  {dict.notificationsPage.recentMoney}
                </h3>
                <span className="text-sm font-semibold text-primary">
                  {dict.notificationsPage.openMoney}
                </span>
              </div>
              <ul className="amanah-surface divide-y divide-border/70">
                {sampleTx.map((row) => {
                  const inflow = row.direction === 'credit';
                  return (
                    <li
                      key={`act-${row.id}`}
                      className="flex items-center justify-between gap-3 px-4 py-3 sm:px-5"
                    >
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
            </section>
          </AppPage>

          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-foreground">Activity · empty</h3>
            <div className="amanah-surface space-y-3.5 border-primary/20 px-4 py-4 sm:px-5">
              <div>
                <p className="text-base font-semibold tracking-tight text-foreground">
                  {dict.notificationsPage.emptyTitle}
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {dict.notificationsPage.emptyDesc}
                </p>
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                <Button className="min-h-11 w-full" disabled>
                  {dict.notificationsPage.openCircles}
                </Button>
                <Button variant="outline" className="min-h-11 w-full" disabled>
                  {dict.notificationsPage.openMoney}
                </Button>
              </div>
            </div>
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
