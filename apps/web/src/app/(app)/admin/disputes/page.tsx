import type { Metadata } from 'next';
import { formatDate } from '@jamiya/shared';
import { Button } from '@jamiya/ui';
import { createClient } from '@/lib/supabase/server';
import { requireAdminAccess } from '@/features/admin/lib/require-admin';
import { resolveDisputeAction } from '@/features/jamiya/actions/dispute-actions';
import { StatusBadge } from '@/features/dashboard/components/dashboard-stats';

export const metadata: Metadata = { title: 'Admin · Disputes' };
export const dynamic = 'force-dynamic';

type DisputeRow = {
  id: string;
  title: string;
  description: string;
  type: string;
  status: string;
  risk_score: number;
  jamiya_id: string;
  opened_by: string;
  created_at: string;
};

export default async function AdminDisputesPage() {
  await requireAdminAccess('compliance');
  const supabase = await createClient();
  const { data } = await supabase
    .from('disputes')
    .select(
      'id, title, description, type, status, risk_score, jamiya_id, opened_by, created_at',
    )
    .order('created_at', { ascending: false })
    .limit(100);

  const rows = (data ?? []) as unknown as DisputeRow[];

  return (
    <div className="space-y-4">
      <h2 className="font-[family-name:var(--font-display)] text-2xl font-semibold">
        Disputes
      </h2>
      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">No disputes yet.</p>
      ) : (
        <ul className="divide-y divide-border rounded-xl border border-border bg-card">
          {rows.map((row) => (
            <li key={row.id} className="space-y-3 px-5 py-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium">{row.title}</p>
                    <StatusBadge status={row.status} />
                    <span className="text-xs text-muted-foreground">
                      risk {row.risk_score}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {row.type.replaceAll('_', ' ')} · {formatDate(row.created_at)}
                  </p>
                  <p className="mt-2 text-sm">{row.description}</p>
                </div>
              </div>
              {row.status === 'open' || row.status === 'under_review' ? (
                <div className="flex flex-wrap gap-2">
                  <form action={resolveDisputeAction}>
                    <input type="hidden" name="disputeId" value={row.id} />
                    <input type="hidden" name="status" value="under_review" />
                    <Button type="submit" size="sm" variant="outline">
                      Mark reviewing
                    </Button>
                  </form>
                  <form action={resolveDisputeAction} className="flex gap-2">
                    <input type="hidden" name="disputeId" value={row.id} />
                    <input type="hidden" name="status" value="resolved" />
                    <input
                      name="notes"
                      placeholder="Resolution notes"
                      className="h-9 rounded-md border border-border bg-background px-3 text-sm"
                    />
                    <Button type="submit" size="sm">
                      Resolve
                    </Button>
                  </form>
                  <form action={resolveDisputeAction}>
                    <input type="hidden" name="disputeId" value={row.id} />
                    <input type="hidden" name="status" value="rejected" />
                    <input type="hidden" name="notes" value="Rejected by compliance" />
                    <Button type="submit" size="sm" variant="destructive">
                      Reject
                    </Button>
                  </form>
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
