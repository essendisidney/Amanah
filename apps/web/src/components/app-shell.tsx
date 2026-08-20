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
import { AmanahLogo } from '@/components/amanah-logo';

type ShellDictionary = Pick<Dictionary, 'nav' | 'common'>;

type Tab = {
  href: Route;
  label: string;
  short: string;
  icon: ComponentType<{ className?: string }>;
  center?: boolean;
};

function pathActive(pathname: string, href: string) {
  if (href === '/dashboard') return pathname === '/dashboard';
  if (href === '/wallet' || href === '/pay') {
    return (
      pathname === '/pay' ||
      pathname === '/wallet' ||
      pathname.startsWith('/wallet/')
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
      label: dict.nav.pay,
      short: dict.nav.payShort,
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
    { href: '/wallet' as Route, label: dict.nav.pay },
    { href: '/notifications' as Route, label: dict.nav.activity },
    { href: '/profile' as Route, label: dict.nav.profile },
  ];
  if (showAdmin) {
    desktopLinks.push({ href: '/admin' as Route, label: dict.common.admin });
  }

  return (
    <div className="amanah-ambient min-h-dvh overflow-x-hidden">
      <header className="sticky top-0 z-40 pt-[env(safe-area-inset-top)] md:backdrop-blur-xl">
        <div className="mx-auto flex h-14 w-full max-w-[390px] items-center justify-between gap-3 px-4 md:h-[4.25rem] md:max-w-6xl md:px-10">
          <AmanahLogo href={'/dashboard' as Route} size="md" tone="brand" />

          <nav
            className="amanah-nav-glass hidden items-center gap-1 rounded-full px-1.5 py-1 md:flex"
            aria-label="Primary"
          >
            {desktopLinks.map((item) => {
              const active = pathActive(pathname, item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    'whitespace-nowrap rounded-full px-4 py-2 text-sm font-medium transition-colors',
                    active
                      ? 'bg-primary text-primary-foreground shadow-[0_6px_18px_rgba(25,184,121,0.28)]'
                      : 'text-muted-foreground hover:text-foreground',
                  )}
                >
                  {item.label}
                  {item.href === '/notifications' && liveUnread > 0 ? (
                    <span className="ml-2 inline-flex min-w-5 items-center justify-center rounded-full bg-white/90 px-1.5 text-[10px] font-semibold text-primary">
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
                  'inline-flex h-11 w-11 items-center justify-center rounded-full md:hidden',
                  pathname.startsWith('/admin')
                    ? 'bg-primary/15 text-primary'
                    : 'text-muted-foreground hover:bg-white/40 dark:hover:bg-white/5',
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

      <main className="mx-auto w-full max-w-[390px] px-4 py-6 pb-[calc(6.5rem+env(safe-area-inset-bottom))] md:max-w-6xl md:px-10 md:py-12 md:pb-14">
        <SmoothRouteTransition>{children}</SmoothRouteTransition>
      </main>

      <nav
        className="fixed inset-x-0 bottom-0 z-50 px-3 pb-[calc(0.5rem+env(safe-area-inset-bottom))] pt-1 md:hidden"
        aria-label="Mobile primary"
      >
        <ul className="amanah-nav-glass mx-auto grid max-w-lg grid-cols-5 items-end rounded-[1.75rem] px-1 py-1.5">
          {tabs.map((item) => {
            const Icon = item.icon;
            const active = pathActive(pathname, item.href);
            const showBadge = item.href === '/notifications' && liveUnread > 0;
            if (item.center) {
              return (
                <li key={item.href} className="relative -mt-7 flex justify-center">
                  <Link
                    href={item.href}
                    className="flex flex-col items-center gap-1"
                    aria-label={item.label}
                  >
                    <span
                      className={cn(
                        'amanah-pay-glow inline-flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground transition-transform active:scale-95',
                        active && 'ring-4 ring-primary/25',
                      )}
                    >
                      <Icon className="h-6 w-6" strokeWidth={1.75} />
                    </span>
                    <span
                      className={cn(
                        'text-[11px] font-semibold',
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
                  className={cn(
                    'relative flex min-h-12 flex-col items-center justify-center gap-0.5 px-1 text-[11px] font-semibold',
                    active ? 'text-primary' : 'text-muted-foreground',
                  )}
                >
                  <Icon className={cn('h-5 w-5', active && 'stroke-[2.4]')} strokeWidth={1.6} />
                  {item.short}
                  {showBadge ? (
                    <span className="absolute right-[18%] top-1 h-1.5 w-1.5 rounded-full bg-primary" />
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
