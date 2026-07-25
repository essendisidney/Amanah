import type { Metadata } from 'next';
import { formatCurrency, formatDate } from '@jamiya/shared';
import { Button } from '@jamiya/ui';
import { createClient } from '@/lib/supabase/server';
import { requireAdminAccess } from '@/features/admin/lib/require-admin';
import { processWithdrawalAction } from '@/features/wallet/actions/withdrawal-actions';
import { StatusBadge } from '@/features/dashboard/components/dashboard-stats';

export const metadata: Metadata = { title: 'Admin · Withdrawals' };
export const dynamic = 'force-dynamic';

type Row = {
  id: string;
  user_id: string;
  amount: number | string;
  currency: string;
  status: string;
  destination_type: string;
  destination_phone: string | null;
  bank_name: string | null;
  bank_account_number: string | null;
  created_at: string;
};

export default async function AdminWithdrawalsPage() {
  await requireAdminAccess('compliance');
  const supabase = await createClient();
  const { data } = await supabase
    .from('withdrawal_requests')
    .select(
      'id, user_id, amount, currency, status, destination_type, destination_phone, bank_name, bank_account_number, created_at',
    )
    .order('created_at', { ascending: false })
    .limit(100);

  const rows = (data ?? []) as unknown as Row[];

  return (
    <div className="space-y-4">
      <h2 className="font-[family-name:var(--font-display)] text-2xl font-semibold">
        Withdrawals
      </h2>
      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">No withdrawal requests yet.</p>
      ) : (
        <ul className="divide-y divide-border rounded-xl border border-border bg-card">
          {rows.map((row) => {
            const amount = typeof row.amount === 'number' ? row.amount : Number(row.amount);
            return (
              <li key={row.id} className="space-y-3 px-5 py-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-medium">
                        {formatCurrency(amount, row.currency)} · {row.destination_type}
                      </p>
                      <StatusBadge status={row.status} />
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {formatDate(row.created_at)} · user {row.user_id.slice(0, 8)}…
                      {row.destination_phone ? ` · ${row.destination_phone}` : ''}
                      {row.bank_name
                        ? ` · ${row.bank_name} ${row.bank_account_number ?? ''}`
                        : ''}
                    </p>
                  </div>
                </div>
                {row.status === 'pending' || row.status === 'processing' ? (
                  <div className="flex flex-wrap gap-2">
                    <form action={processWithdrawalAction}>
                      <input type="hidden" name="withdrawalId" value={row.id} />
                      <input type="hidden" name="approve" value="true" />
                      <Button type="submit" size="sm">
                        Approve &amp; debit
                      </Button>
                    </form>
                    <form action={processWithdrawalAction}>
                      <input type="hidden" name="withdrawalId" value={row.id} />
                      <input type="hidden" name="approve" value="false" />
                      <Button type="submit" size="sm" variant="destructive">
                        Reject
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
