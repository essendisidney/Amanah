import type { Metadata } from 'next';
import Link from 'next/link';
import type { Route } from 'next';
import { formatCurrency, formatDate } from '@jamiya/shared';
import { Button } from '@jamiya/ui';
import { createClient } from '@/lib/supabase/server';
import { requireAdminAccess } from '@/features/admin/lib/require-admin';
import { StatusBadge } from '@/features/dashboard/components/dashboard-stats';
import { runReconcileNowAction } from '@/features/admin/actions/reconcile-actions';

export const metadata: Metadata = { title: 'Admin · Reconcile' };
export const dynamic = 'force-dynamic';

type Props = {
  searchParams?: Promise<{
    status?: string;
    provider?: string;
  }>;
};

type IntentRow = {
  id: string;
  status: string;
  settlement_status: string;
  reconcile_status: string;
  amount: number | string;
  currency: string;
  provider: string;
  provider_reference: string | null;
  created_at: string;
  completed_at: string | null;
  metadata: Record<string, unknown> | null;
};

export default async function AdminFinanceReconcilePage({ searchParams }: Props) {
  await requireAdminAccess('admin');
  const qs = (await searchParams) ?? {};
  const statusFilter = (qs.status ?? 'exception').toLowerCase();
  const providerFilter = (qs.provider ?? '').trim().toLowerCase();

  const supabase = await createClient();

  let query = supabase
    .from('payment_intents')
    .select(
      'id, status, settlement_status, reconcile_status, amount, currency, provider, provider_reference, created_at, completed_at, metadata',
    )
    .order('created_at', { ascending: false })
    .limit(80);

  if (statusFilter === 'exception') {
    query = query.eq('reconcile_status', 'exception');
  } else if (statusFilter === 'open') {
    query = query.eq('status', 'completed').eq('reconcile_status', 'open');
  } else if (statusFilter === 'matched') {
    query = query.eq('reconcile_status', 'matched');
  } else if (statusFilter === 'pending') {
    query = query.in('status', ['pending', 'processing']);
  }

  if (providerFilter) {
    query = query.eq('provider', providerFilter);
  }

  const [{ data: intents }, { data: runs }] = await Promise.all([
    query,
    supabase
      .from('reconcile_runs')
      .select('id, status, started_at, finished_at, summary, error_message')
      .order('started_at', { ascending: false })
      .limit(8),
  ]);

  const rows = (intents ?? []) as unknown as IntentRow[];
  const runRows = (runs ?? []) as Array<{
    id: string;
    status: string;
    started_at: string;
    finished_at: string | null;
    summary: Record<string, unknown> | null;
    error_message: string | null;
  }>;

  const filters: Array<{ key: string; label: string }> = [
    { key: 'exception', label: 'Exceptions' },
    { key: 'open', label: 'Open completed' },
    { key: 'pending', label: 'In flight' },
    { key: 'matched', label: 'Matched' },
    { key: 'all', label: 'All recent' },
  ];

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            <Link href={'/admin/finance' as Route} className="hover:underline">
              Finance
            </Link>{' '}
            · Reconcile
          </p>
          <h2 className="mt-1 font-[family-name:var(--font-display)] text-2xl font-semibold">
            Reconciliation queue
          </h2>
          <p className="mt-1 max-w-xl text-sm text-muted-foreground">
            Investigate mismatches. Do not edit balances here. Mark matched only after PSP
            and journal agree.
          </p>
        </div>
        <form action={runReconcileNowAction}>
          <Button type="submit" className="min-h-11">
            Run reconcile now
          </Button>
        </form>
      </div>

      <div className="flex flex-wrap gap-2">
        {filters.map((f) => {
          const active = statusFilter === f.key || (f.key === 'all' && statusFilter === 'all');
          const href =
            f.key === 'all'
              ? ('/admin/finance/reconcile?status=all' as Route)
              : (`/admin/finance/reconcile?status=${f.key}` as Route);
          return (
            <Link
              key={f.key}
              href={href}
              className={
                active
                  ? 'inline-flex min-h-10 items-center rounded-xl bg-primary px-3 text-sm font-semibold text-primary-foreground'
                  : 'inline-flex min-h-10 items-center rounded-xl border border-border bg-card px-3 text-sm font-medium text-muted-foreground hover:bg-muted'
              }
            >
              {f.label}
            </Link>
          );
        })}
      </div>

      <section className="space-y-3">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Queue ({rows.length})
        </h3>
        {rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nothing in this filter.</p>
        ) : (
          <ul className="divide-y divide-border rounded-xl border border-border bg-card">
            {rows.map((row) => {
              const amount =
                typeof row.amount === 'number' ? row.amount : Number(row.amount);
              const kind =
                typeof row.metadata?.kind === 'string'
                  ? row.metadata.kind
                  : 'wallet_top_up';
              return (
                <li
                  key={row.id}
                  className="flex flex-wrap items-center justify-between gap-3 px-5 py-4"
                >
                  <div>
                    <p className="font-medium">
                      {kind.replaceAll('_', ' ')} · {row.provider}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {formatDate(row.created_at)} · intent {row.id.slice(0, 8)}…
                      {row.provider_reference
                        ? ` · ${row.provider_reference.slice(0, 16)}`
                        : ''}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      expected {formatCurrency(amount, row.currency)} · provider{' '}
                      {row.status} · settle {row.settlement_status} · reconcile{' '}
                      {row.reconcile_status}
                    </p>
                  </div>
                  <StatusBadge status={row.reconcile_status || row.status} />
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="space-y-3">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Recent reconcile runs
        </h3>
        {runRows.length === 0 ? (
          <p className="text-sm text-muted-foreground">No reconcile runs yet.</p>
        ) : (
          <ul className="divide-y divide-border rounded-xl border border-border bg-card">
            {runRows.map((run) => (
              <li key={run.id} className="px-5 py-4 text-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-medium capitalize">{run.status}</p>
                  <p className="text-muted-foreground">{formatDate(run.started_at)}</p>
                </div>
                {run.error_message ? (
                  <p className="mt-1 text-destructive">{run.error_message}</p>
                ) : null}
                {run.summary ? (
                  <p className="mt-1 font-mono text-xs text-muted-foreground">
                    {JSON.stringify(run.summary)}
                  </p>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
