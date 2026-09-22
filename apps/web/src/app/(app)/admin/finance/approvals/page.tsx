import type { Metadata } from 'next';
import Link from 'next/link';
import type { Route } from 'next';
import { formatCurrency, formatDate } from '@jamiya/shared';
import { Button } from '@jamiya/ui';
import { createClient } from '@/lib/supabase/server';
import { requireAdminAccess } from '@/features/admin/lib/require-admin';
import { isAdminRole } from '@jamiya/auth';
import { confirmFinanceDualApprovalAction } from '@/features/admin/actions/finance-approval-actions';
import { updateRefundDualApprovalAction } from '@/features/admin/actions/finance-settings-actions';
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
  const { userId, role } = await requireAdminAccess('compliance');
  const canEditPolicy = isAdminRole(role);
  const supabase = await createClient();

  const [{ data }, { data: settingRow }] = await Promise.all([
    supabase
      .from('dual_approval_requests')
      .select(
        'id, kind, entity_id, amount, currency, status, requested_by, first_approver_id, payload, created_at',
      )
      .in('kind', ['refund', 'withdrawal'])
      .eq('status', 'pending')
      .order('created_at', { ascending: true })
      .limit(40),
    supabase
      .from('platform_settings')
      .select('value')
      .eq('key', 'dual_approval_refunds')
      .maybeSingle(),
  ]);

  const rows = (data ?? []) as unknown as DualRow[];
  const setting = (settingRow?.value ?? { enabled: true, threshold: 10000 }) as {
    enabled?: boolean;
    threshold?: number;
  };
  const threshold = Number(setting.threshold ?? 10000);
  const enabled = setting.enabled !== false;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="font-[family-name:var(--font-display)] text-2xl font-semibold">
            Finance approvals
          </h2>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Maker–checker queue. Large refunds (≥ platform threshold) need a second admin
            before they execute.
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

      {canEditPolicy ? (
      <form
        action={updateRefundDualApprovalAction}
        className="grid gap-3 rounded-xl border border-border bg-card p-4 sm:grid-cols-3"
      >
        <div className="sm:col-span-3">
          <p className="text-sm font-semibold">Refund dual-approval policy</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Currently {enabled ? 'enabled' : 'disabled'} · threshold{' '}
            {formatCurrency(threshold, 'KES')}
          </p>
        </div>
        <label className="flex items-center gap-2 text-sm sm:col-span-1">
          <input
            type="checkbox"
            name="enabled"
            defaultChecked={enabled}
            className="h-4 w-4 rounded border-border"
          />
          Require second approval
        </label>
        <label className="block text-sm sm:col-span-1">
          <span className="font-medium">Threshold (KES)</span>
          <input
            name="threshold"
            type="number"
            min="0"
            step="1"
            defaultValue={threshold}
            className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
          />
        </label>
        <div className="flex items-end sm:col-span-1">
          <Button type="submit" className="min-h-11 w-full sm:w-auto">
            Save policy
          </Button>
        </div>
      </form>
      ) : (
        <p className="rounded-xl border border-dashed border-border px-4 py-3 text-sm text-muted-foreground">
          Refund dual-approval: {enabled ? 'on' : 'off'} · threshold{' '}
          {formatCurrency(threshold, 'KES')} (platform admin can edit)
        </p>
      )}

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
