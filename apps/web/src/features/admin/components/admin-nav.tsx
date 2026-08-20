'use client';

import Link from 'next/link';
import type { Route } from 'next';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { cn } from '@/lib/utils';

const PRIMARY: Array<{ href: Route; label: string }> = [
  { href: '/admin' as Route, label: 'Inbox' },
  { href: '/admin/kyc' as Route, label: 'KYC' },
  { href: '/admin/withdrawals' as Route, label: 'Money out' },
  { href: '/admin/sadaka' as Route, label: 'Sadaka' },
  { href: '/admin/disputes' as Route, label: 'Disputes' },
];

const MORE: Array<{ href: Route; label: string }> = [
  { href: '/admin/tawarruq' as Route, label: 'Tawarruq' },
  { href: '/admin/users' as Route, label: 'Users' },
  { href: '/admin/circles' as Route, label: 'Circles' },
  { href: '/admin/transactions' as Route, label: 'Transactions' },
  { href: '/admin/collections' as Route, label: 'Collections' },
  { href: '/admin/risk' as Route, label: 'Risk' },
  { href: '/admin/playbooks' as Route, label: 'Playbooks' },
  { href: '/admin/observability' as Route, label: 'Health' },
  { href: '/admin/audit' as Route, label: 'Audit' },
];

function linkActive(pathname: string, href: string) {
  if (href === '/admin') return pathname === '/admin';
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function AdminNav() {
  const pathname = usePathname() || '';
  const moreActive = MORE.some((item) => linkActive(pathname, item.href));
  const [moreOpen, setMoreOpen] = useState(moreActive);

  return (
    <div className="space-y-2">
      <nav
        className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [-ms-overflow-style:none] [scrollbar-width:none] sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0 [&::-webkit-scrollbar]:hidden"
        aria-label="Admin primary"
      >
        {PRIMARY.map((item) => {
          const active = linkActive(pathname, item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'inline-flex min-h-11 shrink-0 items-center rounded-xl px-3.5 text-sm font-semibold transition-colors',
                active
                  ? 'bg-primary text-primary-foreground'
                  : 'border border-border bg-card text-foreground hover:bg-muted',
              )}
            >
              {item.label}
            </Link>
          );
        })}
        <button
          type="button"
          onClick={() => setMoreOpen((open) => !open)}
          className={cn(
            'inline-flex min-h-11 shrink-0 items-center rounded-xl border px-3.5 text-sm font-semibold',
            moreOpen || moreActive
              ? 'border-primary/40 bg-primary/10 text-primary'
              : 'border-border bg-card text-muted-foreground hover:bg-muted hover:text-foreground',
          )}
          aria-expanded={moreOpen}
        >
          More
        </button>
      </nav>

      {moreOpen ? (
        <nav
          className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [-ms-overflow-style:none] [scrollbar-width:none] sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0 [&::-webkit-scrollbar]:hidden"
          aria-label="Admin more"
        >
          {MORE.map((item) => {
            const active = linkActive(pathname, item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'inline-flex min-h-11 shrink-0 items-center rounded-xl border px-3.5 text-sm font-medium',
                  active
                    ? 'border-primary/40 bg-primary/10 text-primary'
                    : 'border-border bg-card text-muted-foreground hover:bg-muted hover:text-foreground',
                )}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
      ) : null}
    </div>
  );
}
