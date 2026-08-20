import type { Metadata } from 'next';
import Link from 'next/link';
import type { Route } from 'next';
import { notFound, redirect } from 'next/navigation';
import { formatCurrency } from '@jamiya/shared';
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
import { paymentProvider } from '@/lib/payments/provider';
import { OfficerOverviewStrip } from '@/features/circles/components/officer-overview';
import { NextPayoutBoard } from '@/features/circles/components/circle-ops-panel';
import { CircleNoticeBanner } from '@/features/circles/components/circle-notice-banner';
import { NextContributionCard } from '@/features/circles/components/next-contribution-card';
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
    graceResult,
    { data: walletData },
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
      .limit(24),
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

  return (
    <div className="space-y-8">
      <CircleNoticeBanner notice={notices.notice} noticeType={notices.noticeType} />

      <section className="amanah-surface overflow-hidden bg-[linear-gradient(145deg,#0b5c42_0%,#0f766e_55%,#0b5c42_100%)] p-5 text-primary-foreground shadow-[0_12px_40px_rgba(11,92,66,0.2)] md:p-7">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/70">
              Amanah Circle
            </p>
            <h1 className="mt-2 text-3xl font-bold tracking-tight md:text-4xl">{jamiya.name}</h1>
            <p className="mt-2 text-sm capitalize text-white/80">
              {jamiya.status.replaceAll('_', ' ')}
              {membership ? ` · ${membership.role.replaceAll('_', ' ')}` : ''}
              {segmentLabel ? ` · ${segmentLabel}` : ''}
            </p>
          </div>
          <StatusBadge status={jamiya.status} />
        </div>
        <p className="amanah-money mt-6 text-4xl font-bold tracking-tight md:text-5xl">
          {formatCurrency(estimatedPool, jamiya.currency)}
        </p>
        <p className="mt-2 text-sm text-white/80">
          {jamiya.member_count} {circleLabels.members.toLowerCase()} · cycle{' '}
          {jamiya.cycle_count != null
            ? `${jamiya.current_cycle}/${jamiya.cycle_count}`
            : jamiya.current_cycle}{' '}
          · {cycleProgress}% complete
        </p>
        <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-white/20">
          <div
            className="h-full rounded-full bg-accent"
            style={{ width: `${cycleProgress}%` }}
          />
        </div>
        {canManageOps && jamiya.member_count < 2 ? (
          <div className="mt-5 rounded-xl bg-white/10 px-4 py-3 backdrop-blur-sm">
            <p className="text-sm font-semibold text-white">Invite 1–2 people to activate</p>
            <p className="mt-1 text-xs text-white/75">
              Circles work best with family or friends. Share a join link or short code below.
            </p>
            <Button asChild size="sm" variant="secondary" className="mt-3 min-h-10">
              <a href="#invite-people">Invite people</a>
            </Button>
          </div>
        ) : null}
        <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-4">
          <div className="rounded-xl bg-white/10 px-3 py-2.5 backdrop-blur-sm">
            <p className="text-[11px] uppercase tracking-wide text-white/65">
              {circleLabels.contribution}
            </p>
            <p className="amanah-money mt-1 text-sm font-semibold">
              {formatCurrency(amount, jamiya.currency)}
            </p>
          </div>
          <div className="rounded-xl bg-white/10 px-3 py-2.5 backdrop-blur-sm">
            <p className="text-[11px] uppercase tracking-wide text-white/65">
              {circleLabels.members}
            </p>
            <p className="mt-1 text-sm font-semibold">
              {jamiya.member_count}/{jamiya.max_members}
            </p>
          </div>
          <div className="rounded-xl bg-white/10 px-3 py-2.5 backdrop-blur-sm">
            <p className="text-[11px] uppercase tracking-wide text-white/65">
              {circleLabels.frequency}
            </p>
            <p className="mt-1 text-sm font-semibold">
              {t(circleLabels.everyDays, { days: jamiya.contribution_frequency_days })}
            </p>
          </div>
          <div className="rounded-xl bg-white/10 px-3 py-2.5 backdrop-blur-sm">
            <p className="text-[11px] uppercase tracking-wide text-white/65">
              Next payout
            </p>
            <p className="mt-1 truncate text-sm font-semibold">
              {nextPayout?.memberLabel ?? '—'}
            </p>
          </div>
        </div>
      </section>

      {(segmentBlurb || jamiya.description) && (
        <p className="max-w-2xl text-sm text-muted-foreground">
          {segmentBlurb ?? jamiya.description}
        </p>
      )}

      {jamiya.challenge_kind && jamiya.challenge_kind !== 'rotating' ? (
        <p className="text-sm text-muted-foreground">
          {jamiya.challenge_kind === 'share_dividend'
            ? 'Share / dividend group — profits and equity, not rotating payouts.'
            : 'Savings challenge — contribution rounds only, not a merry-go-round.'}
        </p>
      ) : null}

      {canActivate ? (
        <ActivateCircleButton
          jamiyaId={jamiya.id}
          slug={jamiya.slug}
          canActivate={canActivate}
        />
      ) : null}

      <section className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {[
          {
            href: (myOpenDue
              ? `/circles/${slug}#pay`
              : `/circles/${slug}#calendar`) as Route,
            label: myOpenDue ? 'Contribute' : 'Calendar',
            primary: Boolean(myOpenDue),
          },
          { href: `/circles/${slug}/statement` as Route, label: circleLabels.myStatement },
          { href: `/circles/${slug}/treasury` as Route, label: circleLabels.treasury },
          {
            href: (canManageMembers
              ? `/circles/${slug}/officer`
              : `/circles/${slug}/community`) as Route,
            label: canManageMembers ? circleLabels.officerConsole : circleLabels.meetingsChat,
          },
        ].map((action) => (
          <Button
            key={action.label}
            asChild
            variant={action.primary ? 'default' : 'outline'}
            className="min-h-11"
          >
            <Link href={action.href}>{action.label}</Link>
          </Button>
        ))}
      </section>

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
        />
      ) : null}

      <div className="flex flex-wrap gap-2">
        <Button asChild variant="ghost" size="sm">
          <Link href={`/circles/${slug}/community` as Route}>{circleLabels.meetingsChat}</Link>
        </Button>
        <Button asChild variant="ghost" size="sm">
          <Link href={`/circles/${slug}/elections` as Route}>{circleLabels.elections}</Link>
        </Button>
        <Button asChild variant="ghost" size="sm">
          <Link href={`/circles/${slug}/registration` as Route}>{circleLabels.circleKyc}</Link>
        </Button>
        <Button asChild variant="ghost" size="sm">
          <Link href={`/circles/${slug}/shares` as Route}>{circleLabels.shares}</Link>
        </Button>
        <Button asChild variant="ghost" size="sm">
          <Link href={`/circles/${slug}/journal` as Route}>{circleLabels.journal}</Link>
        </Button>
        <Button asChild variant="ghost" size="sm">
          <Link href={`/circles/${slug}/invoices` as Route}>{circleLabels.invoices}</Link>
        </Button>
        <Button asChild variant="ghost" size="sm">
          <Link href={`/circles/${slug}/arrears` as Route}>Arrears</Link>
        </Button>
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

      <section id="calendar" className="space-y-4">
        <h2 className="text-xl font-bold tracking-tight">Contribution calendar</h2>
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
      </section>

      <section className="space-y-4">
        <h2 className="font-[family-name:var(--font-display)] text-xl font-semibold">
          Payout schedule
        </h2>
        <PayoutSchedule
          payouts={payouts}
          slug={jamiya.slug}
          isCircleAdmin={Boolean(canManageOps)}
          paymentProvider={paymentProvider()}
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
        <section className="grid gap-4 sm:grid-cols-2">
          <div className="rounded-xl border border-border bg-card p-5">
            <h2 className="font-[family-name:var(--font-display)] text-lg font-semibold">
              Qard & table banking
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Request or repay circle loans, and review guarantees, without loading the whole book
              on this page.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <Button asChild size="sm">
                <Link href={'/finance/qard' as Route}>Open Qard</Link>
              </Button>
              {canManageMembers ? (
                <Button asChild variant="outline" size="sm">
                  <Link href={`/circles/${slug}/officer` as Route}>Officer loan queue</Link>
                </Button>
              ) : null}
            </div>
          </div>
          <div className="rounded-xl border border-border bg-card p-5">
            <h2 className="font-[family-name:var(--font-display)] text-lg font-semibold">
              Treasury & books
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Bank accounts, journal, fines, and savings pockets live on dedicated pages for a
              faster hub.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <Button asChild variant="outline" size="sm">
                <Link href={`/circles/${slug}/treasury` as Route}>{circleLabels.treasury}</Link>
              </Button>
              <Button asChild variant="outline" size="sm">
                <Link href={`/circles/${slug}/journal` as Route}>{circleLabels.journal}</Link>
              </Button>
            </div>
          </div>
        </section>
      ) : null}

      {canManageOps ? (
        <>
          <section id="invite-people" className="space-y-4">
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
      ) : null}

      <Button asChild variant="outline">
        <Link href={'/circles' as Route}>Back to My circles</Link>
      </Button>
    </div>
  );
}
