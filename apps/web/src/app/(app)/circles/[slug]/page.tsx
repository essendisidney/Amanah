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
import {
  MerryGoRoundBoard,
  type MerryGoRoundSlot,
} from '@/features/circles/components/merry-go-round-board';
import { MerryGoRoundPaymentsGrid } from '@/features/circles/components/merry-go-round-payments-grid';
import { CircleDetailHero } from '@/features/circles/components/circle-detail-hero';
import { CircleActionHub, type CircleHubGroup } from '@/features/circles/components/circle-action-hub';
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
      .limit(500),
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

  const isRotating =
    jamiya.challenge_kind === 'rotating' || !jamiya.challenge_kind;
  const isShareDividend = jamiya.challenge_kind === 'share_dividend';
  const isSavings = jamiya.challenge_kind === 'savings';

  const kindLabel = isShareDividend
    ? 'Share / dividend group'
    : isSavings
      ? 'Savings challenge'
      : isRotating
        ? 'Merry-go-round'
        : null;

  const heroDescription =
    segmentBlurb ?? jamiya.description ?? (kindLabel ? `${kindLabel}.` : null);

  const memberSummary = `${jamiya.member_count}/${jamiya.max_members} ${circleLabels.members.toLowerCase()}${
    jamiya.cycle_count != null
      ? ` · cycle ${jamiya.current_cycle}/${jamiya.cycle_count}`
      : ` · cycle ${jamiya.current_cycle}`
  }`;

  const merryGoRoundSlots: MerryGoRoundSlot[] = isRotating
    ? (() => {
        const rawPayouts = (payoutData ?? []) as Array<{
          id: string;
          cycle_number: number;
          member_id: string;
          amount: number | string;
          currency: string;
          status: string;
          scheduled_date: string;
        }>;
        const payoutByCycle = new Map(rawPayouts.map((p) => [p.cycle_number, p]));
        const contribsByCycle = new Map<number, typeof contributions>();
        for (const c of contributions) {
          const list = contribsByCycle.get(c.cycleNumber) ?? [];
          list.push(c);
          contribsByCycle.set(c.cycleNumber, list);
        }

        const cycleNumbers = new Set<number>([
          ...payoutByCycle.keys(),
          ...contribsByCycle.keys(),
          ...memberRows
            .map((m) => m.payout_position)
            .filter((n): n is number => typeof n === 'number'),
        ]);

        return [...cycleNumbers]
          .sort((a, b) => a - b)
          .map((cycleNumber) => {
            const rawPayout = payoutByCycle.get(cycleNumber);
            const slotMember =
              (rawPayout ? membersById.get(rawPayout.member_id) : null) ??
              memberRows.find((m) => m.payout_position === cycleNumber) ??
              null;
            const slotProfile = slotMember
              ? profilesById.get(slotMember.user_id)
              : null;
            const cycleContribs = contribsByCycle.get(cycleNumber) ?? [];
            const unpaid = cycleContribs.filter((c) =>
              ['pending', 'late', 'partial'].includes(c.status),
            );
            const paid = cycleContribs.filter(
              (c) => c.status === 'paid' || c.amountPaid > 0,
            );
            const memberLabel =
              slotProfile?.full_name ||
              slotProfile?.email ||
              slotProfile?.phone ||
              (slotMember ? 'Member' : 'Unclaimed');

            return {
              cycleNumber,
              memberLabel,
              memberCode: slotMember?.member_code ?? null,
              payoutPosition: slotMember?.payout_position ?? cycleNumber,
              amount: rawPayout
                ? typeof rawPayout.amount === 'number'
                  ? rawPayout.amount
                  : Number(rawPayout.amount)
                : amount * Math.max(jamiya.member_count, 1),
              currency: rawPayout?.currency ?? jamiya.currency,
              scheduledDate: rawPayout?.scheduled_date ?? null,
              payoutStatus: rawPayout?.status ?? null,
              paidCount: paid.length,
              unpaidCount: unpaid.length,
              unpaidLabels: unpaid
                .map((c) => c.memberLabel)
                .filter((label): label is string => Boolean(label)),
            };
          });
      })()
    : [];

  const mgrGridMembers = members.map((m) => ({
    id: m.id,
    label: m.fullName || m.phone || m.email || m.memberCode || 'Member',
  }));

  const mgrMonthMap = new Map<
    number,
    { cycleNumber: number; year: number; month: number; label: string }
  >();
  const mgrAmounts: Record<string, Record<number, number>> = {};

  const rawContribs = (contribData ?? []) as unknown as Array<{
    member_id: string;
    cycle_number: number;
    amount_paid?: number | string | null;
    due_date: string;
  }>;
  for (const row of rawContribs) {
    const due = new Date(row.due_date);
    const year = due.getFullYear();
    const month = due.getMonth() + 1;
    if (!mgrMonthMap.has(row.cycle_number)) {
      mgrMonthMap.set(row.cycle_number, {
        cycleNumber: row.cycle_number,
        year,
        month,
        label: due.toLocaleString('en-GB', { month: 'short', year: '2-digit' }),
      });
    }
    const paid =
      typeof row.amount_paid === 'number' ? row.amount_paid : Number(row.amount_paid ?? 0);
    if (!mgrAmounts[row.member_id]) mgrAmounts[row.member_id] = {};
    mgrAmounts[row.member_id]![row.cycle_number] = paid;
  }

  // If no contributions yet but cycles are planned, seed month columns from start_date.
  if (isRotating && mgrMonthMap.size === 0 && (jamiya.cycle_count ?? 0) >= 1) {
    const start = jamiya.start_date ? new Date(jamiya.start_date) : new Date();
    const freq = Math.max(jamiya.contribution_frequency_days || 30, 1);
    const cycles = Math.min(jamiya.cycle_count ?? 12, 24);
    for (let i = 0; i < cycles; i++) {
      const due = new Date(start);
      due.setDate(due.getDate() + i * freq);
      const year = due.getFullYear();
      const month = due.getMonth() + 1;
      const cycleNumber = i + 1;
      mgrMonthMap.set(cycleNumber, {
        cycleNumber,
        year,
        month,
        label: due.toLocaleString('en-GB', { month: 'short', year: '2-digit' }),
      });
    }
  }

  const mgrMonths = [...mgrMonthMap.values()].sort(
    (a, b) => a.year - b.year || a.month - b.month || a.cycleNumber - b.cycleNumber,
  );

  const hubGroups: CircleHubGroup[] = [
    {
      title: isRotating
        ? 'Merry-go-round'
        : isShareDividend
          ? 'Table banking'
          : 'Savings',
      items: [
        ...(isRotating
          ? [
              {
                href: `/circles/${slug}#merry-go-round` as Route,
                label: 'Slots & pot',
                hint: 'Who gets paid · who still owes',
                primary: true as const,
              },
              ...(canManageOps
                ? [
                    {
                      href: `/circles/${slug}#mgr-payments` as Route,
                      label: 'Monthly contributions',
                      hint: 'Enter or fix any month (past or present)',
                      primary: true as const,
                    },
                  ]
                : []),
              {
                href: `/circles/${slug}#calendar` as Route,
                label: myOpenDue ? 'Pay my due' : 'Contribution calendar',
                hint: myOpenDue
                  ? 'Your open merry-go-round payment'
                  : 'Due dates and wallet pay',
              },
            ]
          : isShareDividend
            ? [
                ...(canManageOps
                  ? [
                      {
                        href: `/circles/${slug}/books` as Route,
                        label: 'Member payments',
                        hint: 'Shares, monthly savings, loans grid',
                        primary: true as const,
                      },
                    ]
                  : []),
                {
                  href: `/circles/${slug}/shares` as Route,
                  label: 'Shares',
                  hint: 'Share capital & lots',
                },
                {
                  href: `/circles/${slug}/treasury` as Route,
                  label: 'Treasury',
                  hint: 'Cashbook and bank accounts',
                },
              ]
            : [
                {
                  href: `/circles/${slug}#calendar` as Route,
                  label: myOpenDue ? 'Pay my due' : 'Contribution calendar',
                  hint: 'Track savings dues',
                  primary: true as const,
                },
                {
                  href: `/circles/${slug}/treasury` as Route,
                  label: 'Treasury',
                  hint: 'Circle cashbook',
                },
              ]),
        {
          href: `/circles/${slug}/statement` as Route,
          label: 'My statement',
          hint: 'Share capital · contributions · penalties · loans',
        },
      ],
    },
    {
      title: 'Loans & savings',
      items: [
        {
          href: `/finance/qard?jamiyaId=${jamiya.id}` as Route,
          label: 'Qard loan',
          hint: 'Interest-free loan for this circle',
        },
        {
          href: `/finance/welfare?jamiyaId=${jamiya.id}` as Route,
          label: 'Welfare',
          hint: 'Support fund',
        },
        {
          href: `/circles/${slug}#goals` as Route,
          label: 'Circle goals',
          hint: 'School fees, trips, shared targets',
        },
        {
          href: '/finance/goals' as Route,
          label: 'All goals',
          hint: 'Personal and circle savings goals',
        },
        {
          href: '/wallet' as Route,
          label: 'Wallet',
          hint: 'Top up and pay from Money',
        },
      ],
    },
    {
      title: 'People & ops',
      items: [
        {
          href: `/circles/${slug}#members` as Route,
          label: 'Members',
          hint: `${visibleMemberCount} in this circle`,
        },
        ...(canManageOps
          ? [
              {
                href: `/circles/${slug}#invite-people` as Route,
                label: 'Add people',
                hint: 'Invite or create member accounts',
              },
            ]
          : []),
        {
          href: `/circles/${slug}/community` as Route,
          label: circleLabels.meetingsChat,
          hint: 'Meetings and chat',
        },
        ...(canManageMembers
          ? [
              {
                href: `/circles/${slug}/officer` as Route,
                label: circleLabels.officerConsole,
                hint: 'Approvals and circle settings',
              },
            ]
          : []),
        ...(!isRotating
          ? [
              {
                href: `/circles/${slug}/journal` as Route,
                label: circleLabels.journal,
                hint: 'Ledger journal',
              },
            ]
          : []),
      ],
    },
  ];

  return (
    <AppPage>
      <CircleNoticeBanner notice={notices.notice} noticeType={notices.noticeType} />

      {canManageOps ? (
        <OfficerPaymentsGuide slug={slug} challengeKind={jamiya.challenge_kind} />
      ) : null}

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

      <CircleActionHub groups={hubGroups} />

      {canActivate ? (
        <ActivateCircleButton
          jamiyaId={jamiya.id}
          slug={jamiya.slug}
          canActivate={canActivate}
        />
      ) : null}

      {membership?.status === 'active' &&
      isRotating &&
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

      <div id="goals">
        <CircleLinkedGoals jamiyaId={jamiya.id} slug={slug} userId={user.id} />
      </div>

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

      {isRotating ? (
        <CircleSection
          id="merry-go-round"
          title="Merry-go-round"
          description="Payout slots, who has received the pot, and who still owes this round."
          padded={false}
        >
          <MerryGoRoundBoard
            circleName={jamiya.name}
            contributionAmount={amount}
            currency={jamiya.currency}
            currentCycle={jamiya.current_cycle}
            slots={merryGoRoundSlots}
          />
        </CircleSection>
      ) : null}

      {canManageOps && isRotating ? (
        <CircleSection
          id="mgr-payments"
          title="Monthly contributions"
          description="Record what each member paid for any month — past or present. Empty cells mean they did not contribute."
          padded={false}
        >
          <div className="amanah-surface px-4 py-4 sm:px-5">
            <MerryGoRoundPaymentsGrid
              jamiyaId={jamiya.id}
              slug={slug}
              members={mgrGridMembers}
              months={mgrMonths}
              amounts={mgrAmounts}
              defaultAmount={amount}
            />
          </div>
        </CircleSection>
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

        {isRotating ? (
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
        ) : null}
      </div>

      <CircleSection
        id="calendar"
        title={isRotating ? 'Monthly contributions' : 'Contribution calendar'}
        description={
          isRotating
            ? 'Each month’s dues. Officers mark cash received; members can also pay from wallet.'
            : 'Due dates and wallet payments for each cycle.'
        }
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
          officerCashCapture={isRotating || isSavings}
        />
      </CircleSection>

      {canManageOps && !isRotating ? (
        <CircleSection
          id="contribution-ledger"
          title="Contribution ledger"
          description="Who has paid, who owes, and payment history from wallet."
          padded={false}
        >
          <ContributionLedger rows={ledgerRows} payments={paymentHistory} />
        </CircleSection>
      ) : null}

      {isRotating || isSavings ? (
        <CircleSection
          title={isRotating ? 'Who gets the pot' : 'Payout schedule'}
          description={
            isRotating
              ? 'Each slot’s turn to receive the merry-go-round payout.'
              : undefined
          }
          padded={false}
        >
          <PayoutSchedule
            payouts={payouts}
            slug={jamiya.slug}
            isCircleAdmin={Boolean(canManageOps)}
            paymentProvider={paymentProvider()}
          />
        </CircleSection>
      ) : null}

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
          canRecordPayments={Boolean(canManageOps) && isShareDividend}
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
        <section id="finance" className="grid gap-4 sm:grid-cols-2">
          <div className="amanah-surface p-5">
            <h2 className="font-[family-name:var(--font-display)] text-lg font-semibold">
              Loans & welfare
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Qard Hassan, welfare support, and partner Tawarruq — this circle is preselected where
              possible.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <Button asChild size="sm" className="rounded-full">
                <Link href={`/finance/qard?jamiyaId=${jamiya.id}` as Route}>Qard loan</Link>
              </Button>
              <Button asChild variant="outline" size="sm" className="rounded-full">
                <Link href={`/finance/welfare?jamiyaId=${jamiya.id}` as Route}>Welfare</Link>
              </Button>
              <Button asChild variant="outline" size="sm" className="rounded-full">
                <Link href={'/finance/tawarruq' as Route}>Tawarruq</Link>
              </Button>
              <Button asChild variant="outline" size="sm" className="rounded-full">
                <Link href={`/circles/${slug}#goals` as Route}>Goals</Link>
              </Button>
            </div>
          </div>
          <div className="amanah-surface p-5">
            <h2 className="font-[family-name:var(--font-display)] text-lg font-semibold">
              {isRotating ? 'Statement & people' : 'Treasury & books'}
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              {isRotating
                ? 'See your share of contributions and penalties, or manage members.'
                : 'Record shares, savings, and loans — or open the full cashbook.'}
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <Button asChild size="sm" className="rounded-full">
                <Link href={`/circles/${slug}/statement` as Route}>Statement</Link>
              </Button>
              {canManageOps && isShareDividend ? (
                <Button asChild size="sm" variant="outline" className="rounded-full">
                  <Link href={`/circles/${slug}/books` as Route}>Member payments</Link>
                </Button>
              ) : null}
              {canManageOps && isRotating ? (
                <Button asChild size="sm" variant="outline" className="rounded-full">
                  <a href="#mgr-payments">Monthly contributions</a>
                </Button>
              ) : null}
              {!isRotating ? (
                <>
                  <Button asChild variant="outline" size="sm" className="rounded-full">
                    <Link href={`/circles/${slug}/treasury` as Route}>{circleLabels.treasury}</Link>
                  </Button>
                  <Button asChild variant="outline" size="sm" className="rounded-full">
                    <Link href={`/circles/${slug}/journal` as Route}>{circleLabels.journal}</Link>
                  </Button>
                </>
              ) : (
                <Button asChild variant="outline" size="sm" className="rounded-full">
                  <a href="#members">Members</a>
                </Button>
              )}
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
