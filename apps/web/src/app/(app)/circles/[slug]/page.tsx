import type { Metadata } from 'next';
import Link from 'next/link';
import type { Route } from 'next';
import { notFound, redirect } from 'next/navigation';
import { formatCurrency, formatDate } from '@jamiya/shared';
import { Button } from '@jamiya/ui';
import { createClient } from '@/lib/supabase/server';
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
  type TableBankingFund,
} from '@/features/circles/components/circle-ops-panel';

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
  cycle_count: number;
  current_cycle: number;
  contribution_frequency_days: number;
  start_date: string | null;
  late_contribution_penalty?: number | string | null;
  missed_contribution_penalty?: number | string | null;
  late_loan_penalty_fixed?: number | string | null;
  late_loan_penalty_pct?: number | string | null;
  payout_compliance_mode?: string | null;
};

type Props = {
  params: Promise<{ slug: string }>;
};

export default async function CircleDetailsPage({ params }: Props) {
  const { slug } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(`/login?next=/circles/${slug}`);
  }

  const { data } = await supabase
    .from('jamiyas')
    .select(
      `
      id, name, slug, description, status, segment, contribution_amount, currency,
      max_members, member_count, cycle_count, current_cycle,
      contribution_frequency_days, start_date,
      late_contribution_penalty, missed_contribution_penalty,
      late_loan_penalty_fixed, late_loan_penalty_pct, payout_compliance_mode
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
    { data: myMembership },
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
      .from('members')
      .select('id, role, status')
      .eq('jamiya_id', jamiya.id)
      .eq('user_id', user.id)
      .maybeSingle(),
    supabase
      .from('contributions')
      .select('id, cycle_number, amount, amount_paid, currency, status, due_date, member_id')
      .eq('jamiya_id', jamiya.id)
      .order('due_date', { ascending: true })
      .limit(120),
    supabase
      .from('payouts')
      .select(
        'id, cycle_number, amount, currency, status, scheduled_date, member_id, receipt_confirmed_at',
      )
      .eq('jamiya_id', jamiya.id)
      .order('cycle_number', { ascending: true })
      .limit(60),
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

  const membership = myMembership as unknown as {
    id: string;
    role: string;
    status: string;
  } | null;
  const isCircleAdmin =
    membership?.role === 'circle_admin' && membership.status === 'active';
  const canManageMembers =
    membership?.status === 'active' &&
    ['circle_admin', 'chair', 'treasurer'].includes(membership?.role ?? '');
  const canActivate =
    isCircleAdmin &&
    (jamiya.status === 'draft' || jamiya.status === 'open') &&
    jamiya.member_count >= 2;

  const memberRows = (membersData ?? []) as unknown as Array<{
    id: string;
    role: string;
    status: string;
    payout_position: number | null;
    joined_at: string | null;
    user_id: string;
    member_code: string | null;
  }>;

  const userIds = memberRows.map((row) => row.user_id);
  const memberIds = memberRows.map((row) => row.id);
  const [{ data: profileRows }, { data: vouchRows }] = await Promise.all([
    userIds.length > 0
      ? supabase.from('profiles').select('id, full_name, email').in('id', userIds)
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
  if (membership?.status === 'active') {
    const [{ data: fundData }, { data: creditData }] = await Promise.all([
      supabase.rpc('table_banking_fund', { p_jamiya_id: jamiya.id }),
      membership.id
        ? supabase.rpc('member_credit_snapshot', { p_member_id: membership.id })
        : Promise.resolve({ data: null }),
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

  const segmentLabel =
    jamiya.segment === 'womens_circle'
      ? 'Women’s circle'
      : jamiya.segment === 'boda_stage'
        ? 'Boda / tuktuk stage'
        : null;
  const segmentBlurb =
    jamiya.segment === 'womens_circle'
      ? 'Community gatekeeping and welfare support for women’s savings circles.'
      : jamiya.segment === 'boda_stage'
        ? 'Stage-based savings with welfare emphasis for riders and operators.'
        : null;

  return (
    <div className="space-y-10">
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
        <div className="flex flex-wrap gap-2 pt-2">
          <Button asChild variant="outline" size="sm">
            <Link href={`/circles/${slug}/community` as Route}>Meetings & chat</Link>
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link href={`/circles/${slug}/elections` as Route}>Elections</Link>
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link href={`/circles/${slug}/registration` as Route}>Circle KYC</Link>
          </Button>
          {canManageMembers ? (
            <Button asChild variant="outline" size="sm">
              <Link href={`/circles/${slug}/officer` as Route}>Officer console</Link>
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
          <dt className="text-xs uppercase tracking-wide text-muted-foreground">Contribution</dt>
          <dd className="mt-2 text-lg font-semibold">
            {formatCurrency(amount, jamiya.currency)}
          </dd>
        </div>
        <div className="rounded-xl border border-border bg-card p-5">
          <dt className="text-xs uppercase tracking-wide text-muted-foreground">Members</dt>
          <dd className="mt-2 text-lg font-semibold">
            {jamiya.member_count}/{jamiya.max_members}
          </dd>
        </div>
        <div className="rounded-xl border border-border bg-card p-5">
          <dt className="text-xs uppercase tracking-wide text-muted-foreground">Cycle</dt>
          <dd className="mt-2 text-lg font-semibold">
            {jamiya.current_cycle}/{jamiya.cycle_count}
          </dd>
        </div>
        <div className="rounded-xl border border-border bg-card p-5">
          <dt className="text-xs uppercase tracking-wide text-muted-foreground">Frequency</dt>
          <dd className="mt-2 text-lg font-semibold">
            Every {jamiya.contribution_frequency_days} days
          </dd>
        </div>
        <div className="rounded-xl border border-border bg-card p-5">
          <dt className="text-xs uppercase tracking-wide text-muted-foreground">Start date</dt>
          <dd className="mt-2 text-lg font-semibold">
            {jamiya.start_date ? formatDate(jamiya.start_date) : 'Not set'}
          </dd>
        </div>
        {creditRating ? (
          <div className="rounded-xl border border-border bg-card p-5">
            <dt className="text-xs uppercase tracking-wide text-muted-foreground">
              Your credit snapshot
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
          isCircleAdmin={Boolean(isCircleAdmin)}
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

      {isCircleAdmin ? (
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
              canManage
            />
          </section>

          <section className="space-y-4">
            <h2 className="font-[family-name:var(--font-display)] text-xl font-semibold">
              Add members
            </h2>
            <div className="rounded-xl border border-border bg-card p-6">
              <AddMemberForm jamiyaId={jamiya.id} circleName={jamiya.name} />
            </div>
          </section>

          <section className="space-y-4">
            <h2 className="font-[family-name:var(--font-display)] text-xl font-semibold">
              Invite only (link / code)
            </h2>
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
              canManage={isCircleAdmin}
            />
          </section>
        </>
      ) : membership?.status === 'active' && (fund || announcements.length) ? (
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
