import Link from 'next/link';
import type { Route } from 'next';
import { formatCurrency, formatDate } from '@jamiya/shared';
import { Button } from '@jamiya/ui';
import type { Dictionary } from '@/i18n/dictionaries';
import { t } from '@/i18n/dictionaries';
import type { DashboardContribution } from '../types';
import { EmptyState, SectionHeader } from './empty-state';
import { StatusBadge } from './dashboard-stats';
import { payContributionAction } from '@/features/circles/actions/ledger-actions';

export function ContributionsSection({
  contributions,
  labels,
  common,
}: {
  contributions: DashboardContribution[];
  labels: Dictionary['dashboard'];
  common: Dictionary['common'];
}) {
  return (
    <section>
      <SectionHeader title={labels.contributionsTitle} description={labels.contributionsDesc} />

      {contributions.length === 0 ? (
        <EmptyState
          title={labels.contributionsEmptyTitle}
          description={labels.contributionsEmptyDesc}
          actionLabel="Open Circles"
          actionHref={'/circles' as Route}
        />
      ) : (
        <ul className="divide-y divide-border rounded-xl border border-border bg-card">
          {contributions.map((item) => (
            <li
              key={item.id}
              className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between"
            >
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <Link
                    href={`/circles/${item.jamiyaSlug}#pay` as Route}
                    className="font-medium text-foreground hover:text-primary"
                  >
                    {item.jamiyaName}
                  </Link>
                  <StatusBadge status={item.status} />
                </div>
                <p className="mt-1 text-sm text-muted-foreground">
                  {t(labels.cycleDue, {
                    cycle: item.cycleNumber,
                    date: formatDate(item.dueDate),
                  })}
                  {item.amountPaid > 0
                    ? ` · ${labels.paid} ${formatCurrency(item.amountPaid, item.currency)} · ${common.left} ${formatCurrency(Math.max(item.amount - item.amountPaid, 0), item.currency)}`
                    : null}
                </p>
              </div>
              <div className="flex w-full flex-col gap-3 sm:w-auto sm:items-end">
                <p className="text-sm font-semibold text-foreground">
                  {formatCurrency(item.amount, item.currency)}
                  {item.amountPaid > 0 ? (
                    <span className="ml-2 font-normal text-muted-foreground">
                      · {common.left}{' '}
                      {formatCurrency(
                        Math.max(item.amount - item.amountPaid, 0),
                        item.currency,
                      )}
                    </span>
                  ) : null}
                </p>
                {item.status === 'pending' ||
                item.status === 'late' ||
                item.status === 'partial' ? (
                  <form
                    action={payContributionAction}
                    className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center"
                  >
                    <input type="hidden" name="contributionId" value={item.id} />
                    <input type="hidden" name="slug" value={item.jamiyaSlug} />
                    <input
                      name="amount"
                      type="number"
                      inputMode="decimal"
                      min={1}
                      step="0.01"
                      placeholder={labels.amountPlaceholder}
                      className="h-11 w-full rounded-md border border-input bg-background px-3 text-base sm:h-10 sm:w-40 sm:text-sm"
                    />
                    <Button type="submit" className="min-h-11 w-full sm:w-auto">
                      {common.pay}
                    </Button>
                  </form>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
