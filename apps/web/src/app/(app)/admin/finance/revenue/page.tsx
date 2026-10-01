import type { Metadata } from 'next';
import Link from 'next/link';
import type { Route } from 'next';
import { formatCurrency, formatDate } from '@jamiya/shared';
import { createClient } from '@/lib/supabase/server';
import { requireAdminAccess } from '@/features/admin/lib/require-admin';

export const metadata: Metadata = { title: 'Admin · Revenue' };
export const dynamic = 'force-dynamic';

type Summary = {
  ok: boolean;
  error?: string;
  total: number;
  all_time: number;
  by_stream: Array<{ code: string; name: string; amount: number }>;
  by_day: Array<{ day: string; amount: number }>;
  by_circle: Array<{ jamiya_id: string; name: string | null; amount: number }>;
  paying_circles: number;
  circles_total: number;
  monthly_recurring: number;
  financing_fees_agreed: number;
};

const RANGES = {
  month: 'This month',
  last: 'Last month',
  '90d': 'Last 90 days',
  year: 'This year',
} as const;
type RangeKey = keyof typeof RANGES;

function iso(d: Date) {
  return d.toISOString().slice(0, 10);
}

/** Dates are in Nairobi time (UTC+3). */
function rangeDates(key: RangeKey): { from: string; to: string } {
  const now = new Date(Date.now() + 3 * 3600_000);
  const y = now.getUTCFullYear();
  const m = now.getUTCMonth();
  if (key === 'last') {
    return { from: iso(new Date(Date.UTC(y, m - 1, 1))), to: iso(new Date(Date.UTC(y, m, 0))) };
  }
  if (key === '90d') {
    return { from: iso(new Date(now.getTime() - 89 * 86_400_000)), to: iso(now) };
  }
  if (key === 'year') return { from: `${y}-01-01`, to: iso(now) };
  return { from: iso(new Date(Date.UTC(y, m, 1))), to: iso(now) };
}

const kes = (n: number) => formatCurrency(Number(n) || 0, 'KES');

export default async function AdminRevenuePage({
  searchParams,
}: {
  searchParams?: Promise<{ range?: string }>;
}) {
  await requireAdminAccess('admin');
  const params = (await searchParams) ?? {};
  const range: RangeKey = (params.range && params.range in RANGES ? params.range : 'month') as RangeKey;
  const { from, to } = rangeDates(range);

  const supabase = await createClient();
  const { data, error } = await supabase.rpc('admin_revenue_summary', { p_from: from, p_to: to });
  const s = data as unknown as Summary | null;

  if (error || !s?.ok) {
    return (
      <p className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm">
        Could not load revenue: {error?.message ?? s?.error ?? 'unknown error'}
      </p>
    );
  }

  const total = Number(s.total) || 0;
  const maxDay = Math.max(1, ...s.by_day.map((d) => Number(d.amount) || 0));
  const tiles = [
    { label: `Revenue · ${RANGES[range].toLowerCase()}`, value: kes(total) },
    { label: 'Revenue · all time', value: kes(s.all_time) },
    {
      label: 'Paying circles',
      value: `${s.paying_circles} of ${s.circles_total}`,
      hint: `${kes(s.monthly_recurring)} a month from plans`,
    },
    {
      label: 'Financing fees agreed',
      value: kes(s.financing_fees_agreed),
      hint: 'Approved Tawarruq, not yet collected',
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="font-[family-name:var(--font-display)] text-2xl font-semibold">Revenue</h2>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Income booked in the journal (accounts 2100–2150): circle plans, contribution fees,
            join and early-slot fees, Sadaka platform fees and financing fees. {formatDate(from)} –{' '}
            {formatDate(to)}.
          </p>
        </div>
        <nav className="flex flex-wrap gap-1.5" aria-label="Period">
          {(Object.keys(RANGES) as RangeKey[]).map((key) => (
            <Link
              key={key}
              href={`/admin/finance/revenue?range=${key}` as Route}
              aria-current={key === range ? 'page' : undefined}
              className={`inline-flex min-h-10 items-center rounded-full px-3.5 text-sm font-medium ${
                key === range
                  ? 'bg-primary text-primary-foreground'
                  : 'border border-border text-muted-foreground hover:bg-muted'
              }`}
            >
              {RANGES[key]}
            </Link>
          ))}
        </nav>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {tiles.map((tile) => (
          <div key={tile.label} className="jameiyah-surface px-4 py-4">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{tile.label}</p>
            <p className="jameiyah-money mt-2 text-2xl font-semibold tracking-tight">{tile.value}</p>
            {tile.hint ? <p className="mt-1 text-xs text-muted-foreground">{tile.hint}</p> : null}
          </div>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="min-w-0 space-y-3">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">By stream</h3>
          <div className="overflow-x-auto rounded-xl border border-border bg-card">
            <table className="jameiyah-table min-w-[360px]">
              <thead>
                <tr>
                  <th>Account</th>
                  <th className="text-right">Amount</th>
                  <th className="text-right">Share</th>
                </tr>
              </thead>
              <tbody>
                {s.by_stream.map((row) => {
                  const amt = Number(row.amount) || 0;
                  return (
                    <tr key={row.code}>
                      <td>
                        <span className="font-mono text-xs text-muted-foreground">{row.code}</span>{' '}
                        <span className="font-medium">{row.name}</span>
                      </td>
                      <td className="amount">{kes(amt)}</td>
                      <td className="amount">{total > 0 ? `${Math.round((amt / total) * 100)}%` : '—'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>

        <section className="min-w-0 space-y-3">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Top circles</h3>
          {s.by_circle.length ? (
            <ul className="divide-y divide-border rounded-xl border border-border bg-card">
              {s.by_circle.map((c) => (
                <li key={c.jamiya_id} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
                  <span className="truncate font-medium">{c.name ?? 'Circle'}</span>
                  <span className="jameiyah-money font-semibold">{kes(c.amount)}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="rounded-xl border border-dashed border-border p-4 text-sm text-muted-foreground">
              No circle revenue in this period.
            </p>
          )}
        </section>
      </div>

      <section className="min-w-0 space-y-3">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">By day</h3>
        {s.by_day.length ? (
          <ul className="space-y-1.5 rounded-xl border border-border bg-card p-4">
            {s.by_day.map((d) => {
              const amt = Number(d.amount) || 0;
              return (
                <li key={d.day} className="grid grid-cols-[6.5rem_1fr_6.5rem] items-center gap-3 text-sm">
                  <span className="text-muted-foreground">{formatDate(d.day)}</span>
                  <span className="h-2.5 overflow-hidden rounded-full bg-muted" aria-hidden>
                    <span
                      className="block h-full rounded-full bg-primary"
                      style={{ width: `${Math.max(2, (amt / maxDay) * 100)}%` }}
                    />
                  </span>
                  <span className="jameiyah-money text-right font-medium">{kes(amt)}</span>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="rounded-xl border border-dashed border-border p-4 text-sm text-muted-foreground">
            No revenue booked in this period.
          </p>
        )}
      </section>
    </div>
  );
}
