import type { Metadata } from 'next';
import Link from 'next/link';
import type { Route } from 'next';
import { formatCurrency, formatDate } from '@jamiya/shared';
import { Button } from '@jamiya/ui';
import { createClient } from '@/lib/supabase/server';
import { requireAdminAccess } from '@/features/admin/lib/require-admin';
import { StatusBadge } from '@/features/dashboard/components/dashboard-stats';
import {
  backfillMissingSettlementsAction,
  backfillOneSettlementAction,
  markSettlementStatusAction,
} from '@/features/admin/actions/settlement-actions';
import { FINANCE_ACTION_LABELS } from '@/features/admin/lib/finance-labels';

export const metadata: Metadata = { title: 'Admin · Settlements' };
export const dynamic = 'force-dynamic';

type SettlementRow = {
  id: string;
  payment_intent_id: string | null;
  provider: string;
  provider_reference: string | null;
  amount: number | string;
  currency: string;
  status: string;
  settled_at: string | null;
  created_at: string;
};

type MissingIntent = {
  id: string;
  amount: number | string;
  currency: string;
  provider: string;
  provider_reference: string | null;
  completed_at: string | null;
};

type Props = {
  searchParams?: Promise<{ status?: string }>;
};

export default async function AdminSettlementsPage({ searchParams }: Props) {
  await requireAdminAccess('admin');
  const qs = (await searchParams) ?? {};
  const statusFilter = (qs.status ?? '').trim();

  const supabase = await createClient();

  let settlementsQuery = supabase
    .from('settlements')
    .select(
      'id, payment_intent_id, provider, provider_reference, amount, currency, status, settled_at, created_at',
    )
    .order('created_at', { ascending: false })
    .limit(60);

  if (statusFilter && ['pending', 'settled', 'failed', 'disputed'].includes(statusFilter)) {
    settlementsQuery = settlementsQuery.eq('status', statusFilter);
  }

  const [{ data: settlements }, { data: completed }, { data: linked }] = await Promise.all([
    settlementsQuery,
    supabase
      .from('payment_intents')
      .select('id, amount, currency, provider, provider_reference, completed_at')
      .eq('status', 'completed')
      .order('completed_at', { ascending: false })
      .limit(100),
    supabase.from('settlements').select('payment_intent_id').not('payment_intent_id', 'is', null).limit(5000),
  ]);

  const linkedSet = new Set(
    ((linked ?? []) as Array<{ payment_intent_id: string | null }>)
      .map((r) => r.payment_intent_id)
      .filter((id): id is string => Boolean(id)),
  );

  const missing = ((completed ?? []) as unknown as MissingIntent[]).filter(
    (row) => !linkedSet.has(row.id),
  );

  const rows = (settlements ?? []) as unknown as SettlementRow[];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="font-[family-name:var(--font-display)] text-2xl font-semibold">
            Settlements
          </h2>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            PSP cash mirror (`settlements` + `provider_transactions`). Distinct from intent
            status and reconcile status — backfill closes gaps after completes.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {missing.length > 0 ? (
            <form action={backfillMissingSettlementsAction}>
              <input type="hidden" name="limit" value="50" />
              <Button type="submit" className="min-h-11">
                Backfill up to 50
              </Button>
            </form>
          ) : null}
          <Button asChild variant="outline" className="min-h-11">
            <Link href={'/admin/finance' as Route}>Finance centre</Link>
          </Button>
          <Button asChild variant="outline" className="min-h-11">
            <Link href={'/admin/finance/integrity' as Route}>Integrity</Link>
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {[
          { href: '/admin/finance/settlements', label: 'All' },
          { href: '/admin/finance/settlements?status=pending', label: 'Pending' },
          { href: '/admin/finance/settlements?status=settled', label: 'Settled' },
          { href: '/admin/finance/settlements?status=disputed', label: 'Disputed' },
          { href: '/admin/finance/settlements?status=failed', label: 'Failed' },
        ].map((f) => (
          <Button
            key={f.href}
            asChild
            variant={
              (f.href.includes('status=') ? f.href.split('=')[1] : '') === statusFilter
                ? 'default'
                : 'outline'
            }
            className="min-h-9"
            size="sm"
          >
            <Link href={f.href as Route}>{f.label}</Link>
          </Button>
        ))}
      </div>

      {missing.length > 0 ? (
        <section className="overflow-hidden rounded-xl border border-amber-500/30 bg-card">
          <div className="border-b border-border px-4 py-3 text-sm font-semibold">
            Completed intents missing settlement ({missing.length})
          </div>
          <ul className="divide-y divide-border">
            {missing.slice(0, 25).map((row) => (
              <li
                key={row.id}
                className="flex flex-wrap items-center justify-between gap-2 px-4 py-3"
              >
                <div>
                  <p className="text-sm font-semibold">{row.provider}</p>
                  <p className="font-mono text-[11px] text-muted-foreground">
                    {row.id}
                    {row.completed_at ? ` · ${formatDate(row.completed_at)}` : ''}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <p className="tabular-nums text-sm font-semibold">
                    {formatCurrency(Number(row.amount), row.currency)}
                  </p>
                  <Button asChild size="sm" variant="outline" className="min-h-9">
                    <Link href={`/admin/finance/intents/${row.id}` as Route}>Case</Link>
                  </Button>
                  <form action={backfillOneSettlementAction}>
                    <input type="hidden" name="intentId" value={row.id} />
                    <Button
                      type="submit"
                      variant="outline"
                      size="sm"
                      className="min-h-9"
                      title={FINANCE_ACTION_LABELS.mirror.title}
                    >
                      {FINANCE_ACTION_LABELS.mirror.button}
                    </Button>
                  </form>
                </div>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="overflow-hidden rounded-xl border border-border bg-card">
        <div className="border-b border-border px-4 py-3 text-sm font-semibold">
          Settlement ledger ({rows.length})
        </div>
        {rows.length === 0 ? (
          <p className="px-4 py-8 text-sm text-muted-foreground">No settlements yet.</p>
        ) : (
          <ul className="divide-y divide-border">
            {rows.map((row) => (
              <li
                key={row.id}
                className="flex flex-wrap items-center justify-between gap-3 px-4 py-3"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-semibold">{row.provider}</p>
                    <StatusBadge status={row.status} />
                  </div>
                  <p className="mt-0.5 font-mono text-[11px] text-muted-foreground">
                    {row.provider_reference ?? 'no ref'} · {formatDate(row.created_at)}
                  </p>
                  {row.payment_intent_id ? (
                    <p className="font-mono text-[10px] text-muted-foreground">
                      <Link
                        href={`/admin/finance/intents/${row.payment_intent_id}` as Route}
                        className="text-primary hover:underline"
                      >
                        intent {row.payment_intent_id}
                      </Link>
                    </p>
                  ) : null}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <p className="tabular-nums text-sm font-semibold">
                    {formatCurrency(Number(row.amount), row.currency)}
                  </p>
                  {row.status === 'pending' || row.status === 'disputed' ? (
                    <form action={markSettlementStatusAction}>
                      <input type="hidden" name="settlementId" value={row.id} />
                      <input type="hidden" name="status" value="settled" />
                      <Button type="submit" size="sm" variant="outline" className="min-h-9">
                        Mark settled
                      </Button>
                    </form>
                  ) : null}
                  {row.status === 'pending' || row.status === 'settled' ? (
                    <form action={markSettlementStatusAction}>
                      <input type="hidden" name="settlementId" value={row.id} />
                      <input type="hidden" name="status" value="disputed" />
                      <Button type="submit" size="sm" variant="outline" className="min-h-9">
                        Dispute
                      </Button>
                    </form>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
