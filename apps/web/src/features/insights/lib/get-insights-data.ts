import { createClient } from '@/lib/supabase/server';
import { getDashboardData } from '@/features/dashboard';
import type { DashboardData } from '@/features/dashboard';

export type InsightsData = {
  dashboard: DashboardData;
  monthInflow: number;
  monthOutflow: number;
  currency: string;
  onTimeRate: number | null;
  paidCount: number;
  lateCount: number;
  openDueTotal: number;
};

function toNumber(value: number | string | null | undefined): number {
  if (value == null) return 0;
  return typeof value === 'number' ? value : Number(value);
}

export async function getInsightsData(userId: string): Promise<InsightsData> {
  const dashboard = await getDashboardData(userId);
  const supabase = await createClient();

  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);
  const monthIso = monthStart.toISOString();

  const memberIds = dashboard.jamiyas.map((item) => item.membershipId);
  const currency = dashboard.wallet?.currency ?? 'KES';

  const [monthTxResult, historyResult] = await Promise.all([
    supabase
      .from('transactions')
      .select('amount, direction, status, currency')
      .eq('user_id', userId)
      .eq('status', 'completed')
      .gte('created_at', monthIso)
      .limit(200),
    memberIds.length > 0
      ? supabase
          .from('contributions')
          .select('status')
          .in('member_id', memberIds)
          .in('status', ['paid', 'late'])
          .order('due_date', { ascending: false })
          .limit(100)
      : Promise.resolve({ data: [] as Array<{ status: string }> }),
  ]);

  const monthTx = (monthTxResult.data ?? []) as Array<{
    amount: number | string;
    direction: string;
    status: string;
    currency: string;
  }>;

  let monthInflow = 0;
  let monthOutflow = 0;
  for (const row of monthTx) {
    const amount = toNumber(row.amount);
    if (row.direction === 'credit') monthInflow += amount;
    else if (row.direction === 'debit') monthOutflow += amount;
  }

  const history = (historyResult.data ?? []) as Array<{ status: string }>;
  const paidCount = history.filter((row) => row.status === 'paid').length;
  const lateCount = history.filter((row) => row.status === 'late').length;
  const scored = paidCount + lateCount;
  const onTimeRate = scored > 0 ? Math.round((paidCount / scored) * 100) : null;

  const openDueTotal = dashboard.contributions.reduce(
    (sum, item) => sum + Math.max(item.amount - item.amountPaid, 0),
    0,
  );

  return {
    dashboard,
    monthInflow,
    monthOutflow,
    currency,
    onTimeRate,
    paidCount,
    lateCount,
    openDueTotal,
  };
}
