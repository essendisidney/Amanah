'use client';

import Link from 'next/link';
import type { Route } from 'next';
import { useEffect, useState } from 'react';
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  ChevronRight,
  Plus,
  QrCode,
  Send,
  X,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const ACTIONS = [
  {
    href: '/wallet' as Route,
    label: 'Send',
    icon: Send,
    tint: 'amanah-tint-send',
  },
  {
    href: '/wallet' as Route,
    label: 'Request',
    icon: ArrowDownToLine,
    tint: 'amanah-tint-request',
  },
  {
    href: '/wallet#top-up' as Route,
    label: 'Add Money',
    icon: Plus,
    tint: 'amanah-tint-add',
  },
  {
    href: '/wallet#withdraw' as Route,
    label: 'Withdraw',
    icon: ArrowUpFromLine,
    tint: 'amanah-tint-withdraw',
  },
] as const;

/** Sheet-style Pay surface — rises in; deep links keep Money features intact. */
export function PaySheet() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const id = window.requestAnimationFrame(() => setOpen(true));
    return () => window.cancelAnimationFrame(id);
  }, []);

  return (
    <div className="relative mx-auto min-h-[70vh] w-full max-w-[390px] md:max-w-md">
      <div
        className={cn(
          'pointer-events-none fixed inset-0 z-40 bg-black/20 transition-opacity duration-300 md:absolute md:rounded-[2rem]',
          open ? 'opacity-100' : 'opacity-0',
        )}
        aria-hidden
      />

      <div
        className={cn(
          'fixed inset-x-0 bottom-0 z-50 mx-auto w-full max-w-[390px] transition-transform duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] md:absolute md:bottom-auto md:top-8 md:max-w-md',
          open ? 'translate-y-0' : 'translate-y-[110%] md:translate-y-8 md:opacity-0',
        )}
      >
        <div className="amanah-glass rounded-t-[1.75rem] px-5 pb-[calc(1.5rem+env(safe-area-inset-bottom))] pt-3 shadow-[0_-8px_40px_rgba(18,24,22,0.12)] md:rounded-[1.75rem]">
          <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-black/12 dark:bg-white/20" />

          <div className="mb-5 flex items-center justify-between">
            <h1 className="text-xl font-semibold tracking-tight">Pay</h1>
            <Link
              href={'/dashboard' as Route}
              className="inline-flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground hover:bg-black/5 dark:hover:bg-white/10"
              aria-label="Close"
            >
              <X className="h-4 w-4" strokeWidth={1.75} />
            </Link>
          </div>

          <button
            type="button"
            disabled
            className="amanah-pay-glow mb-4 flex w-full flex-col items-center justify-center gap-3 rounded-[1.5rem] bg-primary px-6 py-12 text-primary-foreground"
          >
            <span className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-white/18">
              <QrCode className="h-7 w-7" strokeWidth={1.5} />
            </span>
            <span className="text-[15px] font-semibold">Scan</span>
          </button>

          <ul className="overflow-hidden rounded-[1.25rem] bg-black/[0.03] dark:bg-white/[0.04]">
            {ACTIONS.map((action) => {
              const Icon = action.icon;
              return (
                <li key={action.label} className="border-b border-black/5 last:border-0 dark:border-white/5">
                  <Link
                    href={action.href}
                    className="flex items-center gap-3 px-4 py-4 transition-colors active:bg-black/5 dark:active:bg-white/5"
                  >
                    <span
                      className={cn(
                        'inline-flex h-10 w-10 items-center justify-center rounded-[0.85rem]',
                        action.tint,
                      )}
                    >
                      <Icon className="h-4 w-4" strokeWidth={1.75} />
                    </span>
                    <span className="flex-1 text-[15px] font-medium">{action.label}</span>
                    <ChevronRight className="h-4 w-4 text-muted-foreground" strokeWidth={1.5} />
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    </div>
  );
}
