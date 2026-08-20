'use client';

import Link from 'next/link';
import type { Route } from 'next';
import { useEffect, useState, type ComponentType, type ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import {
  Bell,
  CircleDollarSign,
  Heart,
  Home,
  LayoutGrid,
  LogOut,
  UserRound,
  Wallet,
} from 'lucide-react';
import { APP_NAME } from '@jamiya/shared';
import { Button } from '@jamiya/ui';
import { cn } from '@/lib/utils';
import { LanguageSwitcher } from '@/i18n/language-switcher';
import type { Dictionary } from '@/i18n/dictionaries';
import type { Locale } from '@/i18n/config';
import { NOTIFICATION_INSERT_EVENT } from '@/lib/notification-events';
import { SmoothRouteTransition } from '@/components/smooth-route-transition';

type ShellDictionary = Pick<Dictionary, 'nav' | 'common'>;

type Tab = {
  href: Route;
  label: string;
  short: string;
  icon: ComponentType<{ className?: string }>;
};

function pathActive(pathname: string, href: string) {
  if (href === '/dashboard') return pathname === '/dashboard';
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function AppShell({
  children,
  unread,
  showAdmin,
  signOutAction,
  locale,
  dict,
}: {
  children: ReactNode;
  unread: number;
  showAdmin: boolean;
  signOutAction: () => Promise<void>;
  locale: Locale;
  dict: ShellDictionary;
}) {
  const pathname = usePathname() || '';
  const [liveUnread, setLiveUnread] = useState(unread);

  useEffect(() => {
    setLiveUnread(unread);
  }, [unread]);

  useEffect(() => {
    const onInsert = () => setLiveUnread((count) => count + 1);
    window.addEventListener(NOTIFICATION_INSERT_EVENT, onInsert);
    return () => window.removeEventListener(NOTIFICATION_INSERT_EVENT, onInsert);
  }, []);

  const tabs: Tab[] = [
    {
      href: '/dashboard' as Route,
      label: dict.nav.dashboard,
      short: dict.nav.dashboardShort,
      icon: Home,
    },
    {
      href: '/circles' as Route,
      label: dict.nav.circles,
      short: dict.nav.circlesShort,
      icon: LayoutGrid,
    },
    {
      href: '/wallet' as Route,
      label: dict.nav.wallet,
      short: dict.nav.walletShort,
      icon: Wallet,
    },
    {
      href: '/finance' as Route,
      label: dict.nav.finance,
      short: dict.nav.financeShort,
      icon: CircleDollarSign,
    },
    {
      href: '/profile' as Route,
      label: dict.nav.profile,
      short: dict.nav.profileShort,
      icon: UserRound,
    },
  ];

  const desktopLinks: Array<{ href: Route; label: string }> = [
    ...tabs.map((t) => ({ href: t.href, label: t.label })),
    { href: '/sadaka' as Route, label: dict.common.sadaka },
    { href: '/support' as Route, label: dict.common.support },
    { href: '/notifications' as Route, label: dict.common.notifications },
  ];
  if (showAdmin) {
    desktopLinks.push({ href: '/admin' as Route, label: dict.common.admin });
  }

  return (
    <div className="min-h-dvh overflow-x-hidden bg-[linear-gradient(180deg,#fbfcfa_0%,#eef5f0_100%)]">
      <header className="sticky top-0 z-40 border-b border-border/70 bg-card/90 pt-[env(safe-area-inset-top)] backdrop-blur">
        <div className="mx-auto flex h-14 w-full max-w-6xl items-center justify-between gap-3 px-4 md:h-16 md:px-6">
          <Link
            href={'/dashboard' as Route}
            className="min-w-0 shrink font-[family-name:var(--font-display)] text-lg font-semibold text-primary md:text-xl"
          >
            {APP_NAME}
          </Link>

          <nav className="hidden items-center gap-1 lg:flex" aria-label="Primary">
            {desktopLinks.map((item) => {
              const active = pathActive(pathname, item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    'whitespace-nowrap rounded-md px-3 py-2 text-sm font-medium transition-colors',
                    active
                      ? 'bg-muted text-foreground'
                      : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                  )}
                >
                  {item.label}
                  {item.href === '/notifications' && liveUnread > 0 ? (
                    <span className="ml-2 inline-flex min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-[10px] font-semibold text-primary-foreground">
                      {liveUnread > 9 ? '9+' : liveUnread}
                    </span>
                  ) : null}
                </Link>
              );
            })}
          </nav>

          <div className="flex shrink-0 items-center gap-0.5 sm:gap-1">
            <LanguageSwitcher locale={locale} label={dict.common.language} />
            <Link
              href={'/sadaka' as Route}
              className={cn(
                'inline-flex h-11 w-11 items-center justify-center rounded-md lg:hidden',
                pathActive(pathname, '/sadaka')
                  ? 'text-primary'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground',
              )}
              aria-label={dict.common.sadaka}
              title={dict.common.sadaka}
            >
              <Heart className="h-5 w-5" />
            </Link>
            <Link
              href={'/notifications' as Route}
              className="relative inline-flex h-11 w-11 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
              aria-label={
                liveUnread > 0
                  ? `${dict.common.notifications}, ${liveUnread}`
                  : dict.common.notifications
              }
            >
              <Bell className="h-5 w-5" />
              {liveUnread > 0 ? (
                <span className="absolute right-1.5 top-1.5 inline-flex min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold text-primary-foreground">
                  {liveUnread > 9 ? '9+' : liveUnread}
                </span>
              ) : null}
            </Link>
            <form action={signOutAction} className="hidden sm:block">
              <Button type="submit" variant="outline" size="sm">
                {dict.common.signOut}
              </Button>
            </form>
            <form action={signOutAction} className="sm:hidden">
              <button
                type="submit"
                className="inline-flex h-11 w-11 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
                aria-label={dict.common.signOut}
                title={dict.common.signOut}
              >
                <LogOut className="h-5 w-5" />
              </button>
            </form>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl px-4 py-5 pb-[calc(5.25rem+env(safe-area-inset-bottom))] sm:py-6 md:px-6 md:py-10 md:pb-10">
        <SmoothRouteTransition>{children}</SmoothRouteTransition>
      </main>

      <nav
        className="fixed inset-x-0 bottom-0 z-50 border-t border-border/80 bg-card/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden"
        aria-label="Mobile primary"
      >
        <ul className="mx-auto grid max-w-lg grid-cols-5">
          {tabs.map((item) => {
            const Icon = item.icon;
            const active = pathActive(pathname, item.href);
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={cn(
                    'flex min-h-14 flex-col items-center justify-center gap-0.5 px-1 text-[11px] font-medium',
                    active ? 'text-primary' : 'text-muted-foreground',
                  )}
                >
                  <Icon className={cn('h-5 w-5', active && 'stroke-[2.25]')} />
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
