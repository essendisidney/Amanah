import type { Metadata } from 'next';
import Link from 'next/link';
import type { Route } from 'next';
import { formatCurrency, formatDate } from '@jamiya/shared';
import { Button } from '@jamiya/ui';
import { createClient } from '@/lib/supabase/server';
import { requireAdminAccess } from '@/features/admin/lib/require-admin';
import { getAdminFinanceKpis } from '@/features/admin/lib/finance-kpis';
import { StatusBadge } from '@/features/dashboard/components/dashboard-stats';
import { runReconcileNowAction } from '@/features/admin/actions/reconcile-actions';
import { resolveIntentExceptionAction } from '@/features/admin/actions/finance-resolve-actions';
import { reprocessWebhookAction } from '@/features/admin/actions/webhook-reprocess-actions';

export const metadata: Metadata = { title: 'Admin · Finance' };
export const dynamic = 'force-dynamic';

type IntentRow = {
  id: string;
  status: string;
  settlement_status: string;
  reconcile_status: string;
  amount: number | string;
  currency: string;
  provider: string;
  provider_reference: string | null;
  created_at: string;
  metadata: Record<string, unknown> | null;
};

type WebhookRow = {
  id: string;
  provider: string;
  status: string;
  event_type: string | null;
  fingerprint: string;
  error_message: string | null;
  created_at: string;
  payment_intent_id: string | null;
};

type JournalRow = {
  id: string;
  domain: string;
  description: string | null;
  currency: string;
  source_type: string;
  source_id: string;
  posted_at: string;
};

