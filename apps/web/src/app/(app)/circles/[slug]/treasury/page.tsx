import type { Metadata } from 'next';
import { AppPage } from '@/components/app-page';
import Link from 'next/link';
import type { Route } from 'next';
import { notFound, redirect } from 'next/navigation';
import { Button } from '@jamiya/ui';
import { createClient } from '@/lib/supabase/server';
import { callRpc } from '@/lib/supabase/rpc';
import { CircleNoticeBanner } from '@/features/circles/components/circle-notice-banner';
import { TreasuryPanel } from '@/features/circles/components/treasury-panel';
import { ensureTreasuryAction } from '@/features/circles/actions/treasury-actions';

export const metadata: Metadata = { title: 'Circle treasury' };
export const dynamic = 'force-dynamic';

const OFFICER_ROLES = new Set(['circle_admin', 'chair', 'treasurer']);

type Props = {
  params: Promise<{ slug: string }>;
  searchParams?: Promise<{ notice?: string; noticeType?: string }>;
};

export default async function CircleTreasuryPage({ params, searchParams }: Props) {
  const { slug } = await params;
  const notices = (await searchParams) ?? {};
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/phone?next=/circles/${slug}/treasury`);

  const { data: jamiyaData } = await supabase
    .from('jamiyas')
    .select(
      'id, name, slug, currency, late_contribution_penalty, missed_contribution_penalty, late_loan_penalty_fixed, late_loan_penalty_pct, payout_compliance_mode',
    )
    .eq('slug', slug)
    .maybeSingle();
  const jamiya = jamiyaData as {
    id: string;
    name: string;
    slug: string;
    currency: string;
    late_contribution_penalty?: number | string | null;
    missed_contribution_penalty?: number | string | null;
    late_loan_penalty_fixed?: number | string | null;
    late_loan_penalty_pct?: number | string | null;
    payout_compliance_mode?: string | null;
  } | null;
  if (!jamiya) notFound();

  const { data: membershipData } = await supabase
    .from('members')
    .select('id, role, status')
    .eq('jamiya_id', jamiya.id)
    .eq('user_id', user.id)
    .eq('status', 'active')
    .maybeSingle();
  const membership = membershipData as { id: string; role: string; status: string } | null;
  if (!membership) notFound();

  const canManage = OFFICER_ROLES.has(membership.role);

  await callRpc('ensure_circle_treasury', { p_jamiya_id: jamiya.id });

  const [
    { data: snapData },
    { data: accountsData },
    { data: catsData },
    { data: finesData },
    { data: invData },
    { data: membersData },
    { data: entriesData },
    { data: alertsData },
    { data: openPenaltiesData },
  ] = await Promise.all([
    callRpc('treasury_snapshot', { p_jamiya_id: jamiya.id }),
    supabase
      .from('circle_bank_accounts')
      .select('id, name, account_kind, account_number, balance, currency')
      .eq('jamiya_id', jamiya.id)
      .eq('is_active', true)
      .order('name'),
    supabase
      .from('circle_ledger_categories')
      .select('id, kind, name')
      .eq('jamiya_id', jamiya.id)
      .eq('is_active', true)
      .order('name'),
    supabase
      .from('fine_categories')
      .select('id, name, default_amount, currency')
      .eq('jamiya_id', jamiya.id)
      .eq('is_active', true)
      .order('name'),
    supabase
      .from('circle_investments')
      .select('id, name, status, principal, current_value, currency, started_on')
      .eq('jamiya_id', jamiya.id)
      .order('created_at', { ascending: false })
      .limit(40),
    supabase
      .from('members')
      .select('id, member_code, user_id, status')
      .eq('jamiya_id', jamiya.id)
      .in('status', ['active', 'suspended'])
      .order('created_at'),
    supabase
      .from('book_entries')
      .select('id, entry_type, amount, currency, effective_date, notes')
      .eq('jamiya_id', jamiya.id)
      .order('effective_date', { ascending: false })
      .limit(30),
    canManage
      ? supabase
          .from('circle_bank_alerts')
          .select('id, provider, amount, currency, direction, status, alert_text, created_at')
          .eq('jamiya_id', jamiya.id)
          .order('created_at', { ascending: false })
          .limit(15)
      : Promise.resolve({ data: [] as never[] }),
    canManage
      ? supabase
          .from('penalties')
          .select('id, member_id, kind, amount, currency, notes, assessed_at, status')
          .eq('jamiya_id', jamiya.id)
          .eq('status', 'open')
          .order('assessed_at', { ascending: false })
          .limit(50)
      : Promise.resolve({ data: [] as never[] }),
  ]);

  const snap = snapData as Record<string, unknown> | null;
  const snapshot =
    snap && snap.ok
      ? {
          cashAvailable: Number(snap.cash_available ?? 0),
          incomeTotal: Number(snap.income_total ?? 0),
          expenseTotal: Number(snap.expense_total ?? 0),
          finesOpen: Number(snap.fines_open ?? 0),
          finesPaid: Number(snap.fines_paid ?? 0),
          loansDisbursed: Number(snap.loans_disbursed ?? 0),
          loansRepaid: Number(snap.loans_repaid ?? 0),
          investmentsValue: Number(snap.investments_value ?? 0),
          contributionsPaid: Number(snap.contributions_paid ?? 0),
          contributionsOutstanding: Number(snap.contributions_outstanding ?? 0),
        }
      : null;

  const memberRows = (membersData ?? []) as Array<{
    id: string;
    member_code: string | null;
    user_id: string;
  }>;
  const userIds = memberRows.map((m) => m.user_id);
  const { data: profiles } = userIds.length
    ? await supabase.from('profiles').select('id, full_name, email').in('id', userIds)
    : { data: [] };
  const profileMap = new Map(
    ((profiles ?? []) as Array<{ id: string; full_name: string | null; email: string | null }>).map(
      (p) => [p.id, p],
    ),
  );

  return (
    <AppPage>
      <CircleNoticeBanner notice={notices.notice} noticeType={notices.noticeType} />

      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-medium uppercase tracking-[0.16em] text-accent">
            Online treasurer
          </p>
          <h1 className="mt-2 font-[family-name:var(--font-display)] text-3xl font-semibold">
            {jamiya.name} treasury
          </h1>
          <p className="mt-2 max-w-2xl text-muted-foreground">
            Chama cashbook — accounts, deposits, expenses, fines, investments, and backdated
            records in one place.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline" size="sm" className="min-h-11">
            <Link href={`/circles/${slug}` as Route}>Circle</Link>
          </Button>
          <Button asChild variant="outline" size="sm" className="min-h-11">
            <Link href={`/circles/${slug}/statement` as Route}>My statement</Link>
          </Button>
          {canManage && ((accountsData ?? []) as unknown[]).length === 0 ? (
            <form action={ensureTreasuryAction}>
              <input type="hidden" name="jamiyaId" value={jamiya.id} />
              <input type="hidden" name="slug" value={slug} />
              <Button type="submit" size="sm" className="min-h-11">
                Seed defaults
              </Button>
            </form>
          ) : null}
          <details className="relative">
            <summary className="inline-flex min-h-11 cursor-pointer list-none items-center rounded-md border border-border px-3 text-sm">
              More tools
            </summary>
            <div className="absolute right-0 z-20 mt-1 flex min-w-[10rem] flex-col gap-1 rounded-md border border-border bg-card p-2 shadow-md">
              <Link href={`/circles/${slug}/books` as Route} className="rounded px-2 py-1.5 text-sm hover:bg-muted">
                Member payments
              </Link>
              <Link href={`/circles/${slug}/shares` as Route} className="rounded px-2 py-1.5 text-sm hover:bg-muted">
                Shares
              </Link>
              <Link href={`/circles/${slug}/journal` as Route} className="rounded px-2 py-1.5 text-sm hover:bg-muted">
                Journal
              </Link>
              <Link href={`/circles/${slug}/invoices` as Route} className="rounded px-2 py-1.5 text-sm hover:bg-muted">
                Invoices
              </Link>
              <Link href={`/circles/${slug}/report` as Route} className="rounded px-2 py-1.5 text-sm hover:bg-muted">
                GL reports
              </Link>
              {canManage ? (
                <Link href={`/circles/${slug}/arrears` as Route} className="rounded px-2 py-1.5 text-sm hover:bg-muted">
                  Arrears
                </Link>
              ) : null}
            </div>
          </details>
        </div>
      </div>

      <TreasuryPanel
        jamiyaId={jamiya.id}
        slug={slug}
        currency={jamiya.currency}
        canManage={canManage}
        snapshot={snapshot}
        accounts={((accountsData ?? []) as Array<Record<string, unknown>>).map((a) => ({
          id: String(a.id),
          name: String(a.name),
          accountKind: String(a.account_kind),
          accountNumber: (a.account_number as string | null) ?? null,
          balance: Number(a.balance),
          currency: String(a.currency),
        }))}
        categories={((catsData ?? []) as Array<Record<string, unknown>>).map((c) => ({
          id: String(c.id),
          kind: String(c.kind),
          name: String(c.name),
        }))}
        fineCategories={((finesData ?? []) as Array<Record<string, unknown>>).map((f) => ({
          id: String(f.id),
          name: String(f.name),
          defaultAmount: Number(f.default_amount),
          currency: String(f.currency),
        }))}
        investments={((invData ?? []) as Array<Record<string, unknown>>).map((inv) => ({
          id: String(inv.id),
          name: String(inv.name),
          status: String(inv.status),
          principal: Number(inv.principal),
          currentValue: Number(inv.current_value),
          currency: String(inv.currency),
          startedOn: (inv.started_on as string | null) ?? null,
        }))}
        members={memberRows.map((m) => {
          const p = profileMap.get(m.user_id);
          return {
            id: m.id,
            label: p?.full_name || p?.email || m.user_id.slice(0, 8),
            memberCode: m.member_code,
          };
        })}
        recentEntries={((entriesData ?? []) as Array<Record<string, unknown>>).map((e) => ({
          id: String(e.id),
          entryType: String(e.entry_type),
          amount: Number(e.amount),
          currency: String(e.currency),
          effectiveDate: String(e.effective_date),
          notes: (e.notes as string | null) ?? null,
        }))}
        bankAlerts={((alertsData ?? []) as Array<Record<string, unknown>>).map((a) => ({
          id: String(a.id),
          provider: String(a.provider),
          amount: a.amount == null ? null : Number(a.amount),
          currency: String(a.currency),
          direction: (a.direction as string | null) ?? null,
          status: String(a.status),
          alertText: (a.alert_text as string | null) ?? null,
          createdAt: String(a.created_at),
        }))}
        openPenalties={((openPenaltiesData ?? []) as Array<Record<string, unknown>>).map((p) => {
          const memberId = String(p.member_id);
          const member = memberRows.find((m) => m.id === memberId);
          const profile = member ? profileMap.get(member.user_id) : undefined;
          return {
            id: String(p.id),
            memberLabel:
              profile?.full_name ||
              profile?.email ||
              member?.member_code ||
              memberId.slice(0, 8),
            kind: String(p.kind ?? 'fine'),
            amount: Number(p.amount),
            currency: String(p.currency ?? jamiya.currency),
            notes: (p.notes as string | null) ?? null,
            assessedAt: (p.assessed_at as string | null) ?? null,
          };
        })}
        penaltySettings={
          canManage
            ? {
                lateContributionPenalty: Number(jamiya.late_contribution_penalty ?? 0),
                missedContributionPenalty: Number(jamiya.missed_contribution_penalty ?? 0),
                lateLoanPenaltyFixed: Number(jamiya.late_loan_penalty_fixed ?? 0),
                lateLoanPenaltyPct: Number(jamiya.late_loan_penalty_pct ?? 0),
                payoutComplianceMode: jamiya.payout_compliance_mode ?? 'block',
              }
            : null
        }
      />
    
    </AppPage>
  );
}
