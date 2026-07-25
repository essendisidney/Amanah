import type { Metadata } from 'next';
import { formatCurrency, formatDate } from '@jamiya/shared';
import { createClient } from '@/lib/supabase/server';
import { requireAdminAccess } from '@/features/admin/lib/require-admin';
import { ExportTransactionsButton } from '@/features/admin/components/export-buttons';
import { StatusBadge } from '@/features/dashboard/components/dashboard-stats';

export const metadata: Metadata = { title: 'Admin · Transactions' };
export const dynamic = 'force-dynamic';

type TxRow = {
  id: string;
  type: string;
  status: string;
  amount: number | string;
  currency: string;
  direction: string;
  created_at: string;
  user_id: string;
};

export default async function AdminTransactionsPage() {
  await requireAdminAccess('admin');
  const supabase = await createClient();
  const { data } = await supabase
    .from('transactions')
    .select('id, type, status, amount, currency, direction, created_at, user_id')
    .order('created_at', { ascending: false })
    .limit(100);

  const rows = (data ?? []) as unknown as TxRow[];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-[family-name:var(--font-display)] text-2xl font-semibold">
          Transaction monitoring
        </h2>
        <ExportTransactionsButton />
      </div>
      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No ledger transactions yet. Top-ups, contributions, and payouts will appear here.
        </p>
      ) : (
        <ul className="divide-y divide-border rounded-xl border border-border bg-card">
          {rows.map((tx) => {
            const amount = typeof tx.amount === 'number' ? tx.amount : Number(tx.amount);
            return (
              <li key={tx.id} className="flex items-center justify-between gap-4 px-5 py-4">
                <div>
                  <p className="font-medium capitalize">
                    {tx.type.replaceAll('_', ' ')} · {tx.direction}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {formatDate(tx.created_at)} · user {tx.user_id.slice(0, 8)}…
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-semibold">{formatCurrency(amount, tx.currency)}</p>
                  <StatusBadge status={tx.status} />
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
