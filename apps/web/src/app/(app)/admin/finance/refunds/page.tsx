import type { Metadata } from 'next';
import Link from 'next/link';
import type { Route } from 'next';
import { formatCurrency, formatDate } from '@jamiya/shared';
import { Button } from '@jamiya/ui';
import { createClient } from '@/lib/supabase/server';
import { requireAdminAccess } from '@/features/admin/lib/require-admin';
import {
  requestRefundAction,
  completeRefundAction,
  cancelRefundAction,
} from '@/features/admin/actions/refund-actions';
import { StatusBadge } from '@/features/dashboard/components/dashboard-stats';
import { financeStatusLabel } from '@/features/admin/lib/finance-labels';
import { ConfirmSubmitButton } from '@/features/admin/components/confirm-submit-button';

export const metadata: Metadata = { title: 'Admin · Refunds' };
export const dynamic = 'force-dynamic';

type RefundRow = {
  id: string;
  payment_intent_id: string | null;
  amount: number | string;
  currency: string;
  reason: string | null;
  status: string;
  created_at: string;
  completed_at: string | null;
};

type IntentHit = {
  id: string;
  amount: number | string;
  currency: string;
  status: string;
  settlement_status: string | null;
  reconcile_status: string | null;
  provider: string | null;
  provider_reference: string | null;
  phone: string | null;
  user_id: string | null;
  created_at: string;
  full_name?: string | null;
};

type Props = {
  searchParams?: Promise<{
    q?: string;
    intentId?: string;
  }>;
};

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );
}

