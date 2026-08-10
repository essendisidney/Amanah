import { redirect } from 'next/navigation';
import { formatCurrency } from '@jamiya/shared';
import { Button, Input, Label, Textarea } from '@jamiya/ui';
import { createClient } from '@/lib/supabase/server';
import {
  acceptQardAgreementFormAction,
  decideQardFormAction,
  repayQardFormAction,
  requestQardFormAction,
} from '@/features/finance/actions';

export const dynamic = 'force-dynamic';

type Loan = {
  id: string;
  jamiya_id: string;
  borrower_id: string;
  amount: number | string;
  amount_repaid: number | string;
  currency: string;
  purpose: string;
  status: string;
  due_date: string | null;
  agreement_accepted_at?: string | null;
  agreement_signer_name?: string | null;
};

type Membership = {
  jamiya_id: string;
  role: string;
  jamiya: { name: string } | null;
};

export default async function QardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login?next=/finance/qard');

  const [{ data: loansData }, { data: membershipsData }, { data: pendingData }] =
    await Promise.all([
      supabase
        .from('qard_loans')
        .select(
          'id, jamiya_id, borrower_id, amount, amount_repaid, currency, purpose, status, due_date, agreement_accepted_at, agreement_signer_name',
        )
        .eq('borrower_id', user.id)
        .order('created_at', { ascending: false }),
      supabase
        .from('members')
        .select('jamiya_id, role, jamiya:jamiyas(name)')
        .eq('user_id', user.id)
        .eq('status', 'active'),
      supabase
        .from('qard_loans')
        .select(
          'id, jamiya_id, borrower_id, amount, amount_repaid, currency, purpose, status, due_date, agreement_accepted_at',
        )
        .eq('status', 'requested')
        .order('created_at', { ascending: false })
        .limit(50),
    ]);

  const loans = (loansData ?? []) as unknown as Loan[];
  const memberships = (membershipsData ?? []) as unknown as Membership[];
  const officerCircleIds = new Set(
    memberships
      .filter((m) => ['circle_admin', 'treasurer', 'chair'].includes(m.role))
      .map((m) => m.jamiya_id),
  );
  const pendingForOfficer = ((pendingData ?? []) as unknown as Loan[]).filter((loan) =>
    officerCircleIds.has(loan.jamiya_id),
  );

  const caps = await Promise.all(
    memberships.map(async (m) => {
      const { data } = await supabase.rpc('qard_cap_for_jamiya', {
        p_jamiya_id: m.jamiya_id,
      });
      const result = data as { ok?: boolean; cap?: number; paid_total?: number } | null;
      return {
        jamiyaId: m.jamiya_id,
        name: m.jamiya?.name ?? 'Circle',
        cap: result?.ok ? Number(result.cap ?? 0) : null,
        paid: result?.ok ? Number(result.paid_total ?? 0) : null,
      };
    }),
  );

  return (
    <div className="space-y-10">
      <div>
        <p className="text-sm font-medium uppercase tracking-[0.16em] text-accent">
          Interest-free lending
        </p>
        <h1 className="mt-2 font-[family-name:var(--font-display)] text-4xl font-semibold">
          Qard Hassan
        </h1>
        <p className="mt-2 text-muted-foreground">
          Cap is 50% of your paid contributions in that circle (minimum KES 5,000 if you have no
          paid history yet).
        </p>
      </div>

      {caps.length > 0 ? (
        <ul className="grid gap-3 sm:grid-cols-2">
          {caps.map((cap) => (
            <li key={cap.jamiyaId} className="rounded-xl border border-border bg-card px-4 py-3">
              <p className="text-sm font-medium">{cap.name}</p>
              <p className="mt-1 text-sm text-muted-foreground">
                {cap.cap != null
                  ? `Your cap: ${formatCurrency(cap.cap, 'KES')} (paid ${formatCurrency(cap.paid ?? 0, 'KES')})`
                  : 'Cap unavailable'}
              </p>
            </li>
          ))}
        </ul>
      ) : null}

      <form action={requestQardFormAction} className="max-w-xl space-y-4 border border-border bg-card p-6">
        <h2 className="font-[family-name:var(--font-display)] text-2xl font-semibold">
          Request a loan
        </h2>
        <div className="space-y-2">
          <Label htmlFor="jamiyaId">Circle</Label>
          <select
            id="jamiyaId"
            name="jamiyaId"
            required
            className="h-10 w-full border border-input bg-background px-3"
          >
            <option value="">Choose circle</option>
            {memberships.map((m) => (
              <option key={m.jamiya_id} value={m.jamiya_id}>
                {m.jamiya?.name ?? 'Circle'}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="amount">Amount (KES)</Label>
          <Input id="amount" name="amount" type="number" min="100" required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="installments">Monthly installments</Label>
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
        <div className="space-y-2">
          <Label htmlFor="purpose">Purpose</Label>
          <Textarea id="purpose" name="purpose" minLength={5} required />
        </div>
        <Button type="submit">Submit request</Button>
      </form>

      {pendingForOfficer.length > 0 ? (
        <section>
          <h2 className="font-[family-name:var(--font-display)] text-2xl font-semibold">
            Pending approvals
          </h2>
          <ul className="mt-4 divide-y divide-border border-y border-border">
            {pendingForOfficer.map((loan) => (
              <li
                key={loan.id}
                className="flex flex-wrap items-center justify-between gap-4 py-5"
              >
                <div>
                  <p className="font-medium">{loan.purpose}</p>
                  <p className="text-sm text-muted-foreground">
                    {formatCurrency(Number(loan.amount), loan.currency)} · requested
                    {loan.agreement_accepted_at
                      ? ' · agreement signed'
                      : ' · awaiting borrower agreement'}
                  </p>
                </div>
                <div className="flex gap-2">
                  <form action={decideQardFormAction}>
                    <input type="hidden" name="loanId" value={loan.id} />
                    <input type="hidden" name="approve" value="true" />
                    <Button
                      type="submit"
                      size="sm"
                      disabled={!loan.agreement_accepted_at}
                    >
                      Approve
                    </Button>
                  </form>
                  <form action={decideQardFormAction}>
                    <input type="hidden" name="loanId" value={loan.id} />
                    <input type="hidden" name="approve" value="false" />
                    <Button type="submit" size="sm" variant="destructive">
                      Reject
                    </Button>
                  </form>
                </div>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section>
        <h2 className="font-[family-name:var(--font-display)] text-2xl font-semibold">
          Your loans
        </h2>
        {loans.length ? (
          <ul className="mt-4 divide-y divide-border border-y border-border">
            {loans.map((loan) => {
              const due = Number(loan.amount) - Number(loan.amount_repaid);
              return (
                <li
                  key={loan.id}
                  className="flex flex-wrap items-center justify-between gap-4 py-5"
                >
                  <div>
                    <p className="font-medium">{loan.purpose}</p>
                    <p className="text-sm text-muted-foreground">
                      {loan.status} · {formatCurrency(due, loan.currency)} remaining
                      {loan.due_date ? ` · due ${loan.due_date}` : ''}
                    </p>
                  </div>
                  {loan.status === 'requested' && !loan.agreement_accepted_at ? (
                    <form
                      action={acceptQardAgreementFormAction}
                      className="max-w-md space-y-2 rounded-md border border-border p-3"
                    >
                      <input type="hidden" name="loanId" value={loan.id} />
                      <p className="text-xs text-muted-foreground">
                        Qard Hassan facility agreement (v1): interest-free loan repaid in agreed
                        installments. I accept the circle rules and repayment schedule.
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
                  {loan.status === 'requested' && loan.agreement_accepted_at ? (
                    <p className="text-xs text-muted-foreground">
                      Agreement signed
                      {loan.agreement_signer_name ? ` by ${loan.agreement_signer_name}` : ''}
                    </p>
                  ) : null}
                  {loan.status === 'active' ? (
                    <form action={repayQardFormAction} className="flex items-center gap-2">
                      <input type="hidden" name="loanId" value={loan.id} />
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
          <p className="mt-3 text-muted-foreground">You have no Qard requests.</p>
        )}
      </section>
    </div>
  );
}
