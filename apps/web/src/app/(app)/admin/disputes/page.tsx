import type { Metadata } from 'next';
import Link from 'next/link';
import type { Route } from 'next';
import { formatDate } from '@jamiya/shared';
import { Button } from '@jamiya/ui';
import { createClient } from '@/lib/supabase/server';
import { requireAdminAccess } from '@/features/admin/lib/require-admin';
import { resolveDisputeAction } from '@/features/circles/actions/dispute-actions';
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

  const rows = ((data ?? []) as unknown as DisputeRow[]).slice().sort((a, b) => {
    const aOpen = a.status === 'open' || a.status === 'under_review' ? 0 : 1;
    const bOpen = b.status === 'open' || b.status === 'under_review' ? 0 : 1;
    return aOpen - bOpen;
  });
  const waiting = rows.filter((r) => r.status === 'open' || r.status === 'under_review').length;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="font-[family-name:var(--font-display)] text-2xl font-semibold">
            Disputes
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {waiting === 0 ? 'No open disputes.' : `${waiting} need a decision.`}
          </p>
        </div>
        <Button asChild variant="outline" className="min-h-11">
          <Link href={'/admin' as Route}>Back to Inbox</Link>
        </Button>
      </div>
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
                <div className="flex w-full flex-col gap-2 sm:flex-row sm:flex-wrap">
                  <form action={resolveDisputeAction} className="w-full sm:w-auto">
                    <input type="hidden" name="disputeId" value={row.id} />
                    <input type="hidden" name="status" value="under_review" />
                    <Button type="submit" variant="outline" className="min-h-11 w-full sm:w-auto">
                      Mark reviewing
                    </Button>
                  </form>
                  <form
                    action={resolveDisputeAction}
                    className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center"
                  >
                    <input type="hidden" name="disputeId" value={row.id} />
                    <input type="hidden" name="status" value="resolved" />
                    <input
                      name="notes"
                      placeholder="Resolution notes"
                      className="min-h-11 w-full rounded-md border border-border bg-background px-3 text-sm sm:min-w-[12rem]"
                    />
                    <Button type="submit" className="min-h-11 w-full sm:w-auto">
                      Resolve
                    </Button>
                  </form>
                  <form action={resolveDisputeAction} className="w-full sm:w-auto">
                    <input type="hidden" name="disputeId" value={row.id} />
                    <input type="hidden" name="status" value="rejected" />
                    <input type="hidden" name="notes" value="Rejected by compliance" />
                    <Button type="submit" variant="destructive" className="min-h-11 w-full sm:w-auto">
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
