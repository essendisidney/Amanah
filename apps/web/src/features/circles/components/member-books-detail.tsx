import Link from 'next/link';
import type { Route } from 'next';
import { formatCurrency, formatDate } from '@jamiya/shared';

type ShareLot = {
  id?: string;
  shares: number | string;
  amount: number | string;
  purchased_on: string;
  notes: string | null;
};

type BookEntry = {
  id: string;
  entry_type: string;
  amount: number | string;
  effective_date: string;
  notes: string | null;
};

type QardLoan = {
  id: string;
  amount: number | string;
  amount_repaid: number | string;
  status: string;
  purpose: string | null;
};

type Props = {
  slug: string;
  memberId: string;
  currency: string;
  memberLabel: string;
  shareLots: ShareLot[];
  contributions: BookEntry[];
  loans: BookEntry[];
  repayments: BookEntry[];
  qardLoans: QardLoan[];
  totals: {
    shareAmount: number;
    shareShares: number;
    savings: number;
    loanDisbursed: number;
    loanRepaid: number;
    qardAmount: number;
    qardRepaid: number;
  };
};

function EntryTable({
  rows,
  currency,
  emptyMessage,
}: {
  rows: Array<{ id: string; date: string; amount: number; label: string; notes: string | null }>;
  currency: string;
  emptyMessage: string;
}) {
  if (rows.length === 0) {
    return <p className="text-sm text-muted-foreground">{emptyMessage}</p>;
  }
  return (
    <ul className="divide-y divide-border rounded-xl border border-border bg-card">
      {rows.map((row) => (
        <li key={row.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
          <div>
            <p className="font-medium text-foreground">{row.label}</p>
            <p className="text-xs text-muted-foreground">
              {row.date ? formatDate(row.date) : 'Facility'}
              {row.notes ? ` · ${row.notes}` : ''}
            </p>
          </div>
          <p className="font-semibold tabular-nums">{formatCurrency(row.amount, currency)}</p>
        </li>
      ))}
    </ul>
  );
}

export function MemberBooksDetail({
  slug,
  memberId,
  currency,
  memberLabel,
  shareLots,
  contributions,
  loans,
  repayments,
  qardLoans,
  totals,
}: Props) {
  const loanOutstanding = Math.max(
    totals.loanDisbursed - totals.loanRepaid + (totals.qardAmount - totals.qardRepaid),
    0,
  );

  const shareRows = shareLots.map((lot, i) => ({
    id: lot.id ?? `lot-${i}`,
    date: lot.purchased_on,
    amount: Number(lot.amount) || 0,
    label: `${Number(lot.shares).toLocaleString()} shares`,
    notes: lot.notes,
  }));

  const contributionRows = contributions
    .slice()
    .sort((a, b) => b.effective_date.localeCompare(a.effective_date))
    .map((b) => ({
      id: b.id,
      date: b.effective_date,
      amount: Number(b.amount) || 0,
      label: 'Monthly savings',
      notes: b.notes,
    }));

  const loanRows = [
    ...loans.map((b) => ({
      id: b.id,
      date: b.effective_date,
      amount: Number(b.amount) || 0,
      label: 'Loan disbursed',
      notes: b.notes,
    })),
    ...repayments.map((b) => ({
      id: b.id,
      date: b.effective_date,
      amount: Number(b.amount) || 0,
      label: 'Loan repayment',
      notes: b.notes,
    })),
    ...qardLoans.map((l) => ({
      id: l.id,
      date: '',
      amount: Number(l.amount) || 0,
      label: `Qard · ${l.status}`,
      notes: l.purpose
        ? `${l.purpose} · repaid ${formatCurrency(Number(l.amount_repaid), currency)}`
        : `Repaid ${formatCurrency(Number(l.amount_repaid), currency)}`,
    })),
  ].sort((a, b) => (b.date || '').localeCompare(a.date || ''));

  return (
    <section className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-2xl font-semibold text-foreground">{memberLabel}</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Shares, monthly savings, and loans for this member.
          </p>
        </div>
        <Link
          href={`/circles/${slug}/statement?memberId=${memberId}` as Route}
          className="text-sm font-medium text-accent underline-offset-4 hover:underline"
        >
          Full statement →
        </Link>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Share capital" value={formatCurrency(totals.shareAmount, currency)} sub={totals.shareShares > 0 ? `${totals.shareShares.toLocaleString()} shares` : 'None recorded'} />
        <Stat label="Contributions" value={formatCurrency(totals.savings, currency)} sub={`${contributionRows.length} month${contributionRows.length === 1 ? '' : 's'}`} />
        <Stat label="Loan outstanding" value={formatCurrency(loanOutstanding, currency)} sub={`Borrowed ${formatCurrency(totals.loanDisbursed + totals.qardAmount, currency)}`} />
        <Stat label="Repaid" value={formatCurrency(totals.loanRepaid + totals.qardRepaid, currency)} sub="Cashbook + Qard" />
      </div>

      <div className="space-y-6">
        <div className="space-y-2">
          <h3 className="text-base font-semibold">Share capital</h3>
          <p className="text-sm text-muted-foreground">
            One-off buy-in (SHARES ONE OFF). Not counted as monthly savings.
          </p>
          <EntryTable
            rows={shareRows}
            currency={currency}
            emptyMessage="No share capital recorded yet."
          />
          {shareRows.length > 0 ? (
            <p className="text-right text-sm font-medium text-foreground">
              Total {formatCurrency(totals.shareAmount, currency)}
            </p>
          ) : null}
        </div>

        <div className="space-y-2">
          <h3 className="text-base font-semibold">Monthly contributions</h3>
          <p className="text-sm text-muted-foreground">
            Savings by month (5th Feb, March, April…).
          </p>
          <EntryTable
            rows={contributionRows}
            currency={currency}
            emptyMessage="No monthly contributions recorded yet."
          />
          {contributionRows.length > 0 ? (
            <p className="text-right text-sm font-medium text-foreground">
              Total {formatCurrency(totals.savings, currency)}
            </p>
          ) : null}
        </div>

        <div className="space-y-2">
          <h3 className="text-base font-semibold">Loans & repayments</h3>
          <p className="text-sm text-muted-foreground">
            Cashbook loans from the sheet plus any live Qard facilities.
          </p>
          <EntryTable
            rows={loanRows}
            currency={currency}
            emptyMessage="No loans recorded for this member."
          />
          {loanRows.length > 0 ? (
            <div className="flex flex-wrap justify-end gap-4 text-sm">
              <p>
                <span className="text-muted-foreground">Borrowed </span>
                <span className="font-medium">
                  {formatCurrency(totals.loanDisbursed + totals.qardAmount, currency)}
                </span>
              </p>
              <p>
                <span className="text-muted-foreground">Outstanding </span>
                <span className="font-medium">{formatCurrency(loanOutstanding, currency)}</span>
              </p>
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}

function Stat({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="rounded-lg border border-border bg-secondary/20 px-4 py-3">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 text-lg font-semibold tabular-nums">{value}</p>
      <p className="mt-0.5 text-xs text-muted-foreground">{sub}</p>
    </div>
  );
}
