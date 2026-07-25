import { createClient } from '@/lib/supabase/server';
import type {
  DashboardContribution,
  DashboardData,
  DashboardJamiya,
  DashboardNotification,
  DashboardPayout,
  DashboardProfile,
  DashboardWallet,
} from '../types';

type MembershipRow = {
  id: string;
  role: DashboardJamiya['role'];
  status: DashboardJamiya['status'];
  payout_position: number | null;
  jamiya:
    | {
        id: string;
        name: string;
        slug: string;
        status: DashboardJamiya['jamiya']['status'];
        contribution_amount: number | string;
        currency: string;
        max_members: number;
        member_count: number;
        cycle_count: number;
        current_cycle: number;
        start_date: string | null;
      }
    | null
    | Array<{
        id: string;
        name: string;
        slug: string;
        status: DashboardJamiya['jamiya']['status'];
        contribution_amount: number | string;
        currency: string;
        max_members: number;
        member_count: number;
        cycle_count: number;
        current_cycle: number;
        start_date: string | null;
      }>;
};

type ContributionRow = {
  id: string;
  cycle_number: number;
  amount: number | string;
  currency: string;
  status: DashboardContribution['status'];
  due_date: string;
  jamiya_id: string;
  jamiya:
    | { name: string; slug: string }
    | null
    | Array<{ name: string; slug: string }>;
};

type PayoutRow = {
  id: string;
  cycle_number: number;
  amount: number | string;
  currency: string;
  status: DashboardPayout['status'];
  scheduled_date: string;
  jamiya_id: string;
  jamiya:
    | { name: string; slug: string }
    | null
    | Array<{ name: string; slug: string }>;
};

type NotificationRow = {
  id: string;
  type: DashboardNotification['type'];
  title: string;
  body: string;
  read_at: string | null;
  created_at: string;
};

type WalletRow = {
  id: string;
  balance: number | string;
  available_balance: number | string;
  currency: string;
};

function asSingle<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null;
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

function toNumber(value: number | string): number {
  return typeof value === 'number' ? value : Number(value);
}

export async function getDashboardData(userId: string): Promise<DashboardData> {
  const supabase = await createClient();

  const [
    profileResult,
    membershipsResult,
    notificationsResult,
    unreadResult,
    walletResult,
  ] = await Promise.all([
    supabase
      .from('profiles')
      .select('full_name, email, platform_role, kyc_status, profile_completed')
      .eq('id', userId)
      .maybeSingle(),
    supabase
      .from('members')
      .select(
        `
        id,
        role,
        status,
        payout_position,
        jamiya:jamiyas (
          id,
          name,
          slug,
          status,
          contribution_amount,
          currency,
          max_members,
          member_count,
          cycle_count,
          current_cycle,
          start_date
        )
      `,
      )
      .eq('user_id', userId)
      .in('status', ['active', 'invited'])
      .order('created_at', { ascending: false }),
    supabase
      .from('notifications')
      .select('id, type, title, body, read_at, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(6),
    supabase
      .from('notifications')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .is('read_at', null),
    supabase
      .from('wallets')
      .select('id, balance, available_balance, currency')
      .eq('user_id', userId)
      .eq('currency', 'KES')
      .maybeSingle(),
  ]);

  const profile = profileResult.data
    ? (profileResult.data as unknown as DashboardProfile)
    : null;

  const membershipRows = (membershipsResult.data ?? []) as unknown as MembershipRow[];
  const jamiyas: DashboardJamiya[] = membershipRows
    .map((row) => {
      const jamiya = asSingle(row.jamiya);
      if (!jamiya) return null;
      return {
        membershipId: row.id,
        role: row.role,
        status: row.status,
        payoutPosition: row.payout_position,
        jamiya: {
          id: jamiya.id,
          name: jamiya.name,
          slug: jamiya.slug,
          status: jamiya.status,
          contributionAmount: toNumber(jamiya.contribution_amount),
          currency: jamiya.currency,
          maxMembers: jamiya.max_members,
          memberCount: jamiya.member_count,
          cycleCount: jamiya.cycle_count,
          currentCycle: jamiya.current_cycle,
          startDate: jamiya.start_date,
        },
      } satisfies DashboardJamiya;
    })
    .filter((item): item is DashboardJamiya => item !== null);

  const memberIds = membershipRows.map((row) => row.id);

  let contributions: DashboardContribution[] = [];
  let payouts: DashboardPayout[] = [];

  if (memberIds.length > 0) {
    const [contributionsResult, payoutsResult] = await Promise.all([
      supabase
        .from('contributions')
        .select(
          `
          id,
          cycle_number,
          amount,
          currency,
          status,
          due_date,
          jamiya_id,
          jamiya:jamiyas ( name, slug )
        `,
        )
        .in('member_id', memberIds)
        .in('status', ['pending', 'late'])
        .order('due_date', { ascending: true })
        .limit(8),
      supabase
        .from('payouts')
        .select(
          `
          id,
          cycle_number,
          amount,
          currency,
          status,
          scheduled_date,
          jamiya_id,
          jamiya:jamiyas ( name, slug )
        `,
        )
        .in('member_id', memberIds)
        .in('status', ['scheduled', 'processing'])
        .order('scheduled_date', { ascending: true })
        .limit(8),
    ]);

    contributions = ((contributionsResult.data ?? []) as unknown as ContributionRow[])
      .map((row) => {
        const jamiya = asSingle(row.jamiya);
        if (!jamiya) return null;
        return {
          id: row.id,
          cycleNumber: row.cycle_number,
          amount: toNumber(row.amount),
          currency: row.currency,
          status: row.status,
          dueDate: row.due_date,
          jamiyaName: jamiya.name,
          jamiyaSlug: jamiya.slug,
          jamiyaId: row.jamiya_id,
        } satisfies DashboardContribution;
      })
      .filter((item): item is DashboardContribution => item !== null);

    payouts = ((payoutsResult.data ?? []) as unknown as PayoutRow[])
      .map((row) => {
        const jamiya = asSingle(row.jamiya);
        if (!jamiya) return null;
        return {
          id: row.id,
          cycleNumber: row.cycle_number,
          amount: toNumber(row.amount),
          currency: row.currency,
          status: row.status,
          scheduledDate: row.scheduled_date,
          jamiyaName: jamiya.name,
          jamiyaSlug: jamiya.slug,
          jamiyaId: row.jamiya_id,
        } satisfies DashboardPayout;
      })
      .filter((item): item is DashboardPayout => item !== null);
  }

  const notifications = (
    (notificationsResult.data ?? []) as unknown as NotificationRow[]
  ).map(
    (row) =>
      ({
        id: row.id,
        type: row.type,
        title: row.title,
        body: row.body,
        readAt: row.read_at,
        createdAt: row.created_at,
      }) satisfies DashboardNotification,
  );

  const walletRow = walletResult.data
    ? (walletResult.data as unknown as WalletRow)
    : null;
  const wallet: DashboardWallet | null = walletRow
    ? {
        id: walletRow.id,
        balance: toNumber(walletRow.balance),
        availableBalance: toNumber(walletRow.available_balance),
        currency: walletRow.currency,
      }
    : null;

  return {
    profile,
    jamiyas,
    contributions,
    payouts,
    notifications,
    wallet,
    unreadNotificationCount: unreadResult.count ?? 0,
    stats: {
      activeCircles: jamiyas.filter((item) => item.status === 'active').length,
      pendingContributions: contributions.length,
      upcomingPayouts: payouts.length,
    },
  };
}
