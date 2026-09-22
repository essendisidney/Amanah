import type { Metadata } from 'next';
import Link from 'next/link';
import type { Route } from 'next';
import { formatCurrency, formatDate } from '@jamiya/shared';
import { Button } from '@jamiya/ui';
import { createClient } from '@/lib/supabase/server';
import { requireAdminAccess } from '@/features/admin/lib/require-admin';
import { confirmFinanceDualApprovalAction } from '@/features/admin/actions/finance-approval-actions';
import { StatusBadge } from '@/features/dashboard/components/dashboard-stats';

export const metadata: Metadata = { title: 'Admin · Finance approvals' };
export const dynamic = 'force-dynamic';

type DualRow = {
  id: string;
  kind: string;
  entity_id: string;
  amount: number | string;
  currency: string;
  status: string;
  requested_by: string;
  first_approver_id: string | null;
  payload: Record<string, unknown> | null;
  created_at: string;
};

export default async function AdminFinanceApprovalsPage() {
  const { userId } = await requireAdminAccess('compliance');
  const supabase = await createClient();

  const { data } = await supabase
    .from('dual_approval_requests')
    .select(
      'id, kind, entity_id, amount, currency, status, requested_by, first_approver_id, payload, created_at',
    )
    .in('kind', ['refund', 'withdrawal'])
    .eq('status', 'pending')
    .order('created_at', { ascending: true })
    .limit(40);

  const rows = (data ?? []) as unknown as DualRow[];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="font-[family-name:var(--font-display)] text-2xl font-semibold">
            Finance approvals
          </h2>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Maker–checker queue. Large refunds (≥ platform threshold, default KES 10,000)
            need a second admin before they execute.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline" className="min-h-11">
            <Link href={'/admin/finance/refunds' as Route}>Refunds</Link>
          </Button>
          <Button asChild variant="outline" className="min-h-11">
            <Link href={'/admin/withdrawals' as Route}>Money out</Link>
          </Button>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-border bg-card">
        <div className="border-b border-border px-4 py-3 text-sm font-semibold">
          Pending dual approvals
        </div>
        {rows.length === 0 ? (
          <p className="px-4 py-8 text-sm text-muted-foreground">Nothing waiting.</p>
        ) : (
          <ul className="divide-y divide-border">
            {rows.map((row) => {
              const isFirstApprover =
                row.first_approver_id === userId || row.requested_by === userId;
              return (
                <li
                  key={row.id}
                  className="flex flex-wrap items-center justify-between gap-3 px-4 py-3"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold capitalize">
                      {row.kind.replaceAll('_', ' ')} ·{' '}
                      {formatCurrency(Number(row.amount), row.currency)}
                    </p>
                    <p className="mt-0.5 font-mono text-[11px] text-muted-foreground">
                      {row.entity_id}
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      {formatDate(row.created_at)}
                      {row.payload?.reason
                        ? ` · ${String(row.payload.reason)}`
                        : ''}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <StatusBadge status={row.status} />
                    {isFirstApprover ? (
                      <p className="text-xs text-muted-foreground">
                        Waiting for a different admin
                      </p>
                    ) : (
                      <>
                        <form action={confirmFinanceDualApprovalAction}>
                          <input type="hidden" name="requestId" value={row.id} />
                          <input type="hidden" name="approve" value="true" />
                          <Button type="submit" size="sm" className="min-h-10">
                            Approve
                          </Button>
                        </form>
                        <form action={confirmFinanceDualApprovalAction}>
                          <input type="hidden" name="requestId" value={row.id} />
                          <input type="hidden" name="approve" value="false" />
                          <Button
                            type="submit"
                            size="sm"
                            variant="outline"
                            className="min-h-10"
                          >
                            Reject
                          </Button>
                        </form>
                      </>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
