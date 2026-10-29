'use client';

import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { formatCurrency } from '@jamiya/shared';
import { Alert, AlertDescription, Button, Input, Label, NativeSelect, Textarea } from '@jamiya/ui';
import { parseStatement, type StatementLine } from '@/features/circles/lib/statement-match';
import {
  BILLING_PERIODS,
  PERIOD_LABEL,
  planListPrice,
  type BillingPeriod,
} from '@/features/circles/lib/plan-price';
import { findCircle, guessPlan, type BillingCircle, type BillingPlan } from '../lib/plan-payment-match';
import { recordPlanPaymentsAction } from '../actions/plan-payment-actions';

type Row = StatementLine & {
  circleId: string;
  planId: string;
  period: BillingPeriod;
  include: boolean;
  already: boolean;
};

export function PlanPaymentsForm({
  circles,
  plans,
  recordedRefs,
}: {
  circles: BillingCircle[];
  plans: BillingPlan[];
  recordedRefs: string[];
}) {
  const router = useRouter();
  const [paste, setPaste] = useState('');
  const [rows, setRows] = useState<Row[]>([]);
  const [reading, setReading] = useState(false);
  const [pending, startTransition] = useTransition();
  const [notice, setNotice] = useState<{ ok: boolean; message: string } | null>(null);
  const recorded = useMemo(() => new Set(recordedRefs), [recordedRefs]);
  const circleById = useMemo(() => new Map(circles.map((c) => [c.id, c])), [circles]);
  const paidPlans = plans.filter((p) => Number(p.price_kes) > 0);
  const sortedCircles = useMemo(() => [...circles].sort((a, b) => a.name.localeCompare(b.name)), [circles]);

  async function readPdf(file: File) {
    setReading(true);
    setNotice(null);
    try {
      const { extractText, getDocumentProxy } = await import('unpdf');
      const pdf = await getDocumentProxy(new Uint8Array(await file.arrayBuffer()));
      const { text } = await extractText(pdf, { mergePages: true });
      setPaste(text);
      read(text);
    } catch {
      setNotice({ ok: false, message: 'Could not read that PDF. Copy the rows and paste them instead.' });
    } finally {
      setReading(false);
    }
  }

  function read(source = paste) {
    const lines = parseStatement(source);
    setRows(
      lines.map((line) => {
        const circle = findCircle(`${line.details} ${line.raw}`, line.phone, circles);
        const guess = circle ? guessPlan(line.amount ?? 0, circle, plans) : null;
        const already = recorded.has(line.reference);
        return {
          ...line,
          circleId: circle?.id ?? '',
          planId: guess?.planId ?? paidPlans[0]?.id ?? '',
          period: guess?.period ?? 'monthly',
          include: Boolean(circle) && !already,
          already,
        };
      }),
    );
    setNotice(
      lines.length === 0
        ? { ok: false, message: 'No money-in lines found.' }
        : {
            ok: true,
            message: `Found ${lines.length} payments in, totalling ${formatCurrency(
              lines.reduce((s, l) => s + (l.amount ?? 0), 0),
              'KES',
            )}. Check this against the statement's total credits.`,
          },
    );
  }

  function update(i: number, patch: Partial<Row>) {
    setRows((prev) => prev.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  }

  function priceFor(r: Row): number | null {
    const circle = circleById.get(r.circleId);
    const plan = plans.find((p) => p.id === r.planId);
    return circle && plan ? planListPrice(plan, circle.members, r.period) : null;
  }

  const chosen = rows.filter((r) => r.include && r.circleId && r.planId && (r.amount ?? 0) > 0);

  function record() {
    startTransition(async () => {
      let recordedCount = 0;
      let activated = 0;
      let held = 0;
      let duplicates = 0;
      for (let i = 0; i < chosen.length; i += 400) {
        const result = await recordPlanPaymentsAction(
          chosen.slice(i, i + 400).map((r) => ({
            reference: r.reference,
            paid_on: r.date,
            amount: r.amount ?? 0,
            jamiya_id: r.circleId,
            plan_id: r.planId,
            period: r.period,
            details: r.details.slice(0, 500),
          })),
        );
        if (!result.ok) {
          setNotice({ ok: false, message: result.message });
          router.refresh();
          return;
        }
        recordedCount += result.recorded ?? 0;
        activated += result.activated ?? 0;
        held += result.held ?? 0;
        duplicates += result.duplicates ?? 0;
      }
      const parts = [`Recorded ${recordedCount} payment${recordedCount === 1 ? '' : 's'}; ${activated} plan${activated === 1 ? '' : 's'} switched on or extended.`];
      if (held > 0) parts.push(`${held} short payment${held === 1 ? ' is' : 's are'} held until the rest arrives.`);
      if (duplicates > 0) parts.push(`${duplicates} already recorded and skipped.`);
      setNotice({ ok: true, message: parts.join(' ') });
      setRows([]);
      setPaste('');
      router.refresh();
    });
  }

  return (
    <section className="jameiyah-surface space-y-4 px-4 py-4 sm:px-5">
      <div>
        <h2 className="font-semibold">Read Jameiyah&apos;s bank statement</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Each payment in is matched to a circle by its reference (JM…) or the officer&apos;s phone, and to
          the plan whose price it equals. A payment that covers the plan switches it on, or adds the period
          from where the current one ends. A smaller one is held until the rest arrives.
        </p>
      </div>

      {notice ? (
        <Alert variant={notice.ok ? 'success' : 'destructive'}>
          <AlertDescription>{notice.message}</AlertDescription>
        </Alert>
      ) : null}

      <div className="space-y-1">
        <Label htmlFor="planStatementPdf">Statement PDF</Label>
        <Input
          id="planStatementPdf"
          type="file"
          accept="application/pdf"
          disabled={reading}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void readPdf(file);
            e.target.value = '';
          }}
        />
      </div>
      <div className="space-y-1">
        <Label htmlFor="planStatementPaste">Or paste statement rows</Label>
        <Textarea
          id="planStatementPaste"
          rows={6}
          className="font-mono text-xs"
          value={paste}
          onChange={(e) => setPaste(e.target.value)}
        />
      </div>
      <Button type="button" variant="outline" className="min-h-11" onClick={() => read()} disabled={!paste.trim()}>
        Read statement
      </Button>

      {rows.length > 0 ? (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            {rows.length} payments in · {rows.filter((r) => r.circleId).length} matched to a circle ·{' '}
            {rows.filter((r) => r.already).length} already recorded
          </p>
          <ul className="divide-y divide-border/70 rounded-lg border border-border">
            {rows.map((r, i) => {
              const price = priceFor(r);
              const amount = r.amount ?? 0;
              return (
                <li key={`${r.reference}-${i}`} className="space-y-2 px-3 py-3">
                  <div className="flex flex-wrap items-start gap-3">
                    <input
                      type="checkbox"
                      className="mt-1 h-5 w-5"
                      aria-label={`Record ${r.reference}`}
                      checked={r.include}
                      disabled={r.already}
                      onChange={(e) => update(i, { include: e.target.checked })}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="break-words font-mono text-xs text-muted-foreground">{r.raw}</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {r.date ?? 'No date'} · Ref {r.reference} · {formatCurrency(amount, 'KES')}
                        {r.already ? ' · Already recorded' : ''}
                        {!r.already && r.circleId && price !== null
                          ? amount >= price
                            ? ` · covers ${formatCurrency(price, 'KES')}`
                            : ` · short of ${formatCurrency(price, 'KES')} (held)`
                          : ''}
                      </p>
                    </div>
                  </div>
                  {!r.already ? (
                    <div className="flex flex-wrap items-end gap-3 pl-8">
                      <div className="min-w-[12rem] flex-1 space-y-1">
                        <Label htmlFor={`c-${i}`} className="text-xs">
                          Circle
                        </Label>
                        <NativeSelect
                          id={`c-${i}`}
                          value={r.circleId}
                          onChange={(e) => {
                            const circle = circleById.get(e.target.value);
                            const guess = circle ? guessPlan(amount, circle, plans) : null;
                            update(i, {
                              circleId: e.target.value,
                              include: Boolean(e.target.value),
                              ...(guess ? { planId: guess.planId, period: guess.period } : {}),
                            });
                          }}
                        >
                          <option value="">Choose a circle…</option>
                          {sortedCircles.map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.name} · {c.billingRef} · {c.members} members
                            </option>
                          ))}
                        </NativeSelect>
                      </div>
                      <div className="w-36 space-y-1">
                        <Label htmlFor={`p-${i}`} className="text-xs">
                          Plan
                        </Label>
                        <NativeSelect id={`p-${i}`} value={r.planId} onChange={(e) => update(i, { planId: e.target.value })}>
                          {paidPlans.map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.name}
                            </option>
                          ))}
                        </NativeSelect>
                      </div>
                      <div className="w-36 space-y-1">
                        <Label htmlFor={`d-${i}`} className="text-xs">
                          Period
                        </Label>
                        <NativeSelect
                          id={`d-${i}`}
                          value={r.period}
                          onChange={(e) => update(i, { period: e.target.value as BillingPeriod })}
                        >
                          {BILLING_PERIODS.map((p) => (
                            <option key={p} value={p}>
                              {PERIOD_LABEL[p].adjective}
                            </option>
                          ))}
                        </NativeSelect>
                      </div>
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ul>
          <Button type="button" className="min-h-11" onClick={record} disabled={pending || chosen.length === 0}>
            {pending
              ? 'Recording…'
              : `Record ${chosen.length} payment${chosen.length === 1 ? '' : 's'} · ${formatCurrency(
                  chosen.reduce((s, r) => s + (r.amount ?? 0), 0),
                  'KES',
                )}`}
          </Button>
        </div>
      ) : null}
    </section>
  );
}
