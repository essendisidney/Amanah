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
import type { Dictionary } from '@/i18n/dictionaries';
import { t } from '@/i18n/dictionaries';

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

type LoanLabels = Dictionary['loans'];

function guaranteeSummary(guarantees: CircleLoanGuarantee[], labels: LoanLabels): string {
  if (!guarantees.length) return labels.noGuarantors;
  const accepted = guarantees.filter((g) => g.status === 'accepted').length;
  const pending = guarantees.filter((g) => g.status === 'pending').length;
  const declined = guarantees.filter((g) => g.status === 'declined').length;
  const parts = [`${accepted} ${labels.accepted}`];
  if (pending) parts.push(`${pending} ${labels.pending}`);
  if (declined) parts.push(`${declined} ${labels.declined}`);
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
  labels,
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
  labels: LoanLabels;
}) {
  return (
    <section className="space-y-5">
      <div>
        <h2 className="font-[family-name:var(--font-display)] text-xl font-semibold">
          {labels.title}
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {labels.intro}
          {qardCap != null
            ? ` ${labels.capPrefix} ${formatCurrency(qardCap, currency)}.`
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
          <Label htmlFor="purpose">{labels.purpose}</Label>
          <Textarea id="purpose" name="purpose" minLength={5} required rows={2} />
        </div>
        <div className="space-y-1">
          <Label htmlFor="loanAmount">{t(labels.amount, { currency })}</Label>
          <Input id="loanAmount" name="amount" type="number" min="100" required />
        </div>
        <div className="space-y-1">
          <Label htmlFor="installments">{labels.installments}</Label>
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
            <Label htmlFor="guarantorUserIds">{labels.guarantorsLabel}</Label>
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
            <p className="text-xs text-muted-foreground">{labels.guarantorsHint}</p>
          </div>
        ) : null}
        <Button type="submit" className="min-h-11 w-full sm:w-fit sm:col-span-2">
          {labels.requestLoan}
        </Button>
      </form>

      {pendingGuaranteeRequests.length > 0 ? (
        <div className="space-y-3">
          <h3 className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
            {labels.guaranteeInbox}
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
                  <p className="mt-1 text-xs text-muted-foreground">{labels.guaranteeAcceptNote}</p>
                </div>
                <div className="flex gap-2">
                  <form action={respondQardGuaranteeFormAction}>
                    <input type="hidden" name="guaranteeId" value={req.id} />
                    <input type="hidden" name="slug" value={slug} />
                    <input type="hidden" name="accept" value="true" />
                    <Button type="submit" size="sm">
                      {labels.accept}
                    </Button>
                  </form>
                  <form action={respondQardGuaranteeFormAction}>
                    <input type="hidden" name="guaranteeId" value={req.id} />
                    <input type="hidden" name="slug" value={slug} />
                    <input type="hidden" name="accept" value="false" />
                    <Button type="submit" size="sm" variant="destructive">
                      {labels.decline}
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
            {labels.pendingApprovals}
          </h3>
          <ul className="divide-y divide-border rounded-xl border border-border bg-card">
            {pendingApprovals.map((loan) => {
              const pendingGuarantees = loan.guarantees.filter((g) => g.status === 'pending').length;
              const acceptedGuarantees = loan.guarantees.filter((g) => g.status === 'accepted').length;
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
                        ? ` · ${labels.agreementSigned}`
                        : ` · ${labels.awaitingAgreement}`}
                      {' · '}
                      {guaranteeSummary(loan.guarantees, labels)}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <form action={decideQardFormAction}>
                      <input type="hidden" name="loanId" value={loan.id} />
                      <input type="hidden" name="slug" value={slug} />
                      <input type="hidden" name="approve" value="true" />
                      <Button type="submit" size="sm" disabled={!canApproveLoan}>
                        {labels.approve}
                      </Button>
                    </form>
                    <form action={decideQardFormAction}>
                      <input type="hidden" name="loanId" value={loan.id} />
                      <input type="hidden" name="slug" value={slug} />
                      <input type="hidden" name="approve" value="false" />
                      <Button type="submit" size="sm" variant="destructive">
                        {labels.reject}
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
          {labels.yourLoans}
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
                      {loan.status} · {formatCurrency(due, loan.currency)} {labels.remaining}
                      {loan.dueDate ? ` · due ${loan.dueDate}` : ''}
                      {' · '}
                      {guaranteeSummary(loan.guarantees, labels)}
                    </p>
                  </div>
                  {loan.status === 'requested' && !loan.agreementAcceptedAt ? (
                    <form
                      action={acceptQardAgreementFormAction}
                      className="max-w-sm space-y-2 rounded-md border border-border p-3"
                    >
                      <input type="hidden" name="loanId" value={loan.id} />
                      <input type="hidden" name="slug" value={slug} />
                      <p className="text-xs text-muted-foreground">{labels.acceptAgreementHint}</p>
                      <Input
                        name="signerName"
                        placeholder={labels.signerPlaceholder}
                        required
                        minLength={2}
                      />
                      <Button type="submit" size="sm">
                        {labels.acceptAgreement}
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
                        placeholder={labels.repay}
                        required
                        className="w-28"
                      />
                      <Button type="submit" size="sm">
                        {labels.repay}
                      </Button>
                    </form>
                  ) : null}
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">{labels.noLoans}</p>
        )}
      </div>

      {canApprove && officerActiveLoans.length > 0 ? (
        <div className="space-y-3">
          <h3 className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
            {labels.activeOfficer}
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
                    {formatCurrency(loan.amount - loan.amountRepaid, loan.currency)} {labels.remaining}
                    {loan.dueDate ? ` · due ${loan.dueDate}` : ''}
                    {' · '}
                    {guaranteeSummary(loan.guarantees, labels)}
                  </p>
                </div>
                <form action={markQardDefaultedFormAction}>
                  <input type="hidden" name="loanId" value={loan.id} />
                  <input type="hidden" name="slug" value={slug} />
                  <Button type="submit" size="sm" variant="outline">
                    {labels.markDefaulted}
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
