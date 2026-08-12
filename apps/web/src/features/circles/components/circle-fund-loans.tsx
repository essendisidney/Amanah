import { formatCurrency } from '@jamiya/shared';
import { Button, Input, Label, Textarea } from '@jamiya/ui';
import {
  acceptQardAgreementFormAction,
  decideQardFormAction,
  markQardDefaultedFormAction,
  repayQardFormAction,
  requestQardFormAction,
  respondQardGuaranteeFormAction,
} from '@/features/finance/actions';

export type CircleLoanGuarantee = {
  id: string;
  guarantorUserId: string;
  guarantorName: string;
  status: string;
};

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
  guarantees: CircleLoanGuarantee[];
};

export type GuarantorCandidate = {
  userId: string;
  label: string;
};

export type PendingGuaranteeRequest = {
  id: string;
  loanId: string;
  borrowerName: string;
  amount: number;
  currency: string;
  purpose: string;
};

function guaranteeSummary(guarantees: CircleLoanGuarantee[]): string {
  if (!guarantees.length) return 'no guarantors nominated';
  const accepted = guarantees.filter((g) => g.status === 'accepted').length;
  const pending = guarantees.filter((g) => g.status === 'pending').length;
  const declined = guarantees.filter((g) => g.status === 'declined').length;
  const parts = [`${accepted} accepted`];
  if (pending) parts.push(`${pending} pending`);
  if (declined) parts.push(`${declined} declined`);
  return parts.join(' · ');
}

export function CircleFundLoans({
  jamiyaId,
  slug,
  currency,
  myLoans,
  pendingApprovals,
  pendingGuaranteeRequests,
  officerActiveLoans,
  guarantorCandidates,
  canApprove,
  qardCap,
}: {
  jamiyaId: string;
  slug: string;
  currency: string;
  myLoans: CircleLoanRow[];
  pendingApprovals: CircleLoanRow[];
  pendingGuaranteeRequests: PendingGuaranteeRequest[];
  officerActiveLoans: CircleLoanRow[];
  guarantorCandidates: GuarantorCandidate[];
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
          Interest-free loans from the table banking pool. Optionally ask fellow members to
          guarantee (kafala) your request — officers wait for those accepts before approving.
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
        {guarantorCandidates.length > 0 ? (
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="guarantorUserIds">Ask members to guarantee (optional)</Label>
            <select
              id="guarantorUserIds"
              name="guarantorUserIds"
              multiple
              size={Math.min(6, Math.max(3, guarantorCandidates.length))}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              {guarantorCandidates.map((c) => (
                <option key={c.userId} value={c.userId}>
                  {c.label}
                </option>
              ))}
            </select>
            <p className="text-xs text-muted-foreground">
              Hold Ctrl/Cmd to select more than one. Guarantors must accept before approval.
            </p>
          </div>
        ) : null}
        <Button type="submit" className="min-h-11 w-full sm:w-fit sm:col-span-2">
          Request loan
        </Button>
      </form>

      {pendingGuaranteeRequests.length > 0 ? (
        <div className="space-y-3">
          <h3 className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
            Guarantee requests for you
          </h3>
          <ul className="divide-y divide-border rounded-xl border border-border bg-card">
            {pendingGuaranteeRequests.map((req) => (
              <li
                key={req.id}
                className="flex flex-wrap items-center justify-between gap-3 p-4"
              >
                <div>
                  <p className="font-medium">{req.borrowerName}</p>
                  <p className="text-sm text-muted-foreground">
                    {formatCurrency(req.amount, req.currency)} · {req.purpose}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Accepting means you stand as kafala if they default (circle record + notice —
                    no automatic wallet debit).
                  </p>
                </div>
                <div className="flex gap-2">
                  <form action={respondQardGuaranteeFormAction}>
                    <input type="hidden" name="guaranteeId" value={req.id} />
                    <input type="hidden" name="slug" value={slug} />
                    <input type="hidden" name="accept" value="true" />
                    <Button type="submit" size="sm">
                      Accept
                    </Button>
                  </form>
                  <form action={respondQardGuaranteeFormAction}>
                    <input type="hidden" name="guaranteeId" value={req.id} />
                    <input type="hidden" name="slug" value={slug} />
                    <input type="hidden" name="accept" value="false" />
                    <Button type="submit" size="sm" variant="destructive">
                      Decline
                    </Button>
                  </form>
                </div>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {canApprove && pendingApprovals.length > 0 ? (
        <div className="space-y-3">
          <h3 className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
            Pending approvals
          </h3>
          <ul className="divide-y divide-border rounded-xl border border-border bg-card">
            {pendingApprovals.map((loan) => {
              const pendingGuarantees = loan.guarantees.filter((g) => g.status === 'pending').length;
              const acceptedGuarantees = loan.guarantees.filter(
                (g) => g.status === 'accepted',
              ).length;
              const canApproveLoan =
                Boolean(loan.agreementAcceptedAt) &&
                pendingGuarantees === 0 &&
                (loan.guarantees.length === 0 || acceptedGuarantees > 0);
              return (
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
                      {' · '}
                      {guaranteeSummary(loan.guarantees)}
                    </p>
                    {loan.guarantees.length > 0 ? (
                      <p className="mt-1 text-xs text-muted-foreground">
                        {loan.guarantees
                          .map((g) => `${g.guarantorName} (${g.status})`)
                          .join(', ')}
                      </p>
                    ) : null}
                  </div>
                  <div className="flex gap-2">
                    <form action={decideQardFormAction}>
                      <input type="hidden" name="loanId" value={loan.id} />
                      <input type="hidden" name="slug" value={slug} />
                      <input type="hidden" name="approve" value="true" />
                      <Button type="submit" size="sm" disabled={!canApproveLoan}>
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
              );
            })}
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
                      {' · '}
                      {guaranteeSummary(loan.guarantees)}
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

      {canApprove && officerActiveLoans.length > 0 ? (
        <div className="space-y-3">
          <h3 className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
            Active loans (officer)
          </h3>
          <ul className="divide-y divide-border rounded-xl border border-border bg-card">
            {officerActiveLoans.map((loan) => (
              <li
                key={loan.id}
                className="flex flex-wrap items-center justify-between gap-3 p-4"
              >
                <div>
                  <p className="font-medium">{loan.purpose}</p>
                  <p className="text-sm text-muted-foreground">
                    {formatCurrency(loan.amount - loan.amountRepaid, loan.currency)} remaining
                    {loan.dueDate ? ` · due ${loan.dueDate}` : ''}
                    {' · '}
                    {guaranteeSummary(loan.guarantees)}
                  </p>
                </div>
                <form action={markQardDefaultedFormAction}>
                  <input type="hidden" name="loanId" value={loan.id} />
                  <input type="hidden" name="slug" value={slug} />
                  <Button type="submit" size="sm" variant="outline">
                    Mark defaulted
                  </Button>
                </form>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}