export default async function AdminRefundsPage({ searchParams }: Props) {
  await requireAdminAccess('admin');
  const params = (await searchParams) ?? {};
  const q = (params.q ?? '').trim();
  const selectedIntentId = (params.intentId ?? '').trim();
  const supabase = await createClient();

  const { data: refunds } = await supabase
    .from('refunds')
    .select(
      'id, payment_intent_id, amount, currency, reason, status, created_at, completed_at',
    )
    .order('created_at', { ascending: false })
    .limit(40);

  const rows = (refunds ?? []) as unknown as RefundRow[];

  let hits: IntentHit[] = [];
  let selected: IntentHit | null = null;

  const safeQ = q.replace(/[%_,]/g, '').slice(0, 64);

  if (safeQ.length >= 3 || isUuid(q)) {
    let query = supabase
      .from('payment_intents')
      .select(
        'id, amount, currency, status, settlement_status, reconcile_status, provider, provider_reference, phone, user_id, created_at',
      )
      .order('created_at', { ascending: false })
      .limit(12);

    if (isUuid(q)) {
      query = query.or(`id.eq.${q},provider_reference.eq.${q}`);
    } else if (/^\d+(\.\d+)?$/.test(safeQ)) {
      query = query.eq('amount', Number(safeQ));
    } else {
      query = query.or(
        `provider_reference.ilike.%${safeQ}%,phone.ilike.%${safeQ}%`,
      );
    }

    const { data: intentRows } = await query;
    hits = (intentRows ?? []) as unknown as IntentHit[];

    const userIds = Array.from(
      new Set(hits.map((h) => h.user_id).filter((id): id is string => Boolean(id))),
    );
    if (userIds.length > 0) {
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, full_name')
        .in('id', userIds);
      const nameById = new Map(
        ((profiles ?? []) as Array<{ id: string; full_name: string | null }>).map((p) => [
          p.id,
          p.full_name,
        ]),
      );
      hits = hits.map((h) => ({
        ...h,
        full_name: h.user_id ? nameById.get(h.user_id) ?? null : null,
      }));
    }
  }

  if (selectedIntentId && isUuid(selectedIntentId)) {
    selected = hits.find((h) => h.id === selectedIntentId) ?? null;
    if (!selected) {
      const { data: one } = await supabase
        .from('payment_intents')
        .select(
          'id, amount, currency, status, settlement_status, reconcile_status, provider, provider_reference, phone, user_id, created_at',
        )
        .eq('id', selectedIntentId)
        .maybeSingle();
      if (one) {
        selected = one as IntentHit;
        if (selected.user_id) {
          const { data: profile } = await supabase
            .from('profiles')
            .select('full_name')
            .eq('id', selected.user_id)
            .maybeSingle();
          selected.full_name =
            (profile as { full_name?: string | null } | null)?.full_name ?? null;
        }
      }
    }
  }

  const refundEligible = selected?.status === 'completed';

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="font-[family-name:var(--font-display)] text-2xl font-semibold">
            Refunds
          </h2>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Find a payment first, review eligibility, then queue a refund. Completion posts a
            reversing journal. Large refunds may require dual approval.
          </p>
        </div>
        <Button asChild variant="outline" className="min-h-11">
          <Link href={'/admin/finance' as Route}>Finance centre</Link>
        </Button>
      </div>

      <form
        method="get"
        className="grid gap-3 rounded-xl border border-border bg-card p-4 sm:grid-cols-[1fr_auto]"
      >
        <label className="block text-sm">
          <span className="font-medium">Find payment</span>
          <input
            name="q"
            defaultValue={q}
            className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
            placeholder="Member phone, provider ref, amount, or intent UUID"
          />
        </label>
        <div className="flex items-end">
          <Button type="submit" variant="outline" className="min-h-11 w-full sm:w-auto">
            Search
          </Button>
        </div>
      </form>

      {q && hits.length === 0 ? (
        <p className="text-sm text-muted-foreground">No payments matched “{q}”.</p>
      ) : null}

      {hits.length > 0 ? (
        <div className="overflow-hidden rounded-xl border border-border bg-card">
          <div className="border-b border-border px-4 py-3 text-sm font-semibold">
            Select a payment
          </div>
          <ul className="divide-y divide-border">
            {hits.map((hit) => {
              const active = selected?.id === hit.id;
              return (
                <li key={hit.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold">
                      {hit.full_name?.trim() || 'Member'} ·{' '}
                      {formatCurrency(Number(hit.amount), hit.currency)}
                    </p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {financeStatusLabel(hit.status)}
                      {hit.settlement_status
                        ? ` · settlement ${financeStatusLabel(hit.settlement_status)}`
                        : ''}
                      {hit.reconcile_status
                        ? ` · reconcile ${financeStatusLabel(hit.reconcile_status)}`
                        : ''}
                    </p>
                    <p className="font-mono text-[11px] text-muted-foreground">
                      {hit.provider_reference ?? hit.id} · {hit.phone ?? 'no phone'} ·{' '}
                      {formatDate(hit.created_at)}
                    </p>
                  </div>
                  <Button asChild size="sm" variant={active ? 'default' : 'outline'}>
                    <Link
                      href={
                        `/admin/finance/refunds?q=${encodeURIComponent(q)}&intentId=${hit.id}` as Route
                      }
                    >
                      {active ? 'Selected' : 'Select'}
                    </Link>
                  </Button>
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}

      {selected ? (
        <div className="space-y-3 rounded-xl border border-primary/30 bg-primary/5 p-4">
          <div>
            <p className="text-sm font-semibold text-foreground">
              Refund from {selected.full_name?.trim() || 'member'}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              {formatCurrency(Number(selected.amount), selected.currency)} ·{' '}
              {financeStatusLabel(selected.status)} · payment {selected.id.slice(0, 8)}…
            </p>
            {!refundEligible ? (
              <p className="mt-2 text-sm text-destructive">
                This payment status ({financeStatusLabel(selected.status)}) is not a typical
                refund source. Prefer completed payments.
              </p>
            ) : (
              <p className="mt-2 text-sm text-muted-foreground">
                Eligible to queue. Amount defaults to the full intent; reduce if partial.
              </p>
            )}
          </div>
          <form
            action={requestRefundAction}
            className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"
          >
            <input type="hidden" name="intentId" value={selected.id} />
            <label className="block text-sm">
              <span className="font-medium">Amount (KES)</span>
              <input
                name="amount"
                type="number"
                min="1"
                step="0.01"
                required
                defaultValue={Number(selected.amount)}
                className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
              />
            </label>
            <label className="block text-sm sm:col-span-2">
              <span className="font-medium">Reason</span>
              <input
                name="reason"
                className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                placeholder="Optional"
              />
            </label>
            <div className="flex items-end">
              <Button type="submit" className="min-h-11 w-full" disabled={!refundEligible}>
                Queue refund
              </Button>
            </div>
          </form>
          <p className="text-xs text-muted-foreground">
            Case file:{' '}
            <Link
              href={`/admin/finance/intents/${selected.id}` as Route}
              className="text-primary hover:underline"
            >
              open payment details
            </Link>
          </p>
        </div>
      ) : (
        <form
          action={requestRefundAction}
          className="grid gap-3 rounded-xl border border-dashed border-border bg-card/60 p-4 sm:grid-cols-2 lg:grid-cols-4"
        >
          <p className="sm:col-span-2 lg:col-span-4 text-sm text-muted-foreground">
            Or paste an intent UUID if you already have it from a case file.
          </p>
          <label className="block text-sm sm:col-span-2">
            <span className="font-medium">Payment intent ID</span>
            <input
              name="intentId"
              required
              className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 font-mono text-sm"
              placeholder="uuid"
            />
          </label>
          <label className="block text-sm">
            <span className="font-medium">Amount (KES)</span>
            <input
              name="amount"
              type="number"
              min="1"
              step="0.01"
              required
              className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
            />
          </label>
          <label className="block text-sm">
            <span className="font-medium">Reason</span>
            <input
              name="reason"
              className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
              placeholder="Optional"
            />
          </label>
          <div className="sm:col-span-2 lg:col-span-4">
            <Button type="submit" className="min-h-11">
              Queue refund
            </Button>
          </div>
        </form>
      )}

      <div className="overflow-hidden rounded-xl border border-border bg-card">
        <div className="border-b border-border px-4 py-3 text-sm font-semibold">
          Recent refund requests
        </div>
        {rows.length === 0 ? (
          <p className="px-4 py-8 text-sm text-muted-foreground">No refunds yet.</p>
        ) : (
          <ul className="divide-y divide-border">
            {rows.map((row) => (
              <li
                key={row.id}
                className="flex flex-wrap items-center justify-between gap-3 px-4 py-3"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold tabular-nums">
                    {formatCurrency(Number(row.amount), row.currency)}
                  </p>
                  <p className="mt-0.5 font-mono text-[11px] text-muted-foreground">
                    {row.payment_intent_id ? (
                      <Link
                        href={`/admin/finance/intents/${row.payment_intent_id}` as Route}
                        className="text-primary hover:underline"
                      >
                        {row.payment_intent_id}
                      </Link>
                    ) : (
                      '—'
                    )}{' '}
                    · {row.reason ?? 'no reason'}
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    {formatDate(row.created_at)}
                    {row.completed_at ? ` · done ${formatDate(row.completed_at)}` : ''}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <StatusBadge status={row.status} />
                  {row.status === 'pending' ||
                  row.status === 'processing' ||
                  row.status === 'failed' ? (
                    <>
                      {(row.status === 'pending' || row.status === 'processing') && (
                        <form action={completeRefundAction}>
                          <input type="hidden" name="refundId" value={row.id} />
                          <ConfirmSubmitButton
                            className="min-h-10"
                            message="Complete this refund? This posts a reversing journal and cannot be undone from this screen."
                          >
                            Complete
                          </ConfirmSubmitButton>
                        </form>
                      )}
                      <form action={cancelRefundAction}>
                        <input type="hidden" name="refundId" value={row.id} />
                        <Button type="submit" size="sm" variant="outline" className="min-h-10">
                          Cancel
                        </Button>
                      </form>
                    </>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
