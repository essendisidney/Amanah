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
} from 'lucide-react';
import { formatCurrency } from '@jamiya/shared';
import { Button } from '@jamiya/ui';
import type { Dictionary } from '@/i18n/dictionaries';
import { cn } from '@/lib/utils';

type PayLabels = Dictionary['paySheet'];

export type PayDueItem = {
  href: Route;
  amountLabel: string;
  circleName: string;
  overdue: boolean;
};

type PayLink = {
  href: Route;
  label: string;
  hint?: string;
  icon: ComponentType<{ className?: string; strokeWidth?: number }>;
};

function LinkGroup({ title, items }: { title?: string; items: PayLink[] }) {
  if (items.length === 0) return null;
  return (
    <section className="space-y-2.5">
      {title ? <h2 className="text-sm font-semibold text-foreground">{title}</h2> : null}
      <ul className="amanah-surface divide-y divide-border/70">
        {items.map((action) => {
          const Icon = action.icon;
          return (
            <li key={`${action.href}-${action.label}`}>
              <Link
                href={action.href}
                className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              >
                <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Icon className="h-4 w-4" strokeWidth={1.75} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold text-foreground">{action.label}</span>
                  {action.hint ? (
                    <span className="block text-xs text-muted-foreground">{action.hint}</span>
                  ) : null}
                </span>
                <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" strokeWidth={1.5} />
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/** Pay — same financial-app language as Dashboard and Money. */
export function PaySheet({
  labels,
  available,
  currency = 'KES',
  dues = [],
}: {
  labels: PayLabels;
  available?: number | null;
  currency?: string;
  dues?: PayDueItem[];
}) {
  const [moreOpen, setMoreOpen] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined' && window.location.hash === '#more') {
      setMoreOpen(true);
    }
  }, []);

  const primary: PayLink[] = [
    {
      href: '/wallet' as Route,
      label: labels.openMoney,
      hint: labels.openMoneyHint,
      icon: Wallet,
    },
    {
      href: '/circles' as Route,
      label: labels.payCircle,
      hint: labels.payCircleHint,
      icon: LayoutGrid,
    },
    {
      href: '/finance/insights' as Route,
      label: labels.insights,
      hint: labels.insightsHint,
      icon: ChartNoAxesCombined,
    },
  ];

  const moreTools: PayLink[] = [
    {
      href: '/finance/goals' as Route,
      label: labels.goals,
      hint: labels.goalsHint,
      icon: Target,
    },
    {
      href: '/finance/qard' as Route,
      label: labels.qard,
      hint: labels.qardHint,
      icon: Landmark,
    },
    {
      href: '/finance/welfare' as Route,
      label: labels.welfare,
      hint: labels.welfareHint,
      icon: HandHeart,
    },
    {
      href: '/finance/invest' as Route,
      label: labels.invest,
      hint: labels.investHint,
      icon: TrendingUp,
    },
    {
      href: '/finance/tawarruq' as Route,
      label: labels.tawarruq,
      hint: labels.tawarruqHint,
      icon: Landmark,
    },
    {
      href: '/sadaka' as Route,
      label: labels.sadaka,
      hint: labels.sadakaHint,
      icon: HandHeart,
    },
    {
      href: '/zakat' as Route,
      label: labels.zakat,
      hint: labels.zakatHint,
      icon: Calculator,
    },
  ];

  const balance =
    available != null && Number.isFinite(available) ? available : null;

  return (
    <div className="space-y-5">
      <section className="amanah-surface space-y-3.5 px-4 py-4 sm:px-5">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            {labels.balanceLabel}
          </p>
          <p className="amanah-money mt-1 text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            {formatCurrency(balance ?? 0, currency)}
          </p>
        </div>

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          <Button asChild className="min-h-11 w-full px-2">
            <Link href={'/wallet?focus=top-up#top-up' as Route}>
              <Plus className="h-4 w-4" />
              <span className="truncate">{labels.addMoney}</span>
            </Link>
          </Button>
          <Button asChild variant="outline" className="min-h-11 w-full px-2">
            <Link href={'/wallet?focus=withdraw#withdraw' as Route}>
              <ArrowUpFromLine className="h-4 w-4" />
              <span className="truncate">{labels.withdraw}</span>
            </Link>
          </Button>
          <Button asChild variant="outline" className="col-span-2 min-h-11 w-full px-2 sm:col-span-1">
            <Link href={'/circles' as Route}>
              <LayoutGrid className="h-4 w-4" />
              <span className="truncate">{labels.browseCircles}</span>
            </Link>
          </Button>
        </div>
      </section>

      <section className="space-y-2.5">
        <h2 className="text-sm font-semibold text-foreground">{labels.sectionPay}</h2>
        {dues.length > 0 ? (
          <ul className="space-y-2">
            {dues.map((due) => (
              <li key={due.href}>
                <Link
                  href={due.href}
                  className={cn(
                    'amanah-surface flex items-start justify-between gap-3 px-4 py-3.5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
                    due.overdue
                      ? 'border-destructive/35 bg-destructive/8 hover:bg-destructive/12'
                      : 'border-primary/25 hover:bg-muted/40',
                  )}
                >
                  <div className="min-w-0">
                    <p
                      className={cn(
                        'text-[11px] font-semibold uppercase tracking-[0.14em]',
                        due.overdue ? 'text-destructive' : 'text-primary',
                      )}
                    >
                      {due.overdue ? labels.overdue : labels.payDue}
                    </p>
                    <p className="amanah-money mt-1 text-xl font-bold tracking-tight text-foreground">
                      {due.amountLabel}
                    </p>
                    <p className="mt-0.5 truncate text-xs text-muted-foreground">{due.circleName}</p>
                  </div>
                  <ChevronRight
                    className="mt-1 h-5 w-5 shrink-0 text-muted-foreground"
                    strokeWidth={1.5}
                  />
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <div className="amanah-surface space-y-3 px-4 py-5 text-center sm:px-5">
            <p className="text-sm font-semibold text-foreground">{labels.noDueTitle}</p>
            <p className="text-sm text-muted-foreground">{labels.noDueBody}</p>
            <Button asChild variant="outline" className="min-h-11">
              <Link href={'/circles' as Route}>{labels.browseCircles}</Link>
            </Button>
          </div>
        )}
      </section>

      <LinkGroup items={primary} />

      <div className="space-y-2.5" id="more">
        <button
          type="button"
          onClick={() => setMoreOpen((open) => !open)}
          className="amanah-surface flex w-full items-center justify-between px-4 py-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
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
  );
}
