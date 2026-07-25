import type { Metadata } from 'next';
import Link from 'next/link';
import type { Route } from 'next';
import { notFound, redirect } from 'next/navigation';
import { formatCurrency, formatDate } from '@jamiya/shared';
import { Button } from '@jamiya/ui';
import { createClient } from '@/lib/supabase/server';
import { StatusBadge } from '@/features/dashboard/components/dashboard-stats';
import { InviteMemberForm } from '@/features/jamiya/components/invite-member-form';
import {
  MembersList,
  PendingInvitationsList,
  type InvitationListItem,
  type MemberListItem,
} from '@/features/jamiya/components/members-and-invites';
import {
  ActivateCircleButton,
  ContributionCalendar,
  PayoutSchedule,
  type ScheduleContribution,
  type SchedulePayout,
} from '@/features/jamiya/components/schedule-panel';
import { OpenDisputeForm } from '@/features/jamiya/components/open-dispute-form';

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
  contribution_amount: number | string;
  currency: string;
  max_members: number;
  member_count: number;
  cycle_count: number;
  current_cycle: number;
  contribution_frequency_days: number;
  start_date: string | null;
};

type Props = {
  params: Promise<{ slug: string }>;
};

export default async function JamiyaDetailsPage({ params }: Props) {
  const { slug } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(`/login?next=/jamiyas/${slug}`);
  }

  const { data } = await supabase
    .from('jamiyas')
    .select(
      `
      id, name, slug, description, status, contribution_amount, currency,
      max_members, member_count, cycle_count, current_cycle,
      contribution_frequency_days, start_date
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
  ] = await Promise.all([
    supabase
      .from('members')
      .select('id, role, status, payout_position, joined_at, user_id')
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
      .select('id, cycle_number, amount, currency, status, due_date, member_id')
      .eq('jamiya_id', jamiya.id)
      .order('due_date', { ascending: true })
      .limit(120),
    supabase
      .from('payouts')
      .select('id, cycle_number, amount, currency, status, scheduled_date, member_id')
      .eq('jamiya_id', jamiya.id)
      .order('cycle_number', { ascending: true })
      .limit(60),
  ]);

  const membership = myMembership as unknown as {
    id: string;
    role: string;
    status: string;
  } | null;
  const isCircleAdmin =
    membership?.role === 'circle_admin' && membership.status === 'active';
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
  }>;

  const userIds = memberRows.map((row) => row.user_id);
  const { data: profileRows } =
    userIds.length > 0
      ? await supabase.from('profiles').select('id, full_name, email').in('id', userIds)
      : { data: [] };

  const profilesById = new Map(
    ((profileRows ?? []) as unknown as Array<{
      id: string;
      full_name: string | null;
      email: string | null;
    }>).map((row) => [row.id, row]),
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
      currency: string;
      status: string;
      due_date: string;
      member_id: string;
    }>
  ).map((row) => ({
    id: row.id,
    cycleNumber: row.cycle_number,
    amount: typeof row.amount === 'number' ? row.amount : Number(row.amount),
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
    };
  });

  return (
    <div className="space-y-10">
      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge status={jamiya.status} />
          {membership ? <StatusBadge status={membership.role} /> : null}
        </div>
        <h1 className="font-[family-name:var(--font-display)] text-4xl font-semibold tracking-tight">
          {jamiya.name}
        </h1>
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
      </div>

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
        <h2 className="font-[family-name:var(--font-display)] text-xl font-semibold">
          Members
        </h2>
        <MembersList members={members} />
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
              Invite members
            </h2>
            <div className="rounded-xl border border-border bg-card p-6">
              <InviteMemberForm jamiyaId={jamiya.id} />
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
      ) : null}

      <Button asChild variant="outline">
        <Link href={'/jamiyas' as Route}>Back to My circles</Link>
      </Button>
    </div>
  );
}
