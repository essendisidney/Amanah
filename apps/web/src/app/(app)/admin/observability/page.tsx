import type { Metadata } from 'next';
import { createClient } from '@/lib/supabase/server';
import { requireAdminAccess } from '@/features/admin/lib/require-admin';
import { mpesaHealth } from '@/lib/payments/mpesa';
import { paymentProvider } from '@/lib/payments/provider';
import {
  requireRealProviders,
  shouldBlockSimulatedPayments,
} from '@/lib/production-cutover';

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
    pendingIntents,
    failedIntents,
    mpesa,
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
    supabase
      .from('payment_intents')
      .select('id', { count: 'exact', head: true })
      .in('status', ['pending', 'processing']),
    supabase
      .from('payment_intents')
      .select('id', { count: 'exact', head: true })
      .in('status', ['failed', 'expired', 'cancelled']),
    mpesaHealth(),
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
    { label: 'Payment intents in flight', value: pendingIntents.count ?? 0 },
    { label: 'Payment intents failed', value: failedIntents.count ?? 0 },
  ];

  const provider = paymentProvider();
  const cutoverRows = [
    { label: 'PAYMENT_PROVIDER', value: provider },
    { label: 'REQUIRE_REAL_PROVIDERS', value: requireRealProviders() ? 'true' : 'false' },
    {
      label: 'Simulated blocked',
      value: shouldBlockSimulatedPayments() ? 'yes' : 'no',
    },
    {
      label: 'payments-mpesa health',
      value: mpesa.ok ? 'ok' : `${mpesa.error ?? 'down'}${provider === 'mpesa' ? '' : ' (info)'}`,
    },
    {
      label: 'Daraja configured',
      value: mpesa.daraja_configured ? 'yes' : 'no',
    },
    {
      label: 'B2C configured',
      value: mpesa.b2c_configured ? 'yes' : 'no',
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-[family-name:var(--font-display)] text-2xl font-semibold">
          Observability
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Operational snapshot including aged withdrawals, failed outbox, and payment cutover.
          Health: <code className="text-xs">/api/v1/payments/mpesa-health</code>.
        </p>
      </div>

      <section className="amanah-surface space-y-3 px-4 py-4">
        <h3 className="text-lg font-semibold tracking-tight">Payment cutover</h3>
        <dl className="grid gap-2 sm:grid-cols-2">
          {cutoverRows.map((row) => (
            <div
              key={row.label}
              className="flex items-baseline justify-between gap-3 rounded-xl bg-secondary/50 px-3 py-2"
            >
              <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {row.label}
              </dt>
              <dd className="font-mono text-sm font-semibold">{row.value}</dd>
            </div>
          ))}
        </dl>
        {mpesa.hint && provider === 'mpesa' ? (
          <p className="rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {mpesa.hint}
          </p>
        ) : mpesa.hint && provider !== 'mpesa' ? (
          <p className="rounded-xl border border-border bg-secondary/40 px-3 py-2 text-sm text-muted-foreground">
            Edge probe: {mpesa.error ?? 'not ready'}. App is on {provider}, so wallet top-ups do not
            depend on Daraja until you switch <code className="text-xs">PAYMENT_PROVIDER=mpesa</code>.
            {mpesa.hint ? ` ${mpesa.hint}` : ''}
          </p>
        ) : provider === 'paystack' && !mpesa.daraja_configured ? (
          <p className="text-sm text-muted-foreground">
            App is on Paystack. Daraja STK stays optional until{' '}
            <code className="text-xs">PAYMENT_PROVIDER=mpesa</code> and Edge{' '}
            <code className="text-xs">MPESA_*</code> secrets are set.
          </p>
        ) : null}
      </section>

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
