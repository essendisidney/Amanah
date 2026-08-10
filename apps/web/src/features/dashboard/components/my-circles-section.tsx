import Link from 'next/link';
import type { Route } from 'next';
import { Button } from '@jamiya/ui';
import { formatCurrency, formatDate } from '@jamiya/shared';
import type { DashboardJamiya } from '../types';
import { EmptyState, SectionHeader } from './empty-state';
import { StatusBadge } from './dashboard-stats';

export function MyCirclesSection({ jamiyas }: { jamiyas: DashboardJamiya[] }) {
  return (
    <section>
      <SectionHeader
        title="My circles"
        description="Circles you belong to as a member or circle admin."
        action={
          <Button asChild size="sm" variant="outline">
            <Link href={'/circles' as Route}>View all</Link>
          </Button>
        }
      />

      {jamiyas.length === 0 ? (
        <EmptyState
          title="No circles yet"
          description="Create a circle or accept an invitation to start saving with your community."
          actionLabel="Create a circle"
          actionHref={'/circles/new' as Route}
        />
      ) : (
        <ul className="divide-y divide-border rounded-xl border border-border bg-card">
          {jamiyas.map((item) => (
            <li key={item.membershipId}>
              <Link
                href={`/circles/${item.jamiya.slug}` as Route}
                className="flex flex-col gap-3 px-5 py-4 transition-colors hover:bg-muted/50 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="truncate font-medium text-foreground">{item.jamiya.name}</p>
                    <StatusBadge status={item.jamiya.status} />
                    <StatusBadge status={item.role} />
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {item.jamiya.memberCount}/{item.jamiya.maxMembers} members · Cycle{' '}
                    {item.jamiya.currentCycle}/{item.jamiya.cycleCount}
                    {item.jamiya.startDate
                      ? ` · Starts ${formatDate(item.jamiya.startDate)}`
                      : ''}
                  </p>
                </div>
                <div className="shrink-0 text-sm font-medium text-foreground sm:text-right">
                  {formatCurrency(item.jamiya.contributionAmount, item.jamiya.currency)}
                  <span className="block text-xs font-normal text-muted-foreground">
                    per cycle
                    {item.payoutPosition ? ` · Position #${item.payoutPosition}` : ''}
                  </span>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
