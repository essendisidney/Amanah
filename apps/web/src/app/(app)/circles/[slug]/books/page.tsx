import type { Metadata } from 'next';
import Link from 'next/link';
import type { Route } from 'next';
import { notFound, redirect } from 'next/navigation';
import { Button, Label, Textarea } from '@jamiya/ui';
import { createClient } from '@/lib/supabase/server';
import { CircleNoticeBanner } from '@/features/circles/components/circle-notice-banner';
import {
  importTbSheetAction,
} from '@/features/circles/actions/books-actions';
import { MonthlyPaymentsGrid } from '@/features/circles/components/monthly-payments-grid';
import { MemberBooksDetail } from '@/features/circles/components/member-books-detail';
import { MemberBooksHome } from '@/features/circles/components/member-books-home';
import { MemberBooksBackBar } from '@/features/circles/components/member-books-back-bar';
import { resolveBooksView } from '@/features/circles/lib/member-books-view';
import { MemberBooksRecordForms } from '@/features/circles/components/member-books-record-forms';
import { MemberBooksQuickEntry } from '@/features/circles/components/member-books-quick-entry';
import { MemberBooksMemberSwitcher } from '@/features/circles/components/member-books-member-switcher';

export const metadata: Metadata = { title: 'Member payments' };
export const dynamic = 'force-dynamic';

const OFFICER_ROLES = new Set(['circle_admin', 'chair', 'treasurer', 'secretary']);

type Props = {
  params: Promise<{ slug: string }>;
  searchParams?: Promise<{ notice?: string; noticeType?: string; memberId?: string; view?: string }>;
};

type MemberRow = {
  id: string;
  user_id: string;
  role: string;
  status: string;
  member_code: string | null;
};

type Profile = {
  id: string;
  full_name: string | null;
  email: string | null;
  phone: string | null;
};

function labelFor(profile: Profile | undefined, member: MemberRow) {
  return (
    profile?.full_name ||
    profile?.email ||
    profile?.phone ||
    member.member_code ||
    member.id.slice(0, 8)
  );
}

