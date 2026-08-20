import type { Metadata } from 'next';
import { formatCurrency, formatDate } from '@jamiya/shared';
import { Button } from '@jamiya/ui';
import { createClient } from '@/lib/supabase/server';
import { requireAdminAccess } from '@/features/admin/lib/require-admin';
import {
  confirmDualApprovalAction,
  processPayoutCashoutAction,
  processWithdrawalAction,
} from '@/features/wallet/actions/withdrawal-actions';
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
  metadata: Record<string, unknown> | null;
};

export default async function AdminWithdrawalsPage() {
  await requireAdminAccess('compliance');
  const supabase = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any;
  const [{ data }, { data: dualData }] = await Promise.all([
    supabase
      .from('withdrawal_requests')
      .select(
        'id, user_id, amount, currency, status, destination_type, destination_phone, bank_name, bank_account_number, created_at, metadata',
      )
      .order('created_at', { ascending: false })
      .limit(100),
    db
      .from('dual_approval_requests')
      .select('id, kind, entity_id, amount, currency, status, first_approver_id, created_at')
      .eq('kind', 'withdrawal')
      .eq('status', 'pending')
      .order('created_at', { ascending: false })
      .limit(40),
  ]);

  const rows = (data ?? []) as unknown as Row[];
  const dualRows = (dualData ?? []) as unknown as Array<{
    id: string;
    entity_id: string;
    amount: number | string;
    currency: string;
    first_approver_id: string;
    created_at: string;
  }>;

  return (
    <div className="space-y-4">
      <div>
        <h2 className="font-[family-name:var(--font-display)] text-2xl font-semibold">
          Withdrawals
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Amounts at/above the platform dual-approval threshold need a second compliance
          approver. You cannot second-approve your own first approval. Payout cashouts
          auto-simulate until live Daraja B2C.
        </p>
      </div>

      {dualRows.length > 0 ? (
        <section className="space-y-3">
          <h3 className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
            Awaiting second approval
          </h3>
          <ul className="divide-y divide-border rounded-xl border border-border bg-card">
            {dualRows.map((row) => (
              <li
                key={row.id}
                className="flex flex-wrap items-center justify-between gap-3 px-5 py-4"
              >
                <div>
                  <p className="font-medium">
                    {formatCurrency(Number(row.amount), row.currency)} · withdrawal
                  </p>
                  <p className="text-sm text-muted-foreground">
                    First approver {row.first_approver_id.slice(0, 8)}… ·{' '}
                    {formatDate(row.created_at)}
                  </p>
                </div>
                <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
                  <form action={confirmDualApprovalAction} className="w-full sm:w-auto">
                    <input type="hidden" name="requestId" value={row.id} />
                    <input type="hidden" name="approve" value="true" />
                    <Button type="submit" className="min-h-11 w-full sm:w-auto">
                      Second approve
                    </Button>
                  </form>
                  <form action={confirmDualApprovalAction} className="w-full sm:w-auto">
                    <input type="hidden" name="requestId" value={row.id} />
                    <input type="hidden" name="approve" value="false" />
                    <Button type="submit" variant="destructive" className="min-h-11 w-full sm:w-auto">
                      Reject
                    </Button>
                  </form>
                </div>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">No withdrawal requests yet.</p>
      ) : (
        <ul className="divide-y divide-border rounded-xl border border-border bg-card">
          {rows.map((row) => {
            const amount = typeof row.amount === 'number' ? row.amount : Number(row.amount);
            const kind = typeof row.metadata?.kind === 'string' ? row.metadata.kind : null;
            const isPayoutCashout = kind === 'payout_cashout';
            return (
              <li key={row.id} className="space-y-3 px-5 py-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-medium">
                        {formatCurrency(amount, row.currency)} · {row.destination_type}
                      </p>
                      <StatusBadge status={row.status} />
                      {isPayoutCashout ? <StatusBadge status="payout_cashout" /> : null}
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
                  <div className="flex w-full flex-col gap-2 sm:flex-row sm:flex-wrap">
                    {isPayoutCashout ? (
                      <form action={processPayoutCashoutAction} className="w-full sm:w-auto">
                        <input type="hidden" name="withdrawalId" value={row.id} />
                        <Button type="submit" className="min-h-11 w-full sm:w-auto">
                          Sim B2C cashout
                        </Button>
                      </form>
                    ) : null}
                    <form action={processWithdrawalAction} className="w-full sm:w-auto">
                      <input type="hidden" name="withdrawalId" value={row.id} />
                      <input type="hidden" name="approve" value="true" />
                      <Button
                        type="submit"
                        variant={isPayoutCashout ? 'outline' : 'default'}
                        className="min-h-11 w-full sm:w-auto"
                      >
                        Approve &amp; debit
                      </Button>
                    </form>
                    <form action={processWithdrawalAction} className="w-full sm:w-auto">
                      <input type="hidden" name="withdrawalId" value={row.id} />
                      <input type="hidden" name="approve" value="false" />
                      <Button type="submit" variant="destructive" className="min-h-11 w-full sm:w-auto">
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
