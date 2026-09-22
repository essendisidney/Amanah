import type { Metadata } from 'next';
import Link from 'next/link';
import type { Route } from 'next';
import { formatCurrency, formatDate } from '@jamiya/shared';
import { Button } from '@jamiya/ui';
import { createClient } from '@/lib/supabase/server';
import { requireAdminAccess } from '@/features/admin/lib/require-admin';
import {
  backfillIntentJournalAction,
  backfillMissingJournalsAction,
} from '@/features/admin/actions/integrity-backfill-actions';
import { backfillMissingSettlementsAction } from '@/features/admin/actions/settlement-actions';

export const metadata: Metadata = { title: 'Admin · Finance integrity' };
export const dynamic = 'force-dynamic';

type Snapshot = {
  ok?: boolean;
  error?: string;
  wallet_balances_kes?: number;
  wallet_liability_journal_net_kes?: number;
  wallet_vs_journal_delta_kes?: number;
  completed_intents_missing_journal?: number;
  completed_intents_missing_settlement?: number;
  settlements_pending?: number;
  settlements_disputed?: number;
  unbalanced_journal_entries?: number;
  checked_at?: string;
};

type MissingRow = {
  id: string;
  amount: number | string;
  currency: string;
  provider: string;
  completed_at: string | null;
  metadata: Record<string, unknown> | null;
};

export default async function AdminFinanceIntegrityPage() {
  await requireAdminAccess('admin');
  const supabase = await createClient();

  const { data: snapRaw } = await supabase.rpc('finance_integrity_snapshot');
  const snap = (snapRaw ?? {}) as Snapshot;

  const { data: missing } = await supabase
    .from('payment_intents')
    .select('id, amount, currency, provider, completed_at, metadata')
    .eq('status', 'completed')
    .order('completed_at', { ascending: false })
    .limit(80);

  const { data: journalSources } = await supabase
    .from('journal_entries')
    .select('source_id')
    .eq('source_type', 'payment_intent')
    .limit(5000);

  const posted = new Set(
    ((journalSources ?? []) as Array<{ source_id: string }>).map((j) => j.source_id),
  );
  const missingRows = ((missing ?? []) as unknown as MissingRow[]).filter(
    (row) => !posted.has(row.id),
  );

  const delta = Number(snap.wallet_vs_journal_delta_kes ?? 0);
  const deltaOk = Math.abs(delta) < 1;
  const missingCount = Number(snap.completed_intents_missing_journal ?? missingRows.length);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="font-[family-name:var(--font-display)] text-2xl font-semibold">
            Ledger integrity
          </h2>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Compare live wallet SoT to journal projection (account 2000). Use Backfill to
            post missing journals and mirror settlement sidecars — idempotent.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {missingCount > 0 ? (
            <form action={backfillMissingJournalsAction}>
              <input type="hidden" name="limit" value="50" />
              <Button type="submit" className="min-h-11">
                Backfill journals
              </Button>
            </form>
          ) : null}
          {(snap.completed_intents_missing_settlement ?? 0) > 0 ? (
            <form action={backfillMissingSettlementsAction}>
              <input type="hidden" name="limit" value="50" />
              <Button type="submit" variant="outline" className="min-h-11">
                Backfill settlements
              </Button>
            </form>
          ) : null}
          <Button asChild variant="outline" className="min-h-11">
            <Link href={'/admin/finance' as Route}>Finance centre</Link>
          </Button>
          <Button asChild variant="outline" className="min-h-11">
            <Link href={'/admin/finance/settlements' as Route}>Settlements</Link>
          </Button>
          <Button asChild variant="outline" className="min-h-11">
            <Link href={'/admin/finance/accounts' as Route}>Chart of accounts</Link>
          </Button>
        </div>
      </div>

      {!snap.ok ? (
        <p className="rounded-xl border border-destructive/40 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          {snap.error ?? 'Could not load integrity snapshot.'}
        </p>
      ) : (
        <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {[
            {
              label: 'Wallet balances (KES)',
              value: formatCurrency(Number(snap.wallet_balances_kes ?? 0), 'KES'),
              hint: 'Live SoT',
            },
            {
              label: 'Journal wallet liability net',
              value: formatCurrency(
                Number(snap.wallet_liability_journal_net_kes ?? 0),
                'KES',
              ),
              hint: 'Account 2000 credits − debits',
            },
            {
              label: 'Wallet − journal delta',
              value: formatCurrency(delta, 'KES'),
              hint: deltaOk ? 'Within KES 1' : 'Investigate projection gaps',
            },
            {
              label: 'Completed intents missing journal',
              value: String(snap.completed_intents_missing_journal ?? 0),
              hint: 'Should trend to zero',
            },
            {
              label: 'Completed intents missing settlement',
              value: String(snap.completed_intents_missing_settlement ?? 0),
              hint: 'PSP cash mirror gaps',
            },
            {
              label: 'Settlements pending / disputed',
              value: `${snap.settlements_pending ?? 0} / ${snap.settlements_disputed ?? 0}`,
              hint: 'Open settlement rows',
            },
            {
              label: 'Unbalanced journal entries',
              value: String(snap.unbalanced_journal_entries ?? 0),
              hint: 'Debits must equal credits',
            },
            {
              label: 'Checked at',
              value: snap.checked_at ? formatDate(snap.checked_at) : '—',
              hint: 'Server clock',
            },
          ].map((c) => (
            <div
              key={c.label}
              className="rounded-xl border border-border bg-card px-4 py-3"
            >
              <dt className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                {c.label}
              </dt>
              <dd className="mt-1 text-lg font-semibold tabular-nums">{c.value}</dd>
              <p className="mt-1 text-xs text-muted-foreground">{c.hint}</p>
            </div>
          ))}
        </dl>
      )}

      <section className="overflow-hidden rounded-xl border border-border bg-card">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-3">
          <p className="text-sm font-semibold">
            Completed intents without journal post ({missingRows.length})
          </p>
          {missingRows.length > 0 ? (
            <form action={backfillMissingJournalsAction}>
              <input type="hidden" name="limit" value="50" />
              <Button type="submit" variant="outline" size="sm" className="min-h-9">
                Backfill batch
              </Button>
            </form>
          ) : null}
        </div>
        {missingRows.length === 0 ? (
          <p className="px-4 py-8 text-sm text-muted-foreground">All clear.</p>
        ) : (
          <ul className="divide-y divide-border">
            {missingRows.slice(0, 40).map((row) => (
              <li
                key={row.id}
                className="flex flex-wrap items-center justify-between gap-2 px-4 py-3"
              >
                <div>
                  <p className="text-sm font-semibold">
                    {String(row.metadata?.kind ?? 'payment')} · {row.provider}
                  </p>
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
                  <form action={backfillIntentJournalAction}>
                    <input type="hidden" name="intentId" value={row.id} />
                    <Button type="submit" variant="outline" size="sm" className="min-h-9">
                      Backfill
                    </Button>
                  </form>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
