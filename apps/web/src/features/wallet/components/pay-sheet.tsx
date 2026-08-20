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
import { AmanahLogo } from '@/components/amanah-logo';
import { cn } from '@/lib/utils';

const ACTIONS = [
  {
    href: '/wallet' as Route,
    label: 'Send',
    hint: 'To anyone, anytime',
    icon: Send,
    tint: 'amanah-tint-send',
  },
  {
    href: '/wallet' as Route,
    label: 'Request',
    hint: 'Ask and receive',
    icon: ArrowDownToLine,
    tint: 'amanah-tint-request',
  },
  {
    href: '/wallet#top-up' as Route,
    label: 'Add Money',
    hint: 'From M-Pesa, Bank, Card',
    icon: Plus,
    tint: 'amanah-tint-add',
  },
  {
    href: '/wallet#withdraw' as Route,
    label: 'Withdraw',
    hint: 'To M-Pesa or Bank',
    icon: ArrowUpFromLine,
    tint: 'amanah-tint-withdraw',
  },
] as const;

/** Pay — IMAGE #2 liquid-glass surface (light, soft, premium). */
export function PaySheet() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const id = window.requestAnimationFrame(() => setReady(true));
    return () => window.cancelAnimationFrame(id);
  }, []);

  return (
    <div
      className={cn(
        'relative mx-auto w-full max-w-[390px] transition-all duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] md:max-w-md',
        ready ? 'translate-y-0 opacity-100' : 'translate-y-3 opacity-0',
      )}
    >
      {/* Soft ambient wash behind the sheet — never a black veil */}
      <div
        aria-hidden
        className="pointer-events-none absolute -inset-x-6 -top-8 h-56 rounded-[2.5rem] bg-[radial-gradient(ellipse_at_top,_rgba(25,184,121,0.12)_0%,_rgba(91,141,239,0.08)_45%,_transparent_70%)]"
      />

      <div className="amanah-glass relative rounded-[1.75rem] px-5 pb-6 pt-5 shadow-[0_12px_40px_rgba(17,24,39,0.06)]">
        <div className="mb-6 flex items-start justify-between gap-3">
          <div className="min-w-0 space-y-3">
            <AmanahLogo href={'/dashboard' as Route} size="sm" tone="brand" />
            <h1 className="text-[1.75rem] font-semibold tracking-tight text-foreground">Pay</h1>
          </div>
          <Link
            href={'/dashboard' as Route}
            className="amanah-glass-pill inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-muted-foreground"
            aria-label="Close"
          >
            <X className="h-4 w-4" strokeWidth={1.75} />
          </Link>
        </div>

        {/* Scan — soft deep emerald glass, not neon */}
        <button
          type="button"
          disabled
          className="relative mb-5 flex w-full flex-col items-center justify-center gap-3 overflow-hidden rounded-[1.5rem] px-6 py-14 text-left text-white"
          style={{
            background:
              'radial-gradient(ellipse 90% 70% at 20% 0%, rgba(56,201,138,0.45), transparent 55%), linear-gradient(165deg, #0f6b54 0%, #0b4a3c 55%, #08352c 100%)',
            boxShadow:
              '0 0 0 1px rgba(255,255,255,0.12) inset, 0 16px 40px rgba(11,74,60,0.28)',
          }}
        >
          <span
            aria-hidden
            className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_80%_20%,rgba(91,141,239,0.2),transparent_45%)]"
          />
          <span className="relative inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-white/15 backdrop-blur-sm">
            <QrCode className="h-7 w-7" strokeWidth={1.5} />
          </span>
          <span className="relative text-[15px] font-semibold tracking-tight">Scan to pay</span>
          <span className="relative text-xs text-white/70">Tap to open camera</span>
        </button>

        <p className="mb-2 text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
          Quick actions
        </p>

        <ul className="overflow-hidden rounded-[1.35rem] bg-white/55 dark:bg-white/[0.04]">
          {ACTIONS.map((action) => {
            const Icon = action.icon;
            return (
              <li
                key={action.label}
                className="border-b border-black/[0.04] last:border-0 dark:border-white/5"
              >
                <Link
                  href={action.href}
                  className="flex items-center gap-3 px-3.5 py-3.5 transition-colors active:bg-black/[0.03] dark:active:bg-white/5"
                >
                  <span
                    className={cn(
                      'inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-[0.95rem]',
                      action.tint,
                    )}
                  >
                    <Icon className="h-[18px] w-[18px]" strokeWidth={1.75} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[15px] font-semibold text-foreground">
                      {action.label}
                    </span>
                    <span className="mt-0.5 block text-xs text-muted-foreground">{action.hint}</span>
                  </span>
                  <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground/70" strokeWidth={1.5} />
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
