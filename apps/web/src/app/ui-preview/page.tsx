import { notFound } from 'next/navigation';
import Link from 'next/link';
import type { Route } from 'next';
import {
  Activity,
  Home,
  LayoutGrid,
  Wallet,
  UserRound,
} from 'lucide-react';
import { dictionaries } from '@/i18n/dictionaries';
import { DashboardView } from '@/features/dashboard/components/dashboard-view';
import type { DashboardData } from '@/features/dashboard/types';
import { CircleDetailHero } from '@/features/circles/components/circle-detail-hero';
import { AdminNav } from '@/features/admin/components/admin-nav';
import { Button } from '@jamiya/ui';
import { cn } from '@/lib/utils';
import { JameiyahLogo } from '@/components/amanah-logo';

export const dynamic = 'force-dynamic';

/** Local / preview-only visual QA page. Never live data; blocked in production. */
export default function UiPreviewPage() {
  if (process.env.VERCEL_ENV === 'production') {
    notFound();
  }
  if (process.env.NODE_ENV === 'production' && process.env.VERCEL_ENV !== 'preview') {
    notFound();
  }

  const dict = dictionaries.en;
  const sample: DashboardData = {
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

  const tabs = [
    { href: '/dashboard' as Route, short: dict.nav.dashboardShort, icon: Home, active: true },
    { href: '/circles' as Route, short: dict.nav.circlesShort, icon: LayoutGrid, active: false },
    { href: '/wallet' as Route, short: dict.nav.walletShort, icon: Wallet, active: false, center: true },
    { href: '/notifications' as Route, short: dict.nav.activityShort, icon: Activity, active: false },
    { href: '/profile' as Route, short: dict.nav.profileShort, icon: UserRound, active: false },
  ];

  return (
    <div className="amanah-ambient min-h-dvh overflow-x-hidden">
      <div className="sticky top-0 z-50 border-b border-accent/40 bg-accent/15 px-4 py-2 text-center text-xs font-semibold uppercase tracking-[0.12em] text-accent-foreground">
        Sample preview — not live data
      </div>

      <header className="sticky top-8 z-40 border-b border-border/60 bg-background/90 pt-[env(safe-area-inset-top)] backdrop-blur-md">
        <div className="mx-auto flex h-12 w-full max-w-6xl items-center justify-between gap-3 px-4">
          <JameiyahLogo href={'/' as Route} size="md" tone="brand" />
          <span className="text-xs font-medium text-muted-foreground">UI polish preview</span>
        </div>
      </header>

      <main className="relative mx-auto w-full max-w-6xl space-y-10 px-4 pb-[calc(5.25rem+env(safe-area-inset-bottom))] pt-4 md:px-6 md:pb-12">
        <section id="dashboard" aria-label="Dashboard sample">
          <DashboardView data={sample} email="sample@preview.local" labels={dict.dashboard} common={dict.common} />
        </section>

        <section id="circle" className="space-y-3" aria-label="Circle summary sample">
          <h2 className="text-sm font-semibold text-foreground">Circle summary</h2>
          <CircleDetailHero
            slug="sisters-circle-sample"
            name="Sisters Circle"
            status="active"
            roleLabel="Member"
            kindLabel="Merry-go-round"
            poolAmount={16000}
            currency="KES"
            memberSummary="8/10 members"
            stats={[
              { label: 'Contribution', value: 'KES 2,000' },
              { label: 'Schedule', value: 'Every 30 days' },
              { label: 'Cycle', value: '2 of 8' },
              { label: 'Progress', value: '25%' },
            ]}
            personalDue={{ remaining: 2000, dueDate: '2026-09-30', status: 'open' }}
          />
        </section>

        <section id="actions" className="space-y-3" aria-label="Button styles sample">
          <h2 className="text-sm font-semibold text-foreground">Actions</h2>
          <div className="amanah-surface flex flex-wrap gap-2 p-4">
            <Button>Primary</Button>
            <Button variant="outline">Secondary</Button>
            <Button variant="destructive">Destructive</Button>
          </div>
        </section>

        <section id="admin" className="space-y-3" aria-label="Admin nav sample">
          <h2 className="text-sm font-semibold text-foreground">Admin navigation</h2>
          <AdminNav />
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
                    item.active
                      ? 'bg-primary/10 text-primary'
                      : 'text-muted-foreground',
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
