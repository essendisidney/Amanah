import type { Metadata } from 'next';
import Link from 'next/link';
import type { Route } from 'next';
import { redirect } from 'next/navigation';
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  ChevronRight,
  Plus,
  QrCode,
  Send,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/server';

export const metadata: Metadata = {
  title: 'Pay',
};

export const dynamic = 'force-dynamic';

const ACTIONS = [
  {
    href: '/wallet#top-up' as Route,
    label: 'Add money',
    hint: 'Top up your balance',
    icon: Plus,
  },
  {
    href: '/wallet#withdraw' as Route,
    label: 'Withdraw',
    hint: 'Send to M-Pesa or bank',
    icon: ArrowUpFromLine,
  },
  {
    href: '/wallet' as Route,
    label: 'Send money',
    hint: 'From your Amanah balance',
    icon: Send,
  },
  {
    href: '/wallet' as Route,
    label: 'Request money',
    hint: 'Ask someone to pay you',
    icon: ArrowDownToLine,
  },
] as const;

export default async function PayPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/phone?next=/pay');
  }

  return (
    <div className="mx-auto max-w-lg space-y-8">
      <header className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-bold tracking-tight">Pay</h1>
        <Link
          href={'/dashboard' as Route}
          className="inline-flex h-10 w-10 items-center justify-center rounded-full text-muted-foreground hover:bg-white/40 dark:hover:bg-white/5"
          aria-label="Close"
        >
          ✕
        </Link>
      </header>

      <section className="amanah-glass relative overflow-hidden rounded-[2rem] bg-[linear-gradient(160deg,rgba(11,92,66,0.92),rgba(15,118,110,0.85))] p-1 text-white shadow-[0_16px_40px_rgba(11,92,66,0.28)]">
        <button
          type="button"
          className="flex w-full flex-col items-center justify-center gap-3 rounded-[1.85rem] border border-white/20 bg-white/10 px-6 py-16 backdrop-blur-md transition-colors hover:bg-white/15"
          disabled
          aria-disabled
        >
          <span className="inline-flex h-16 w-16 items-center justify-center rounded-2xl border border-white/35 bg-white/15">
            <QrCode className="h-8 w-8" />
          </span>
          <span className="text-base font-semibold tracking-tight">Scan to pay</span>
          <span className="text-sm text-white/70">Coming with live rails</span>
        </button>
      </section>

      <ul className="amanah-glass divide-y divide-border/40 overflow-hidden rounded-3xl">
        {ACTIONS.map((action) => {
          const Icon = action.icon;
          return (
            <li key={action.label}>
              <Link
                href={action.href}
                className="flex items-center gap-3 px-4 py-4 transition-colors hover:bg-white/35 dark:hover:bg-white/5"
              >
                <span className="amanah-glass-pill inline-flex h-11 w-11 items-center justify-center rounded-2xl text-primary">
                  <Icon className="h-5 w-5" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold text-foreground">
                    {action.label}
                  </span>
                  <span className="block text-xs text-muted-foreground">{action.hint}</span>
                </span>
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
