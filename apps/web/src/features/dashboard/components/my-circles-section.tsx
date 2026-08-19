import Link from 'next/link';
import type { Route } from 'next';
import { Button } from '@jamiya/ui';
import { formatCurrency, formatDate } from '@jamiya/shared';
import type { Dictionary } from '@/i18n/dictionaries';
import { t } from '@/i18n/dictionaries';
import type { DashboardJamiya } from '../types';
import { EmptyState, SectionHeader } from './empty-state';
import { StatusBadge } from './dashboard-stats';

export function MyCirclesSection({
  jamiyas,
  labels,
  common,
}: {
  jamiyas: DashboardJamiya[];
  labels: Dictionary['dashboard'];
  common: Dictionary['common'];
}) {
  return (
    <section>
      <SectionHeader
        title={labels.myCirclesTitle}
        description={labels.myCirclesDesc}
        action={
          <Button asChild size="sm" variant="outline">
            <Link href={'/circles' as Route}>{common.viewAll}</Link>
          </Button>
        }
      />

      {jamiyas.length === 0 ? (
        <EmptyState
          title={labels.noCirclesTitle}
          description={labels.noCirclesDesc}
          actionLabel={labels.createACircle}
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
                    {item.jamiya.memberCount}/{item.jamiya.maxMembers} {common.members} ·{' '}
                    {item.jamiya.cycleCount != null
                      ? `${common.cycle} ${item.jamiya.currentCycle}/${item.jamiya.cycleCount}`
                      : common.cycle}
                    {item.jamiya.startDate
                      ? ` · ${common.starts} ${formatDate(item.jamiya.startDate)}`
                      : ''}
                  </p>
                </div>
                <div className="shrink-0 text-sm font-medium text-foreground sm:text-right">
                  {formatCurrency(item.jamiya.contributionAmount, item.jamiya.currency)}
                  <span className="block text-xs font-normal text-muted-foreground">
                    {common.perCycle}
                    {item.payoutPosition
                      ? ` · ${t(labels.position, { n: item.payoutPosition })}`
                      : ''}
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
