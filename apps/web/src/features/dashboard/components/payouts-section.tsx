import Link from 'next/link';
import type { Route } from 'next';
import { formatCurrency, formatDate } from '@jamiya/shared';
import type { Dictionary } from '@/i18n/dictionaries';
import { t } from '@/i18n/dictionaries';
import type { DashboardPayout } from '../types';
import { EmptyState, SectionHeader } from './empty-state';
import { StatusBadge } from './dashboard-stats';

export function PayoutsSection({
  payouts,
  labels,
}: {
  payouts: DashboardPayout[];
  labels: Dictionary['dashboard'];
}) {
  return (
    <section>
      <SectionHeader title={labels.payoutsTitle} description={labels.payoutsDesc} />

      {payouts.length === 0 ? (
        <EmptyState
          title={labels.payoutsEmptyTitle}
          description={labels.payoutsEmptyDesc}
        />
      ) : (
        <ul className="divide-y divide-border rounded-xl border border-border bg-card">
          {payouts.map((item) => (
            <li
              key={item.id}
              className="flex flex-col gap-2 px-5 py-4 sm:flex-row sm:items-center sm:justify-between"
            >
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <Link
                    href={`/circles/${item.jamiyaSlug}` as Route}
                    className="font-medium text-foreground hover:text-primary"
                  >
                    {item.jamiyaName}
                  </Link>
                  <StatusBadge status={item.status} />
                </div>
                <p className="mt-1 text-sm text-muted-foreground">
                  {t(labels.cycleScheduled, {
                    cycle: item.cycleNumber,
                    date: formatDate(item.scheduledDate),
                  })}
                </p>
              </div>
              <p className="text-sm font-semibold text-foreground">
                {formatCurrency(item.amount, item.currency)}
              </p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
