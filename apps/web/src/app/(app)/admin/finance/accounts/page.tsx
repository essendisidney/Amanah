import type { Metadata } from 'next';
import Link from 'next/link';
import type { Route } from 'next';
import { formatCurrency } from '@jamiya/shared';
import { Button } from '@jamiya/ui';
import { createClient } from '@/lib/supabase/server';
import { requireAdminAccess } from '@/features/admin/lib/require-admin';

export const metadata: Metadata = { title: 'Admin · Chart of accounts' };
export const dynamic = 'force-dynamic';

type AccountRow = {
  id: string;
  code: string;
  name: string;
  domain: string;
  normal_balance: string;
  is_active: boolean;
};

type LineAgg = {
  ledger_account_id: string;
  side: string;
  amount: number | string;
};

export default async function AdminChartOfAccountsPage() {
  await requireAdminAccess('admin');
  const supabase = await createClient();

  const [{ data: accounts }, { data: lines }] = await Promise.all([
    supabase
      .from('ledger_accounts')
      .select('id, code, name, domain, normal_balance, is_active')
      .order('code', { ascending: true }),
    supabase.from('journal_lines').select('ledger_account_id, side, amount').limit(10000),
  ]);

  const rows = (accounts ?? []) as unknown as AccountRow[];
  const totals = new Map<string, { debit: number; credit: number }>();
  for (const raw of (lines ?? []) as unknown as LineAgg[]) {
    const cur = totals.get(raw.ledger_account_id) ?? { debit: 0, credit: 0 };
    const amt = Number(raw.amount) || 0;
    if (raw.side === 'debit') cur.debit += amt;
    else cur.credit += amt;
    totals.set(raw.ledger_account_id, cur);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="font-[family-name:var(--font-display)] text-2xl font-semibold">
            Chart of accounts
          </h2>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Domain-tagged ledger accounts. Totals are from append-only journal lines
            (projection), not editable balances.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline" className="min-h-11">
            <Link href={'/admin/finance/journal' as Route}>Journal</Link>
          </Button>
          <Button asChild variant="outline" className="min-h-11">
            <Link href={'/admin/finance/integrity' as Route}>Integrity</Link>
          </Button>
        </div>
      </div>

      <div className="overflow-x-auto rounded-xl border border-border bg-card">
        <table className="amanah-table min-w-[640px]">
          <thead>
            <tr>
              <th>Code</th>
              <th>Name</th>
              <th>Domain</th>
              <th>Normal</th>
              <th className="text-right">Debits</th>
              <th className="text-right">Credits</th>
              <th className="text-right">Net</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const t = totals.get(row.id) ?? { debit: 0, credit: 0 };
              const net =
                row.normal_balance === 'credit' ? t.credit - t.debit : t.debit - t.credit;
              return (
                <tr key={row.id} className={!row.is_active ? 'opacity-50' : undefined}>
                  <td className="font-mono text-xs">{row.code}</td>
                  <td className="font-medium">{row.name}</td>
                  <td className="text-muted-foreground">{row.domain}</td>
                  <td className="capitalize text-muted-foreground">{row.normal_balance}</td>
                  <td className="amount">{formatCurrency(t.debit, 'KES')}</td>
                  <td className="amount">{formatCurrency(t.credit, 'KES')}</td>
                  <td className="amount">{formatCurrency(net, 'KES')}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