export default async function AdminFinancePage() {
  await requireAdminAccess('admin');
  const supabase = await createClient();
  const kpis = await getAdminFinanceKpis();

  const [{ data: exceptions }, { data: openIntents }, { data: webhooks }, { data: journals }] =
    await Promise.all([
      supabase
        .from('payment_intents')
        .select(
          'id, status, settlement_status, reconcile_status, amount, currency, provider, provider_reference, created_at, metadata',
        )
        .eq('reconcile_status', 'exception')
        .order('created_at', { ascending: false })
        .limit(25),
      supabase
        .from('payment_intents')
        .select(
          'id, status, settlement_status, reconcile_status, amount, currency, provider, provider_reference, created_at, metadata',
        )
        .eq('status', 'completed')
        .eq('reconcile_status', 'open')
        .order('created_at', { ascending: false })
        .limit(25),
      supabase
        .from('webhook_events')
        .select(
          'id, provider, status, event_type, fingerprint, error_message, created_at, payment_intent_id',
        )
        .in('status', ['failed', 'received'])
        .order('created_at', { ascending: false })
        .limit(20),
      supabase
        .from('journal_entries')
        .select('id, domain, description, currency, source_type, source_id, posted_at')
        .order('posted_at', { ascending: false })
        .limit(20),
    ]);

  const exRows = (exceptions ?? []) as unknown as IntentRow[];
  const openRows = (openIntents ?? []) as unknown as IntentRow[];
  const whRows = (webhooks ?? []) as unknown as WebhookRow[];
  const jeRows = (journals ?? []) as unknown as JournalRow[];

  const cards: Array<{ label: string; value: string; hint: string }> = [
    {
      label: 'Member wallets (KES)',
      value: formatCurrency(kpis.walletBalancesKes, 'KES'),
      hint: 'Live SoT until journal cutover',
    },
    {
      label: 'Pending collections',
      value: formatCurrency(kpis.pendingCollectionsKes, 'KES'),
      hint: `${kpis.pendingCollectionsCount} intents in flight`,
    },
    {
      label: 'Pending disbursements',
      value: formatCurrency(kpis.pendingDisbursementsKes, 'KES'),
      hint: `${kpis.pendingDisbursementsCount} withdrawals`,
    },
    {
      label: 'Qard outstanding',
      value: formatCurrency(kpis.qardOutstandingKes, 'KES'),
      hint: `${kpis.qardActiveCount} active facilities`,
    },
    {
      label: 'Sadaka raised',
      value: formatCurrency(kpis.sadakaRaisedKes, 'KES'),
      hint: 'Campaign totals (sidecar)',
    },
    {
      label: 'Unreconciled completed',
      value: String(kpis.completedOpenReconcileCount),
      hint: 'Provider success ≠ matched',
    },
    {
      label: 'Reconcile exceptions',
      value: String(kpis.exceptionCount),
      hint: 'Needs investigation',
    },
    {
      label: 'Failed / expired intents',
      value: String(kpis.failedIntentCount),
      hint: 'Collections that did not complete',
    },
    {
      label: 'Journal posts',
      value: String(kpis.journalEntryCount),
      hint: 'Append-only projection',
    },
    {
      label: 'Webhook inbox stuck',
      value: String(kpis.webhookStuckCount),
      hint: 'failed or unprocessed',
    },
  ];

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="font-[family-name:var(--font-display)] text-2xl font-semibold">
            Finance command centre
          </h2>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Domains stay separate (wallets, Qard, Sadaka, journals). Provider success ≠
            settled ≠ reconciled. Balances are read-only — corrections only via reverse
            journal posts.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <form action={runReconcileNowAction}>
            <Button type="submit" variant="outline" className="min-h-11">
              Run reconcile now
            </Button>
          </form>
          <Button asChild className="min-h-11">
            <Link href={'/admin/finance/reconcile' as Route}>Reconcile queue</Link>
          </Button>
          <Button asChild variant="outline" className="min-h-11">
            <Link href={'/admin/finance/journal' as Route}>Journal</Link>
          </Button>
          <Button asChild variant="outline" className="min-h-11">
            <Link href={'/admin/finance/integrity' as Route}>Integrity</Link>
          </Button>
          <Button asChild variant="outline" className="min-h-11">
            <Link href={'/admin/finance/settlements' as Route}>Settlements</Link>
          </Button>
          <Button asChild variant="outline" className="min-h-11">
            <Link href={'/admin/finance/accounts' as Route}>Accounts</Link>
          </Button>
          <Button asChild variant="outline" className="min-h-11">
            <Link href={'/admin/finance/refunds' as Route}>Refunds</Link>
          </Button>
          <Button asChild variant="outline" className="min-h-11">
            <Link href={'/admin/finance/approvals' as Route}>Approvals</Link>
          </Button>
          <Button asChild variant="outline" className="min-h-11">
            <Link href={'/admin/architecture' as Route}>How it is built</Link>
          </Button>
          <Button asChild variant="outline" className="min-h-11">
            <Link href={'/admin/observability' as Route}>System health</Link>
          </Button>
        </div>
      </div>

      <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        {cards.map((c) => (
          <div
            key={c.label}
            className="rounded-xl border border-border bg-card px-4 py-3"
          >
            <dt className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              {c.label}
            </dt>
            <dd className="mt-1 text-lg font-semibold tabular-nums">{c.value}</dd>
            <p className="mt-1 text-xs text-muted-foreground">{c.hint}</p>
          </div>
        ))}
      </dl>

      <div className="rounded-xl border border-dashed border-border bg-muted/30 px-4 py-3 text-sm text-muted-foreground">
        <p className="font-medium text-foreground">How money is built (today)</p>
        <p className="mt-1">
          Features → Payment orchestrator → adapters (IntaSend / …) →{' '}
          <code className="text-xs">payment_intents</code> → wallet ledger RPCs → journal
          projection + cashbook bridge. External PSPs move cash; Jameiyah records truth.
        </p>
      </div>

      <Section title="Reconcile exceptions" empty="No exceptions flagged.">
        {exRows.map((row) => (
          <IntentLine key={row.id} row={row} showResolve />
        ))}
      </Section>

      <Section title="Completed but still open" empty="No open completed intents.">
        {openRows.map((row) => (
          <IntentLine key={row.id} row={row} showResolve />
        ))}
      </Section>

      <Section title="Webhook inbox (failed / stuck)" empty="Inbox is clear.">
        {whRows.map((wh) => (
          <li
            key={wh.id}
            className="flex flex-wrap items-center justify-between gap-3 px-5 py-4"
          >
            <div className="min-w-0 flex-1">
              <p className="font-medium">
                {wh.provider} · {wh.event_type ?? 'callback'} · {wh.status}
              </p>
              <p className="text-sm text-muted-foreground">
                {formatDate(wh.created_at)}
                {wh.payment_intent_id
                  ? ` · intent ${wh.payment_intent_id.slice(0, 8)}…`
                  : ''}
                {wh.error_message ? ` · ${wh.error_message}` : ''}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {wh.payment_intent_id ? (
                <Button asChild size="sm" variant="outline" className="min-h-10">
                  <Link href={`/admin/finance/intents/${wh.payment_intent_id}` as Route}>
                    Case file
                  </Link>
                </Button>
              ) : null}
              <p className="font-mono text-xs text-muted-foreground">
                {wh.fingerprint.slice(0, 12)}…
              </p>
              {(wh.status === 'failed' || wh.status === 'received') && (
                <form action={reprocessWebhookAction}>
                  <input type="hidden" name="eventId" value={wh.id} />
                  <Button type="submit" size="sm" variant="outline" className="min-h-10">
                    Reprocess
                  </Button>
                </form>
              )}
            </div>
          </li>
        ))}
      </Section>

      <Section title="Recent journal posts" empty="No journal entries yet.">
        {jeRows.map((je) => (
          <li
            key={je.id}
            className="flex flex-wrap items-center justify-between gap-3 px-5 py-4"
          >
            <div>
              <p className="font-medium">
                {je.domain} · {je.description ?? je.source_type}
              </p>
              <p className="text-sm text-muted-foreground">
                {formatDate(je.posted_at)} · {je.source_type}/{je.source_id.slice(0, 8)}…
              </p>
            </div>
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {je.currency}
            </p>
          </li>
        ))}
      </Section>
    </div>
  );
}

