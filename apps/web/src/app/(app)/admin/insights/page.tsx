import type { Metadata } from 'next';
import Link from 'next/link';
import type { Route } from 'next';
import { formatDate } from '@jamiya/shared';
import { requireAdminAccess } from '@/features/admin/lib/require-admin';
import {
  fetchAdminInsights,
  formatCountMap,
  pct,
} from '@/features/admin/lib/insights';

export const metadata: Metadata = { title: 'Admin · Insights' };
export const dynamic = 'force-dynamic';

function Metric({
  label,
  value,
  hint,
}: {
  label: string;
  value: string | number;
  hint?: string;
}) {
  return (
    <div className="rounded-xl border border-border bg-card px-4 py-4">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-2 font-[family-name:var(--font-display)] text-3xl font-semibold tracking-tight">
        {value}
      </p>
      {hint ? <p className="mt-1 text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

function BarList({
  title,
  rows,
  empty,
}: {
  title: string;
  rows: Array<{ label: string; value: number }>;
  empty: string;
}) {
  const max = Math.max(...rows.map((r) => r.value), 1);
  return (
    <div className="amanah-surface space-y-3 px-4 py-4">
      <h3 className="text-sm font-semibold tracking-tight">{title}</h3>
      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">{empty}</p>
      ) : (
        <ul className="space-y-2.5">
          {rows.map((row) => (
            <li key={row.label}>
              <div className="mb-1 flex items-baseline justify-between gap-2 text-sm">
                <span className="capitalize text-foreground">{row.label}</span>
                <span className="font-semibold tabular-nums">{row.value}</span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-secondary">
                <div
                  className="h-full rounded-full bg-primary"
                  style={{ width: `${Math.max(6, (100 * row.value) / max)}%` }}
                />
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default async function AdminInsightsPage() {
  await requireAdminAccess('compliance');
  const insights = await fetchAdminInsights();

  if (!insights) {
    return (
      <div className="amanah-surface space-y-2 px-5 py-5">
        <h2 className="text-xl font-semibold">Insights unavailable</h2>
        <p className="text-sm text-muted-foreground">
          Could not load product metrics. Confirm you are signed in as platform admin and that
          migrations are applied.
        </p>
      </div>
    );
  }

  const a = insights.activation;
  const p = insights.payments;
  const h = insights.circle_health;

  const joinedRate = pct(a.with_membership, a.profiles_total);
  const paidRate = pct(a.with_paid_contribution, a.with_membership || a.profiles_total);
  const intentSuccess =
    p.intents_7d > 0 ? pct(p.intents_completed_7d, p.intents_7d) : null;
  const dueTotal = h.contributions_paid + h.contributions_pending;
  const pendingShare = pct(h.contributions_pending, dueTotal);

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="font-[family-name:var(--font-display)] text-2xl font-semibold">
            Insights
          </h2>
          <p className="mt-1 max-w-xl text-sm text-muted-foreground">
            Activation, payment funnel, and circle health — who is stuck, who is late, and what
            broke in payments.
          </p>
        </div>
        <p className="text-xs text-muted-foreground">
          Updated {formatDate(insights.generated_at)}
        </p>
      </div>

      <section className="space-y-3">
        <div className="flex items-baseline justify-between gap-2">
          <h3 className="text-lg font-bold tracking-tight">Activation</h3>
          <p className="text-xs text-muted-foreground">Signup → circle → first payment</p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <Metric label="Members" value={a.profiles_total} hint={`${a.profiles_7d} new · 7d`} />
          <Metric
            label="In a circle"
            value={joinedRate == null ? a.with_membership : `${joinedRate}%`}
            hint={`${a.with_membership} of ${a.profiles_total} profiles`}
          />
          <Metric
            label="Paid once"
            value={paidRate == null ? a.with_paid_contribution : `${paidRate}%`}
            hint={`${a.with_paid_contribution} members with a paid contribution`}
          />
          <Metric
            label="Avg hours to first pay"
            value={a.avg_hours_to_first_pay ?? '—'}
            hint="From signup to first paid contribution"
          />
          <Metric label="Officers" value={a.officers_active} hint="Active circle officers" />
          <Metric label="Circle members" value={a.members_active} hint="Active member role" />
          <Metric label="Invites pending" value={a.invites_pending} />
          <Metric label="Invites accepted" value={a.invites_accepted} />
        </div>
      </section>

      <section className="space-y-3">
        <div className="flex items-baseline justify-between gap-2">
          <h3 className="text-lg font-bold tracking-tight">Payment funnel</h3>
          <p className="text-xs text-muted-foreground">Intents · ledger · contribution methods</p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <Metric
            label="Intents (7d)"
            value={p.intents_7d}
            hint={
              intentSuccess == null
                ? `${p.intents_total} all-time`
                : `${intentSuccess}% completed · ${p.intents_failed_7d} failed`
            }
          />
          <Metric label="Completed intents (7d)" value={p.intents_completed_7d} />
          <Metric label="Ledger txs (30d)" value={p.transactions_completed_30d} />
          <Metric label="Circle payments (30d)" value={p.contribution_payments_30d} />
        </div>
        <div className="grid gap-3 lg:grid-cols-3">
          <BarList
            title="Intent status"
            rows={formatCountMap(p.intents_by_status)}
            empty="No payment intents yet (STK / checkout attempts will show here)."
          />
          <BarList
            title="Channel / provider"
            rows={formatCountMap(p.intents_by_provider)}
            empty="No provider mix yet."
          />
          <BarList
            title="Ledger types (30d)"
            rows={formatCountMap(p.transactions_by_type)}
            empty="No completed ledger activity in the last 30 days."
          />
        </div>
        <div className="grid gap-3 lg:grid-cols-2">
          <BarList
            title="Contribution payment methods (30d)"
            rows={formatCountMap(p.payment_methods)}
            empty="No contribution payments recorded in the last 30 days."
          />
          <div className="amanah-surface space-y-3 px-4 py-4">
            <h3 className="text-sm font-semibold tracking-tight">Top payment errors (30d)</h3>
            {p.top_errors.length === 0 ? (
              <p className="text-sm text-muted-foreground">No failed intents with messages yet.</p>
            ) : (
              <ul className="divide-y divide-border">
                {p.top_errors.map((row) => (
                  <li
                    key={`${row.error}-${row.n}`}
                    className="flex items-start justify-between gap-3 py-2.5 text-sm"
                  >
                    <span className="min-w-0 break-words text-muted-foreground">{row.error}</span>
                    <span className="shrink-0 font-semibold tabular-nums">{row.n}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </section>

      <section className="space-y-3">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h3 className="text-lg font-bold tracking-tight">Circle health</h3>
          <Link
            href={'/admin/collections' as Route}
            className="text-sm font-semibold text-primary hover:underline"
          >
            Open collections
          </Link>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <Metric label="Circles" value={h.circles_total} hint={`${h.circles_active} active status`} />
          <Metric
            label="Pending dues"
            value={h.contributions_pending}
            hint={pendingShare == null ? undefined : `${pendingShare}% of due items`}
          />
          <Metric label="Overdue" value={h.contributions_overdue} hint="Pending past due date" />
          <Metric
            label="On-time pay rate"
            value={h.on_time_rate_pct == null ? '—' : `${h.on_time_rate_pct}%`}
            hint="Paid on or before due date"
          />
          <Metric label="Open collection cases" value={h.open_collection_cases} />
          <Metric
            label="Quiet circles (14d)"
            value={h.dormant_circles_14d}
            hint="No payment activity in 14 days"
          />
          <Metric label="Paid contributions" value={h.contributions_paid} />
        </div>

        <div className="amanah-surface overflow-hidden">
          <div className="border-b border-border px-4 py-3">
            <h3 className="text-sm font-semibold tracking-tight">Per circle</h3>
          </div>
          {h.circles.length === 0 ? (
            <p className="px-4 py-5 text-sm text-muted-foreground">No circles yet.</p>
          ) : (
            <ul className="divide-y divide-border">
              {h.circles.map((circle) => (
                <li
                  key={circle.id}
                  className="flex flex-wrap items-center justify-between gap-3 px-4 py-3.5"
                >
                  <div className="min-w-0">
                    <Link
                      href={`/circles/${circle.slug}` as Route}
                      className="font-semibold text-foreground hover:text-primary hover:underline"
                    >
                      {circle.name}
                    </Link>
                    <p className="text-xs capitalize text-muted-foreground">
                      {circle.status.replaceAll('_', ' ')} · {circle.members} members
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-3 text-sm">
                    <span className="tabular-nums text-muted-foreground">
                      Paid <strong className="text-foreground">{circle.paid}</strong>
                    </span>
                    <span className="tabular-nums text-muted-foreground">
                      Pending <strong className="text-foreground">{circle.pending}</strong>
                    </span>
                    <span
                      className={
                        circle.overdue > 0
                          ? 'tabular-nums font-semibold text-destructive'
                          : 'tabular-nums text-muted-foreground'
                      }
                    >
                      Overdue {circle.overdue}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </div>
  );
}
