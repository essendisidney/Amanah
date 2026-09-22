import { createClient } from '@/lib/supabase/server';

export type FinanceKpis = {
  walletBalancesKes: number;
  pendingCollectionsKes: number;
  pendingCollectionsCount: number;
  completedOpenReconcileCount: number;
  exceptionCount: number;
  failedIntentCount: number;
  pendingDisbursementsKes: number;
  pendingDisbursementsCount: number;
  qardOutstandingKes: number;
  qardActiveCount: number;
  sadakaRaisedKes: number;
  journalEntryCount: number;
  webhookStuckCount: number;
};

function n(v: unknown): number {
  if (typeof v === 'number') return Number.isFinite(v) ? v : 0;
  if (typeof v === 'string') {
    const x = Number(v);
    return Number.isFinite(x) ? x : 0;
  }
  return 0;
}

/** Platform finance snapshot for admin (read-only aggregates). */
export async function getAdminFinanceKpis(): Promise<FinanceKpis> {
  const supabase = await createClient();

  const [
    wallets,
    pendingIntents,
    openReconcile,
    exceptions,
    failedIntents,
    withdrawals,
    qard,
    sadaka,
    journals,
    webhooks,
  ] = await Promise.all([
    supabase.from('wallets').select('balance, currency').eq('currency', 'KES'),
    supabase
      .from('payment_intents')
      .select('amount, currency')
      .in('status', ['pending', 'processing'])
      .eq('currency', 'KES'),
    supabase
      .from('payment_intents')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'completed')
      .eq('reconcile_status', 'open'),
    supabase
      .from('payment_intents')
      .select('id', { count: 'exact', head: true })
      .eq('reconcile_status', 'exception'),
    supabase
      .from('payment_intents')
      .select('id', { count: 'exact', head: true })
      .in('status', ['failed', 'expired', 'cancelled']),
    supabase
      .from('withdrawal_requests')
      .select('amount, currency')
      .in('status', ['pending', 'processing'])
      .eq('currency', 'KES'),
    supabase
      .from('qard_loans')
      .select('amount, amount_repaid, status')
      .eq('status', 'active'),
    supabase.from('charity_campaigns').select('raised_amount, currency'),
    supabase.from('journal_entries').select('id', { count: 'exact', head: true }),
    supabase
      .from('webhook_events')
      .select('id', { count: 'exact', head: true })
      .in('status', ['failed', 'received']),
  ]);

  const walletBalancesKes = ((wallets.data ?? []) as Array<{ balance: unknown }>).reduce(
    (s, w) => s + n(w.balance),
    0,
  );
  const pendingRows = (pendingIntents.data ?? []) as Array<{ amount: unknown }>;
  const pendingCollectionsKes = pendingRows.reduce((s, r) => s + n(r.amount), 0);
  const wdRows = (withdrawals.data ?? []) as Array<{ amount: unknown }>;
  const pendingDisbursementsKes = wdRows.reduce((s, r) => s + n(r.amount), 0);
  const qardRows = (qard.data ?? []) as Array<{
    amount: unknown;
    amount_repaid: unknown;
  }>;
  const qardOutstandingKes = qardRows.reduce(
    (s, r) => s + Math.max(n(r.amount) - n(r.amount_repaid), 0),
    0,
  );
  const sadakaRows = (sadaka.data ?? []) as Array<{
    raised_amount: unknown;
    currency: string;
  }>;
  const sadakaRaisedKes = sadakaRows
    .filter((r) => r.currency === 'KES')
    .reduce((s, r) => s + n(r.raised_amount), 0);

  return {
    walletBalancesKes,
    pendingCollectionsKes,
    pendingCollectionsCount: pendingRows.length,
    completedOpenReconcileCount: openReconcile.count ?? 0,
    exceptionCount: exceptions.count ?? 0,
    failedIntentCount: failedIntents.count ?? 0,
    pendingDisbursementsKes,
    pendingDisbursementsCount: wdRows.length,
    qardOutstandingKes,
    qardActiveCount: qardRows.length,
    sadakaRaisedKes,
    journalEntryCount: journals.count ?? 0,
    webhookStuckCount: webhooks.count ?? 0,
  };
}
