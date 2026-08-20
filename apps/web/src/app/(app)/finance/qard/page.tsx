import Link from 'next/link';
import type { Route } from 'next';
import { redirect } from 'next/navigation';
import { formatCurrency } from '@jamiya/shared';
import { Button, Input, Label, Textarea } from '@jamiya/ui';
import { createClient } from '@/lib/supabase/server';
import {
  acceptQardAgreementFormAction,
  decideQardFormAction,
  repayQardFormAction,
  requestQardFormAction,
  respondQardGuaranteeFormAction,
} from '@/features/finance/actions';
import { EmptyState } from '@/features/dashboard/components/empty-state';

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

type Props = {
  searchParams?: Promise<{ jamiyaId?: string }>;
};

export default async function QardPage({ searchParams }: Props) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login?next=/finance/qard');

  const params = (await searchParams) ?? {};
  const preferredJamiyaId = params.jamiyaId?.trim() || '';

  const [
    { data: loansData },
    { data: membershipsData },
    { data: pendingData },
    { data: pendingGuaranteeData },
  ] = await Promise.all([
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
    supabase
      .from('qard_guarantees')
      .select(
        'id, loan_id, status, loan:qard_loans(id, amount, currency, purpose, status, borrower_id)',
      )
      .eq('guarantor_user_id', user.id)
      .eq('status', 'pending')
      .limit(30),
  ]);

  const loans = (loansData ?? []) as unknown as Loan[];
  const memberships = (membershipsData ?? []) as unknown as Membership[];
  const defaultJamiyaId = memberships.some((m) => m.jamiya_id === preferredJamiyaId)
    ? preferredJamiyaId
    : memberships[0]?.jamiya_id ?? '';
  const officerCircleIds = new Set(
    memberships
      .filter((m) => ['circle_admin', 'treasurer', 'chair'].includes(m.role))
      .map((m) => m.jamiya_id),
  );
  const pendingForOfficer = ((pendingData ?? []) as unknown as Loan[]).filter((loan) =>
    officerCircleIds.has(loan.jamiya_id),
  );
  const hasActiveRepay = loans.some((loan) => loan.status === 'active');

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

  const pendingGuarantees = (
    (pendingGuaranteeData ?? []) as unknown as Array<{
      id: string;
      loan:
        | { amount: number | string; currency: string; purpose: string; status: string }
        | Array<{ amount: number | string; currency: string; purpose: string; status: string }>
        | null;
    }>
  ).filter((row) => {
    const loan = Array.isArray(row.loan) ? row.loan[0] : row.loan;
    return loan?.status === 'requested';
  });

  return (
    <div className="space-y-10">
      <div>
        <p className="text-sm font-medium uppercase tracking-[0.16em] text-accent">
          <Link href={'/finance' as Route} className="hover:text-primary">
            Finance
          </Link>
        </p>
        <h1 className="mt-2 font-[family-name:var(--font-display)] text-4xl font-semibold">
          Qard Hassan
        </h1>
        <p className="mt-2 max-w-2xl text-muted-foreground">
          Interest-free circle loans. Cap is 50% of your paid contributions in that circle
          (minimum KES 5,000 if you have no paid history yet).
        </p>
      </div>

      {memberships.length === 0 ? (
        <EmptyState
          title="Join a circle first"
          description="Qard Hassan is available inside an active circle. Create or join one, then return here."
          actionLabel="Go to Circles"
          actionHref={'/circles' as Route}
        />
      ) : null}

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

      {pendingGuarantees.length > 0 ? (
        <section className="space-y-3">
          <h2 className="font-[family-name:var(--font-display)] text-2xl font-semibold">
            Guarantee requests for you
          </h2>
          <ul className="divide-y divide-border border-y border-border">
            {pendingGuarantees.map((row) => {
              const loan = Array.isArray(row.loan) ? row.loan[0] : row.loan;
              if (!loan) return null;
              return (
                <li
                  key={row.id}
                  className="flex flex-wrap items-center justify-between gap-4 py-5"
                >
                  <div>
                    <p className="font-medium">{loan.purpose}</p>
                    <p className="text-sm text-muted-foreground">
                      {formatCurrency(Number(loan.amount), loan.currency)} · kafala request
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <form action={respondQardGuaranteeFormAction}>
                      <input type="hidden" name="guaranteeId" value={row.id} />
                      <input type="hidden" name="accept" value="true" />
                      <Button type="submit" size="sm" className="min-h-11">
                        Accept
                      </Button>
                    </form>
                    <form action={respondQardGuaranteeFormAction}>
                      <input type="hidden" name="guaranteeId" value={row.id} />
                      <input type="hidden" name="accept" value="false" />
                      <Button type="submit" size="sm" variant="destructive" className="min-h-11">
                        Decline
                      </Button>
                    </form>
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}

      {memberships.length > 0 ? (
        <form
          action={requestQardFormAction}
          className="max-w-xl space-y-4 rounded-xl border border-border bg-card p-6"
        >
          <h2 className="font-[family-name:var(--font-display)] text-2xl font-semibold">
            Request a loan
          </h2>
          <div className="space-y-2">
            <Label htmlFor="jamiyaId">Circle</Label>
            <select
              id="jamiyaId"
              name="jamiyaId"
              required
              defaultValue={defaultJamiyaId}
              className="flex h-11 w-full rounded-md border border-input bg-background px-3 text-sm"
            >
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
          <Button type="submit" className="min-h-11">
            Submit request
          </Button>
        </form>
      ) : null}

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
                      className="min-h-11"
                      disabled={!loan.agreement_accepted_at}
                    >
                      Approve
                    </Button>
                  </form>
                  <form action={decideQardFormAction}>
                    <input type="hidden" name="loanId" value={loan.id} />
                    <input type="hidden" name="approve" value="false" />
                    <Button type="submit" size="sm" variant="destructive" className="min-h-11">
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
        <div className="flex flex-wrap items-end justify-between gap-3">
          <h2 className="font-[family-name:var(--font-display)] text-2xl font-semibold">
            Your loans
          </h2>
          {hasActiveRepay ? (
            <Button asChild variant="outline" size="sm" className="min-h-11">
              <Link href={'/wallet#top-up' as Route}>Top up Money</Link>
            </Button>
          ) : null}
        </div>
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
                      <Button type="submit" size="sm" className="min-h-11">
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
                    <form
                      action={repayQardFormAction}
                      className="flex flex-wrap items-center gap-2"
                    >
                      <input type="hidden" name="loanId" value={loan.id} />
                      <Input
                        name="amount"
                        type="number"
                        min="1"
                        max={due}
                        placeholder="Repay"
                        required
                        className="h-11 w-28"
                      />
                      <Button type="submit" size="sm" className="min-h-11">
                        Repay
                      </Button>
                    </form>
                  ) : null}
                </li>
              );
            })}
          </ul>
        ) : (
          <EmptyState
            title="No Qard requests yet"
            description="Request an interest-free loan from a circle where you are an active member."
          />
        )}
      </section>
    </div>
  );
}
