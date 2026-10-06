import Link from 'next/link';
import type { Route } from 'next';
import { formatCurrency, formatDate, formatRelativeTime } from '@jamiya/shared';
import { Button } from '@jamiya/ui';
import {
  collectFeesOwedAction,
  waiveFeeOwedAction,
} from '@/features/admin/actions/fees-owed-actions';
import { StatusBadge } from '@/features/dashboard/components/dashboard-stats';
import { ConfirmSubmitButton } from '@/features/admin/components/confirm-submit-button';

export const FEES_OWED_STATUSES = [
  ['owed', 'Owed'],
  ['collected', 'Collected'],
  ['waived', 'Waived'],
  ['all', 'All'],
] as const;
export type FeesOwedStatus = (typeof FEES_OWED_STATUSES)[number][0];

export type FeesOwedSummary = {
  owed_count: number;
  owed_total: number | string;
  owed_members: number;
  collected_30d_total: number | string;
  waived_total: number | string;
  oldest_owed_at: string | null;
};

export type FeeOwedRow = {
  id: string;
  user_id: string;
  full_name: string | null;
  phone: string | null;
  jamiya_name: string | null;
  cycle_number: number | null;
  amount: number | string;
  currency: string;
  status: string;
  created_at: string;
  collected_at: string | null;
  waived_at: string | null;
  waive_reason: string | null;
};

/** One block per member, in the order their first fee appears (oldest first). */
function groupByMember(rows: FeeOwedRow[]) {
  const groups = new Map<
    string,
    { userId: string; name: string; phone: string | null; rows: FeeOwedRow[] }
  >();
  for (const row of rows) {
    const group = groups.get(row.user_id) ?? {
      userId: row.user_id,
      name: row.full_name?.trim() || 'Member',
      phone: row.phone,
      rows: [],
    };
    group.rows.push(row);
    groups.set(row.user_id, group);
  }
  return [...groups.values()];
}

