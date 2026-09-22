import type { Metadata } from 'next';
import { formatCurrency, formatDate } from '@jamiya/shared';
import { createClient } from '@/lib/supabase/server';
import { requireAdminAccess } from '@/features/admin/lib/require-admin';
import { StatusBadge } from '@/features/dashboard/components/dashboard-stats';

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
  payment_intent_id: string | null;
};

export default async function AdminFinancePage() {
  await requireAdminAccess('admin');
  const supabase = await createClient();

  const [{ data: exceptions }, { data: openIntents }, { data: webhooks }, { data: journals }] =
    await Promise.all([
      supabase
        .from('payment_intents')
        .select(
          'id, status, settlement_status, reconcile_status, amount, currency, provider, provider_reference, created_at, metadata',
        )
        .eq('reconcile_status', 'exception')
        .order('created_at', { ascending: false })
        .limit(40),
      supabase
        .from('payment_intents')
        .select(
          'id, status, settlement_status, reconcile_status, amount, currency, provider, provider_reference, created_at, metadata',
        )
        .eq('status', 'completed')
        .eq('reconcile_status', 'open')
        .order('created_at', { ascending: false })
        .limit(40),
      supabase
        .from('webhook_events')
        .select(
          'id, provider, status, event_type, fingerprint, error_message, created_at, payment_intent_id',
        )
        .in('status', ['failed', 'received'])
        .order('created_at', { ascending: false })
        .limit(30),
      supabase
        .from('journal_entries')
        .select(
          'id, domain, description, currency, source_type, source_id, posted_at, payment_intent_id',
        )
        .order('posted_at', { ascending: false })
        .limit(30),
    ]);

  const exRows = (exceptions ?? []) as unknown as IntentRow[];
  const openRows = (openIntents ?? []) as unknown as IntentRow[];
  const whRows = (webhooks ?? []) as unknown as WebhookRow[];
  const jeRows = (journals ?? []) as unknown as JournalRow[];

  return (
    <div className="space-y-8">
      <div>
        <h2 className="font-[family-name:var(--font-display)] text-2xl font-semibold">
          Finance exceptions
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Provider success, settlement, and reconcile are separate. Wallet balances stay
          read-only here — flag mismatches for ops, never edit cash.
        </p>
      </div>

      <Section title="Reconcile exceptions" empty="No exceptions flagged.">
        {exRows.map((row) => (
          <IntentLine key={row.id} row={row} />
        ))}
      </Section>

      <Section
        title="Completed but still open"
        empty="No open completed intents."
      >
        {openRows.map((row) => (
          <IntentLine key={row.id} row={row} />
        ))}
      </Section>

      <Section title="Webhook inbox (failed / stuck)" empty="Inbox is clear.">
        {whRows.map((wh) => (
          <li
            key={wh.id}
            className="flex flex-wrap items-center justify-between gap-3 px-5 py-4"
          >
            <div>
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
            <p className="font-mono text-xs text-muted-foreground">
              {wh.fingerprint.slice(0, 12)}…
            </p>
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

function IntentLine({ row }: { row: IntentRow }) {
  const amount = typeof row.amount === 'number' ? row.amount : Number(row.amount);
  const kind =
    typeof row.metadata?.kind === 'string' ? row.metadata.kind : 'wallet_top_up';
  return (
    <li className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
      <div>
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
      <div className="text-right">
        <p className="font-semibold">{formatCurrency(amount, row.currency)}</p>
        <StatusBadge status={row.reconcile_status} />
      </div>
    </li>
  );
}
