'use client';

import Link from 'next/link';
import type { Route } from 'next';
import { useEffect, useState, type ComponentType, type ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import {
  Activity,
  Home,
  LayoutGrid,
  Wallet,
  Shield,
  UserRound,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { LanguageSwitcher } from '@/i18n/language-switcher';
import type { Dictionary } from '@/i18n/dictionaries';
import type { Locale } from '@/i18n/config';
import {
  NOTIFICATION_CLEAR_EVENT,
  NOTIFICATION_INSERT_EVENT,
  NOTIFICATION_READ_EVENT,
} from '@/lib/notification-events';
import { SmoothRouteTransition } from '@/components/smooth-route-transition';
import { ThemeToggle } from '@/components/theme-toggle';
import { JameiyahLogo } from '@/components/amanah-logo';

type ShellDictionary = Pick<Dictionary, 'nav' | 'common'>;

type Tab = {
  href: Route;
  label: string;
  short: string;
  icon: ComponentType<{ className?: string; strokeWidth?: number }>;
  center?: boolean;
};

function pathActive(pathname: string, href: string) {
  if (href === '/dashboard') return pathname === '/dashboard';
  if (href === '/wallet' || href === '/pay') {
    return (
      pathname === '/wallet' ||
      pathname.startsWith('/wallet/') ||
      pathname === '/pay' ||
      pathname === '/finance' ||
      pathname.startsWith('/finance/') ||
      pathname === '/sadaka' ||
      pathname.startsWith('/sadaka/') ||
      pathname === '/zakat'
    );
  }
  if (href === '/notifications') {
    return pathname === '/notifications' || pathname.startsWith('/notifications/');
  }
  if (href === '/profile') {
    return pathname === '/profile' || pathname.startsWith('/profile/');
  }
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
    const onRead = (event: Event) => {
      const detail = (event as CustomEvent<{ count?: number }>).detail;
      const n = Math.max(1, Number(detail?.count ?? 1));
      setLiveUnread((count) => Math.max(0, count - n));
    };
    const onClear = () => setLiveUnread(0);
    window.addEventListener(NOTIFICATION_INSERT_EVENT, onInsert);
    window.addEventListener(NOTIFICATION_READ_EVENT, onRead);
    window.addEventListener(NOTIFICATION_CLEAR_EVENT, onClear);
    return () => {
      window.removeEventListener(NOTIFICATION_INSERT_EVENT, onInsert);
      window.removeEventListener(NOTIFICATION_READ_EVENT, onRead);
      window.removeEventListener(NOTIFICATION_CLEAR_EVENT, onClear);
    };
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
      center: true,
    },
    {
      href: '/notifications' as Route,
      label: dict.nav.activity,
      short: dict.nav.activityShort,
      icon: Activity,
    },
    {
      href: '/profile' as Route,
      label: dict.nav.profile,
      short: dict.nav.profileShort,
      icon: UserRound,
    },
  ];

  const desktopLinks: Array<{ href: Route; label: string }> = [
    { href: '/dashboard' as Route, label: dict.nav.dashboard },
    { href: '/circles' as Route, label: dict.nav.circles },
    { href: '/wallet' as Route, label: dict.nav.wallet },
    { href: '/notifications' as Route, label: dict.nav.activity },
    { href: '/profile' as Route, label: dict.nav.profile },
  ];
  if (showAdmin) {
    desktopLinks.push({ href: '/admin' as Route, label: dict.common.admin });
  }

  return (
    <div className="amanah-ambient min-h-dvh overflow-x-hidden">
      <header className="sticky top-0 z-40 border-b border-border/60 bg-background/90 pt-[env(safe-area-inset-top)] backdrop-blur-md md:border-transparent md:bg-transparent">
        <div className="mx-auto flex h-12 w-full max-w-6xl items-center justify-between gap-3 px-4 md:h-14 md:px-6">
          <JameiyahLogo href={'/dashboard' as Route} size="md" tone="brand" />

          <nav
            className="amanah-nav-glass hidden items-center gap-0.5 rounded-xl px-1 py-1 md:flex"
            aria-label="Primary"
          >
            {desktopLinks.map((item) => {
              const active = pathActive(pathname, item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={active ? 'page' : undefined}
                  className={cn(
                    'whitespace-nowrap rounded-lg px-3.5 py-1.5 text-sm font-medium transition-colors',
                    active
                      ? 'bg-primary text-primary-foreground'
                      : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                  )}
                >
                  {item.label}
                  {item.href === '/notifications' && liveUnread > 0 ? (
                    <span className="ml-1.5 inline-flex min-w-5 items-center justify-center rounded-md bg-white/90 px-1.5 text-[10px] font-semibold text-primary">
                      {liveUnread > 9 ? '9+' : liveUnread}
                    </span>
                  ) : null}
                </Link>
              );
            })}
          </nav>

          <div className="flex shrink-0 items-center gap-0.5 sm:gap-1">
            <ThemeToggle />
            <LanguageSwitcher locale={locale} label={dict.common.language} />
            {showAdmin ? (
              <Link
                href={'/admin' as Route}
                className={cn(
                  'inline-flex h-10 w-10 items-center justify-center rounded-lg md:hidden',
                  pathname.startsWith('/admin')
                    ? 'bg-primary/15 text-primary'
                    : 'text-muted-foreground hover:bg-muted',
                )}
                aria-label={dict.common.admin}
                title={dict.common.admin}
              >
                <Shield className="h-5 w-5" />
              </Link>
            ) : null}
            <form action={signOutAction} className="hidden">
              <button type="submit">{dict.common.signOut}</button>
            </form>
          </div>
        </div>
      </header>

      <main className="relative mx-auto w-full max-w-6xl px-4 pb-[calc(5.25rem+env(safe-area-inset-bottom))] pt-4 md:px-6 md:pb-12 md:pt-6">
        <div
          className="pointer-events-none absolute inset-x-0 top-0 h-64 bg-[radial-gradient(ellipse_at_top,_rgba(13,92,69,0.07)_0%,_rgba(197,160,68,0.05)_45%,_transparent_72%)]"
          aria-hidden
        />
        <div className="relative">
          <SmoothRouteTransition>{children}</SmoothRouteTransition>
        </div>
      </main>

      <nav
        className="fixed inset-x-0 bottom-0 z-50 border-t border-border/70 bg-background/95 px-2 pb-[env(safe-area-inset-bottom)] pt-1 backdrop-blur-md md:hidden"
        aria-label="Mobile primary"
      >
        <ul className="mx-auto grid max-w-lg grid-cols-5 items-center gap-0.5">
          {tabs.map((item) => {
            const Icon = item.icon;
            const active = pathActive(pathname, item.href);
            const showBadge = item.href === '/notifications' && liveUnread > 0;
            if (item.center) {
              return (
                <li key={item.href} className="flex justify-center">
                  <Link
                    href={item.href}
                    aria-current={active ? 'page' : undefined}
                    aria-label={item.label}
                    className="flex min-h-12 flex-col items-center justify-center gap-0.5 px-1"
                  >
                    <span
                      className={cn(
                        'inline-flex h-10 w-10 items-center justify-center rounded-xl transition-colors',
                        active
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-primary/12 text-primary',
                      )}
                    >
                      <Icon className="h-5 w-5" strokeWidth={active ? 2.2 : 1.75} />
                    </span>
                    <span
                      className={cn(
                        'text-[10px] font-semibold',
                        active ? 'text-primary' : 'text-muted-foreground',
                      )}
                    >
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
                  aria-current={active ? 'page' : undefined}
                  className={cn(
                    'relative flex min-h-12 flex-col items-center justify-center gap-0.5 rounded-lg px-1 text-[10px] font-semibold',
                    active
                      ? 'bg-primary/10 text-primary'
                      : 'text-muted-foreground hover:text-foreground',
                  )}
                >
                  <Icon className="h-5 w-5" strokeWidth={active ? 2.4 : 1.6} />
                  {item.short}
                  {showBadge ? (
                    <span className="absolute right-[22%] top-1.5 h-1.5 w-1.5 rounded-full bg-primary" />
                  ) : null}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </div>
  );
}
