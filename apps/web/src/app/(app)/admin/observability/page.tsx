import type { Metadata } from 'next';
import { createClient } from '@/lib/supabase/server';
import { requireAdminAccess } from '@/features/admin/lib/require-admin';

export const metadata: Metadata = { title: 'Admin · Observability' };
export const dynamic = 'force-dynamic';

export default async function AdminObservabilityPage() {
  await requireAdminAccess('compliance');
  const supabase = await createClient();
  const agedCutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  const [
    users,
    jamiyas,
    openCases,
    pendingWithdrawals,
    agedWithdrawals,
    pendingKyc,
    outboxPending,
    outboxFailed,
    bankJobs,
  ] = await Promise.all([
    supabase.from('profiles').select('id', { count: 'exact', head: true }),
    supabase.from('jamiyas').select('id', { count: 'exact', head: true }),
    supabase
      .from('collection_cases')
      .select('id', { count: 'exact', head: true })
      .in('status', ['open', 'contacted', 'promised', 'partially_paid']),
    supabase
      .from('withdrawal_requests')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'pending'),
    supabase
      .from('withdrawal_requests')
      .select('id', { count: 'exact', head: true })
      .in('status', ['pending', 'processing'])
      .lt('created_at', agedCutoff),
    supabase
      .from('kyc_documents')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'uploaded'),
    supabase
      .from('notification_outbox')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'pending'),
    supabase
      .from('notification_outbox')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'failed'),
    supabase
      .from('bank_transfer_jobs')
      .select('id', { count: 'exact', head: true })
      .in('status', ['queued', 'submitted']),
  ]);

  const cards = [
    { label: 'Members', value: users.count ?? 0 },
    { label: 'Circles', value: jamiyas.count ?? 0 },
    { label: 'Open collection cases', value: openCases.count ?? 0 },
    { label: 'Pending withdrawals', value: pendingWithdrawals.count ?? 0 },
    { label: 'Aged withdrawals (>24h)', value: agedWithdrawals.count ?? 0 },
    { label: 'KYC awaiting review', value: pendingKyc.count ?? 0 },
    { label: 'Outbox pending', value: outboxPending.count ?? 0 },
    { label: 'Outbox failed', value: outboxFailed.count ?? 0 },
    { label: 'Bank jobs in flight', value: bankJobs.count ?? 0 },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-[family-name:var(--font-display)] text-2xl font-semibold">
          Observability
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Operational snapshot including aged withdrawals and failed outbox. Wire{' '}
          <code className="text-xs">NEXT_PUBLIC_SENTRY_DSN</code> for error capture; health at{' '}
          <code className="text-xs">/api/v1/health</code>.
        </p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {cards.map((card) => (
          <div
            key={card.label}
            className="rounded-xl border border-border bg-card px-4 py-4 shadow-[0_1px_0_rgba(26,31,28,0.04)]"
          >
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {card.label}
            </p>
            <p className="mt-2 font-[family-name:var(--font-display)] text-3xl font-semibold">
              {card.value}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
