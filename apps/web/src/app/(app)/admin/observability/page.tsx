import type { Metadata } from 'next';
import { formatDate } from '@jamiya/shared';
import { createClient } from '@/lib/supabase/server';
import { requireAdminAccess } from '@/features/admin/lib/require-admin';
import { mpesaHealth } from '@/lib/payments/mpesa';
import { bankHealth } from '@/lib/payments/bank';
import { paymentProvider } from '@/lib/payments/provider';
import { orchestratorHealth } from '@/lib/payments/orchestrator';
import {
  requireRealProviders,
  shouldBlockSimulatedPayments,
} from '@/lib/production-cutover';
import { runReconcileNowAction } from '@/features/admin/actions/reconcile-actions';
import { AdminSectionHeader } from '@/features/admin/components/admin-section-header';
import { Button } from '@jamiya/ui';

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
    bank,
    lastReconcile,
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
    bankHealth(),
    supabase
      .from('reconcile_runs')
      .select('id, status, started_at, finished_at, summary, error_message')
      .order('started_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
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
  const orch = orchestratorHealth();
  const cutoverRows = [
    { label: 'PAYMENT_PROVIDER', value: provider },
    { label: 'Collect / Disburse', value: `${orch.collect} / ${orch.disburse}` },
    {
      label: 'Failover collect / disburse',
      value: `${orch.failoverCollect ?? '—'} / ${orch.failoverDisburse ?? '—'}`,
    },
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
    {
      label: 'IntaSend / TendePay',
      value: `${orch.adapters.intasend.configured ? 'intasend✓' : 'intasend–'} / ${orch.adapters.tendepay.configured ? 'tendepay✓' : 'tendepay–'}`,
    },
    {
      label: 'Bank rails (coop / kcb / generic)',
      value: `${orch.bankRails?.coop ? 'coop✓' : 'coop–'} / ${orch.bankRails?.kcb ? 'kcb✓' : 'kcb–'} / ${orch.bankRails?.generic ? 'bank✓' : 'bank–'}`,
    },
    {
      label: 'Bank payment webhook',
      value: orch.bankRails?.webhook ?? '/api/webhooks/bank',
    },
    {
      label: 'payments-bank health',
      value: bank.ok ? 'ok' : `${bank.error ?? 'down'}${provider === 'bank' || provider === 'coop' || provider === 'kcb' ? '' : ' (info)'}`,
    },
    {
      label: 'Bank API configured',
      value: bank.bank_configured ? 'yes' : 'no',
    },
    {
      label: 'Bank SMS webhook secret',
      value: process.env.BANK_ALERT_WEBHOOK_SECRET?.trim() ? 'set' : 'missing',
    },
    {
      label: 'Bank payment webhook secret',
      value:
        process.env.BANK_WEBHOOK_SECRET?.trim() ||
        process.env.BANK_ALERT_WEBHOOK_SECRET?.trim()
          ? 'set'
          : 'missing',
    },
  ];

  const reconcile = lastReconcile.data as {
    id: string;
    status: string;
    started_at: string;
    finished_at: string | null;
    summary: Record<string, unknown> | null;
    error_message: string | null;
  } | null;

  const summary = (reconcile?.summary ?? {}) as {
    intents_settled?: number;
    intents_failed?: number;
    intents_flagged?: number;
    withdrawals_settled?: number;
    withdrawals_failed?: number;
    withdrawals_flagged?: number;
    needs_admin?: Array<{ entity_type: string; entity_id: string; reason: string }>;
  };

  return (
    <div className="space-y-6">
      <AdminSectionHeader
        title="Health"
        subtitle="Ops snapshot: reconcile, cutover, queues. Probe /api/v1/payments/orchestrator-health."
      />

      <section className="amanah-surface space-y-3 px-4 py-4 sm:px-5">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <h3 className="text-sm font-semibold text-foreground">Payment reconcile</h3>
          <form action={runReconcileNowAction}>
            <Button type="submit" variant="outline" className="min-h-11">
              Run now
            </Button>
          </form>
        </div>
        {reconcile ? (
          <div className="space-y-2 text-sm">
            <p className="text-muted-foreground">
              Last run {formatDate(reconcile.started_at)} · status{' '}
              <span className="font-medium text-foreground">{reconcile.status}</span>
              {reconcile.finished_at ? ` · finished ${formatDate(reconcile.finished_at)}` : ''}
            </p>
            <dl className="grid gap-2 sm:grid-cols-3">
              <div className="bg-secondary/50 px-3 py-2">
                <dt className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Intents settled / failed / flagged
                </dt>
                <dd className="mt-1 font-mono text-sm font-semibold tabular-nums">
                  {summary.intents_settled ?? 0} / {summary.intents_failed ?? 0} /{' '}
                  {summary.intents_flagged ?? 0}
                </dd>
              </div>
              <div className="bg-secondary/50 px-3 py-2">
                <dt className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Withdrawals settled / failed / flagged
                </dt>
                <dd className="mt-1 font-mono text-sm font-semibold tabular-nums">
                  {summary.withdrawals_settled ?? 0} / {summary.withdrawals_failed ?? 0} /{' '}
                  {summary.withdrawals_flagged ?? 0}
                </dd>
              </div>
              <div className="bg-secondary/50 px-3 py-2">
                <dt className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Needs admin
                </dt>
                <dd className="mt-1 font-mono text-sm font-semibold tabular-nums">
                  {summary.needs_admin?.length ?? 0}
                </dd>
              </div>
            </dl>
            {reconcile.error_message ? (
              <p className="text-sm text-destructive">{reconcile.error_message}</p>
            ) : null}
            {(summary.needs_admin?.length ?? 0) > 0 ? (
              <ul className="max-h-40 space-y-1 overflow-y-auto text-xs text-muted-foreground">
                {summary.needs_admin!.slice(0, 12).map((item) => (
                  <li key={`${item.entity_type}:${item.entity_id}`}>
                    {item.entity_type} {item.entity_id.slice(0, 8)}… · {item.reason}
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            No reconcile runs yet. Daily cron:{' '}
            <code className="text-xs">job=reconcile-payments</code> at 05:00 UTC.
          </p>
        )}
      </section>

      <section className="amanah-surface space-y-3 px-4 py-4 sm:px-5">
        <h3 className="text-sm font-semibold text-foreground">Payment cutover</h3>
        <dl className="grid gap-2 sm:grid-cols-2">
          {cutoverRows.map((row) => (
            <div
              key={row.label}
              className="flex items-baseline justify-between gap-3 bg-secondary/50 px-3 py-2"
            >
              <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {row.label}
              </dt>
              <dd className="font-mono text-sm font-semibold">{row.value}</dd>
            </div>
          ))}
        </dl>
        {provider === 'bank' && bank.hint ? (
          <p className="border border-border bg-secondary/40 px-3 py-2 text-sm text-muted-foreground">
            {bank.hint}
          </p>
        ) : null}
        {mpesa.hint && provider === 'mpesa' ? (
          <p className="border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {mpesa.hint}
          </p>
        ) : mpesa.hint && provider !== 'mpesa' ? (
          <p className="border border-border bg-secondary/40 px-3 py-2 text-sm text-muted-foreground">
            Edge probe: {mpesa.error ?? 'not ready'}. App is on {provider}, so wallet top-ups do not
            depend on Daraja until you switch <code className="text-xs">PAYMENT_PROVIDER=mpesa</code>
            .{mpesa.hint ? ` ${mpesa.hint}` : ''}
          </p>
        ) : provider === 'paystack' && !mpesa.daraja_configured ? (
          <p className="text-sm text-muted-foreground">
            App is on Paystack. Daraja STK stays optional until{' '}
            <code className="text-xs">PAYMENT_PROVIDER=mpesa</code> and Edge{' '}
            <code className="text-xs">MPESA_*</code> secrets are set.
          </p>
        ) : null}
      </section>

      <dl className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {cards.map((card) => (
          <div key={card.label} className="amanah-surface px-4 py-3">
            <dt className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              {card.label}
            </dt>
            <dd className="mt-1 text-2xl font-semibold tabular-nums">{card.value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
