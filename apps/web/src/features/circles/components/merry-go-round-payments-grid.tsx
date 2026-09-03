'use client';

import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Alert, AlertDescription, Button, Input, Label } from '@jamiya/ui';
import { saveMgrMonthlyPaymentsAction } from '@/features/circles/actions/ledger-actions';
import { VoidLedgerButton } from '@/features/circles/components/void-ledger-button';

export type MgrGridMember = {
  id: string;
  label: string;
};

export type MgrMonthColumn = {
  cycleNumber: number;
  year: number;
  month: number;
  label: string;
};

type Props = {
  jamiyaId: string;
  slug: string;
  members: MgrGridMember[];
  months: MgrMonthColumn[];
  /** memberId -> cycleNumber -> amount paid */
  amounts: Record<string, Record<number, number>>;
  /** memberId -> cycleNumber -> contribution id (for void) */
  contributionIds?: Record<string, Record<number, string>>;
  canManage?: boolean;
  defaultAmount: number;
};

function cellKey(memberId: string, cycleNumber: number) {
  return `${memberId}:${cycleNumber}`;
}

function monthLabel(year: number, month: number) {
  return new Date(year, month - 1, 1).toLocaleString('en-GB', {
    month: 'short',
    year: '2-digit',
  });
}

function shiftMonth(year: number, month: number, delta: number) {
  const d = new Date(year, month - 1 + delta, 1);
  return { year: d.getFullYear(), month: d.getMonth() + 1 };
}

function sortMonths(cols: MgrMonthColumn[]) {
  return [...cols].sort((a, b) => a.year - b.year || a.month - b.month);
}

function nextFreeCycle(cols: MgrMonthColumn[]) {
  const used = new Set(cols.map((c) => c.cycleNumber));
  let n = 1;
  while (used.has(n)) n += 1;
  return n;
}