export default async function MemberBooksPage({ params, searchParams }: Props) {
  const { slug } = await params;
  const qs = (await searchParams) ?? {};
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/phone?next=/circles/${slug}/books`);

  const { data: jamiyaData } = await supabase
    .from('jamiyas')
    .select('id, name, slug, currency, share_par_value, contribution_amount')
    .eq('slug', slug)
    .maybeSingle();
  const jamiya = jamiyaData as {
    id: string;
    name: string;
    slug: string;
    currency: string;
    share_par_value: number | string;
    contribution_amount: number | string;
  } | null;
  if (!jamiya) notFound();

  const { data: myMemberData } = await supabase
    .from('members')
    .select('id, role, status')
    .eq('jamiya_id', jamiya.id)
    .eq('user_id', user.id)
    .maybeSingle();
  const myMember = myMemberData as { id: string; role: string; status: string } | null;
  const isOfficer =
    myMember?.status === 'active' && OFFICER_ROLES.has(myMember.role ?? '');

  if (!isOfficer) {
    redirect(`/circles/${slug}/statement`);
  }

  const { data: membersData } = await supabase
    .from('members')
    .select('id, user_id, role, status, member_code')
    .eq('jamiya_id', jamiya.id)
    .in('status', ['active', 'pending'])
    .order('joined_at', { ascending: true });

  const members = (membersData ?? []) as MemberRow[];
  const userIds = members.map((m) => m.user_id);
  const memberIds = members.map((m) => m.id);

  const [{ data: profileRows }, { data: bookRows }, { data: lotRows }, { data: loanRows }] =
    await Promise.all([
      userIds.length
        ? supabase.from('profiles').select('id, full_name, email, phone').in('id', userIds)
        : Promise.resolve({ data: [] }),
      memberIds.length
        ? supabase
            .from('book_entries')
            .select('id, member_id, entry_type, amount, effective_date, notes')
            .eq('jamiya_id', jamiya.id)
            .in('member_id', memberIds)
            .order('effective_date', { ascending: false })
            .limit(2000)
        : Promise.resolve({ data: [] }),
      memberIds.length
        ? supabase
            .from('circle_share_lots')
            .select('id, member_id, shares, amount, notes, purchased_on')
            .eq('jamiya_id', jamiya.id)
            .in('member_id', memberIds)
            .order('purchased_on', { ascending: false })
        : Promise.resolve({ data: [] }),
      userIds.length
        ? supabase
            .from('qard_loans')
            .select('id, borrower_id, amount, amount_repaid, status, purpose')
            .eq('jamiya_id', jamiya.id)
            .in('borrower_id', userIds)
        : Promise.resolve({ data: [] }),
    ]);

  const profilesById = new Map(
    ((profileRows ?? []) as Profile[]).map((p) => [p.id, p]),
  );

  type Totals = {
    shareShares: number;
    shareAmount: number;
    savings: number;
    loanDisbursed: number;
    loanRepaid: number;
    qardAmount: number;
    qardRepaid: number;
  };

  const totalsByMember = new Map<string, Totals>();
  for (const m of members) {
    totalsByMember.set(m.id, {
      shareShares: 0,
      shareAmount: 0,
      savings: 0,
      loanDisbursed: 0,
      loanRepaid: 0,
      qardAmount: 0,
      qardRepaid: 0,
    });
  }

  for (const lot of (lotRows ?? []) as Array<{
    member_id: string;
    shares: number | string;
    amount: number | string;
  }>) {
    const t = totalsByMember.get(lot.member_id);
    if (!t) continue;
    t.shareShares += Number(lot.shares) || 0;
    t.shareAmount += Number(lot.amount) || 0;
  }

  for (const row of (bookRows ?? []) as Array<{
    member_id: string | null;
    entry_type: string;
    amount: number | string;
  }>) {
    if (!row.member_id) continue;
    const t = totalsByMember.get(row.member_id);
    if (!t) continue;
    const amount = Number(row.amount) || 0;
    if (row.entry_type === 'contribution') t.savings += amount;
    if (row.entry_type === 'loan') t.loanDisbursed += amount;
    if (row.entry_type === 'loan_repayment') t.loanRepaid += amount;
  }

  const memberIdByUser = new Map(members.map((m) => [m.user_id, m.id]));
  for (const loan of (loanRows ?? []) as Array<{
    borrower_id: string;
    amount: number | string;
    amount_repaid: number | string;
    status: string;
  }>) {
    if (loan.status === 'rejected') continue;
    const mid = memberIdByUser.get(loan.borrower_id);
    if (!mid) continue;
    const t = totalsByMember.get(mid);
    if (!t) continue;
    t.qardAmount += Number(loan.amount) || 0;
    t.qardRepaid += Number(loan.amount_repaid) || 0;
  }

  const selectedId =
    qs.memberId && members.some((m) => m.id === qs.memberId)
      ? qs.memberId
      : (members[0]?.id ?? '');
  const view = resolveBooksView(qs.view, selectedId || undefined);
  const selected = members.find((m) => m.id === selectedId) ?? null;
  const selectedProfile = selected ? profilesById.get(selected.user_id) : undefined;
  const selectedTotals = selected ? totalsByMember.get(selected.id) : undefined;
  const parValue = Number(jamiya.share_par_value) || 0;

  const selectedBooks = (
    (bookRows ?? []) as Array<{
      id: string;
      member_id: string | null;
      entry_type: string;
      amount: number | string;
      effective_date: string;
      notes: string | null;
    }>
  ).filter((b) => b.member_id === selectedId);

  const selectedQard = (
    (loanRows ?? []) as Array<{
      id: string;
      borrower_id: string;
      amount: number | string;
      amount_repaid: number | string;
      status: string;
      purpose: string | null;
    }>
  ).filter((l) => selected && l.borrower_id === selected.user_id);

  const selectedShareLots = (
    (lotRows ?? []) as Array<{
      id: string;
      member_id: string;
      shares: number | string;
      amount: number | string;
      purchased_on: string;
      notes: string | null;
    }>
  ).filter((l) => l.member_id === selectedId);

  const selectedContributions = selectedBooks.filter((b) => b.entry_type === 'contribution');
  const selectedLoans = selectedBooks.filter((b) => b.entry_type === 'loan');
  const selectedRepayments = selectedBooks.filter((b) => b.entry_type === 'loan_repayment');

  const currency = jamiya.currency;

  const monthAmounts: Record<string, Record<string, number>> = {};
  const monthSet = new Map<string, { year: number; month: number }>();
  for (const row of (bookRows ?? []) as Array<{
    member_id: string | null;
    entry_type: string;
    amount: number | string;
    effective_date: string;
  }>) {
    if (!row.member_id || row.entry_type !== 'contribution') continue;
    const d = new Date(`${row.effective_date}T12:00:00`);
    if (Number.isNaN(d.getTime())) continue;
    const year = d.getFullYear();
    const month = d.getMonth() + 1;
    const key = `${year}-${String(month).padStart(2, '0')}`;
    monthSet.set(key, { year, month });
    if (!monthAmounts[row.member_id]) monthAmounts[row.member_id] = {};
    monthAmounts[row.member_id]![key] =
      (monthAmounts[row.member_id]![key] ?? 0) + (Number(row.amount) || 0);
  }

  // Default TB3 window Feb–current (or through Jul 2026 if still early).
  const now = new Date();
  const defaultStart = new Date(2026, 1, 1); // Feb 2026
  let rangeStart = defaultStart;
  let rangeEnd = new Date(now.getFullYear(), now.getMonth(), 1);
  if (rangeEnd < defaultStart) rangeEnd = defaultStart;
  const jul2026 = new Date(2026, 6, 1);
  if (rangeEnd < jul2026) rangeEnd = jul2026;

  for (const { year, month } of monthSet.values()) {
    const d = new Date(year, month - 1, 1);
    if (d < rangeStart) rangeStart = d;
    if (d > rangeEnd) rangeEnd = d;
  }

  const gridMonths: Array<{ year: number; month: number; label: string }> = [];
  {
    const cursor = new Date(rangeStart);
    let guard = 0;
    while (cursor <= rangeEnd && guard < 24) {
      gridMonths.push({
        year: cursor.getFullYear(),
        month: cursor.getMonth() + 1,
        label: cursor.toLocaleString('en-GB', { month: 'short', year: '2-digit' }),
      });
      cursor.setMonth(cursor.getMonth() + 1);
      guard += 1;
    }
  }

  const shareAmounts: Record<string, number> = {};
  for (const m of members) {
    shareAmounts[m.id] = totalsByMember.get(m.id)?.shareAmount ?? 0;
  }

  const gridMembers = members.map((m) => ({
    id: m.id,
    label: labelFor(profilesById.get(m.user_id), m),
  }));

  const homeMembers = members.map((m) => {
    const t = totalsByMember.get(m.id)!;
    const loanOut = Math.max(
      t.loanDisbursed - t.loanRepaid + (t.qardAmount - t.qardRepaid),
      0,
    );
    return {
      id: m.id,
      label: labelFor(profilesById.get(m.user_id), m),
      shareAmount: t.shareAmount,
      savings: t.savings,
      loanOut,
    };
  });

  const memberLabel = selected ? labelFor(selectedProfile, selected) : '';

  return (
    <div className="mx-auto max-w-6xl space-y-8 px-6 py-10">
      <CircleNoticeBanner notice={qs.notice} noticeType={qs.noticeType} />

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-[family-name:var(--font-display)] text-3xl font-semibold">
            Member payments
          </h1>
          <p className="mt-2 max-w-xl text-muted-foreground">
            Record shares, monthly savings, and loans for each member.
          </p>
        </div>
        <Button asChild variant="outline" size="sm" className="min-h-11">
          <Link href={`/circles/${slug}` as Route}>← Back to circle</Link>
        </Button>
      </div>

      {view === 'home' ? (
        <MemberBooksHome slug={slug} currency={currency} members={homeMembers} />
      ) : null}

      {view === 'grid' ? (
        <section className="space-y-4">
          <MemberBooksBackBar slug={slug} title="Enter everyone's payments" />
          <MonthlyPaymentsGrid
            jamiyaId={jamiya.id}
            slug={slug}
            members={gridMembers}
            months={gridMonths}
            monthAmounts={monthAmounts}
            shareAmounts={shareAmounts}
            defaultMonthAmount={Number(jamiya.contribution_amount) || 2000}
            defaultShareAmount={5000}
            defaultShareDate="2026-02-05"
          />
        </section>
      ) : null}

      {view === 'member' && selected && selectedTotals ? (
        <div className="space-y-6">
          <MemberBooksBackBar slug={slug} title={memberLabel} />
          <MemberBooksMemberSwitcher
            slug={slug}
            members={gridMembers}
            currentMemberId={selectedId}
          />
          <MemberBooksQuickEntry
            jamiyaId={jamiya.id}
            slug={slug}
            memberId={selected.id}
            memberLabel={memberLabel}
            currency={currency}
            parValue={parValue}
            defaultMonthAmount={Number(jamiya.contribution_amount) || 2000}
            defaultShareAmount={5000}
          />
          <div className="space-y-3">
            <h2 className="text-lg font-semibold">Record so far</h2>
            <MemberBooksDetail
              slug={slug}
              memberId={selectedId}
              currency={currency}
              memberLabel={memberLabel}
              shareLots={selectedShareLots}
              contributions={selectedContributions}
              loans={selectedLoans}
              repayments={selectedRepayments}
              qardLoans={selectedQard}
              totals={selectedTotals}
            />
          </div>
          <details className="rounded-xl border border-border bg-card">
            <summary className="cursor-pointer px-5 py-4 text-sm font-medium text-muted-foreground hover:text-foreground">
              Fix one month, repayment, or share count (advanced)
            </summary>
            <div className="border-t border-border px-5 py-4">
              <MemberBooksRecordForms
                jamiyaId={jamiya.id}
                slug={slug}
                memberId={selected.id}
                currency={currency}
                parValue={parValue}
              />
            </div>
          </details>
        </div>
      ) : null}

      {view === 'import' ? (
        <section className="space-y-4">
          <MemberBooksBackBar slug={slug} title="Paste from Excel" />
          <div className="rounded-xl border border-border bg-card p-5">
            <p className="text-sm text-muted-foreground">
              From <strong className="font-medium text-foreground">HALAL CHAMA INVESTMENT.xlsx</strong>{' '}
              → tab <strong className="font-medium text-foreground">AMANAH TEST</strong>: select rows
              1–10 (header + members), copy, paste below. Include both header rows. Names must match
              members on the circle page.
            </p>
            <form action={importTbSheetAction} className="mt-4 space-y-4">
              <input type="hidden" name="jamiyaId" value={jamiya.id} />
              <input type="hidden" name="slug" value={slug} />
              <input type="hidden" name="parValue" value={parValue || 100} />
              <input type="hidden" name="year" value="2026" />
              <div className="space-y-1">
                <Label htmlFor="contributionsPaste">Contributions (AMANAH TEST rows 1–10)</Label>
                <Textarea
                  id="contributionsPaste"
                  name="contributionsPaste"
                  rows={10}
                  className="font-mono text-xs"
                  placeholder={`NEXT OF KIN	NAME	SHARES	CONTRIBUTION
		ONE OFF	5TH FEB	5TH MARCH	5TH APRIL
HUSBAE…	KHADIJA ALADINA	5000	2000	2000	2000
…	VIOLA CHUMBA	5000	2000	3000	2000
…	JULLIET	5000	2000	2000	CLOSED`}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="loansPaste">Loans (AMANAH TEST from row 17 downward)</Label>
                <Textarea
                  id="loansPaste"
                  name="loansPaste"
                  rows={8}
                  className="font-mono text-xs"
                  placeholder={`FEB	LOANS
5TH FEB	JULIET	16000	paid 3k contribution plus profit
5TH FEB	KHADIJA ALADINA	25000	9161 1st installment
5TH MARCH	VIOLA	15000`}
                />
              </div>
              <Button type="submit" className="min-h-11">
                Import sheet
              </Button>
            </form>
          </div>
        </section>
      ) : null}

      {members.length === 0 && view !== 'home' ? (
        <p className="text-sm text-muted-foreground">
          No members yet. Add people on the circle page first.
        </p>
      ) : null}

    </div>
  );
}
