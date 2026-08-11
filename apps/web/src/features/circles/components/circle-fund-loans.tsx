import { formatCurrency } from '@jamiya/shared';
import { Button, Input, Label, Textarea } from '@jamiya/ui';
import {
  acceptQardAgreementFormAction,
  decideQardFormAction,
  repayQardFormAction,
  requestQardFormAction,
} from '@/features/finance/actions';

export type CircleLoanRow = {
  id: string;
  borrowerId: string;
  amount: number;
  amountRepaid: number;
  currency: string;
  purpose: string;
  status: string;
  dueDate: string | null;
  agreementAcceptedAt: string | null;
  agreementSignerName: string | null;
};

export function CircleFundLoans({
  jamiyaId,
  slug,
  currency,
  myLoans,
  pendingApprovals,
  canApprove,
  qardCap,
}: {
  jamiyaId: string;
  slug: string;
  currency: string;
  myLoans: CircleLoanRow[];
  pendingApprovals: CircleLoanRow[];
  canApprove: boolean;
  qardCap: number | null;
}) {
  return (
    <section className="space-y-5">
      <div>
        <h2 className="font-[family-name:var(--font-display)] text-xl font-semibold">
          Circle loans (Qard Hassan)
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Interest-free loans from the table banking pool.
          {qardCap != null
            ? ` Your request cap: ${formatCurrency(qardCap, currency)}.`
            : ''}
        </p>
      </div>

      <form
        action={requestQardFormAction}
        className="grid max-w-xl gap-3 rounded-xl border border-border bg-card p-5 sm:grid-cols-2"
      >
        <input type="hidden" name="jamiyaId" value={jamiyaId} />
        <input type="hidden" name="slug" value={slug} />
        <div className="space-y-1 sm:col-span-2">
          <Label htmlFor="purpose">Purpose</Label>
          <Textarea id="purpose" name="purpose" minLength={5} required rows={2} />
        </div>
        <div className="space-y-1">
          <Label htmlFor="loanAmount">Amount ({currency})</Label>
          <Input id="loanAmount" name="amount" type="number" min="100" required />
        </div>
        <div className="space-y-1">
          <Label htmlFor="installments">Installments</Label>
          <Input
            id="installments"
            name="installments"
            type="number"
            min="1"
            max="24"
            defaultValue="4"
            required
          />
        </div>
        <Button type="submit" className="min-h-11 w-full sm:w-fit sm:col-span-2">
          Request loan
        </Button>
      </form>

      {canApprove && pendingApprovals.length > 0 ? (
        <div className="space-y-3">
          <h3 className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
            Pending approvals
          </h3>
          <ul className="divide-y divide-border rounded-xl border border-border bg-card">
            {pendingApprovals.map((loan) => (
              <li
                key={loan.id}
                className="flex flex-wrap items-center justify-between gap-3 p-4"
              >
                <div>
                  <p className="font-medium">{loan.purpose}</p>
                  <p className="text-sm text-muted-foreground">
                    {formatCurrency(loan.amount, loan.currency)}
                    {loan.agreementAcceptedAt
                      ? ' · agreement signed'
                      : ' · awaiting borrower agreement'}
                  </p>
                </div>
                <div className="flex gap-2">
                  <form action={decideQardFormAction}>
                    <input type="hidden" name="loanId" value={loan.id} />
                    <input type="hidden" name="slug" value={slug} />
                    <input type="hidden" name="approve" value="true" />
                    <Button type="submit" size="sm" disabled={!loan.agreementAcceptedAt}>
                      Approve
                    </Button>
                  </form>
                  <form action={decideQardFormAction}>
                    <input type="hidden" name="loanId" value={loan.id} />
                    <input type="hidden" name="slug" value={slug} />
                    <input type="hidden" name="approve" value="false" />
                    <Button type="submit" size="sm" variant="destructive">
                      Reject
                    </Button>
                  </form>
                </div>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="space-y-3">
        <h3 className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
          Your loans in this circle
        </h3>
        {myLoans.length ? (
          <ul className="divide-y divide-border rounded-xl border border-border bg-card">
            {myLoans.map((loan) => {
              const due = Math.max(loan.amount - loan.amountRepaid, 0);
              return (
                <li
                  key={loan.id}
                  className="flex flex-wrap items-center justify-between gap-3 p-4"
                >
                  <div>
                    <p className="font-medium">{loan.purpose}</p>
                    <p className="text-sm text-muted-foreground">
                      {loan.status} · {formatCurrency(due, loan.currency)} remaining
                      {loan.dueDate ? ` · due ${loan.dueDate}` : ''}
                    </p>
                  </div>
                  {loan.status === 'requested' && !loan.agreementAcceptedAt ? (
                    <form
                      action={acceptQardAgreementFormAction}
                      className="max-w-sm space-y-2 rounded-md border border-border p-3"
                    >
                      <input type="hidden" name="loanId" value={loan.id} />
                      <input type="hidden" name="slug" value={slug} />
                      <p className="text-xs text-muted-foreground">
                        Interest-free Qard Hassan — accept the facility agreement to continue.
                      </p>
                      <Input
                        name="signerName"
                        placeholder="Full name as signature"
                        required
                        minLength={2}
                      />
                      <Button type="submit" size="sm">
                        Accept agreement
                      </Button>
                    </form>
                  ) : null}
                  {loan.status === 'active' ? (
                    <form action={repayQardFormAction} className="flex gap-2">
                      <input type="hidden" name="loanId" value={loan.id} />
                      <input type="hidden" name="slug" value={slug} />
                      <Input
                        name="amount"
                        type="number"
                        min="1"
                        max={due}
                        placeholder="Repay"
                        required
                        className="w-28"
                      />
                      <Button type="submit" size="sm">
                        Repay
                      </Button>
                    </form>
                  ) : null}
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">No loans yet in this circle.</p>
        )}
      </div>
    </section>
  );
}
