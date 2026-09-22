import type { Metadata } from 'next';
import Link from 'next/link';
import type { Route } from 'next';
import { formatCurrency, formatDate } from '@jamiya/shared';
import { Button } from '@jamiya/ui';
import { createClient } from '@/lib/supabase/server';
import { requireAdminAccess } from '@/features/admin/lib/require-admin';
import { requestRefundAction, completeRefundAction, cancelRefundAction } from '@/features/admin/actions/refund-actions';
import { StatusBadge } from '@/features/dashboard/components/dashboard-stats';

export const metadata: Metadata = { title: 'Admin · Refunds' };
export const dynamic = 'force-dynamic';

type RefundRow = {
  id: string;
  payment_intent_id: string | null;
  amount: number | string;
  currency: string;
  reason: string | null;
  status: string;
  created_at: string;
  completed_at: string | null;
};

export default async function AdminRefundsPage() {
  await requireAdminAccess('admin');
  const supabase = await createClient();

  const { data: refunds } = await supabase
    .from('refunds')
    .select(
      'id, payment_intent_id, amount, currency, reason, status, created_at, completed_at',
    )
    .order('created_at', { ascending: false })
    .limit(40);

  const rows = (refunds ?? []) as unknown as RefundRow[];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="font-[family-name:var(--font-display)] text-2xl font-semibold">
            Refunds
          </h2>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Queue a refund against a completed intent. Completion posts a reversing
            journal and reverses domain sidecars (contribution, sadaka, sponsorship).
            Unsupported payment kinds fail closed. Large refunds may require dual approval.
          </p>
        </div>
        <Button asChild variant="outline" className="min-h-11">
          <Link href={'/admin/finance' as Route}>Finance centre</Link>
        </Button>
      </div>

      <form
        action={requestRefundAction}
        className="grid gap-3 rounded-xl border border-border bg-card p-4 sm:grid-cols-2 lg:grid-cols-4"
      >
        <label className="block text-sm sm:col-span-2">
          <span className="font-medium">Payment intent ID</span>
          <input
            name="intentId"
            required
            className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 font-mono text-sm"
            placeholder="uuid"
          />
        </label>
        <label className="block text-sm">
          <span className="font-medium">Amount (KES)</span>
          <input
            name="amount"
            type="number"
            min="1"
            step="0.01"
            required
            className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
          />
        </label>
        <label className="block text-sm">
          <span className="font-medium">Reason</span>
          <input
            name="reason"
            className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
            placeholder="Optional"
          />
        </label>
        <div className="sm:col-span-2 lg:col-span-4">
          <Button type="submit" className="min-h-11">
            Queue refund
          </Button>
        </div>
      </form>

      <div className="overflow-hidden rounded-xl border border-border bg-card">
        <div className="border-b border-border px-4 py-3 text-sm font-semibold">
          Recent refund requests
        </div>
        {rows.length === 0 ? (
          <p className="px-4 py-8 text-sm text-muted-foreground">No refunds yet.</p>
        ) : (
          <ul className="divide-y divide-border">
            {rows.map((row) => (
              <li
                key={row.id}
                className="flex flex-wrap items-center justify-between gap-3 px-4 py-3"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold tabular-nums">
                    {formatCurrency(Number(row.amount), row.currency)}
                  </p>
                  <p className="mt-0.5 font-mono text-[11px] text-muted-foreground">
                    {row.payment_intent_id ? (
                      <Link
                        href={`/admin/finance/intents/${row.payment_intent_id}` as Route}
                        className="text-primary hover:underline"
                      >
                        {row.payment_intent_id}
                      </Link>
                    ) : (
                      '—'
                    )}{' '}
                    · {row.reason ?? 'no reason'}
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    {formatDate(row.created_at)}
                    {row.completed_at ? ` · done ${formatDate(row.completed_at)}` : ''}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <StatusBadge status={row.status} />
                  {row.status === 'pending' || row.status === 'processing' || row.status === 'failed' ? (
                    <>
                      {(row.status === 'pending' || row.status === 'processing') && (
                        <form action={completeRefundAction}>
                          <input type="hidden" name="refundId" value={row.id} />
                          <Button type="submit" size="sm" className="min-h-10">
                            Complete
                          </Button>
                        </form>
                      )}
                      <form action={cancelRefundAction}>
                        <input type="hidden" name="refundId" value={row.id} />
                        <Button type="submit" size="sm" variant="outline" className="min-h-10">
                          Cancel
                        </Button>
                      </form>
                    </>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