/** Admin list of owed circle fees, with collect and waive actions. */
export function FeesOwedView({
  status,
  summary,
  rows,
  failed,
}: {
  status: FeesOwedStatus;
  summary?: FeesOwedSummary;
  rows: FeeOwedRow[];
  failed: string | null;
}) {
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="font-[family-name:var(--font-display)] text-2xl font-semibold">
            Fees owed
          </h2>
          <p className="text-muted-foreground mt-1 max-w-2xl text-sm">
            Circle fees a member&apos;s wallet could not cover when their contribution was paid.
            They are taken automatically from the next M-Pesa deposit and before any withdrawal.
            Collect now if the member has since been paid out, or waive with a reason.
          </p>
        </div>
        <Button asChild variant="outline" className="min-h-11">
          <Link href={'/admin/finance' as Route}>Finance centre</Link>
        </Button>
      </div>

      {failed ? (
        <p className="border-destructive/40 bg-destructive/5 text-destructive rounded-xl border px-4 py-3 text-sm">
          Could not load fees owed: {failed}
        </p>
      ) : null}

      {summary ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[
            {
              label: 'Owed now',
              value: formatCurrency(Number(summary.owed_total), 'KES'),
              hint: `${summary.owed_count} fee${summary.owed_count === 1 ? '' : 's'} · ${summary.owed_members} member${summary.owed_members === 1 ? '' : 's'}`,
            },
            {
              label: 'Oldest unpaid',
              value: summary.oldest_owed_at ? formatRelativeTime(summary.oldest_owed_at) : 'None',
              hint: summary.oldest_owed_at ? formatDate(summary.oldest_owed_at) : 'Nothing owed',
            },
            {
              label: 'Collected, last 30 days',
              value: formatCurrency(Number(summary.collected_30d_total), 'KES'),
              hint: 'Taken after being owed',
            },
            {
              label: 'Waived',
              value: formatCurrency(Number(summary.waived_total), 'KES'),
              hint: 'All time',
            },
          ].map((tile) => (
            <div key={tile.label} className="border-border bg-card rounded-xl border px-4 py-3">
              <p className="text-muted-foreground text-xs font-medium">{tile.label}</p>
              <p className="mt-1 text-xl font-semibold tabular-nums">{tile.value}</p>
              <p className="text-muted-foreground mt-0.5 text-xs">{tile.hint}</p>
            </div>
          ))}
        </div>
      ) : null}

      <nav className="flex flex-wrap gap-2" aria-label="Filter by status">
        {FEES_OWED_STATUSES.map(([value, label]) => (
          <Link
            key={value}
            href={`/admin/finance/fees-owed?status=${value}` as Route}
            aria-current={status === value ? 'page' : undefined}
            className={`inline-flex min-h-10 items-center rounded-lg border px-3 text-xs font-semibold ${
              status === value ? 'border-primary bg-primary/10 text-primary' : 'border-border'
            }`}
          >
            {label}
          </Link>
        ))}
      </nav>

      <div className="border-border bg-card overflow-hidden rounded-xl border">
        {rows.length === 0 ? (
          <p className="text-muted-foreground px-4 py-8 text-sm">
            {status === 'owed' ? 'No member owes a circle fee.' : 'Nothing here yet.'}
          </p>
        ) : (
          <ul className="divide-border divide-y">
            {groupByMember(rows).map((member) => {
              const owed = member.rows.filter((row) => row.status === 'owed');
              const owedTotal = owed.reduce((sum, row) => sum + Number(row.amount), 0);
              return (
                <li key={member.userId} className="space-y-3 px-4 py-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold">{member.name}</p>
                      <p className="text-muted-foreground mt-0.5 text-xs">
                        {member.phone ?? 'No phone'}
                        {owed.length > 0
                          ? ` · owes ${formatCurrency(owedTotal, owed[0]?.currency ?? 'KES')}`
                          : ''}
                      </p>
                    </div>
                    {owed.length > 0 ? (
                      <form action={collectFeesOwedAction}>
                        <input type="hidden" name="userId" value={member.userId} />
                        <Button type="submit" size="sm" variant="outline" className="min-h-10">
                          Collect now
                        </Button>
                      </form>
                    ) : null}
                  </div>

                  <ul className="space-y-2">
                    {member.rows.map((row) => (
                      <li
                        key={row.id}
                        className="border-border/70 bg-background/60 space-y-2 rounded-lg border px-3 py-2.5"
                      >
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="text-sm">
                              <span className="font-semibold tabular-nums">
                                {formatCurrency(Number(row.amount), row.currency)}
                              </span>{' '}
                              · {row.jamiya_name ?? 'Circle'}
                              {row.cycle_number != null ? `, cycle ${row.cycle_number}` : ''}
                            </p>
                            <p className="text-muted-foreground text-[11px]">
                              Owed since {formatDate(row.created_at)}
                              {row.collected_at
                                ? ` · collected ${formatDate(row.collected_at)}`
                                : ''}
                              {row.waived_at ? ` · waived ${formatDate(row.waived_at)}` : ''}
                            </p>
                            {row.waive_reason ? (
                              <p className="text-foreground mt-1 text-xs">
                                Reason: {row.waive_reason}
                              </p>
                            ) : null}
                          </div>
                          <StatusBadge status={row.status} />
                        </div>
                        {row.status === 'owed' ? (
                          <form action={waiveFeeOwedAction} className="flex items-center gap-2">
                            <input type="hidden" name="feeId" value={row.id} />
                            <label className="min-w-0 flex-1">
                              <span className="sr-only">Reason to waive this fee</span>
                              <input
                                name="reason"
                                required
                                minLength={3}
                                maxLength={500}
                                className="border-border bg-background w-full rounded-lg border px-3 py-2 text-sm"
                                placeholder="Reason to waive"
                              />
                            </label>
                            <ConfirmSubmitButton
                              variant="outline"
                              className="min-h-10"
                              message="Waive this fee? It will not be collected, and the member is notified with your reason."
                            >
                              Waive
                            </ConfirmSubmitButton>
                          </form>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
