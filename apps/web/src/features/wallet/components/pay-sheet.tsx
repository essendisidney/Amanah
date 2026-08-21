'use client';

import Link from 'next/link';
import type { Route } from 'next';
import { useEffect, useState, type ComponentType } from 'react';
import {
  ArrowUpFromLine,
  Calculator,
  ChartNoAxesCombined,
  ChevronDown,
  ChevronRight,
  HandHeart,
  Landmark,
  LayoutGrid,
  Plus,
  Target,
  TrendingUp,
  Wallet,
  X,
} from 'lucide-react';
import { formatCurrency } from '@jamiya/shared';
import { AmanahLogo } from '@/components/amanah-logo';
import type { Dictionary } from '@/i18n/dictionaries';
import { cn } from '@/lib/utils';

type PayLabels = Dictionary['paySheet'];

type PayLink = {
  href: Route;
  label: string;
  hint: string;
  icon: ComponentType<{ className?: string; strokeWidth?: number }>;
  tint: string;
};

function LinkGroup({
  title,
  items,
}: {
  title?: string;
  items: PayLink[];
}) {
  if (items.length === 0) return null;
  return (
    <section className="space-y-2">
      {title ? (
        <h2 className="px-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
          {title}
        </h2>
      ) : null}
      <ul className="overflow-hidden rounded-[1.35rem] bg-white/55 dark:bg-white/[0.04]">
        {items.map((action) => {
          const Icon = action.icon;
          return (
            <li
              key={`${action.href}-${action.label}`}
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
                <ChevronRight
                  className="h-4 w-4 shrink-0 text-muted-foreground/70"
                  strokeWidth={1.5}
                />
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/** Pay — primary map first; extra tools behind “More”. */
export function PaySheet({
  labels,
  available,
  currency = 'KES',
  dueHref,
  dueAmountLabel,
  dueCircleName,
  dueOverdue = false,
}: {
  labels: PayLabels;
  available?: number | null;
  currency?: string;
  dueHref?: Route | null;
  dueAmountLabel?: string | null;
  dueCircleName?: string | null;
  dueOverdue?: boolean;
}) {
  const [ready, setReady] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);

  useEffect(() => {
    const id = window.requestAnimationFrame(() => setReady(true));
    return () => window.cancelAnimationFrame(id);
  }, []);

  const primary: PayLink[] = [
    ...(dueHref
      ? []
      : [
          {
            href: '/circles' as Route,
            label: labels.payCircle,
            hint: labels.payCircleHint,
            icon: LayoutGrid,
            tint: 'amanah-tint-pay',
          } satisfies PayLink,
        ]),
    {
      href: '/wallet#withdraw' as Route,
      label: labels.withdraw,
      hint: labels.withdrawHint,
      icon: ArrowUpFromLine,
      tint: 'amanah-tint-withdraw',
    },
    {
      href: '/finance/insights' as Route,
      label: labels.insights,
      hint: labels.insightsHint,
      icon: ChartNoAxesCombined,
      tint: 'amanah-tint-send',
    },
    {
      href: '/wallet' as Route,
      label: labels.openMoney,
      hint: labels.openMoneyHint,
      icon: Wallet,
      tint: 'amanah-tint-add',
    },
  ];

  const moreTools: PayLink[] = [
    {
      href: '/finance/goals' as Route,
      label: labels.goals,
      hint: labels.goalsHint,
      icon: Target,
      tint: 'amanah-tint-send',
    },
    {
      href: '/finance/qard' as Route,
      label: labels.qard,
      hint: labels.qardHint,
      icon: Landmark,
      tint: 'amanah-tint-pay',
    },
    {
      href: '/finance/welfare' as Route,
      label: labels.welfare,
      hint: labels.welfareHint,
      icon: HandHeart,
      tint: 'amanah-tint-add',
    },
    {
      href: '/finance/invest' as Route,
      label: labels.invest,
      hint: labels.investHint,
      icon: TrendingUp,
      tint: 'amanah-tint-send',
    },
    {
      href: '/finance/tawarruq' as Route,
      label: labels.tawarruq,
      hint: labels.tawarruqHint,
      icon: Landmark,
      tint: 'amanah-tint-withdraw',
    },
    {
      href: '/sadaka' as Route,
      label: labels.sadaka,
      hint: labels.sadakaHint,
      icon: HandHeart,
      tint: 'amanah-tint-add',
    },
    {
      href: '/zakat' as Route,
      label: labels.zakat,
      hint: labels.zakatHint,
      icon: Calculator,
      tint: 'amanah-tint-pay',
    },
    {
      href: '/finance' as Route,
      label: labels.allFinance,
      hint: labels.allFinanceHint,
      icon: Wallet,
      tint: 'amanah-tint-send',
    },
  ];

  return (
    <div
      className={cn(
        'relative mx-auto w-full max-w-[390px] transition-all duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] md:max-w-md',
        ready ? 'translate-y-0 opacity-100' : 'translate-y-3 opacity-0',
      )}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute -inset-x-6 -top-8 h-56 rounded-[2.5rem] bg-[radial-gradient(ellipse_at_top,_rgba(25,184,121,0.12)_0%,_rgba(91,141,239,0.08)_45%,_transparent_70%)]"
      />

      <div className="amanah-glass relative space-y-5 rounded-[1.75rem] px-5 pb-6 pt-5 shadow-[0_12px_40px_rgba(17,24,39,0.06)]">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 space-y-3">
            <AmanahLogo href={'/dashboard' as Route} size="sm" tone="brand" />
            <div>
              <h1 className="text-[1.75rem] font-semibold tracking-tight text-foreground">
                {labels.title}
              </h1>
              <p className="mt-1 text-sm text-muted-foreground">{labels.subtitle}</p>
            </div>
          </div>
          <Link
            href={'/dashboard' as Route}
            className="amanah-glass-pill inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-muted-foreground"
            aria-label={labels.close}
          >
            <X className="h-4 w-4" strokeWidth={1.75} />
          </Link>
        </div>

        {available != null && Number.isFinite(available) ? (
          <Link
            href={'/wallet' as Route}
            className="flex items-center justify-between gap-3 rounded-[1.25rem] bg-white/50 px-4 py-3 dark:bg-white/[0.05]"
          >
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                {labels.balanceLabel}
              </p>
              <p className="amanah-money mt-0.5 text-xl font-bold tracking-tight text-foreground">
                {formatCurrency(available, currency)}
              </p>
            </div>
            <span className="text-xs font-semibold text-primary">{labels.openMoney} →</span>
          </Link>
        ) : null}

        <Link
          href={'/wallet#top-up' as Route}
          className="relative flex w-full flex-col items-center justify-center gap-2 overflow-hidden rounded-[1.5rem] px-6 py-10 text-left text-white"
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
            <Plus className="h-7 w-7" strokeWidth={1.5} />
          </span>
          <span className="relative text-[15px] font-semibold tracking-tight">
            {labels.addMoney}
          </span>
          <span className="relative text-xs text-white/70">{labels.addMoneyHint}</span>
        </Link>

        {dueHref && dueAmountLabel ? (
          <Link
            href={dueHref}
            className={cn(
              'block overflow-hidden rounded-[1.35rem] px-4 py-4 transition-transform active:scale-[0.99]',
              dueOverdue
                ? 'border border-destructive/35 bg-destructive/10'
                : 'border border-primary/25 bg-primary/10',
            )}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p
                  className={cn(
                    'text-[11px] font-semibold uppercase tracking-[0.16em]',
                    dueOverdue ? 'text-destructive' : 'text-primary',
                  )}
                >
                  {dueOverdue ? labels.overdue : labels.payDue}
                </p>
                <p className="amanah-money mt-1 text-2xl font-bold tracking-tight text-foreground">
                  {dueAmountLabel}
                </p>
                <p className="mt-1 truncate text-xs text-muted-foreground">
                  {dueCircleName
                    ? `${labels.payDueHint} · ${dueCircleName}`
                    : labels.payDueHint}
                </p>
              </div>
              <ChevronRight
                className="mt-1 h-5 w-5 shrink-0 text-muted-foreground"
                strokeWidth={1.5}
              />
            </div>
          </Link>
        ) : null}

        <LinkGroup items={primary} />

        <div className="space-y-2">
          <button
            type="button"
            onClick={() => setMoreOpen((open) => !open)}
            className="flex w-full items-center justify-between rounded-[1.25rem] bg-white/45 px-4 py-3 text-left dark:bg-white/[0.04]"
            aria-expanded={moreOpen}
          >
            <span className="text-sm font-semibold text-foreground">{labels.moreTools}</span>
            <ChevronDown
              className={cn(
                'h-4 w-4 text-muted-foreground transition-transform',
                moreOpen && 'rotate-180',
              )}
              strokeWidth={1.75}
            />
          </button>
          {moreOpen ? <LinkGroup items={moreTools} /> : null}
        </div>
      </div>
    </div>
  );
}
