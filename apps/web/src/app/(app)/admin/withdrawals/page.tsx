import type { Metadata } from 'next';
import Link from 'next/link';
import type { Route } from 'next';
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

export const metadata: Metadata = { title: 'Admin · Money out' };
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

function ageLabel(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const mins = Math.max(0, Math.floor(ms / 60000));
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 48) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export default async function AdminWithdrawalsPage() {
  await requireAdminAccess('compliance', '/admin/withdrawals');
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
      .select(
        'id, kind, entity_id, amount, currency, status, first_approver_id, created_at, payload',
      )
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
    payload: Record<string, unknown> | null;
  }>;

  const profileIds = Array.from(
    new Set([
      ...rows.map((r) => r.user_id),
      ...dualRows.map((r) => r.first_approver_id),
      ...dualRows
        .map((r) => (typeof r.payload?.user_id === 'string' ? r.payload.user_id : null))
        .filter(Boolean),
    ]),
  ) as string[];

  const { data: profiles } =
    profileIds.length > 0
      ? await supabase.from('profiles').select('id, full_name').in('id', profileIds)
      : { data: [] };
  const nameById = new Map(
    ((profiles ?? []) as Array<{ id: string; full_name: string | null }>).map((p) => [
      p.id,
      p.full_name?.trim() || p.id.slice(0, 8),
    ]),
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="font-[family-name:var(--font-display)] text-2xl font-semibold">
            Money out
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Maker–checker: amounts at/above the dual-approval threshold need a second compliance
            approver. Destination is locked from the member&apos;s verified M-Pesa. You cannot
            second-approve your own first approval.
          </p>
        </div>
        <Button asChild variant="outline" className="min-h-11">
          <Link href={'/admin' as Route}>Back to Inbox</Link>
        </Button>
      </div>

      {dualRows.length > 0 ? (
        <section className="space-y-3">
          <h3 className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
            Awaiting second approval
          </h3>
          <ul className="divide-y divide-border rounded-xl border border-border bg-card">
            {dualRows.map((row) => {
              const destPhone =
                typeof row.payload?.destination_phone === 'string'
                  ? row.payload.destination_phone
                  : null;
              const destType =
                typeof row.payload?.destination_type === 'string'
                  ? row.payload.destination_type
                  : 'mpesa';
              const memberId =
                typeof row.payload?.user_id === 'string' ? row.payload.user_id : null;
              return (
                <li
                  key={row.id}
                  className="flex flex-wrap items-center justify-between gap-3 px-5 py-4"
                >
                  <div>
                    <p className="font-medium">
                      {formatCurrency(Number(row.amount), row.currency)} · {destType}
                    </p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      To {destPhone ?? '—'} · member{' '}
                      {memberId ? nameById.get(memberId) ?? memberId.slice(0, 8) : '—'}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Maker {nameById.get(row.first_approver_id) ?? row.first_approver_id.slice(0, 8)}{' '}
                      · {ageLabel(row.created_at)} · {formatDate(row.created_at)}
                    </p>
                  </div>
                  <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
                    <form action={confirmDualApprovalAction} className="w-full sm:w-auto">
                      <input type="hidden" name="requestId" value={row.id} />
                      <input type="hidden" name="approve" value="true" />
                      <Button type="submit" className="min-h-11 w-full sm:w-auto">
                        Second approve &amp; send
                      </Button>
                    </form>
                    <form action={confirmDualApprovalAction} className="w-full sm:w-auto">
                      <input type="hidden" name="requestId" value={row.id} />
                      <input type="hidden" name="approve" value="false" />
                      <Button
                        type="submit"
                        variant="destructive"
                        className="min-h-11 w-full sm:w-auto"
                      >
                        Reject
                      </Button>
                    </form>
                  </div>
                </li>
              );
            })}
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
            const locked = row.metadata?.destination_locked === true;
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
                      {locked ? (
                        <span className="rounded-full bg-secondary px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                          Locked dest
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {formatDate(row.created_at)} · {ageLabel(row.created_at)} ·{' '}
                      {nameById.get(row.user_id) ?? row.user_id.slice(0, 8)}
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
                          Send B2C cashout
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
                        Approve &amp; send
                      </Button>
                    </form>
                    <form action={processWithdrawalAction} className="w-full sm:w-auto">
                      <input type="hidden" name="withdrawalId" value={row.id} />
                      <input type="hidden" name="approve" value="false" />
                      <Button
                        type="submit"
                        variant="destructive"
                        className="min-h-11 w-full sm:w-auto"
                      >
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
