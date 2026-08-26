import { formatCurrency, formatDate } from '@jamiya/shared';
import { StatusBadge } from '@/features/dashboard/components/dashboard-stats';

export type ContributionLedgerRow = {
  id: string;
  memberLabel: string;
  memberPhone: string | null;
  cycleNumber: number;
  amount: number;
  amountPaid: number;
  currency: string;
  status: string;
  dueDate: string;
  paidAt: string | null;
};

export type ContributionPaymentRow = {
  id: string;
  amount: number;
  currency: string;
  paidAt: string;
  memberLabel: string;
  cycleNumber: number;
  recordedByLabel: string;
};

/** Officer view: every contribution with who/amount/status so they can trace what was added. */
export function ContributionLedger({
  rows,
  payments,
}: {
  rows: ContributionLedgerRow[];
  payments: ContributionPaymentRow[];
}) {
  const paid = rows.filter((r) => r.status === 'paid' || r.status === 'partial');
  const due = rows.filter((r) => r.status === 'pending' || r.status === 'late');

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h3 className="text-sm font-semibold text-foreground">
          All contributions ({rows.length})
        </h3>
        <p className="text-sm text-muted-foreground">
          Trace every member&apos;s dues: who owes, who has paid, and how much. Paid rows show
          below in payment history when wallet payments were recorded.
        </p>
        {rows.length === 0 ? (
          <p className="rounded-xl border border-dashed border-border px-4 py-6 text-sm text-muted-foreground">
            No contribution schedule yet. Activate the circle to generate cycles, then payments
            appear here.
          </p>
        ) : (
          <ul className="divide-y divide-border rounded-xl border border-border bg-card">
            {rows.map((row) => (
              <li
                key={row.id}
                className="flex flex-col gap-1 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium text-foreground">{row.memberLabel}</p>
                    <StatusBadge status={row.status} />
                    <span className="text-xs text-muted-foreground">Cycle {row.cycleNumber}</span>
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {row.memberPhone ? `${row.memberPhone} · ` : ''}
                    Due {formatDate(row.dueDate)}
                    {row.paidAt ? ` · Paid ${formatDate(row.paidAt)}` : ''}
                  </p>
                </div>
                <p className="text-sm font-medium text-foreground">
                  {formatCurrency(row.amountPaid, row.currency)}
                  <span className="font-normal text-muted-foreground">
                    {' '}
                    / {formatCurrency(row.amount, row.currency)}
                  </span>
                </p>
              </li>
            ))}
          </ul>
        )}
        {rows.length > 0 ? (
          <p className="text-xs text-muted-foreground">
            Paid/partial: {paid.length} · Still due: {due.length}
          </p>
        ) : null}
      </div>

      <div className="space-y-2">
        <h3 className="text-sm font-semibold text-foreground">
          Payment history ({payments.length})
        </h3>
        <p className="text-sm text-muted-foreground">
          Each wallet payment recorded against a contribution — who was paid for, amount, and who
          recorded it.
        </p>
        {payments.length === 0 ? (
          <p className="rounded-xl border border-dashed border-border px-4 py-6 text-sm text-muted-foreground">
            No wallet payments recorded yet. When a member pays from Money, the entry shows here.
          </p>
        ) : (
          <ul className="divide-y divide-border rounded-xl border border-border bg-card">
            {payments.map((pay) => (
              <li
                key={pay.id}
                className="flex flex-col gap-1 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <p className="font-medium text-foreground">
                    {pay.memberLabel}{' '}
                    <span className="text-xs font-normal text-muted-foreground">
                      · Cycle {pay.cycleNumber}
                    </span>
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {formatDate(pay.paidAt)} · Recorded by {pay.recordedByLabel}
                  </p>
                </div>
                <p className="text-sm font-semibold text-foreground">
                  {formatCurrency(pay.amount, pay.currency)}
                </p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
