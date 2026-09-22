import type { Metadata } from 'next';
import Link from 'next/link';
import type { Route } from 'next';
import { Button } from '@jamiya/ui';
import { requireAdminAccess } from '@/features/admin/lib/require-admin';
import { FINANCE_STATUS_MAPS } from '@/lib/finance/state-machine';

export const metadata: Metadata = { title: 'Admin · Architecture' };
export const dynamic = 'force-dynamic';

const LAYERS = [
  {
    title: '1. Product surfaces',
    body: 'Circles, Wallet, Finance (Qard / Goals / Welfare / Tawarruq), Sadaka, Admin ops queues.',
  },
  {
    title: '2. Payment orchestrator',
    body: 'Features call collectPayment / disbursePayment / getPaymentStatus only. Adapters: IntaSend, TendePay, Daraja, Paystack, simulated. Never import a PSP SDK from a feature.',
  },
  {
    title: '3. Collection truth (live SoT)',
    body: 'payment_intents → complete_payment_intent / fail_payment_intent → wallets + private.ledger_* + transactions. Idempotency keys prevent double-credit.',
  },
  {
    title: '4. Settlement & reconcile layers',
    body: 'intent.status ≠ settlement_status ≠ reconcile_status. settlements + provider_transactions mirror PSP cash. Webhook inbox (webhook_events) dedupes by fingerprint.',
  },
  {
    title: '5. Journal projection',
    body: 'ledger_accounts + journal_entries / journal_lines — append-only, balanced, idempotent on (source_type, source_id). Domains: OPERATING, CONTRIBUTIONS, QARD, SADAKA, TAKAFUL, ASSET_FINANCE.',
  },
  {
    title: '6. Circle books',
    body: 'book_entries cashbook bridged from contribution settlements. Officer desk + member statement read from books + wallet, not raw PSP payloads.',
  },
] as const;

const ADMIN_MAP = [
  { href: '/admin/finance' as Route, label: 'Finance', role: 'MuM KPIs, exceptions, journal feed' },
  { href: '/admin/finance/reconcile' as Route, label: 'Reconcile', role: 'Stuck intents + run reconcile' },
  { href: '/admin/finance/journal' as Route, label: 'Journal', role: 'Append-only double-entry browser' },
  { href: '/admin/finance/refunds' as Route, label: 'Refunds', role: 'Queue refunds (no edit of posts)' },
  { href: '/admin/architecture' as Route, label: 'Architecture', role: 'How the stack is built' },
  { href: '/admin/observability' as Route, label: 'Health', role: 'Provider / cron / webhook health' },
  { href: '/admin/transactions' as Route, label: 'Transactions', role: 'Wallet ledger browse' },
  { href: '/admin/audit' as Route, label: 'Audit', role: 'Who changed what' },
] as const;

function statusGrid(
  title: string,
  map: Record<string, readonly string[]>,
) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <h3 className="text-sm font-semibold">{title}</h3>
      <ul className="mt-3 space-y-1.5 text-xs text-muted-foreground">
        {Object.entries(map).map(([from, tos]) => (
          <li key={from} className="font-mono">
            <span className="text-foreground">{from}</span>
            {tos.length === 0 ? (
              <span> → (terminal)</span>
            ) : (
              <span> → {tos.join(' | ')}</span>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

export default async function AdminArchitecturePage() {
  await requireAdminAccess('admin');

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="font-[family-name:var(--font-display)] text-2xl font-semibold">
            System architecture
          </h2>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            How Jameiyah money is built end-to-end. This is the admin backend map — not a
            member product page. Live SoT is still wallet + payment_intents; journal is the
            projection path toward full double-entry.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild className="min-h-11">
            <Link href={'/admin/finance' as Route}>Finance centre</Link>
          </Button>
          <Button asChild variant="outline" className="min-h-11">
            <Link href={'/admin/observability' as Route}>Health</Link>
          </Button>
        </div>
      </div>

      <section className="space-y-3">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Stack layers
        </h3>
        <ol className="grid gap-3 md:grid-cols-2">
          {LAYERS.map((layer) => (
            <li
              key={layer.title}
              className="rounded-xl border border-border bg-card px-4 py-3"
            >
              <p className="text-sm font-semibold text-foreground">{layer.title}</p>
              <p className="mt-1 text-sm text-muted-foreground">{layer.body}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="space-y-3">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Controlled status transitions
        </h3>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {statusGrid('payment_intents.status', FINANCE_STATUS_MAPS.intent)}
          {statusGrid(
            'payment_intents.settlement_status',
            FINANCE_STATUS_MAPS.settlementLayer,
          )}
          {statusGrid(
            'payment_intents.reconcile_status',
            FINANCE_STATUS_MAPS.reconcile,
          )}
          {statusGrid('settlements.status', FINANCE_STATUS_MAPS.settlementRecord)}
          {statusGrid('refunds.status', FINANCE_STATUS_MAPS.refund)}
        </div>
      </section>

      <section className="space-y-3">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Admin surfaces
        </h3>
        <ul className="divide-y divide-border rounded-xl border border-border bg-card">
          {ADMIN_MAP.map((item) => (
            <li key={item.href} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
              <div>
                <p className="text-sm font-semibold">{item.label}</p>
                <p className="text-xs text-muted-foreground">{item.role}</p>
              </div>
              <Button asChild variant="outline" size="sm" className="min-h-10">
                <Link href={item.href}>Open</Link>
              </Button>
            </li>
          ))}
        </ul>
      </section>

      <p className="text-xs text-muted-foreground">
        Docs: <code>docs/financial-architecture.md</code>,{' '}
        <code>docs/payment-provider-integration.md</code>,{' '}
        <code>docs/PAYMENTS_ORCHESTRATOR.md</code>.
      </p>
    </div>
  );
}
