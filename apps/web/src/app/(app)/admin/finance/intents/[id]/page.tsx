import type { Metadata } from 'next';
import Link from 'next/link';
import type { Route } from 'next';
import { notFound } from 'next/navigation';
import { formatCurrency, formatDate } from '@jamiya/shared';
import { Button } from '@jamiya/ui';
import { createClient } from '@/lib/supabase/server';
import { requireAdminAccess } from '@/features/admin/lib/require-admin';
import { StatusBadge } from '@/features/dashboard/components/dashboard-stats';
import { resolveIntentExceptionAction } from '@/features/admin/actions/finance-resolve-actions';
import { reprocessWebhookAction } from '@/features/admin/actions/webhook-reprocess-actions';
import { backfillIntentJournalAction } from '@/features/admin/actions/integrity-backfill-actions';
import {
  backfillOneSettlementAction,
  markSettlementStatusAction,
} from '@/features/admin/actions/settlement-actions';

export const dynamic = 'force-dynamic';

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  return { title: `Admin · Intent ${id.slice(0, 8)}` };
}

export default async function AdminPaymentIntentCasePage({ params }: Props) {
  await requireAdminAccess('admin');
  const { id } = await params;
  if (!id || !/^[0-9a-f-]{36}$/i.test(id)) notFound();

  const supabase = await createClient();

  const { data: intentRaw } = await supabase
    .from('payment_intents')
    .select(
      'id, user_id, status, settlement_status, reconcile_status, amount, currency, provider, provider_reference, created_at, completed_at, metadata, error_message',
    )
    .eq('id', id)
    .maybeSingle();

  if (!intentRaw) notFound();

  const intent = intentRaw as {
    id: string;
    user_id: string | null;
    status: string;
    settlement_status: string;
    reconcile_status: string;
    amount: number | string;
    currency: string;
    provider: string;
    provider_reference: string | null;
    created_at: string;
    completed_at: string | null;
    metadata: Record<string, unknown> | null;
    error_message: string | null;
  };

  const [
    { data: webhooks },
    { data: journalsByPi },
    { data: journalsBySource },
    { data: settlements },
    { data: providerTx },
    { data: refunds },
  ] = await Promise.all([
    supabase
      .from('webhook_events')
      .select(
        'id, provider, status, event_type, fingerprint, error_message, created_at, processed_at',
      )
      .eq('payment_intent_id', id)
      .order('created_at', { ascending: false })
      .limit(40),
    supabase
      .from('journal_entries')
      .select('id, domain, description, currency, source_type, source_id, posted_at')
      .eq('payment_intent_id', id)
      .order('posted_at', { ascending: false })
      .limit(20),
    supabase
      .from('journal_entries')
      .select('id, domain, description, currency, source_type, source_id, posted_at')
      .eq('source_type', 'payment_intent')
      .eq('source_id', id)
      .order('posted_at', { ascending: false })
      .limit(20),
    supabase
      .from('settlements')
      .select(
        'id, provider, provider_reference, amount, currency, status, settled_at, created_at',
      )
      .eq('payment_intent_id', id)
      .order('created_at', { ascending: false })
      .limit(20),
    supabase
      .from('provider_transactions')
      .select(
        'id, provider, provider_reference, direction, amount, currency, status, observed_at',
      )
      .eq('payment_intent_id', id)
      .order('observed_at', { ascending: false })
      .limit(20),
    supabase
      .from('refunds')
      .select('id, amount, currency, reason, status, created_at, completed_at')
      .eq('payment_intent_id', id)
      .order('created_at', { ascending: false })
      .limit(20),
  ]);

  const journalMap = new Map<
    string,
    {
      id: string;
      domain: string;
      description: string | null;
      currency: string;
      posted_at: string;
    }
  >();
  for (const row of [...(journalsByPi ?? []), ...(journalsBySource ?? [])] as Array<{
    id: string;
    domain: string;
    description: string | null;
    currency: string;
    posted_at: string;
  }>) {
    journalMap.set(row.id, row);
  }
  const journals = [...journalMap.values()];

  let txRows: Array<{
    id: string;
    type: string;
    amount: number | string;
    currency: string;
    reference: string | null;
    created_at: string;
  }> = [];
  if (intent.provider_reference) {
    const { data: byRef } = await supabase
      .from('transactions')
      .select('id, type, amount, currency, reference, created_at')
      .eq('reference', intent.provider_reference)
      .limit(10);
    txRows = (byRef ?? []) as typeof txRows;
  }
  if (txRows.length === 0 && intent.user_id) {
    const { data: recent } = await supabase
      .from('transactions')
      .select('id, type, amount, currency, reference, created_at, metadata')
      .eq('user_id', intent.user_id)
      .order('created_at', { ascending: false })
      .limit(30);
    txRows = ((recent ?? []) as Array<{
      id: string;
      type: string;
      amount: number | string;
      currency: string;
      reference: string | null;
      created_at: string;
      metadata: Record<string, unknown> | null;
    }>).filter(
      (t) =>
        t.metadata?.payment_intent_id === id ||
        t.reference === intent.id ||
        t.reference === intent.provider_reference,
    );
  }

  const kind =
    typeof intent.metadata?.kind === 'string' ? intent.metadata.kind : 'wallet_top_up';
  const amount =
    typeof intent.amount === 'number' ? intent.amount : Number(intent.amount);
  const hasJournal = journals.length > 0;
  const hasSettlement = (settlements ?? []).length > 0;
  const openReconcile = ['exception', 'open'].includes(intent.reconcile_status);
  const returnTo = `/admin/finance/intents/${intent.id}`;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">
            Case file
          </p>
          <h2 className="mt-1 font-[family-name:var(--font-display)] text-2xl font-semibold">
            {kind.replaceAll('_', ' ')} · {intent.provider}
          </h2>
          <p className="mt-1 font-mono text-xs text-muted-foreground">{intent.id}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline" className="min-h-11">
            <Link href={'/admin/finance' as Route}>Finance</Link>
          </Button>
          <Button asChild variant="outline" className="min-h-11">
            <Link href={'/admin/finance/reconcile' as Route}>Reconcile</Link>
          </Button>
          <Button asChild variant="outline" className="min-h-11">
            <Link href={'/admin/finance/settlements' as Route}>Settlements</Link>
          </Button>
        </div>
      </div>

      <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          {
            label: 'Amount',
            value: formatCurrency(amount, intent.currency),
          },
          { label: 'Intent status', value: intent.status },
          { label: 'Settlement layer', value: intent.settlement_status },
          { label: 'Reconcile', value: intent.reconcile_status },
        ].map((c) => (
          <div key={c.label} className="rounded-xl border border-border bg-card px-4 py-3">
            <dt className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              {c.label}
            </dt>
            <dd className="mt-1 text-lg font-semibold tabular-nums capitalize">{c.value}</dd>
          </div>
        ))}
      </dl>

      <section className="rounded-xl border border-border bg-card px-4 py-4">
        <h3 className="text-sm font-semibold">Timeline & refs</h3>
        <ul className="mt-3 space-y-1 text-sm text-muted-foreground">
          <li>Created {formatDate(intent.created_at)}</li>
          {intent.completed_at ? <li>Completed {formatDate(intent.completed_at)}</li> : null}
          <li>
            Provider ref:{' '}
            <span className="font-mono text-foreground">
              {intent.provider_reference ?? '—'}
            </span>
          </li>
          {intent.user_id ? (
            <li>
              User:{' '}
              <span className="font-mono text-foreground">{intent.user_id}</span>
            </li>
          ) : null}
          {intent.error_message ? (
            <li className="text-destructive">{intent.error_message}</li>
          ) : null}
        </ul>
        {intent.metadata && Object.keys(intent.metadata).length > 0 ? (
          <pre className="mt-3 max-h-40 overflow-auto rounded-lg bg-muted/50 p-3 text-[11px] leading-relaxed">
            {JSON.stringify(intent.metadata, null, 2)}
          </pre>
        ) : null}
      </section>

      <section className="flex flex-wrap gap-2 rounded-xl border border-dashed border-border bg-muted/20 px-4 py-3">
        {openReconcile ? (
          <>
            <form action={resolveIntentExceptionAction}>
              <input type="hidden" name="intentId" value={intent.id} />
              <input type="hidden" name="action" value="match" />
              <input type="hidden" name="returnTo" value={returnTo} />
              <Button type="submit" className="min-h-10">
                Match
              </Button>
            </form>
            <form action={resolveIntentExceptionAction}>
              <input type="hidden" name="intentId" value={intent.id} />
              <input type="hidden" name="action" value="manual" />
              <input type="hidden" name="returnTo" value={returnTo} />
              <Button type="submit" variant="outline" className="min-h-10">
                Manual
              </Button>
            </form>
            <form action={resolveIntentExceptionAction}>
              <input type="hidden" name="intentId" value={intent.id} />
              <input type="hidden" name="action" value="waive" />
              <input type="hidden" name="returnTo" value={returnTo} />
              <Button type="submit" variant="outline" className="min-h-10">
                Waive
              </Button>
            </form>
          </>
        ) : null}
        {intent.status === 'completed' && !hasJournal ? (
          <form action={backfillIntentJournalAction}>
            <input type="hidden" name="intentId" value={intent.id} />
            <input type="hidden" name="returnTo" value={returnTo} />
            <Button type="submit" variant="outline" className="min-h-10">
              Backfill journal
            </Button>
          </form>
        ) : null}
        {intent.status === 'completed' && !hasSettlement ? (
          <form action={backfillOneSettlementAction}>
            <input type="hidden" name="intentId" value={intent.id} />
            <input type="hidden" name="returnTo" value={returnTo} />
            <Button type="submit" variant="outline" className="min-h-10">
              Mirror settlement
            </Button>
          </form>
        ) : null}
        <Button asChild variant="outline" className="min-h-10">
          <Link href={'/admin/finance/journal' as Route}>Journal browser</Link>
        </Button>
      </section>

      <CaseSection title={`Webhooks (${(webhooks ?? []).length})`} empty="No linked webhooks.">
        {((webhooks ?? []) as Array<{
          id: string;
          provider: string;
          status: string;
          event_type: string | null;
          fingerprint: string;
          error_message: string | null;
          created_at: string;
        }>).map((wh) => (
          <li
            key={wh.id}
            className="flex flex-wrap items-center justify-between gap-2 px-4 py-3"
          >
            <div>
              <p className="text-sm font-semibold">
                {wh.provider} · {wh.event_type ?? 'callback'}
              </p>
              <p className="text-xs text-muted-foreground">
                {formatDate(wh.created_at)} · {wh.fingerprint.slice(0, 14)}…
                {wh.error_message ? ` · ${wh.error_message}` : ''}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <StatusBadge status={wh.status} />
              {(wh.status === 'failed' || wh.status === 'received') && (
                <form action={reprocessWebhookAction}>
                  <input type="hidden" name="eventId" value={wh.id} />
                  <input type="hidden" name="returnTo" value={returnTo} />
                  <Button type="submit" size="sm" variant="outline" className="min-h-9">
                    Reprocess
                  </Button>
                </form>
              )}
            </div>
          </li>
        ))}
      </CaseSection>

      <CaseSection title={`Journal (${journals.length})`} empty="No journal posts.">
        {journals.map((je) => (
          <li key={je.id} className="flex justify-between gap-2 px-4 py-3 text-sm">
            <div>
              <p className="font-semibold">
                {je.domain} · {je.description ?? 'entry'}
              </p>
              <p className="text-xs text-muted-foreground">{formatDate(je.posted_at)}</p>
            </div>
            <Link
              href={`/admin/finance/journal?entry=${je.id}` as Route}
              className="text-xs font-semibold text-primary hover:underline"
            >
              Open
            </Link>
          </li>
        ))}
      </CaseSection>

      <CaseSection
        title={`Settlements (${(settlements ?? []).length})`}
        empty="No settlement rows."
      >
        {((settlements ?? []) as Array<{
          id: string;
          provider: string;
          provider_reference: string | null;
          amount: number | string;
          currency: string;
          status: string;
          created_at: string;
        }>).map((s) => (
          <li
            key={s.id}
            className="flex flex-wrap items-center justify-between gap-2 px-4 py-3"
          >
            <div>
              <p className="text-sm font-semibold">
                {s.provider} · {formatCurrency(Number(s.amount), s.currency)}
              </p>
              <p className="text-xs text-muted-foreground">
                {s.provider_reference ?? 'no ref'} · {formatDate(s.created_at)}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <StatusBadge status={s.status} />
              {s.status === 'pending' || s.status === 'disputed' ? (
                <form action={markSettlementStatusAction}>
                  <input type="hidden" name="settlementId" value={s.id} />
                  <input type="hidden" name="status" value="settled" />
                  <input type="hidden" name="returnTo" value={returnTo} />
                  <Button type="submit" size="sm" variant="outline" className="min-h-9">
                    Settle
                  </Button>
                </form>
              ) : null}
              {s.status === 'pending' || s.status === 'settled' ? (
                <form action={markSettlementStatusAction}>
                  <input type="hidden" name="settlementId" value={s.id} />
                  <input type="hidden" name="status" value="disputed" />
                  <input type="hidden" name="returnTo" value={returnTo} />
                  <Button type="submit" size="sm" variant="outline" className="min-h-9">
                    Dispute
                  </Button>
                </form>
              ) : null}
            </div>
          </li>
        ))}
      </CaseSection>

      <CaseSection
        title={`Provider txs (${(providerTx ?? []).length})`}
        empty="No provider_transactions."
      >
        {((providerTx ?? []) as Array<{
          id: string;
          provider: string;
          provider_reference: string;
          direction: string;
          amount: number | string;
          currency: string;
          status: string;
          observed_at: string;
        }>).map((pt) => (
          <li key={pt.id} className="flex justify-between gap-2 px-4 py-3 text-sm">
            <div>
              <p className="font-semibold">
                {pt.direction} · {pt.provider}
              </p>
              <p className="text-xs text-muted-foreground">
                {pt.provider_reference} · {formatDate(pt.observed_at)}
              </p>
            </div>
            <div className="text-right">
              <p className="font-semibold tabular-nums">
                {formatCurrency(Number(pt.amount), pt.currency)}
              </p>
              <StatusBadge status={pt.status} />
            </div>
          </li>
        ))}
      </CaseSection>

      <CaseSection title={`Refunds (${(refunds ?? []).length})`} empty="No refunds.">
        {((refunds ?? []) as Array<{
          id: string;
          amount: number | string;
          currency: string;
          reason: string | null;
          status: string;
          created_at: string;
        }>).map((r) => (
          <li key={r.id} className="flex justify-between gap-2 px-4 py-3 text-sm">
            <div>
              <p className="font-semibold">{r.reason ?? 'Refund'}</p>
              <p className="text-xs text-muted-foreground">{formatDate(r.created_at)}</p>
            </div>
            <div className="text-right">
              <p className="font-semibold">
                {formatCurrency(Number(r.amount), r.currency)}
              </p>
              <StatusBadge status={r.status} />
            </div>
          </li>
        ))}
      </CaseSection>

      <CaseSection title={`Wallet ledger (${txRows.length})`} empty="No linked wallet txs.">
        {txRows.map((tx) => (
          <li key={tx.id} className="flex justify-between gap-2 px-4 py-3 text-sm">
            <div>
              <p className="font-semibold capitalize">{tx.type.replaceAll('_', ' ')}</p>
              <p className="text-xs text-muted-foreground">
                {formatDate(tx.created_at)}
                {tx.reference ? ` · ${tx.reference}` : ''}
              </p>
            </div>
            <p className="font-semibold tabular-nums">
              {formatCurrency(Number(tx.amount), tx.currency)}
            </p>
          </li>
        ))}
      </CaseSection>
    </div>
  );
}

function CaseSection({
  title,
  empty,
  children,
}: {
  title: string;
  empty: string;
  children: React.ReactNode;
}) {
  const items = Array.isArray(children) ? children.filter(Boolean) : children ? [children] : [];
  return (
    <section className="overflow-hidden rounded-xl border border-border bg-card">
      <div className="border-b border-border px-4 py-3 text-sm font-semibold">{title}</div>
      {items.length === 0 ? (
        <p className="px-4 py-6 text-sm text-muted-foreground">{empty}</p>
      ) : (
        <ul className="divide-y divide-border">{items}</ul>
      )}
    </section>
  );
}
