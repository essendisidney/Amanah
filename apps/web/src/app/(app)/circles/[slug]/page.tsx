import type { Metadata } from 'next';
import Link from 'next/link';
import type { Route } from 'next';
import { notFound, redirect } from 'next/navigation';
import { formatCurrency } from '@jamiya/shared';
import { Button } from '@jamiya/ui';
import { getAuthUser } from '@/lib/supabase/auth';
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
import { paymentProvider } from '@/lib/payments/provider';
import { OfficerOverviewStrip } from '@/features/circles/components/officer-overview';
import { NextPayoutBoard } from '@/features/circles/components/circle-ops-panel';
import { CircleNoticeBanner } from '@/features/circles/components/circle-notice-banner';
import { NextContributionCard } from '@/features/circles/components/next-contribution-card';
import { ContributionLedger } from '@/features/circles/components/contribution-ledger';
import { ClaimPayoutSlotForm } from '@/features/circles/components/claim-payout-slot-form';
import { CircleLinkedGoals } from '@/features/circles/components/circle-linked-goals';
import { OfficerPaymentsGuide } from '@/features/circles/components/officer-payments-guide';
import { CircleDetailHero } from '@/features/circles/components/circle-detail-hero';
import { CircleQuickNav } from '@/features/circles/components/circle-quick-nav';
import { CircleSection } from '@/features/circles/components/circle-section';
import { AppPage } from '@/components/app-page';
import { getDictionary } from '@/i18n/get-dictionary';
import { t } from '@/i18n/dictionaries';
import { getSiteUrl } from '@/lib/site-url';

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
  slot_pricing_enabled?: boolean | null;
  early_slot_fee_pct?: number | string | null;
  late_slot_rebate_pct?: number | string | null;
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

  const { data: pricingRow } = await supabase
    .from('jamiyas')
    .select('slot_pricing_enabled, early_slot_fee_pct, late_slot_rebate_pct')
    .eq('id', jamiya.id)
    .maybeSingle();
  const pricing = pricingRow as {
    slot_pricing_enabled?: boolean | null;
    early_slot_fee_pct?: number | string | null;
    late_slot_rebate_pct?: number | string | null;
  } | null;
  if (pricing) {
    jamiya.slot_pricing_enabled = pricing.slot_pricing_enabled;
    jamiya.early_slot_fee_pct = pricing.early_slot_fee_pct;
    jamiya.late_slot_rebate_pct = pricing.late_slot_rebate_pct;
  }
  const amount =
    typeof jamiya.contribution_amount === 'number'
      ? jamiya.contribution_amount
      : Number(jamiya.contribution_amount);

  const [
    { data: membersData },
    { data: invitesData },
    { data: contribData },
    { data: payoutData },
    graceResult,
    { data: walletData },
    { data: paymentData },
  ] = await Promise.all([
    supabase
      .from('members')
      .select('id, role, status, payout_position, joined_at, user_id, member_code')
      .eq('jamiya_id', jamiya.id)
      .order('joined_at', { ascending: true }),
    supabase
      .from('invitations')
      .select('id, email, phone, status, expires_at, created_at, invite_code')
      .eq('jamiya_id', jamiya.id)
      .eq('status', 'pending')
      .order('created_at', { ascending: false }),
    supabase
      .from('contributions')
      .select(
        'id, cycle_number, amount, amount_paid, currency, status, due_date, member_id, paid_at',
      )
      .eq('jamiya_id', jamiya.id)
      .order('due_date', { ascending: true })
      .limit(200),
    supabase
      .from('payouts')
      .select(
        'id, cycle_number, amount, currency, status, scheduled_date, member_id, receipt_confirmed_at',
      )
      .eq('jamiya_id', jamiya.id)
      .order('cycle_number', { ascending: true })
      .limit(24),
    supabase
      .from('grace_period_requests')
      .select('id', { count: 'exact', head: true })
      .eq('jamiya_id', jamiya.id)
      .eq('status', 'pending'),
    supabase
      .from('wallets')
      .select('available_balance, currency')
      .eq('user_id', user.id)
      .eq('currency', jamiya.currency)
      .maybeSingle(),
    supabase
      .from('contribution_payments')
      .select(
        'id, amount, currency, paid_at, created_by, contribution_id, contributions!inner(jamiya_id, cycle_number, member_id)',
      )
      .eq('contributions.jamiya_id', jamiya.id)
      .order('paid_at', { ascending: false })
      .limit(80),
  ]);

  const pendingGraceCount = graceResult.count ?? 0;
  const walletRow = walletData as
    | { available_balance: number | string; currency: string }
    | null;
  const walletAvailable = walletRow
    ? typeof walletRow.available_balance === 'number'
      ? walletRow.available_balance
      : Number(walletRow.available_balance)
    : null;
  const walletCurrency = walletRow?.currency ?? jamiya.currency;

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

  const members: MemberListItem[] = memberRows
    .filter((row) => row.status !== 'removed' && row.status !== 'left')
    .map((row) => {
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

  const visibleMemberCount = members.length;

  const membersById = new Map(memberRows.map((row) => [row.id, row]));

  const invitations: InvitationListItem[] = (
    (invitesData ?? []) as unknown as Array<{
      id: string;
      email: string | null;
      phone: string | null;
      status: string;
      expires_at: string;
      created_at: string;
      invite_code: string | null;
    }>
  ).map((row) => ({
    id: row.id,
    email: row.email,
    phone: row.phone,
    status: row.status,
    expiresAt: row.expires_at,
    createdAt: row.created_at,
    inviteCode: row.invite_code,
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
      paid_at?: string | null;
    }>
  ).map((row) => {
    const member = membersById.get(row.member_id);
    const profile = member ? profilesById.get(member.user_id) : null;
    return {
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
      memberLabel:
        canManageOps || membership?.id === row.member_id
          ? profile?.full_name || profile?.email || profile?.phone || 'Member'
          : undefined,
      memberPhone: canManageOps ? (profile?.phone ?? null) : null,
      paidAt: row.paid_at ?? null,
    };
  });

  const paymentRaw = (paymentData ?? []) as unknown as Array<{
    id: string;
    amount: number | string;
    currency: string;
    paid_at: string;
    created_by: string;
    contribution_id: string;
    contributions:
      | { jamiya_id: string; cycle_number: number; member_id: string }
      | Array<{ jamiya_id: string; cycle_number: number; member_id: string }>;
  }>;

  const recorderIds = [
    ...new Set(paymentRaw.map((p) => p.created_by).filter(Boolean)),
  ];
  const missingRecorderIds = recorderIds.filter((id) => !profilesById.has(id));
  if (missingRecorderIds.length > 0) {
    const { data: recorderRows } = await supabase
      .from('profiles')
      .select('id, full_name, email, phone')
      .in('id', missingRecorderIds);
    for (const row of (recorderRows ?? []) as Array<{
      id: string;
      full_name: string | null;
      email: string | null;
      phone: string | null;
    }>) {
      profilesById.set(row.id, row);
    }
  }

  const ledgerRows = contributions.map((c) => ({
    id: c.id,
    memberLabel: c.memberLabel ?? 'Member',
    memberPhone: c.memberPhone ?? null,
    cycleNumber: c.cycleNumber,
    amount: c.amount,
    amountPaid: c.amountPaid,
    currency: c.currency,
    status: c.status,
    dueDate: c.dueDate,
    paidAt: c.paidAt ?? null,
  }));

  const paymentHistory = paymentRaw.map((row) => {
    const contrib = Array.isArray(row.contributions)
      ? row.contributions[0]
      : row.contributions;
    const member = contrib ? membersById.get(contrib.member_id) : null;
    const memberProfile = member ? profilesById.get(member.user_id) : null;
    const recorder = profilesById.get(row.created_by);
    return {
      id: row.id,
      amount: typeof row.amount === 'number' ? row.amount : Number(row.amount),
      currency: row.currency,
      paidAt: row.paid_at,
      memberLabel:
        memberProfile?.full_name ||
        memberProfile?.email ||
        memberProfile?.phone ||
        'Member',
      cycleNumber: contrib?.cycle_number ?? 0,
      recordedByLabel:
        recorder?.full_name || recorder?.email || recorder?.phone || 'Officer',
    };
  });

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

  const contributedTotal = contributions.reduce((sum, row) => sum + row.amountPaid, 0);
  const cycleProgress =
    jamiya.cycle_count && jamiya.cycle_count > 0
      ? Math.min(100, Math.round((jamiya.current_cycle / jamiya.cycle_count) * 100))
      : 0;
  const myOpenDue = contributions.find((c) => c.isMine && ['pending', 'late', 'partial'].includes(c.status));
  const estimatedPool =
    contributedTotal > 0
      ? contributedTotal
      : amount * Math.max(jamiya.current_cycle, 1) * Math.max(jamiya.member_count, 1);

  const kindLabel =
    jamiya.challenge_kind === 'share_dividend'
      ? 'Share / dividend group'
      : jamiya.challenge_kind === 'savings'
        ? 'Savings challenge'
        : null;

  const heroDescription =
    segmentBlurb ?? jamiya.description ?? (kindLabel ? `${kindLabel}.` : null);

  const memberSummary = `${jamiya.member_count}/${jamiya.max_members} ${circleLabels.members.toLowerCase()}${
    jamiya.cycle_count != null
      ? ` · cycle ${jamiya.current_cycle}/${jamiya.cycle_count}`
      : ` · cycle ${jamiya.current_cycle}`
  }`;

  const primaryNav = [
    ...(myOpenDue
      ? [{ href: `/circles/${slug}#pay` as Route, label: 'Contribute', primary: true }]
      : [{ href: `/circles/${slug}#calendar` as Route, label: 'Calendar' }]),
    ...(canManageOps
      ? [{ href: `/circles/${slug}/books` as Route, label: 'Member payments', primary: true }]
      : []),
    { href: `/circles/${slug}/statement` as Route, label: circleLabels.myStatement },
    { href: `/circles/${slug}/treasury` as Route, label: circleLabels.treasury },
    {
      href: (canManageMembers ? `/circles/${slug}/officer` : `/circles/${slug}/community`) as Route,
      label: canManageMembers ? circleLabels.officerConsole : circleLabels.meetingsChat,
    },
  ];

  const secondaryNav = [
    { href: `/circles/${slug}/community` as Route, label: circleLabels.meetingsChat },
    { href: `/circles/${slug}/elections` as Route, label: circleLabels.elections },
    { href: `/circles/${slug}/registration` as Route, label: circleLabels.circleKyc },
    { href: `/circles/${slug}/shares` as Route, label: circleLabels.shares },
    { href: `/circles/${slug}/journal` as Route, label: circleLabels.journal },
    { href: `/circles/${slug}/invoices` as Route, label: circleLabels.invoices },
    ...(canManageMembers
      ? [{ href: `/circles/${slug}/arrears` as Route, label: circleLabels.arrears }]
      : []),
  ];

  return (
    <AppPage>
      <CircleNoticeBanner notice={notices.notice} noticeType={notices.noticeType} />

      {canManageOps ? <OfficerPaymentsGuide slug={slug} /> : null}

      <CircleDetailHero
        slug={slug}
        name={jamiya.name}
        status={jamiya.status}
        roleLabel={membership ? membership.role.replaceAll('_', ' ') : null}
        segmentLabel={segmentLabel}
        kindLabel={kindLabel}
        description={heroDescription}
        poolAmount={estimatedPool}
        currency={jamiya.currency}
        memberSummary={memberSummary}
        stats={[
          {
            label: circleLabels.contribution,
            value: formatCurrency(amount, jamiya.currency),
          },
          {
            label: circleLabels.frequency,
            value: t(circleLabels.everyDays, { days: jamiya.contribution_frequency_days }),
          },
          {
            label: 'Next payout',
            value: nextPayout?.memberLabel ?? '—',
          },
          {
            label: 'Progress',
            value: `${cycleProgress}%`,
          },
        ]}
      />

      {canManageOps && jamiya.member_count < 2 ? (
        <p className="text-sm text-muted-foreground">
          Invite people to activate.{' '}
          <a href="#invite-people" className="font-medium text-primary hover:underline">
            Invite
          </a>
        </p>
      ) : null}

      <CircleQuickNav primary={primaryNav} secondary={secondaryNav} />

      {canActivate ? (
        <ActivateCircleButton
          jamiyaId={jamiya.id}
          slug={jamiya.slug}
          canActivate={canActivate}
        />
      ) : null}

      {membership?.status === 'active' &&
      (jamiya.challenge_kind === 'rotating' || !jamiya.challenge_kind) &&
      jamiya.status !== 'active' ? (
        <ClaimPayoutSlotForm
          jamiyaId={jamiya.id}
          slug={slug}
          maxSlots={Math.max(jamiya.cycle_count ?? 0, jamiya.max_members, 1)}
          takenPositions={memberRows
            .filter((m) => m.id !== membership.id)
            .map((m) => m.payout_position)
            .filter((n): n is number => typeof n === 'number')}
          contributionAmount={amount}
          currency={jamiya.currency}
          slotPricingEnabled={Boolean(jamiya.slot_pricing_enabled)}
          earlySlotFeePct={Number(jamiya.early_slot_fee_pct ?? 0)}
          lateSlotRebatePct={Number(jamiya.late_slot_rebate_pct ?? 0)}
          currentPosition={membership.payout_position}
        />
      ) : null}

      <CircleLinkedGoals jamiyaId={jamiya.id} slug={slug} userId={user.id} />

      {myOpenDue ? (
        <NextContributionCard
          contributionId={myOpenDue.id}
          slug={slug}
          amount={myOpenDue.amount}
          amountPaid={myOpenDue.amountPaid}
          currency={myOpenDue.currency}
          dueDate={myOpenDue.dueDate}
          status={myOpenDue.status}
          walletAvailable={
            walletAvailable != null && Number.isFinite(walletAvailable)
              ? walletAvailable
              : null
          }
          walletCurrency={walletCurrency}
          labels={dict.contributionCard}
        />
      ) : null}

      <div className="grid gap-4 lg:grid-cols-2">
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
      </div>

      <CircleSection
        id="calendar"
        title="Contribution calendar"
        description="Due dates and wallet payments for each cycle."
        padded={false}
      >
        <ContributionCalendar
          contributions={contributions}
          slug={jamiya.slug}
          walletAvailable={
            walletAvailable != null && Number.isFinite(walletAvailable)
              ? walletAvailable
              : null
          }
          walletCurrency={walletCurrency}
          canActivate={canActivate}
          canManageOps={Boolean(canManageOps)}
          memberCount={jamiya.member_count}
        />
      </CircleSection>

      {canManageOps ? (
        <CircleSection
          id="contribution-ledger"
          title="Contribution ledger"
          description="Who has paid, who owes, and payment history from wallet."
          padded={false}
        >
          <ContributionLedger rows={ledgerRows} payments={paymentHistory} />
        </CircleSection>
      ) : null}

      <CircleSection title="Payout schedule" padded={false}>
        <PayoutSchedule
          payouts={payouts}
          slug={jamiya.slug}
          isCircleAdmin={Boolean(canManageOps)}
          paymentProvider={paymentProvider()}
        />
      </CircleSection>

      <CircleSection
        id="members"
        title={`Members (${visibleMemberCount})`}
        description="Everyone who has joined this chama. After you add or invite someone, refresh or tap Add people."
        action={
          membership?.status === 'active' &&
          ['circle_admin', 'chair', 'treasurer', 'secretary'].includes(membership?.role ?? '') ? (
            <div className="flex flex-wrap gap-2">
              <Button asChild size="sm" variant="outline" className="rounded-full">
                <a href="#invite-people">Add people</a>
              </Button>
              <ExportCircleReportButtons slug={jamiya.slug} />
            </div>
          ) : undefined
        }
        padded={false}
      >
        <MembersList
          members={members}
          slug={slug}
          canManage={canManageMembers}
          canRecordPayments={Boolean(canManageOps)}
        />
      </CircleSection>

      {canManageOps ? (
        <>
          <CircleSection
            id="invite-people"
            title="Add people (manual)"
            description="Create their Amanah account now. They get a join link and code to sign in."
          >
            <AddMemberForm jamiyaId={jamiya.id} circleName={jamiya.name} />
          </CircleSection>

          <CircleSection
            title="Join link / invite code"
            description="Share by SMS, copy link/code, email, or WhatsApp."
          >
            <InviteMemberForm jamiyaId={jamiya.id} circleName={jamiya.name} />
          </CircleSection>

          <CircleSection
            title={`Pending invitations (${invitations.length})`}
            description="Waiting to accept. Once they join, they appear under Members."
            padded={false}
          >
            <PendingInvitationsList
              invitations={invitations}
              slug={jamiya.slug}
              canManage={canManageOps}
              siteUrl={getSiteUrl()}
              circleName={jamiya.name}
            />
          </CircleSection>
        </>
      ) : null}

      {membership?.status === 'active' ? (
        <CircleSection title="Open a dispute">
          <OpenDisputeForm jamiyaId={jamiya.id} slug={jamiya.slug} />
        </CircleSection>
      ) : null}

      {membership?.status === 'active' ? (
        <section className="grid gap-4 sm:grid-cols-2">
          <div className="amanah-surface p-5">
            <h2 className="font-[family-name:var(--font-display)] text-lg font-semibold">
              Circle finance
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Qard loans, welfare support, and partner Tawarruq — circle preselected where
              possible.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <Button asChild size="sm" className="rounded-full">
                <Link href={`/finance/qard?jamiyaId=${jamiya.id}` as Route}>Qard Hassan</Link>
              </Button>
              <Button asChild variant="outline" size="sm" className="rounded-full">
                <Link href={`/finance/welfare?jamiyaId=${jamiya.id}` as Route}>Welfare</Link>
              </Button>
              <Button asChild variant="outline" size="sm" className="rounded-full">
                <Link href={'/finance/tawarruq' as Route}>Tawarruq</Link>
              </Button>
              {canManageMembers ? (
                <Button asChild variant="ghost" size="sm" className="rounded-full">
                  <Link href={`/circles/${slug}/officer` as Route}>Officer queue</Link>
                </Button>
              ) : null}
            </div>
          </div>
          <div className="amanah-surface p-5">
            <h2 className="font-[family-name:var(--font-display)] text-lg font-semibold">
              Treasury & books
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Record each member&apos;s shares, savings, and loans in one place — or open the full
              cashbook.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              {canManageOps ? (
                <Button asChild size="sm" className="rounded-full">
                  <Link href={`/circles/${slug}/books` as Route}>Member payments</Link>
                </Button>
              ) : null}
              <Button asChild variant="outline" size="sm" className="rounded-full">
                <Link href={`/circles/${slug}/treasury` as Route}>{circleLabels.treasury}</Link>
              </Button>
              <Button asChild variant="outline" size="sm" className="rounded-full">
                <Link href={`/circles/${slug}/journal` as Route}>{circleLabels.journal}</Link>
              </Button>
            </div>
          </div>
        </section>
      ) : null}

      <Button asChild variant="outline" className="rounded-full">
        <Link href={'/circles' as Route}>Back to My circles</Link>
      </Button>
    </AppPage>
  );
}