export function MerryGoRoundPaymentsGrid({
  jamiyaId,
  slug,
  members,
  months: initialMonths,
  amounts,
  contributionIds = {},
  canManage = false,
  defaultAmount,
}: Props) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const [saveNotice, setSaveNotice] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);
  const [months, setMonths] = useState(() => sortMonths(initialMonths));
  const [fillAmount, setFillAmount] = useState(String(defaultAmount || 0));
  const [mobileMemberId, setMobileMemberId] = useState(members[0]?.id ?? '');
  const [draft, setDraft] = useState<Record<string, string>>(() => {
    const next: Record<string, string> = {};
    for (const m of members) {
      for (const col of initialMonths) {
        const v = amounts[m.id]?.[col.cycleNumber];
        next[cellKey(m.id, col.cycleNumber)] = v && v > 0 ? String(v) : '';
      }
    }
    return next;
  });

  const dirtyKeys = useMemo(() => {
    const keys = new Set<string>();
    for (const m of members) {
      for (const col of months) {
        const key = cellKey(m.id, col.cycleNumber);
        const draftVal = Number(draft[key] || 0);
        const orig = amounts[m.id]?.[col.cycleNumber] ?? 0;
        if ((Number.isFinite(draftVal) ? draftVal : 0) !== orig) keys.add(key);
      }
    }
    return keys;
  }, [members, months, draft, amounts]);

  const newMonthKeys = useMemo(() => {
    const initial = new Set(
      initialMonths.map((m) => `${m.year}-${m.month}-${m.cycleNumber}`),
    );
    return months.filter((m) => !initial.has(`${m.year}-${m.month}-${m.cycleNumber}`));
  }, [months, initialMonths]);

  const canSave = dirtyKeys.size > 0 || newMonthKeys.length > 0;

  function seedDraft(cols: MgrMonthColumn[]) {
    setDraft((prev) => {
      const next = { ...prev };
      for (const m of members) {
        for (const col of cols) {
          const key = cellKey(m.id, col.cycleNumber);
          if (next[key] === undefined) {
            const v = amounts[m.id]?.[col.cycleNumber];
            next[key] = v && v > 0 ? String(v) : '';
          }
        }
      }
      return next;
    });
  }

  function addPastMonth() {
    setMonths((prev) => {
      const now = new Date();
      const anchor = prev[0] ?? {
        year: now.getFullYear(),
        month: now.getMonth() + 1,
        cycleNumber: 1,
        label: '',
      };
      const { year, month } = shiftMonth(anchor.year, anchor.month, -1);
      if (prev.some((p) => p.year === year && p.month === month)) return prev;
      const col: MgrMonthColumn = {
        cycleNumber: nextFreeCycle(prev),
        year,
        month,
        label: monthLabel(year, month),
      };
      seedDraft([col]);
      return sortMonths([col, ...prev]);
    });
  }

  function addNextMonth() {
    setMonths((prev) => {
      const now = new Date();
      const anchor = prev[prev.length - 1] ?? {
        year: now.getFullYear(),
        month: now.getMonth() + 1,
        cycleNumber: 1,
        label: '',
      };
      const { year, month } = shiftMonth(anchor.year, anchor.month, 1);
      if (prev.some((p) => p.year === year && p.month === month)) return prev;
      const col: MgrMonthColumn = {
        cycleNumber: nextFreeCycle(prev),
        year,
        month,
        label: monthLabel(year, month),
      };
      seedDraft([col]);
      return sortMonths([...prev, col]);
    });
  }

  function fillEmpty() {
    const amount = Number(fillAmount);
    if (!Number.isFinite(amount) || amount <= 0) return;
    setDraft((prev) => {
      const next = { ...prev };
      for (const m of members) {
        for (const col of months) {
          const key = cellKey(m.id, col.cycleNumber);
          if (!next[key]?.trim()) next[key] = String(amount);
        }
      }
      return next;
    });
  }

  /** One tap: set every empty cell in this month to the fill amount (or default). */
  function markMonthPaid(cycleNumber: number) {
    const amount = Number(fillAmount);
    if (!Number.isFinite(amount) || amount <= 0) return;
    setDraft((prev) => {
      const next = { ...prev };
      for (const m of members) {
        const key = cellKey(m.id, cycleNumber);
        if (!next[key]?.trim()) next[key] = String(amount);
      }
      return next;
    });
  }

  /** Empty cell tap → fill default contribution (one less step). */
  function fillCellIfEmpty(key: string) {
    setDraft((prev) => {
      if (prev[key]?.trim()) return prev;
      const amount = Number(fillAmount);
      if (!Number.isFinite(amount) || amount <= 0) return prev;
      return { ...prev, [key]: String(amount) };
    });
  }

  /** First month that still has empty cells — for the big CTA. */
  const quickMonth = useMemo(() => {
    for (const col of months) {
      const anyEmpty = members.some((m) => {
        const key = cellKey(m.id, col.cycleNumber);
        return !(Number(draft[key] || 0) > 0);
      });
      if (anyEmpty) return col;
    }
    return months[0] ?? null;
  }, [months, members, draft]);

  function onSave() {
    const cyclesToSave = new Set<number>();
    for (const key of dirtyKeys) {
      const cycle = Number(key.split(':')[1]);
      if (Number.isFinite(cycle)) cyclesToSave.add(cycle);
    }
    for (const col of newMonthKeys) cyclesToSave.add(col.cycleNumber);

    if (cyclesToSave.size === 0) return;

    const rows: Array<{
      member_id: string;
      cycle_number: number;
      year: number;
      month: number;
      amount: number;
    }> = [];

    for (const m of members) {
      for (const col of months) {
        if (!cyclesToSave.has(col.cycleNumber)) continue;
        const key = cellKey(m.id, col.cycleNumber);
        rows.push({
          member_id: m.id,
          cycle_number: col.cycleNumber,
          year: col.year,
          month: col.month,
          amount: Number(draft[key] || 0) || 0,
        });
      }
    }

    const fd = new FormData();
    fd.set('jamiyaId', jamiyaId);
    fd.set('slug', slug);
    fd.set('rows', JSON.stringify(rows));

    startTransition(async () => {
      const result = await saveMgrMonthlyPaymentsAction(fd);
      setSaveNotice({
        type: result.success ? 'success' : 'error',
        message: result.message,
      });
      if (result.success) router.refresh();
    });
  }

  if (members.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Add members first, then enter monthly contributions here — including past months.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      {saveNotice ? (
        <Alert variant={saveNotice.type === 'success' ? 'success' : 'destructive'}>
          <AlertDescription>{saveNotice.message}</AlertDescription>
        </Alert>
      ) : null}
      <p className="text-sm text-muted-foreground">
        Tap an empty cell to fill {fillAmount || defaultAmount || 'the amount'}, or use{' '}
        <strong className="font-medium text-foreground">Mark month paid</strong> for everyone at
        once. Then Save.
      </p>

      {quickMonth ? (
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-primary/25 bg-primary/5 px-4 py-3">
          <p className="flex-1 text-sm text-foreground">
            Record <strong>{quickMonth.label}</strong> for everyone at{' '}
            <strong>KES {fillAmount || defaultAmount}</strong>?
          </p>
          <Button
            type="button"
            className="min-h-11"
            onClick={() => {
              markMonthPaid(quickMonth.cycleNumber);
            }}
          >
            Mark {quickMonth.label} paid
          </Button>
        </div>
      ) : null}

      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1">
          <Label htmlFor="mgrFill">Default amount</Label>
          <div className="flex gap-2">
            <Input
              id="mgrFill"
              type="number"
              min={0}
              step="1"
              value={fillAmount}
              onChange={(e) => setFillAmount(e.target.value)}
              className="min-h-11 w-28"
            />
            <Button type="button" variant="outline" className="min-h-11" onClick={fillEmpty}>
              Fill all empty
            </Button>
          </div>
        </div>
        <Button type="button" variant="outline" className="min-h-11" onClick={addPastMonth}>
          Add past month
        </Button>
        <Button type="button" variant="outline" className="min-h-11" onClick={addNextMonth}>
          Add month
        </Button>
        <Button type="button" className="min-h-11" disabled={pending || !canSave} onClick={onSave}>
          {pending
            ? 'Saving…'
            : dirtyKeys.size
              ? `Save ${dirtyKeys.size} change${dirtyKeys.size === 1 ? '' : 's'}`
              : newMonthKeys.length
                ? 'Save months'
                : 'Save'}
        </Button>
      </div>

      {months.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border px-4 py-6 text-sm text-muted-foreground">
          No months yet. Tap <strong className="text-foreground">Add past month</strong> or{' '}
          <strong className="text-foreground">Add month</strong> to start recording.
        </p>
      ) : (
        <>
          {/* Mobile: one member at a time — easier thumb entry */}
          <div className="space-y-3 md:hidden">
            <Label htmlFor="mgrMobileMember">Member</Label>
            <select
              id="mgrMobileMember"
              value={mobileMemberId}
              onChange={(e) => setMobileMemberId(e.target.value)}
              className="block h-12 w-full rounded-md border border-input bg-background px-3 text-base"
            >
              {members.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.label}
                </option>
              ))}
            </select>
            <ul className="space-y-2">
              {months.map((col) => {
                const key = cellKey(mobileMemberId, col.cycleNumber);
                const raw = draft[key] ?? '';
                const paid = Number(raw || 0) > 0;
                const contribId = contributionIds[mobileMemberId]?.[col.cycleNumber];
                return (
                  <li
                    key={key}
                    className="flex items-center justify-between gap-3 rounded-xl border border-border px-3 py-2"
                  >
                    <div>
                      <p className="text-sm font-medium">{col.label}</p>
                      <p className="text-xs text-muted-foreground">Cycle {col.cycleNumber}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      {!paid ? (
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="min-h-11"
                          onClick={() => fillCellIfEmpty(key)}
                        >
                          Paid
                        </Button>
                      ) : null}
                      <Input
                        type="number"
                        min={0}
                        step="1"
                        inputMode="decimal"
                        placeholder="—"
                        value={raw}
                        onFocus={() => fillCellIfEmpty(key)}
                        onChange={(e) =>
                          setDraft((prev) => ({ ...prev, [key]: e.target.value }))
                        }
                        className={[
                          'min-h-12 w-28 text-base',
                          paid ? 'border-primary/40 bg-primary/5' : 'bg-muted/30',
                        ].join(' ')}
                        aria-label={`${col.label} amount`}
                      />
                      {canManage && paid && contribId ? (
                        <VoidLedgerButton
                          slug={slug}
                          memberId={mobileMemberId}
                          kind="contribution"
                          id={contribId}
                          label="Void"
                        />
                      ) : null}
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>

          <div className="hidden overflow-x-auto rounded-lg border border-border md:block">
          <table className="min-w-full border-collapse text-sm">
            <thead>
              <tr className="bg-secondary/50 text-left">
                <th className="sticky left-0 z-10 bg-secondary/95 px-3 py-2 font-medium">Name</th>
                {months.map((col) => (
                  <th
                    key={`${col.cycleNumber}-${col.year}-${col.month}`}
                    className="min-w-[7.5rem] px-2 py-2 font-medium"
                  >
                    <span className="block">{col.label}</span>
                    <span className="block text-xs font-normal text-muted-foreground">
                      Cycle {col.cycleNumber}
                    </span>
                    <button
                      type="button"
                      className="mt-1 text-xs font-medium text-primary underline-offset-2 hover:underline"
                      onClick={() => markMonthPaid(col.cycleNumber)}
                    >
                      Mark paid
                    </button>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {members.map((m) => (
                <tr key={m.id} className="border-t border-border">
                  <td className="sticky left-0 z-10 bg-card px-3 py-2 font-medium">{m.label}</td>
                  {months.map((col) => {
                    const key = cellKey(m.id, col.cycleNumber);
                    const raw = draft[key] ?? '';
                    const paid = Number(raw || 0) > 0;
                    const contribId = contributionIds[m.id]?.[col.cycleNumber];
                    return (
                      <td key={key} className="px-2 py-1.5">
                        <div className="flex items-center gap-1">
                          <Input
                            type="number"
                            min={0}
                            step="1"
                            inputMode="decimal"
                            placeholder="—"
                            value={raw}
                            onFocus={() => fillCellIfEmpty(key)}
                            onChange={(e) =>
                              setDraft((prev) => ({ ...prev, [key]: e.target.value }))
                            }
                            className={[
                              'min-h-10 w-full min-w-[4.5rem]',
                              paid ? 'border-primary/40 bg-primary/5' : 'bg-muted/30',
                            ].join(' ')}
                            aria-label={`${m.label} ${col.label}`}
                          />
                          {canManage && paid && contribId ? (
                            <VoidLedgerButton
                              slug={slug}
                              memberId={m.id}
                              kind="contribution"
                              id={contribId}
                              label="Void"
                            />
                          ) : null}
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        </>
      )}

      <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
        <span>
          <span className="mr-1 inline-block h-2.5 w-2.5 rounded-sm bg-primary/20 align-middle" />
          Has amount = contributed
        </span>
        <span>
          <span className="mr-1 inline-block h-2.5 w-2.5 rounded-sm bg-muted align-middle" />
          Empty = did not contribute
        </span>
      </div>
    </div>
  );
}