function Section({
  title,
  empty,
  children,
}: {
  title: string;
  empty: string;
  children: React.ReactNode;
}) {
  const items = Array.isArray(children) ? children : children ? [children] : [];
  const has = items.filter(Boolean).length > 0;
  return (
    <section className="space-y-3">
      <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
        {title}
      </h3>
      {!has ? (
        <p className="text-sm text-muted-foreground">{empty}</p>
      ) : (
        <ul className="divide-y divide-border rounded-xl border border-border bg-card">
          {children}
        </ul>
      )}
    </section>
  );
}

function IntentLine({
  row,
  showResolve,
}: {
  row: IntentRow;
  showResolve?: boolean;
}) {
  const amount = typeof row.amount === 'number' ? row.amount : Number(row.amount);
  const kind =
    typeof row.metadata?.kind === 'string' ? row.metadata.kind : 'wallet_top_up';
  return (
    <li className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
      <div className="min-w-0 flex-1">
        <p className="font-medium">
          {kind.replaceAll('_', ' ')} · {row.provider}
        </p>
        <p className="text-sm text-muted-foreground">
          {formatDate(row.created_at)} · {row.id.slice(0, 8)}…
          {row.provider_reference ? ` · ref ${row.provider_reference.slice(0, 12)}` : ''}
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          provider {row.status} · settle {row.settlement_status} · reconcile{' '}
          {row.reconcile_status}
        </p>
      </div>
      <div className="flex flex-wrap items-center justify-end gap-2">
        <div className="text-right">
          <p className="font-semibold">{formatCurrency(amount, row.currency)}</p>
          <StatusBadge status={row.reconcile_status} />
        </div>
        <Button asChild size="sm" variant="outline" className="min-h-10">
          <Link href={`/admin/finance/intents/${row.id}` as Route}>Case file</Link>
        </Button>
        {showResolve ? (
          <div className="flex flex-wrap gap-1.5">
            <form action={resolveIntentExceptionAction}>
              <input type="hidden" name="intentId" value={row.id} />
              <input type="hidden" name="action" value="match" />
              <Button type="submit" size="sm" className="min-h-10">
                Match
              </Button>
            </form>
            <form action={resolveIntentExceptionAction}>
              <input type="hidden" name="intentId" value={row.id} />
              <input type="hidden" name="action" value="manual" />
              <Button type="submit" size="sm" variant="outline" className="min-h-10">
                Manual
              </Button>
            </form>
            <form action={resolveIntentExceptionAction}>
              <input type="hidden" name="intentId" value={row.id} />
              <input type="hidden" name="action" value="waive" />
              <Button type="submit" size="sm" variant="outline" className="min-h-10">
                Waive
              </Button>
            </form>
          </div>
        ) : null}
      </div>
    </li>
  );
}
