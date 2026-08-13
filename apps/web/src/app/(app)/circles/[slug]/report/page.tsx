import Link from 'next/link';
import type { Route } from 'next';
import { notFound, redirect } from 'next/navigation';
import { formatCurrency, formatDate } from '@jamiya/shared';
import { Button } from '@jamiya/ui';
import { createClient } from '@/lib/supabase/server';
import { callRpc } from '@/lib/supabase/rpc';
import { PrintReportButton } from '@/features/circles/components/print-report-button';

export const dynamic = 'force-dynamic';

type Props = { params: Promise<{ slug: string }> };

export default async function CirclePrintReportPage({ params }: Props) {
  const { slug } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/login?next=/circles/${slug}/report`);

  const { data: jamiyaData } = await supabase
    .from('jamiyas')
    .select('id, name, slug, segment, currency, contribution_amount, member_count, status')
    .eq('slug', slug)
    .maybeSingle();
  const jamiya = jamiyaData as unknown as {
    id: string;
    name: string;
    slug: string;
    segment: string;
    currency: string;
    contribution_amount: number | string;
    member_count: number;
    status: string;
  } | null;
  if (!jamiya) notFound();

  const { data: membershipData } = await supabase
    .from('members')
    .select('role, status')
    .eq('jamiya_id', jamiya.id)
    .eq('user_id', user.id)
    .maybeSingle();
  const membership = membershipData as unknown as { role: string; status: string } | null;
  if (
    !membership ||
    !['circle_admin', 'chair', 'treasurer', 'secretary'].includes(membership.role)
  ) {
    notFound();
  }

  const { data: members } = await supabase
    .from('members')
    .select('user_id, role, status, payout_position, joined_at')
    .eq('jamiya_id', jamiya.id)
    .order('payout_position');
  const memberRows = (members ?? []) as unknown as Array<{
    user_id: string;
    role: string;
    status: string;
    payout_position: number | null;
    joined_at: string | null;
  }>;
  const ids = memberRows.map((m) => m.user_id);
  const { data: profiles } = ids.length
    ? await supabase.from('profiles').select('id, full_name, email, mpesa_phone').in('id', ids)
    : { data: [] };
  const profileById = new Map(
    (
      (profiles ?? []) as unknown as Array<{
        id: string;
        full_name: string | null;
        email: string | null;
        mpesa_phone: string | null;
      }>
    ).map((p) => [p.id, p]),
  );

  const [{ data: contribs }, { data: snapRaw }, { data: glRaw }, { data: accounts }] =
    await Promise.all([
      supabase.from('contributions').select('status, amount, currency').eq('jamiya_id', jamiya.id),
      callRpc('treasury_snapshot', { p_jamiya_id: jamiya.id }),
      callRpc('circle_gl_pack', { p_jamiya_id: jamiya.id }),
      supabase
        .from('circle_bank_accounts')
        .select('name, account_kind, balance, currency')
        .eq('jamiya_id', jamiya.id)
        .eq('is_active', true)
        .order('name'),
    ]);
  const contribRows = (contribs ?? []) as unknown as Array<{
    status: string;
    amount: number | string;
  }>;
  const paid = contribRows.filter((c) => c.status === 'paid').length;
  const late = contribRows.filter((c) => c.status === 'late').length;
  const pending = contribRows.filter((c) => c.status === 'pending').length;
  const snap = snapRaw as Record<string, unknown> | null;
  const gl = glRaw as {
    ok?: boolean;
    income_statement?: {
      income_total?: number;
      expense_total?: number;
      surplus?: number;
      income_by_category?: Array<{ category: string; amount: number }>;
      expense_by_category?: Array<{ category: string; amount: number }>;
    };
    cash_flow?: {
      inflows?: number;
      outflows?: number;
      net?: number;
      closing_cash?: number;
    };
    balance_sheet?: {
      assets?: {
        cash?: number;
        investments?: number;
        loans_outstanding?: number;
        total?: number;
      };
      equity_liabilities?: {
        share_capital?: number;
        retained_surplus?: number;
        total?: number;
      };
    };
  } | null;

  return (
    <main className="mx-auto max-w-3xl px-6 py-10 print:px-0 print:py-0">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3 print:hidden">
        <Button asChild variant="outline" size="sm">
          <Link href={`/circles/${slug}` as Route}>Back to circle</Link>
        </Button>
        <div className="flex gap-2">
          <Button asChild variant="outline" size="sm">
            <Link href={`/circles/${slug}/treasury` as Route}>Treasury</Link>
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link href={`/circles/${slug}/shares` as Route}>Shares</Link>
          </Button>
          <PrintReportButton />
        </div>
      </div>
      <header className="border-b border-border pb-4">
        <p className="text-sm uppercase tracking-wide text-muted-foreground">Amanah circle report</p>
        <h1 className="mt-1 font-[family-name:var(--font-display)] text-3xl font-semibold">
          {jamiya.name}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {jamiya.segment.replaceAll('_', ' ')} · {jamiya.status} ·{' '}
          {formatCurrency(Number(jamiya.contribution_amount), jamiya.currency)} contribution ·{' '}
          {jamiya.member_count} members · Generated {formatDate(new Date().toISOString())}
        </p>
      </header>

      <section className="mt-6">
        <h2 className="font-[family-name:var(--font-display)] text-xl font-semibold">
          Contribution summary
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Paid {paid} · Pending {pending} · Late {late} (of {contribRows.length} rows)
          {snap?.ok
            ? ` · Paid ${formatCurrency(Number(snap.contributions_paid), jamiya.currency)} · Outstanding ${formatCurrency(Number(snap.contributions_outstanding), jamiya.currency)}`
            : ''}
        </p>
      </section>

      {snap?.ok ? (
        <section className="mt-8 space-y-2">
          <h2 className="font-[family-name:var(--font-display)] text-xl font-semibold">
            Treasury summary
          </h2>
          <ul className="text-sm text-muted-foreground">
            <li>Cash available: {formatCurrency(Number(snap.cash_available), jamiya.currency)}</li>
            <li>Income: {formatCurrency(Number(snap.income_total), jamiya.currency)}</li>
            <li>Expenses: {formatCurrency(Number(snap.expense_total), jamiya.currency)}</li>
            <li>
              Fines open / paid:{' '}
              {formatCurrency(Number(snap.fines_open), jamiya.currency)} /{' '}
              {formatCurrency(Number(snap.fines_paid), jamiya.currency)}
            </li>
            <li>
              Loans disbursed / repaid:{' '}
              {formatCurrency(Number(snap.loans_disbursed), jamiya.currency)} /{' '}
              {formatCurrency(Number(snap.loans_repaid), jamiya.currency)}
            </li>
            <li>
              Investments: {formatCurrency(Number(snap.investments_value), jamiya.currency)}
            </li>
          </ul>
        </section>
      ) : null}

      {gl?.ok ? (
        <>
          <section className="mt-8 space-y-2">
            <h2 className="font-[family-name:var(--font-display)] text-xl font-semibold">
              Income statement
            </h2>
            <ul className="text-sm text-muted-foreground">
              <li>
                Income:{' '}
                {formatCurrency(Number(gl.income_statement?.income_total ?? 0), jamiya.currency)}
              </li>
              <li>
                Expenses:{' '}
                {formatCurrency(Number(gl.income_statement?.expense_total ?? 0), jamiya.currency)}
              </li>
              <li>
                Surplus / (deficit):{' '}
                {formatCurrency(Number(gl.income_statement?.surplus ?? 0), jamiya.currency)}
              </li>
            </ul>
            {(gl.income_statement?.expense_by_category?.length ?? 0) > 0 ? (
              <ul className="mt-2 text-xs text-muted-foreground">
                {gl.income_statement!.expense_by_category!.map((row) => (
                  <li key={row.category}>
                    Expense · {row.category}: {formatCurrency(Number(row.amount), jamiya.currency)}
                  </li>
                ))}
              </ul>
            ) : null}
          </section>

          <section className="mt-8 space-y-2">
            <h2 className="font-[family-name:var(--font-display)] text-xl font-semibold">
              Cash flow
            </h2>
            <ul className="text-sm text-muted-foreground">
              <li>
                Inflows: {formatCurrency(Number(gl.cash_flow?.inflows ?? 0), jamiya.currency)}
              </li>
              <li>
                Outflows: {formatCurrency(Number(gl.cash_flow?.outflows ?? 0), jamiya.currency)}
              </li>
              <li>Net: {formatCurrency(Number(gl.cash_flow?.net ?? 0), jamiya.currency)}</li>
              <li>
                Closing cash:{' '}
                {formatCurrency(Number(gl.cash_flow?.closing_cash ?? 0), jamiya.currency)}
              </li>
            </ul>
          </section>

          <section className="mt-8 space-y-2">
            <h2 className="font-[family-name:var(--font-display)] text-xl font-semibold">
              Balance sheet
            </h2>
            <div className="grid gap-4 text-sm text-muted-foreground sm:grid-cols-2">
              <div>
                <p className="font-medium text-foreground">Assets</p>
                <ul className="mt-1 space-y-1">
                  <li>
                    Cash: {formatCurrency(Number(gl.balance_sheet?.assets?.cash ?? 0), jamiya.currency)}
                  </li>
                  <li>
                    Investments:{' '}
                    {formatCurrency(
                      Number(gl.balance_sheet?.assets?.investments ?? 0),
                      jamiya.currency,
                    )}
                  </li>
                  <li>
                    Loans outstanding:{' '}
                    {formatCurrency(
                      Number(gl.balance_sheet?.assets?.loans_outstanding ?? 0),
                      jamiya.currency,
                    )}
                  </li>
                  <li className="font-medium text-foreground">
                    Total:{' '}
                    {formatCurrency(Number(gl.balance_sheet?.assets?.total ?? 0), jamiya.currency)}
                  </li>
                </ul>
              </div>
              <div>
                <p className="font-medium text-foreground">Equity</p>
                <ul className="mt-1 space-y-1">
                  <li>
                    Share capital:{' '}
                    {formatCurrency(
                      Number(gl.balance_sheet?.equity_liabilities?.share_capital ?? 0),
                      jamiya.currency,
                    )}
                  </li>
                  <li>
                    Retained surplus:{' '}
                    {formatCurrency(
                      Number(gl.balance_sheet?.equity_liabilities?.retained_surplus ?? 0),
                      jamiya.currency,
                    )}
                  </li>
                  <li className="font-medium text-foreground">
                    Total:{' '}
                    {formatCurrency(
                      Number(gl.balance_sheet?.equity_liabilities?.total ?? 0),
                      jamiya.currency,
                    )}
                  </li>
                </ul>
              </div>
            </div>
            <p className="text-xs text-muted-foreground print:hidden">
              Print / Save as PDF from the browser for a shareable pack.
            </p>
          </section>
        </>
      ) : null}

      <section className="mt-8">
        <h2 className="font-[family-name:var(--font-display)] text-xl font-semibold">
          Account balances
        </h2>
        {!(accounts as unknown[] | null)?.length ? (
          <p className="mt-2 text-sm text-muted-foreground">No circle accounts seeded yet.</p>
        ) : (
          <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
            {((accounts ?? []) as Array<{
              name: string;
              account_kind: string;
              balance: number | string;
              currency: string;
            }>).map((a) => (
              <li key={a.name}>
                {a.name} ({a.account_kind.replaceAll('_', ' ')}):{' '}
                {formatCurrency(Number(a.balance), a.currency)}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mt-8">
        <h2 className="font-[family-name:var(--font-display)] text-xl font-semibold">Members</h2>
        <table className="mt-3 w-full border-collapse text-left text-sm">
          <thead>
            <tr className="border-b border-border">
              <th className="py-2 pr-2">Name</th>
              <th className="py-2 pr-2">Role</th>
              <th className="py-2 pr-2">Status</th>
              <th className="py-2 pr-2">Position</th>
              <th className="py-2">Phone</th>
            </tr>
          </thead>
          <tbody>
            {memberRows.map((member) => {
              const profile = profileById.get(member.user_id);
              return (
                <tr key={member.user_id} className="border-b border-border/70">
                  <td className="py-2 pr-2">{profile?.full_name ?? profile?.email ?? '—'}</td>
                  <td className="py-2 pr-2 capitalize">{member.role.replaceAll('_', ' ')}</td>
                  <td className="py-2 pr-2">{member.status}</td>
                  <td className="py-2 pr-2">{member.payout_position ?? '—'}</td>
                  <td className="py-2">{profile?.mpesa_phone ?? '—'}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>
    </main>
  );
}
