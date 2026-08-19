import type { Metadata } from 'next';
import Link from 'next/link';
import type { Route } from 'next';
import { notFound, redirect } from 'next/navigation';
import { formatCurrency, formatDate } from '@jamiya/shared';
import { Button } from '@jamiya/ui';
import { getAuthUser } from '@/lib/supabase/auth';
import { StatusBadge } from '@/features/dashboard/components/dashboard-stats';
import { InviteMemberForm } from '@/features/circles/components/invite-member-form';
import { AddMemberForm } from '@/features/circles/components/add-member-form';
import {
  MembersList,
  PendingInvitationsList,
  type InvitationListItem,
  type MemberListItem,
} from '@/features/circles/components/members-and-invites';
import {
  ActivateCircleButton,
  ContributionCalendar,
  PayoutSchedule,
  type ScheduleContribution,
  type SchedulePayout,
} from '@/features/circles/components/schedule-panel';
import { OpenDisputeForm } from '@/features/circles/components/open-dispute-form';
import { ExportCircleReportButtons } from '@/features/circles/components/export-circle-report';
import { OfficerOverviewStrip } from '@/features/circles/components/officer-overview';
import {
  CircleOpsPanel,
  NextPayoutBoard,
  type AnnouncementRow,
  type BookEntryRow,
  type MemberOption,
  type PenaltySettings,
  type SavingsPocketRow,
  type TableBankingFund,
} from '@/features/circles/components/circle-ops-panel';
import {
  CircleFundLoans,
  type CircleLoanRow,
  type PendingGuaranteeRequest,
} from '@/features/circles/components/circle-fund-loans';
import { CircleNoticeBanner } from '@/features/circles/components/circle-notice-banner';
import { getDictionary } from '@/i18n/get-dictionary';
import { t } from '@/i18n/dictionaries';

export const metadata: Metadata = {
  title: 'Circle details',
};

export const dynamic = 'force-dynamic';

type JamiyaRow = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  status: string;
  segment: string;
  contribution_amount: number | string;
  currency: string;
  max_members: number;
  member_count: number;
  cycle_count: number | null;
  current_cycle: number;
  contribution_frequency_days: number;
  start_date: string | null;
  late_contribution_penalty?: number | string | null;
  missed_contribution_penalty?: number | string | null;
  late_loan_penalty_fixed?: number | string | null;
  late_loan_penalty_pct?: number | string | null;
  payout_compliance_mode?: string | null;
  challenge_kind?: string | null;
};

type Props = {
  params: Promise<{ slug: string }>;
  searchParams?: Promise<{ notice?: string; noticeType?: string }>;
};

