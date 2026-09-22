import type { Metadata } from 'next';
import Link from 'next/link';
import type { Route } from 'next';
import { formatCurrency, formatDate } from '@jamiya/shared';
import { Button } from '@jamiya/ui';
import { createClient } from '@/lib/supabase/server';
import { requireAdminAccess } from '@/features/admin/lib/require-admin';

export const metadata: Metadata = { title: 'Admin · Journal' };
export const dynamic = 'force-dynamic';

type EntryRow = {
  id: string;
  domain: string;
  description: string | null;
  currency: string;
  source_type: string;
  source_id: string;
  posted_at: string;
  payment_intent_id: string | null;
  user_id: string | null;
};

type LineRow = {
  id: string;
  journal_entry_id: string;
  side: 'debit' | 'credit';
  amount: number | string;
  currency: string;
  memo: string | null;
  ledger_accounts: { code: string; name: string } | null;
};

export default async function AdminJournalPage({
  searchParams,
}: {
  searchParams?: Promise<{ entry?: string; domain?: string }>;
}) {
  await requireAdminAccess('admin');
  const qs = (await searchParams) ?? {};
  const supabase = await createClient();

  let entriesQuery = supabase
    .from('journal_entries')
    .select(
      'id, domain, description, currency, source_type, source_id, posted_at, payment_intent_id, user_id',
    )
    .order('posted_at', { ascending: false })
    .limit(40);

  if (qs.domain) {
    entriesQuery = entriesQuery.eq('domain', qs.domain);
  }

  const { data: entries } = await entriesQuery;
  const entryRows = (entries ?? []) as unknown as EntryRow[];

  const selectedId = qs.entry ?? entryRows[0]?.id ?? null;
  let lines: LineRow[] = [];
  if (selectedId) {
    const { data } = await supabase
      .from('journal_lines')
      .select(
        'id, journal_entry_id, side, amount, currency, memo, ledger_accounts(code, name)',
      )
      .eq('journal_entry_id', selectedId)
      .order('side', { ascending: true });
    lines = (data ?? []) as unknown as LineRow[];
  }

  const domains = [
    'OPERATING',
    'CONTRIBUTIONS',
    'QARD',
    'SADAKA',
    'TAKAFUL',
    'ASSET_FINANCE',
  ] as const;

  const selected = entryRows.find((e) => e.id === selectedId) ?? null;
  const debitTotal = lines
    .filter((l) => l.side === 'debit')
    .reduce((s, l) => s + Number(l.amount), 0);
  const creditTotal = lines
    .filter((l) => l.side === 'credit')
    .reduce((s, l) => s + Number(l.amount), 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="font-[family-name:var(--font-display)] text-2xl font-semibold">
            Journal ledger
          </h2>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Append-only projection. Posts are never edited — reverse with a new balanced
            entry. Live wallet SoT remains until cutover.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline" className="min-h-11">
            <Link href={'/admin/finance' as Route}>Finance centre</Link>
          </Button>
          <Button asChild variant="outline" className="min-h-11">
            <Link href={'/admin/architecture' as Route}>Architecture</Link>
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <Link
          href={'/admin/finance/journal' as Route}
          className={`rounded-lg border px-3 py-1.5 text-xs font-semibold ${
            !qs.domain ? 'border-primary bg-primary/10 text-primary' : 'border-border'
          }`}
        >
          All
        </Link>
        {domains.map((d) => (
          <Link
            key={d}
            href={`/admin/finance/journal?domain=${d}` as Route}
            className={`rounded-lg border px-3 py-1.5 text-xs font-semibold ${
              qs.domain === d
                ? 'border-primary bg-primary/10 text-primary'
                : 'border-border'
            }`}
          >
            {d}
          </Link>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="overflow-hidden rounded-xl border border-border bg-card">
          <div className="border-b border-border px-4 py-3 text-sm font-semibold">
            Recent posts
          </div>
          {entryRows.length === 0 ? (
            <p className="px-4 py-8 text-sm text-muted-foreground">No journal posts yet.</p>
          ) : (
            <ul className="divide-y divide-border">
              {entryRows.map((row) => {
                const active = row.id === selectedId;
                return (
                  <li key={row.id}>
                    <Link
                      href={
                        `/admin/finance/journal?${new URLSearchParams({
                          ...(qs.domain ? { domain: qs.domain } : {}),
                          entry: row.id,
                        }).toString()}` as Route
                      }
                      className={`block px-4 py-3 transition-colors hover:bg-muted/50 ${
                        active ? 'bg-muted/60' : ''
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="text-sm font-semibold">
                            {row.description ?? row.source_type}
                          </p>
                          <p className="mt-0.5 text-xs text-muted-foreground">
                            {row.domain} · {row.source_type}/{row.source_id.slice(0, 8)}…
                          </p>
                        </div>
                        <time className="shrink-0 text-[11px] text-muted-foreground">
                          {formatDate(row.posted_at)}
                        </time>
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div className="overflow-hidden rounded-xl border border-border bg-card">
          <div className="border-b border-border px-4 py-3 text-sm font-semibold">
            Entry detail
          </div>
          {!selected ? (
            <p className="px-4 py-8 text-sm text-muted-foreground">Select a post.</p>
          ) : (
            <div className="space-y-4 px-4 py-4">
              <div>
                <p className="text-sm font-semibold">
                  {selected.description ?? selected.source_type}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {selected.domain} · posted {formatDate(selected.posted_at)}
                </p>
                <p className="mt-1 font-mono text-[11px] text-muted-foreground">
                  {selected.source_type}:{selected.source_id}
                </p>
              </div>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs text-muted-foreground">
                    <th className="pb-2 font-medium">Account</th>
                    <th className="pb-2 font-medium">Side</th>
                    <th className="pb-2 text-right font-medium">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {lines.map((line) => (
                    <tr key={line.id}>
                      <td className="py-2">
                        <span className="font-mono text-xs">
                          {line.ledger_accounts?.code ?? '—'}
                        </span>
                        <span className="ml-2 text-muted-foreground">
                          {line.ledger_accounts?.name}
                        </span>
                      </td>
                      <td className="py-2 capitalize">{line.side}</td>
                      <td className="py-2 text-right tabular-nums">
                        {formatCurrency(Number(line.amount), line.currency)}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t border-border text-xs font-semibold">
                    <td className="pt-2" colSpan={2}>
                      Debits {formatCurrency(debitTotal, selected.currency)} · Credits{' '}
                      {formatCurrency(creditTotal, selected.currency)}
                      {Math.abs(debitTotal - creditTotal) > 0.001 ? (
                        <span className="ml-2 text-destructive">UNBALANCED</span>
                      ) : (
                        <span className="ml-2 text-emerald-700">balanced</span>
                      )}
                    </td>
                    <td />
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
