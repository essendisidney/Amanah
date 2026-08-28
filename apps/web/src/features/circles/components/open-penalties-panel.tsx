import { formatCurrency, formatDate } from '@jamiya/shared';
import { Button } from '@jamiya/ui';
import { StatusBadge } from '@/features/dashboard/components/dashboard-stats';
import { resolveMemberPenaltyAction } from '../actions/treasury-actions';

export type OpenPenaltyRow = {
  id: string;
  memberLabel: string;
  kind: string;
  amount: number;
  currency: string;
  notes: string | null;
  assessedAt: string | null;
};

function kindLabel(kind: string) {
  return kind.replaceAll('_', ' ');
}

/** Officer list: mark open fines paid or waive them. */
export function OpenPenaltiesPanel({
  slug,
  rows,
  returnPath = '/treasury',
}: {
  slug: string;
  rows: OpenPenaltyRow[];
  returnPath?: string;
}) {
  if (rows.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No open fines. Levy a fine below, or assess late contribution penalties from Officer settings.
      </p>
    );
  }

  return (
    <ul className="divide-y divide-border rounded-xl border border-border bg-card">
      {rows.map((row) => (
        <li
          key={row.id}
          className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between"
        >
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <p className="font-medium text-foreground">{row.memberLabel}</p>
              <StatusBadge status="open" />
              <span className="text-xs capitalize text-muted-foreground">
                {kindLabel(row.kind)}
              </span>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              {formatCurrency(row.amount, row.currency)}
              {row.assessedAt ? ` · Assessed ${formatDate(row.assessedAt)}` : ''}
              {row.notes ? ` · ${row.notes}` : ''}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <form action={resolveMemberPenaltyAction}>
              <input type="hidden" name="penaltyId" value={row.id} />
              <input type="hidden" name="slug" value={slug} />
              <input type="hidden" name="action" value="paid" />
              <input type="hidden" name="returnPath" value={returnPath} />
              <Button type="submit" size="sm" className="min-h-10">
                Mark paid
              </Button>
            </form>
            <form action={resolveMemberPenaltyAction}>
              <input type="hidden" name="penaltyId" value={row.id} />
              <input type="hidden" name="slug" value={slug} />
              <input type="hidden" name="action" value="waived" />
              <input type="hidden" name="returnPath" value={returnPath} />
              <Button type="submit" size="sm" variant="outline" className="min-h-10">
                Waive
              </Button>
            </form>
          </div>
        </li>
      ))}
    </ul>
  );
}
