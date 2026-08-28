import { Button, Input, Label } from '@jamiya/ui';
import { formatCurrency, formatDate } from '@jamiya/shared';
import { recordMemberLoanEventAction } from '@/features/circles/actions/loan-actions';

export type LoanLedgerEvent = {
  id: string;
  event_type: string;
  amount: number;
  profit_amount: number;
  principal_delta: number;
  effective_date: string;
  notes: string | null;
};

export type LoanLedgerFacility = {
  id: string;
  principal_outstanding: number;
  profit_rate_pct: number;
  status: string;
  opened_on: string;
};

type Props = {
  jamiyaId: string;
  slug: string;
  memberId: string;
  memberLabel: string;
  currency: string;
  facility: LoanLedgerFacility | null;
  totals: {
    profit_paid: number;
    disbursed: number;
    repaid_principal: number;
  };
  events: LoanLedgerEvent[];
};

const EVENT_LABELS: Record<string, string> = {
  disbursement: 'New loan',
  profit: 'Profit paid',
  repayment: 'Repayment',
  rollover: 'Rollover',
};

export function MemberLoanLedger({
  jamiyaId,
  slug,
  memberId,
  memberLabel,
  currency,
  facility,
  totals,
  events,
}: Props) {
  const principal = facility?.principal_outstanding ?? 0;
  const rate = facility?.profit_rate_pct ?? 10;
  const suggestedProfit = Math.round((principal * rate) / 100);
  const today = new Date().toISOString().slice(0, 10);

  return (
    <section className="space-y-4 rounded-xl border border-border bg-card p-5">
      <div>
        <h2 className="text-lg font-semibold">Loan ledger — profit & rollovers</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Like Asha&apos;s Excel: <strong className="font-medium text-foreground">NEW LOAN</strong>,{' '}
          <strong className="font-medium text-foreground">INTEREST/profit</strong>,{' '}
          <strong className="font-medium text-foreground">REPAYMENT</strong>, and{' '}
          <strong className="font-medium text-foreground">rollover + top-up</strong>.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Loan balance" value={formatCurrency(principal, currency)} />
        <Stat
          label="Suggested profit"
          value={formatCurrency(suggestedProfit, currency)}
          sub={`${rate}% of balance`}
        />
        <Stat label="Profit paid (total)" value={formatCurrency(totals.profit_paid, currency)} />
        <Stat
          label="Borrowed / repaid"
          value={`${formatCurrency(totals.disbursed, currency)} / ${formatCurrency(totals.repaid_principal, currency)}`}
        />
      </div>

      {events.length > 0 ? (
        <ul className="divide-y divide-border rounded-lg border border-border">
          {events.map((e) => (
            <li key={e.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm">
              <div>
                <p className="font-medium">{EVENT_LABELS[e.event_type] ?? e.event_type}</p>
                <p className="text-xs text-muted-foreground">
                  {formatDate(e.effective_date)}
                  {e.notes ? ` · ${e.notes}` : ''}
                </p>
              </div>
              <div className="text-right tabular-nums">
                <p className="font-semibold">{formatCurrency(Number(e.amount), currency)}</p>
                {Number(e.profit_amount) > 0 ? (
                  <p className="text-xs text-muted-foreground">
                    incl. profit {formatCurrency(Number(e.profit_amount), currency)}
                  </p>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted-foreground">No loan events yet for {memberLabel}.</p>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <LoanEventForm
          title="New loan"
          jamiyaId={jamiyaId}
          slug={slug}
          memberId={memberId}
          eventType="disbursement"
          defaultDate={today}
        />
        <LoanEventForm
          title="Pay profit only"
          jamiyaId={jamiyaId}
          slug={slug}
          memberId={memberId}
          eventType="profit"
          defaultAmount={suggestedProfit > 0 ? suggestedProfit : undefined}
          defaultDate={today}
        />
        <LoanEventForm
          title="Repayment (principal + profit)"
          jamiyaId={jamiyaId}
          slug={slug}
          memberId={memberId}
          eventType="repayment"
          showProfitSplit
          defaultDate={today}
        />
        <LoanEventForm
          title="Rollover + top-up"
          jamiyaId={jamiyaId}
          slug={slug}
          memberId={memberId}
          eventType="rollover"
          showRollover
          defaultDate={today}
          helpText="Profit paid on closing the old loan, then new balance after rollover (e.g. Sarah 50,000 → 40,300 with top-up)."
        />
      </div>
    </section>
  );
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-lg border border-border bg-secondary/20 px-4 py-3">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 text-base font-semibold tabular-nums">{value}</p>
      {sub ? <p className="mt-0.5 text-xs text-muted-foreground">{sub}</p> : null}
    </div>
  );
}

function LoanEventForm({
  title,
  jamiyaId,
  slug,
  memberId,
  eventType,
  defaultDate,
  defaultAmount,
  showProfitSplit = false,
  showRollover = false,
  helpText,
}: {
  title: string;
  jamiyaId: string;
  slug: string;
  memberId: string;
  eventType: 'disbursement' | 'profit' | 'repayment' | 'rollover';
  defaultDate: string;
  defaultAmount?: number;
  showProfitSplit?: boolean;
  showRollover?: boolean;
  helpText?: string;
}) {
  return (
    <form action={recordMemberLoanEventAction} className="space-y-3 rounded-lg border border-border p-4">
      <h3 className="font-semibold">{title}</h3>
      {helpText ? <p className="text-xs text-muted-foreground">{helpText}</p> : null}
      <input type="hidden" name="jamiyaId" value={jamiyaId} />
      <input type="hidden" name="slug" value={slug} />
      <input type="hidden" name="memberId" value={memberId} />
      <input type="hidden" name="eventType" value={eventType} />
      <div className="grid gap-3 sm:grid-cols-2">
        {showRollover ? (
          <>
            <div className="space-y-1">
              <Label htmlFor={`${eventType}-profit`}>Profit on close</Label>
              <Input id={`${eventType}-profit`} name="profitAmount" type="number" min={0} step="1" />
            </div>
            <div className="space-y-1">
              <Label htmlFor={`${eventType}-new`}>New loan balance</Label>
              <Input id={`${eventType}-new`} name="newPrincipal" type="number" min={0} step="1" required />
            </div>
          </>
        ) : (
          <div className="space-y-1">
            <Label htmlFor={`${eventType}-amount`}>Amount</Label>
            <Input
              id={`${eventType}-amount`}
              name="amount"
              type="number"
              min={1}
              step="1"
              defaultValue={defaultAmount}
              required
            />
          </div>
        )}
        {showProfitSplit ? (
          <div className="space-y-1">
            <Label htmlFor={`${eventType}-profit-split`}>Profit portion</Label>
            <Input id={`${eventType}-profit-split`} name="profitAmount" type="number" min={0} step="1" defaultValue={0} />
          </div>
        ) : null}
        <div className="space-y-1">
          <Label htmlFor={`${eventType}-date`}>Date</Label>
          <Input id={`${eventType}-date`} name="effectiveDate" type="date" defaultValue={defaultDate} required />
        </div>
        <div className="space-y-1 sm:col-span-2">
          <Label htmlFor={`${eventType}-notes`}>Notes</Label>
          <Input id={`${eventType}-notes`} name="notes" placeholder="Optional" />
        </div>
      </div>
      <Button type="submit" variant="outline" className="min-h-10">
        Save
      </Button>
    </form>
  );
}
