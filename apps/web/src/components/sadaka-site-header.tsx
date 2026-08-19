'use client';

import Link from 'next/link';
import type { Route } from 'next';
import { Menu, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { APP_NAME } from '@jamiya/shared';
import { cn } from '@/lib/utils';

const SADAKA_LINKS = [
  { href: '/sadaka' as Route, label: 'Active campaigns' },
  { href: '/sadaka/new' as Route, label: 'Start campaign' },
  { href: '/sadaka/my' as Route, label: 'My campaigns' },
  { href: '/sadaka/adopt' as Route, label: 'Adopt' },
] as const;

type SadakaSiteHeaderProps = {
  signedIn: boolean;
  pathname?: string;
};

function pathActive(pathname: string, href: string) {
  return pathname === href || (href !== '/sadaka' && pathname.startsWith(`${href}/`));
}

export function SadakaSiteHeader({ signedIn, pathname = '' }: SadakaSiteHeaderProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const homeHref = (signedIn ? '/dashboard' : '/') as Route;

  useEffect(() => {
    document.body.style.overflow = menuOpen ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [menuOpen]);

  return (
    <header className="sticky top-0 z-40 border-b border-border/70 bg-card/90 pt-[env(safe-area-inset-top)] backdrop-blur">
      <div className="mx-auto flex h-14 w-full max-w-6xl items-center justify-between gap-2 px-4 md:h-16 md:gap-3 md:px-6">
        <Link
          href={homeHref}
          className="shrink-0 font-[family-name:var(--font-display)] text-lg font-semibold text-primary md:text-xl"
        >
          {APP_NAME}
        </Link>

        <nav className="hidden items-center gap-1 md:flex" aria-label="Sadaka">
          {SADAKA_LINKS.map((item) => {
            const active = pathActive(pathname, item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'whitespace-nowrap rounded-md px-2.5 py-2 text-sm font-medium transition-colors',
                  active
                    ? 'bg-muted text-foreground'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                )}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="flex shrink-0 items-center gap-1">
          <Link
            href={(signedIn ? '/dashboard' : '/login?next=/sadaka') as Route}
            className="hidden rounded-md border border-border px-3 py-1.5 text-sm font-medium sm:inline-flex"
          >
            {signedIn ? 'Dashboard' : 'Sign in'}
          </Link>

          <button
            type="button"
            className="inline-flex h-11 w-11 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground md:hidden"
            aria-expanded={menuOpen}
            aria-controls="sadaka-mobile-menu"
            aria-label={menuOpen ? 'Close Sadaka menu' : 'Open Sadaka menu'}
            onClick={() => setMenuOpen((open) => !open)}
          >
            {menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {menuOpen ? (
        <div
          id="sadaka-mobile-menu"
          className="border-t border-border/70 bg-card px-4 py-3 md:hidden"
        >
          <ul className="flex flex-col gap-1">
            {SADAKA_LINKS.map((item) => {
              const active = pathActive(pathname, item.href);
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className={cn(
                      'flex min-h-11 items-center rounded-lg px-3 text-sm font-medium',
                      active
                        ? 'bg-muted text-foreground'
                        : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                    )}
                    onClick={() => setMenuOpen(false)}
                  >
                    {item.label}
                  </Link>
                </li>
              );
            })}
            <li className="border-t border-border/70 pt-2">
              <Link
                href={(signedIn ? '/dashboard' : '/login?next=/sadaka') as Route}
                className="flex min-h-11 items-center rounded-lg px-3 text-sm font-medium text-primary"
                onClick={() => setMenuOpen(false)}
              >
                {signedIn ? 'Dashboard' : 'Sign in'}
              </Link>
            </li>
          </ul>
        </div>
      ) : null}
    </header>
  );
}
