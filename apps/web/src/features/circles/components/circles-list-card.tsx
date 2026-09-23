import Link from 'next/link';
import type { Route } from 'next';
import { formatCurrency, formatDate } from '@jamiya/shared';
import { StatusBadge } from '@/features/dashboard/components/dashboard-stats';
import { cn } from '@/lib/utils';

export type CirclesListDue = {
  remaining: number;
  currency: string;
  dueDate: string | null;
  status: string;
};

type Props = {
  href: Route;
  name: string;
  status: string;
  memberLabel: string;
  monthlyAmount: number;
  currency: string;
  due?: CirclesListDue | null;
  nextContributionLabel?: string;
  eachMonthLabel?: string;
  clearLabel?: string;
};

/** Circles index row — Dashboard circle DNA (StatusBadge + labeled due), not wash dots. */
export function CirclesListCard({
  href,
  name,
  status,
  memberLabel,
  monthlyAmount,
  currency,
  due,
  nextContributionLabel = 'Next contribution',
  eachMonthLabel = 'Each month',
  clearLabel = 'Clear for now',
}: Props) {
  const overdue = due?.status === 'late';

  return (
    <Link
      href={href}
      className="amanah-surface block border-l-4 border-l-primary px-4 py-4 transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 sm:px-5"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="truncate text-[15px] font-semibold tracking-tight text-foreground">
              {name}
            </p>
            <StatusBadge status={status} />
          </div>
          <p className="mt-1 text-xs capitalize text-muted-foreground">{memberLabel}</p>
        </div>
        <div className="shrink-0 text-right">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            {eachMonthLabel}
          </p>
          <p className="amanah-money mt-0.5 text-sm font-semibold text-foreground">
            {formatCurrency(monthlyAmount, currency)}
          </p>
        </div>
      </div>

      <div className="mt-3.5 border-t border-border/70 pt-3">
        {due ? (
          <div>
            <p
              className={cn(
                'text-[10px] font-semibold uppercase tracking-wide',
                overdue ? 'text-destructive' : 'text-muted-foreground',
              )}
            >
              {overdue ? 'Overdue' : nextContributionLabel}
            </p>
            <p
              className={cn(
                'amanah-money mt-0.5 text-sm font-semibold',
                overdue ? 'text-destructive' : 'text-foreground',
              )}
            >
              {formatCurrency(due.remaining, due.currency)}
            </p>
            {due.dueDate ? (
              <p className="mt-0.5 text-xs text-muted-foreground">{formatDate(due.dueDate)}</p>
            ) : null}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">{clearLabel}</p>
        )}
      </div>
    </Link>
  );
}
