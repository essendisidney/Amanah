import type { Metadata } from 'next';
import { formatCurrency, formatDate } from '@jamiya/shared';
import { Button } from '@jamiya/ui';
import { createClient } from '@/lib/supabase/server';
import { requireAdminAccess } from '@/features/admin/lib/require-admin';
import {
  syncCollectionsAction,
  updateCollectionCaseAction,
} from '@/features/admin/actions/collection-actions';
import { runPlaybookAction } from '@/features/admin/actions/playbook-actions';
import { StatusBadge } from '@/features/dashboard/components/dashboard-stats';

export const metadata: Metadata = { title: 'Admin · Collections' };
export const dynamic = 'force-dynamic';

type CaseRow = {
  id: string;
  status: string;
  severity: string;
  amount_due: number | string;
  currency: string;
  days_overdue: number;
  contact_attempts: number;
  user_id: string;
  jamiya_id: string;
  created_at: string;
};

export default async function AdminCollectionsPage() {
  await requireAdminAccess('compliance');
  const supabase = await createClient();
  const { data } = await supabase
    .from('collection_cases')
    .select(
      'id, status, severity, amount_due, currency, days_overdue, contact_attempts, user_id, jamiya_id, created_at',
    )
    .order('days_overdue', { ascending: false })
    .limit(100);

  const rows = (data ?? []) as unknown as CaseRow[];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-[family-name:var(--font-display)] text-2xl font-semibold">
          Collections
        </h2>
        <form action={syncCollectionsAction}>
          <Button type="submit" variant="outline" size="sm">
            Sync overdue cases
          </Button>
        </form>
      </div>
      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No collection cases. Sync after contributions become late.
        </p>
      ) : (
        <ul className="divide-y divide-border rounded-xl border border-border bg-card">
          {rows.map((row) => {
            const amount =
              typeof row.amount_due === 'number'
                ? row.amount_due
                : Number(row.amount_due);
            return (
              <li key={row.id} className="space-y-3 px-5 py-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-medium">
                        {formatCurrency(amount, row.currency)} · {row.days_overdue}d
                        overdue
                      </p>
                      <StatusBadge status={row.status} />
                      <StatusBadge status={row.severity} />
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {formatDate(row.created_at)} · user {row.user_id.slice(0, 8)}…
                      · contacts {row.contact_attempts}
                    </p>
                  </div>
                </div>
                {['open', 'contacted', 'promised', 'partially_paid'].includes(
                  row.status,
                ) ? (
                  <div className="flex flex-wrap gap-2">
                    <form action={runPlaybookAction}>
                      <input type="hidden" name="caseId" value={row.id} />
                      <Button type="submit" size="sm">
                        Run playbook step
                      </Button>
                    </form>
                    <form action={updateCollectionCaseAction}>
                      <input type="hidden" name="caseId" value={row.id} />
                      <input type="hidden" name="status" value="contacted" />
                      <Button type="submit" size="sm" variant="outline">
                        Mark contacted
                      </Button>
                    </form>
                    <form action={updateCollectionCaseAction}>
                      <input type="hidden" name="caseId" value={row.id} />
                      <input type="hidden" name="status" value="resolved" />
                      <Button type="submit" size="sm" variant="outline">
                        Resolve
                      </Button>
                    </form>
                    <form action={updateCollectionCaseAction}>
                      <input type="hidden" name="caseId" value={row.id} />
                      <input type="hidden" name="status" value="written_off" />
                      <Button type="submit" size="sm" variant="destructive">
                        Write off
                      </Button>
                    </form>
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