export default async function CircleDetailsPage({ params, searchParams }: Props) {
  const { slug } = await params;
  const notices = (await searchParams) ?? {};
  const [{ supabase, user }, { dict }] = await Promise.all([getAuthUser(), getDictionary()]);

  if (!user) {
    redirect(`/phone?next=/circles/${slug}`);
  }

  const { data } = await supabase
    .from('jamiyas')
    .select(
      `
      id, name, slug, description, status, segment, contribution_amount, currency,
      max_members, member_count, cycle_count, current_cycle,
      contribution_frequency_days, start_date,
      late_contribution_penalty, missed_contribution_penalty,
      late_loan_penalty_fixed, late_loan_penalty_pct, payout_compliance_mode,
      challenge_kind
    `,
    )
    .eq('slug', slug)
    .maybeSingle();

  if (!data) notFound();

  const jamiya = data as unknown as JamiyaRow;
  const amount =
    typeof jamiya.contribution_amount === 'number'
      ? jamiya.contribution_amount
      : Number(jamiya.contribution_amount);

  const [
    { data: membersData },
    { data: invitesData },
    { data: contribData },
    { data: payoutData },
    { data: bookData },
    { data: announcementData },
  ] = await Promise.all([
    supabase
      .from('members')
      .select('id, role, status, payout_position, joined_at, user_id, member_code')
      .eq('jamiya_id', jamiya.id)
      .order('payout_position', { ascending: true, nullsFirst: false }),
    supabase
      .from('invitations')
      .select('id, email, phone, status, expires_at, created_at')
      .eq('jamiya_id', jamiya.id)
      .eq('status', 'pending')
      .order('created_at', { ascending: false }),
    supabase
      .from('contributions')
      .select('id, cycle_number, amount, amount_paid, currency, status, due_date, member_id')
      .eq('jamiya_id', jamiya.id)
      .order('due_date', { ascending: true })
      .limit(48),
    supabase
      .from('payouts')
      .select(
        'id, cycle_number, amount, currency, status, scheduled_date, member_id, receipt_confirmed_at',
      )
      .eq('jamiya_id', jamiya.id)
      .order('cycle_number', { ascending: true })
      .limit(36),
    supabase
      .from('book_entries')
      .select('id, entry_type, amount, currency, effective_date, notes')
      .eq('jamiya_id', jamiya.id)
      .order('effective_date', { ascending: false })
      .limit(20),
    supabase
      .from('announcements')
      .select('id, title, body, created_at')
      .eq('jamiya_id', jamiya.id)
      .order('created_at', { ascending: false })
      .limit(10),
  ]);

  const memberRows = (membersData ?? []) as unknown as Array<{
    id: string;
    role: string;
    status: string;
    payout_position: number | null;
    joined_at: string | null;
    user_id: string;
    member_code: string | null;
  }>;

  const membership = memberRows.find((row) => row.user_id === user.id) ?? null;
  const canManageMembers =
    membership?.status === 'active' &&
    ['circle_admin', 'chair', 'treasurer'].includes(membership?.role ?? '');
  /** Chair/treasurer share ops: invites, penalties, books, announcements. */
  const canManageOps = canManageMembers;
  const canActivate =
    canManageOps &&
    (jamiya.status === 'draft' || jamiya.status === 'open') &&
    jamiya.member_count >= 2;

  const userIds = memberRows.map((row) => row.user_id);
  const memberIds = memberRows.map((row) => row.id);
  const [{ data: profileRows }, { data: vouchRows }] = await Promise.all([
    userIds.length > 0
      ? supabase.from('profiles').select('id, full_name, email, phone').in('id', userIds)
      : Promise.resolve({ data: [] }),
    memberIds.length > 0
      ? supabase
          .from('member_vouches')
          .select('member_id, status')
          .eq('jamiya_id', jamiya.id)
          .in('member_id', memberIds)
      : Promise.resolve({ data: [] }),
  ]);

  const profilesById = new Map(
    ((profileRows ?? []) as unknown as Array<{
      id: string;
      full_name: string | null;
      email: string | null;
      phone: string | null;
    }>).map((row) => [row.id, row]),
  );
  const vouchByMember = new Map(
    ((vouchRows ?? []) as unknown as Array<{ member_id: string; status: string }>).map((row) => [
      row.member_id,
      row.status,
    ]),
  );

  const members: MemberListItem[] = memberRows.map((row) => {
    const profile = profilesById.get(row.user_id);
    return {
      id: row.id,
      role: row.role,
      status: row.status,
      payoutPosition: row.payout_position,
      joinedAt: row.joined_at,
      fullName: profile?.full_name ?? null,
      email: profile?.email ?? null,
      phone: profile?.phone ?? null,
      memberCode: row.member_code,
      vouchStatus: vouchByMember.get(row.id) ?? null,
    };
  });

  const membersById = new Map(memberRows.map((row) => [row.id, row]));

  const invitations: InvitationListItem[] = (
    (invitesData ?? []) as unknown as Array<{
      id: string;
      email: string | null;
      phone: string | null;
      status: string;
      expires_at: string;
      created_at: string;
    }>
  ).map((row) => ({
    id: row.id,
    email: row.email,
    phone: row.phone,
    status: row.status,
    expiresAt: row.expires_at,
    createdAt: row.created_at,
  }));

  const contributions: ScheduleContribution[] = (
    (contribData ?? []) as unknown as Array<{
      id: string;
      cycle_number: number;
      amount: number | string;
      amount_paid?: number | string | null;
      currency: string;
      status: string;
      due_date: string;
      member_id: string;
    }>
  ).map((row) => ({
    id: row.id,
    cycleNumber: row.cycle_number,
    amount: typeof row.amount === 'number' ? row.amount : Number(row.amount),
    amountPaid:
      typeof row.amount_paid === 'number'
        ? row.amount_paid
        : Number(row.amount_paid ?? 0),
    currency: row.currency,
    status: row.status,
    dueDate: row.due_date,
    isMine: membership?.id === row.member_id,
  }));

  const payouts: SchedulePayout[] = (
    (payoutData ?? []) as unknown as Array<{
      id: string;
      cycle_number: number;
      amount: number | string;
      currency: string;
      status: string;
      scheduled_date: string;
      member_id: string;
      receipt_confirmed_at: string | null;
    }>
  ).map((row) => {
    const member = membersById.get(row.member_id);
    const profile = member ? profilesById.get(member.user_id) : null;
    return {
      id: row.id,
      cycleNumber: row.cycle_number,
      amount: typeof row.amount === 'number' ? row.amount : Number(row.amount),
      currency: row.currency,
      status: row.status,
      scheduledDate: row.scheduled_date,
      memberLabel: profile?.full_name || profile?.email || 'Member',
      isMine: membership?.id === row.member_id,
      receiptConfirmedAt: row.receipt_confirmed_at,
    };
  });

  const bookEntries: BookEntryRow[] = (
    (bookData ?? []) as unknown as Array<{
      id: string;
      entry_type: string;
      amount: number | string;
      currency: string;
      effective_date: string;
      notes: string | null;
    }>
  ).map((row) => ({
    id: row.id,
    entryType: row.entry_type,
    amount: Number(row.amount),
    currency: row.currency,
    effectiveDate: row.effective_date,
    notes: row.notes,
  }));

  const announcements: AnnouncementRow[] = (
    (announcementData ?? []) as unknown as Array<{
      id: string;
      title: string;
      body: string;
      created_at: string;
    }>
  ).map((row) => ({
    id: row.id,
    title: row.title,
    body: row.body,
    createdAt: row.created_at,
  }));

  const memberOptions: MemberOption[] = members.map((m) => ({
    id: m.id,
    label: m.fullName ?? m.email ?? m.id.slice(0, 8),
    memberCode: m.memberCode ?? null,
  }));

  const penaltySettings: PenaltySettings = {
    lateContributionPenalty: Number(jamiya.late_contribution_penalty ?? 0),
    missedContributionPenalty: Number(jamiya.missed_contribution_penalty ?? 0),
    lateLoanPenaltyFixed: Number(jamiya.late_loan_penalty_fixed ?? 0),
    lateLoanPenaltyPct: Number(jamiya.late_loan_penalty_pct ?? 0),
    payoutComplianceMode: jamiya.payout_compliance_mode ?? 'block',
  };

  let fund: TableBankingFund | null = null;
  let creditRating: string | null = null;
  let pockets: SavingsPocketRow[] = [];
  let myLoans: CircleLoanRow[] = [];
  let pendingApprovals: CircleLoanRow[] = [];
  let officerActiveLoans: CircleLoanRow[] = [];
  let pendingGuaranteeRequests: PendingGuaranteeRequest[] = [];
  let qardCap: number | null = null;
  const canApproveLoans =
    membership?.status === 'active' &&
    ['circle_admin', 'chair', 'treasurer'].includes(membership?.role ?? '');

  if (membership?.status === 'active') {
    const [
      { data: fundData },
      { data: creditData },
      { data: pocketData },
      { data: myLoanData },
      { data: pendingLoanData },
      { data: activeLoanData },
      { data: myPendingGuaranteeData },
      { data: capData },
    ] = await Promise.all([
      supabase.rpc('table_banking_fund', { p_jamiya_id: jamiya.id }),
      membership.id
        ? supabase.rpc('member_credit_snapshot', { p_member_id: membership.id })
        : Promise.resolve({ data: null }),
      membership.id
        ? supabase
            .from('savings_pockets')
            .select('id, category, label, balance, target_amount, duration_months, currency')
            .eq('jamiya_id', jamiya.id)
            .eq('member_id', membership.id)
            .order('created_at', { ascending: false })
        : Promise.resolve({ data: [] }),
      supabase
        .from('qard_loans')
        .select(
          'id, borrower_id, amount, amount_repaid, currency, purpose, status, due_date, agreement_accepted_at, agreement_signer_name',
        )
        .eq('jamiya_id', jamiya.id)
        .eq('borrower_id', user.id)
        .order('created_at', { ascending: false })
        .limit(20),
      canApproveLoans
        ? supabase
            .from('qard_loans')
            .select(
              'id, borrower_id, amount, amount_repaid, currency, purpose, status, due_date, agreement_accepted_at, agreement_signer_name',
            )
            .eq('jamiya_id', jamiya.id)
            .eq('status', 'requested')
            .order('created_at', { ascending: false })
            .limit(20)
        : Promise.resolve({ data: [] }),
      canApproveLoans
        ? supabase
            .from('qard_loans')
            .select(
              'id, borrower_id, amount, amount_repaid, currency, purpose, status, due_date, agreement_accepted_at, agreement_signer_name',
            )
            .eq('jamiya_id', jamiya.id)
            .eq('status', 'active')
            .order('created_at', { ascending: false })
            .limit(20)
        : Promise.resolve({ data: [] }),
      supabase
        .from('qard_guarantees')
        .select(
          'id, loan_id, status, loan:qard_loans(id, borrower_id, amount, currency, purpose, status)',
        )
        .eq('jamiya_id', jamiya.id)
        .eq('guarantor_user_id', user.id)
        .eq('status', 'pending')
        .limit(20),
      supabase.rpc('qard_cap_for_jamiya', { p_jamiya_id: jamiya.id }),
    ]);
    const f = fundData as Record<string, unknown> | null;
    if (f?.ok) {
      fund = {
        memberContributions: Number(f.member_contributions ?? 0),
        penaltiesReceived: Number(f.penalties_received ?? 0),
        lentOut: Number(f.lent_out ?? 0),
        repaid: Number(f.repaid ?? 0),
        outstanding: Number(f.outstanding ?? 0),
        overdue: Number(f.overdue ?? 0),
        availableToLend: Number(f.available_to_lend ?? 0),
        portfolioAtRiskPct: Number(f.portfolio_at_risk_pct ?? 0),
      };
    }
    const c = creditData as { ok?: boolean; rating?: string; repayment_rate?: number } | null;
    if (c?.ok && c.rating) {
      creditRating = `${c.rating} (${c.repayment_rate ?? 0}% on-time)`;
    }
    pockets = (
      (pocketData ?? []) as unknown as Array<{
        id: string;
        category: string;
        label: string | null;
        balance: number | string;
        target_amount: number | string | null;
        duration_months: number | null;
        currency: string;
      }>
    ).map((row) => ({
      id: row.id,
      category: row.category,
      label: row.label,
      balance: Number(row.balance ?? 0),
      targetAmount: row.target_amount != null ? Number(row.target_amount) : null,
      durationMonths: row.duration_months,
      currency: row.currency,
    }));

    type LoanDbRow = {
      id: string;
      borrower_id: string;
      amount: number | string;
      amount_repaid: number | string;
      currency: string;
      purpose: string;
      status: string;
      due_date: string | null;
      agreement_accepted_at: string | null;
      agreement_signer_name: string | null;
    };

    const loanRowsForGuarantees = [
      ...((myLoanData ?? []) as unknown as LoanDbRow[]),
      ...((pendingLoanData ?? []) as unknown as LoanDbRow[]),
      ...((activeLoanData ?? []) as unknown as LoanDbRow[]),
    ];
    const loanIds = [...new Set(loanRowsForGuarantees.map((row) => row.id))];
    const { data: guaranteeRows } =
      loanIds.length > 0
        ? await supabase
            .from('qard_guarantees')
            .select('id, loan_id, guarantor_user_id, status')
            .in('loan_id', loanIds)
        : { data: [] as Array<{ id: string; loan_id: string; guarantor_user_id: string; status: string }> };

    const guaranteesByLoan = new Map<
      string,
      Array<{ id: string; guarantorUserId: string; guarantorName: string; status: string }>
    >();
    for (const row of (guaranteeRows ?? []) as unknown as Array<{
      id: string;
      loan_id: string;
      guarantor_user_id: string;
      status: string;
    }>) {
      const profile = profilesById.get(row.guarantor_user_id);
      const list = guaranteesByLoan.get(row.loan_id) ?? [];
      list.push({
        id: row.id,
        guarantorUserId: row.guarantor_user_id,
        guarantorName: profile?.full_name || profile?.email || 'Member',
        status: row.status,
      });
      guaranteesByLoan.set(row.loan_id, list);
    }

    const mapLoan = (row: LoanDbRow): CircleLoanRow => ({
      id: row.id,
      borrowerId: row.borrower_id,
      amount: Number(row.amount),
      amountRepaid: Number(row.amount_repaid),
      currency: row.currency,
      purpose: row.purpose,
      status: row.status,
      dueDate: row.due_date,
      agreementAcceptedAt: row.agreement_accepted_at,
      agreementSignerName: row.agreement_signer_name,
      guarantees: guaranteesByLoan.get(row.id) ?? [],
    });

    myLoans = ((myLoanData ?? []) as unknown as LoanDbRow[]).map(mapLoan);
    pendingApprovals = ((pendingLoanData ?? []) as unknown as LoanDbRow[])
      .map(mapLoan)
      .filter((loan) => loan.borrowerId !== user.id);
    officerActiveLoans = ((activeLoanData ?? []) as unknown as LoanDbRow[])
      .map(mapLoan)
      .filter((loan) => loan.borrowerId !== user.id);

    pendingGuaranteeRequests = (
      (myPendingGuaranteeData ?? []) as unknown as Array<{
        id: string;
        loan_id: string;
        loan:
          | {
              id: string;
              borrower_id: string;
              amount: number | string;
              currency: string;
              purpose: string;
              status: string;
            }
          | Array<{
              id: string;
              borrower_id: string;
              amount: number | string;
              currency: string;
              purpose: string;
              status: string;
            }>
          | null;
      }>
    )
      .map((row) => {
        const loan = Array.isArray(row.loan) ? row.loan[0] : row.loan;
        if (!loan || loan.status !== 'requested') return null;
        const borrower = profilesById.get(loan.borrower_id);
        return {
          id: row.id,
          loanId: loan.id,
          borrowerName: borrower?.full_name || borrower?.email || 'Member',
          amount: Number(loan.amount),
          currency: loan.currency,
          purpose: loan.purpose,
        } satisfies PendingGuaranteeRequest;
      })
      .filter((row): row is PendingGuaranteeRequest => row != null);

    const cap = capData as { ok?: boolean; cap?: number } | null;
    if (cap?.ok) qardCap = Number(cap.cap ?? 0);
  }

  const lateCount = contributions.filter((c) => c.status === 'late').length;
  const nextPayout = payouts.find(
    (p) => p.status === 'scheduled' || p.status === 'processing',
  );
  const nextPayoutRaw = (
    (payoutData ?? []) as Array<{ member_id: string; status: string }>
  ).find((p) => p.status === 'scheduled' || p.status === 'processing');
  const nextMember = nextPayoutRaw
    ? memberRows.find((m) => m.id === nextPayoutRaw.member_id)
    : null;
  const { count: pendingGraceCount } = canManageMembers
    ? await supabase
        .from('grace_period_requests')
        .select('id', { count: 'exact', head: true })
        .eq('jamiya_id', jamiya.id)
        .eq('status', 'pending')
    : { count: 0 };

  const circleLabels = dict.circle;
  const segmentLabel =
    jamiya.segment === 'womens_circle'
      ? circleLabels.womensCircle
      : jamiya.segment === 'boda_stage'
        ? circleLabels.bodaStage
        : null;
  const segmentBlurb =
    jamiya.segment === 'womens_circle'
      ? circleLabels.womensBlurb
      : jamiya.segment === 'boda_stage'
        ? circleLabels.bodaBlurb
        : null;

  return (
    <div className="space-y-10">
      <CircleNoticeBanner notice={notices.notice} noticeType={notices.noticeType} />

      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge status={jamiya.status} />
          {membership ? <StatusBadge status={membership.role} /> : null}
          {segmentLabel ? <StatusBadge status={jamiya.segment} /> : null}
        </div>
        <h1 className="font-[family-name:var(--font-display)] text-4xl font-semibold tracking-tight">
          {jamiya.name}
        </h1>
        {segmentBlurb ? (
          <p className="max-w-2xl text-sm text-muted-foreground">{segmentBlurb}</p>
        ) : null}
        {jamiya.description ? (
          <p className="max-w-2xl text-muted-foreground">{jamiya.description}</p>
        ) : null}
        {canActivate ? (
          <div className="pt-2">
            <ActivateCircleButton
              jamiyaId={jamiya.id}
              slug={jamiya.slug}
              canActivate={canActivate}
            />
          </div>
        ) : null}
        {jamiya.challenge_kind && jamiya.challenge_kind !== 'rotating' ? (
          <p className="text-sm text-muted-foreground">
            {jamiya.challenge_kind === 'share_dividend'
              ? 'Share / dividend group — profits and equity, not rotating payouts.'
              : 'Savings challenge — contribution rounds only, not a merry-go-round.'}
          </p>
        ) : null}
        <div className="flex flex-wrap gap-2 pt-2">
          <Button asChild variant="outline" size="sm">
            <Link href={`/circles/${slug}/community` as Route}>{circleLabels.meetingsChat}</Link>
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link href={`/circles/${slug}/elections` as Route}>{circleLabels.elections}</Link>
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link href={`/circles/${slug}/registration` as Route}>{circleLabels.circleKyc}</Link>
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link href={`/circles/${slug}/treasury` as Route}>{circleLabels.treasury}</Link>
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link href={`/circles/${slug}/shares` as Route}>{circleLabels.shares}</Link>
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link href={`/circles/${slug}/journal` as Route}>{circleLabels.journal}</Link>
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link href={`/circles/${slug}/invoices` as Route}>{circleLabels.invoices}</Link>
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link href={`/circles/${slug}/statement` as Route}>{circleLabels.idReport}</Link>
          </Button>
          {canManageMembers ? (
            <Button asChild variant="outline" size="sm">
              <Link href={`/circles/${slug}/officer` as Route}>{circleLabels.officerConsole}</Link>
            </Button>
          ) : null}
        </div>
      </div>

      {canManageMembers ? (
        <OfficerOverviewStrip
          slug={jamiya.slug}
          lateCount={lateCount}
          pendingGrace={pendingGraceCount ?? 0}
          nextPayoutLabel={nextPayout?.memberLabel ?? null}
          nextPayoutDate={nextPayout?.scheduledDate ?? null}
          nextPayoutAmount={nextPayout?.amount ?? null}
          currency={jamiya.currency}
        />
      ) : null}

      <NextPayoutBoard
        currency={jamiya.currency}
        next={
          nextPayout
            ? {
                memberLabel: nextPayout.memberLabel,
                memberCode: nextMember?.member_code ?? null,
                cycleNumber: nextPayout.cycleNumber,
                amount: nextPayout.amount,
                scheduledDate: nextPayout.scheduledDate,
                status: nextPayout.status,
              }
            : null
        }
      />

      <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <div className="rounded-xl border border-border bg-card p-5">
          <dt className="text-xs uppercase tracking-wide text-muted-foreground">
            {circleLabels.contribution}
          </dt>
          <dd className="mt-2 text-lg font-semibold">
            {formatCurrency(amount, jamiya.currency)}
          </dd>
        </div>
        <div className="rounded-xl border border-border bg-card p-5">
          <dt className="text-xs uppercase tracking-wide text-muted-foreground">
            {circleLabels.members}
          </dt>
          <dd className="mt-2 text-lg font-semibold">
            {jamiya.member_count}/{jamiya.max_members}
          </dd>
        </div>
        <div className="rounded-xl border border-border bg-card p-5">
          <dt className="text-xs uppercase tracking-wide text-muted-foreground">
            {circleLabels.cycle}
          </dt>
          <dd className="mt-2 text-lg font-semibold">
            {jamiya.cycle_count != null
              ? `${jamiya.current_cycle}/${jamiya.cycle_count}`
              : 'Not set'}
          </dd>
        </div>
        <div className="rounded-xl border border-border bg-card p-5">
          <dt className="text-xs uppercase tracking-wide text-muted-foreground">
            {circleLabels.frequency}
          </dt>
          <dd className="mt-2 text-lg font-semibold">
            {t(circleLabels.everyDays, { days: jamiya.contribution_frequency_days })}
          </dd>
        </div>
        <div className="rounded-xl border border-border bg-card p-5">
          <dt className="text-xs uppercase tracking-wide text-muted-foreground">
            {circleLabels.startDate}
          </dt>
          <dd className="mt-2 text-lg font-semibold">
            {jamiya.start_date ? formatDate(jamiya.start_date) : circleLabels.notSet}
          </dd>
        </div>
        {creditRating ? (
          <div className="rounded-xl border border-border bg-card p-5">
            <dt className="text-xs uppercase tracking-wide text-muted-foreground">
              {circleLabels.creditSnapshot}
            </dt>
            <dd className="mt-2 text-lg font-semibold">{creditRating}</dd>
          </div>
        ) : null}
      </dl>

      <section className="space-y-4">
        <h2 className="font-[family-name:var(--font-display)] text-xl font-semibold">
          Contribution calendar
        </h2>
        <ContributionCalendar contributions={contributions} slug={jamiya.slug} />
      </section>

      <section className="space-y-4">
        <h2 className="font-[family-name:var(--font-display)] text-xl font-semibold">
          Payout schedule
        </h2>
        <PayoutSchedule
          payouts={payouts}
          slug={jamiya.slug}
          isCircleAdmin={Boolean(canManageOps)}
        />
      </section>

      <section className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-[family-name:var(--font-display)] text-xl font-semibold">
            Members
          </h2>
          {membership?.status === 'active' &&
          ['circle_admin', 'chair', 'treasurer', 'secretary'].includes(
            membership?.role ?? '',
          ) ? (
            <ExportCircleReportButtons slug={jamiya.slug} />
          ) : null}
        </div>
        <MembersList members={members} slug={slug} canManage={canManageMembers} />
      </section>

      {membership?.status === 'active' ? (
        <section className="space-y-4">
          <h2 className="font-[family-name:var(--font-display)] text-xl font-semibold">
            Open a dispute
          </h2>
          <div className="max-w-xl rounded-xl border border-border bg-card p-6">
            <OpenDisputeForm jamiyaId={jamiya.id} slug={jamiya.slug} />
          </div>
        </section>
      ) : null}

      {membership?.status === 'active' ? (
        <CircleFundLoans
          jamiyaId={jamiya.id}
          slug={jamiya.slug}
          currency={jamiya.currency}
          myLoans={myLoans}
          pendingApprovals={pendingApprovals}
          pendingGuaranteeRequests={pendingGuaranteeRequests}
          officerActiveLoans={officerActiveLoans}
          guarantorCandidates={memberRows
            .filter((row) => row.status === 'active' && row.user_id !== user.id)
            .map((row) => {
              const profile = profilesById.get(row.user_id);
              return {
                userId: row.user_id,
                label: profile?.full_name || profile?.email || 'Member',
              };
            })}
          canApprove={canApproveLoans}
          qardCap={qardCap}
          labels={dict.loans}
        />
      ) : null}

      {canManageOps ? (
        <>
          <section className="space-y-4">
            <h2 className="font-[family-name:var(--font-display)] text-xl font-semibold">
              Circle operations
            </h2>
            <CircleOpsPanel
              jamiyaId={jamiya.id}
              slug={jamiya.slug}
              currency={jamiya.currency}
              settings={penaltySettings}
              fund={fund}
              bookEntries={bookEntries}
              announcements={announcements}
              members={memberOptions}
              myMemberId={membership?.id ?? null}
              pockets={pockets}
              canManage
            />
          </section>

          <section className="space-y-4">
            <h2 className="font-[family-name:var(--font-display)] text-xl font-semibold">
              Add people (manual)
            </h2>
            <p className="text-sm text-muted-foreground">
              Create their Amanah account now. They get a join link and code to sign in.
            </p>
            <div className="rounded-xl border border-border bg-card p-6">
              <AddMemberForm jamiyaId={jamiya.id} circleName={jamiya.name} />
            </div>
          </section>

          <section className="space-y-4">
            <h2 className="font-[family-name:var(--font-display)] text-xl font-semibold">
              Join link / invite code
            </h2>
            <p className="text-sm text-muted-foreground">
              Share a WhatsApp link or short code. They open it, sign in with phone, and join.
            </p>
            <div className="rounded-xl border border-border bg-card p-6">
              <InviteMemberForm jamiyaId={jamiya.id} circleName={jamiya.name} />
            </div>
          </section>

          <section className="space-y-4">
            <h2 className="font-[family-name:var(--font-display)] text-xl font-semibold">
              Pending invitations
            </h2>
            <PendingInvitationsList
              invitations={invitations}
              slug={jamiya.slug}
              canManage={canManageOps}
            />
          </section>
        </>
      ) : membership?.status === 'active' &&
        (fund || announcements.length || pockets.length || membership.id) ? (
        <section className="space-y-4">
          <CircleOpsPanel
            jamiyaId={jamiya.id}
            slug={jamiya.slug}
            currency={jamiya.currency}
            settings={penaltySettings}
            fund={fund}
            bookEntries={[]}
            announcements={announcements}
            members={memberOptions}
            myMemberId={membership.id}
            pockets={pockets}
            canManage={false}
          />
        </section>
      ) : null}

      <Button asChild variant="outline">
        <Link href={'/circles' as Route}>Back to My circles</Link>
      </Button>
    </div>
  );
}
