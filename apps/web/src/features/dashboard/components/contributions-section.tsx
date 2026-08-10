import Link from 'next/link';
import type { Route } from 'next';
import { formatCurrency, formatDate } from '@jamiya/shared';
import { Button } from '@jamiya/ui';
import type { DashboardContribution } from '../types';
import { EmptyState, SectionHeader } from './empty-state';
import { StatusBadge } from './dashboard-stats';
import { payContributionAction } from '@/features/circles/actions/ledger-actions';

export function ContributionsSection({
  contributions,
}: {
  contributions: DashboardContribution[];
}) {
  return (
    <section>
      <SectionHeader
        title="Upcoming contributions"
        description="Dues that are pending or late across your circles."
      />

      {contributions.length === 0 ? (
        <EmptyState
          title="Nothing due right now"
          description="When cycles open, your contribution schedule will appear here."
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
                    href={`/circles/${item.jamiyaSlug}` as Route}
                    className="font-medium text-foreground hover:text-primary"
                  >
                    {item.jamiyaName}
                  </Link>
                  <StatusBadge status={item.status} />
                </div>
                <p className="mt-1 text-sm text-muted-foreground">
                  Cycle {item.cycleNumber} · Due {formatDate(item.dueDate)}
                  {item.amountPaid > 0
                    ? ` · Paid ${formatCurrency(item.amountPaid, item.currency)} · Left ${formatCurrency(Math.max(item.amount - item.amountPaid, 0), item.currency)}`
                    : null}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <p className="text-sm font-semibold text-foreground">
                  {formatCurrency(item.amount, item.currency)}
                </p>
                {item.status === 'pending' ||
                item.status === 'late' ||
                item.status === 'partial' ? (
                  <form action={payContributionAction} className="flex items-center gap-2">
                    <input type="hidden" name="contributionId" value={item.id} />
                    <input type="hidden" name="slug" value={item.jamiyaSlug} />
                    <input
                      name="amount"
                      type="number"
                      min={1}
                      step="0.01"
                      placeholder="Mdogo"
                      className="h-9 w-24 rounded-md border border-input bg-background px-2 text-sm"
                    />
                    <Button type="submit" size="sm">
                      Pay
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
