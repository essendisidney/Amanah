'use client';

import { useMemo, useState, useTransition } from 'react';
import { Button, Input, Label } from '@jamiya/ui';
import { saveMgrMonthlyPaymentsAction } from '@/features/circles/actions/ledger-actions';

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
  defaultAmount,
}: Props) {
  const [pending, startTransition] = useTransition();
  const [months, setMonths] = useState(() => sortMonths(initialMonths));
  const [fillAmount, setFillAmount] = useState(String(defaultAmount || 0));
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

    startTransition(() => {
      void saveMgrMonthlyPaymentsAction(fd);
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
      <p className="text-sm text-muted-foreground">
        Enter what each person paid for any month (past or present). Empty = did not contribute.
        Use <strong className="font-medium text-foreground">Add past month</strong> to backfill
        history (like Asha’s books).
      </p>

      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1">
          <Label htmlFor="mgrFill">Fill empty with</Label>
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
              Apply
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
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="min-w-full border-collapse text-sm">
            <thead>
              <tr className="bg-secondary/50 text-left">
                <th className="sticky left-0 z-10 bg-secondary/95 px-3 py-2 font-medium">Name</th>
                {months.map((col) => (
                  <th
                    key={`${col.cycleNumber}-${col.year}-${col.month}`}
                    className="min-w-[6.5rem] px-2 py-2 font-medium"
                  >
                    <span className="block">{col.label}</span>
                    <span className="block text-xs font-normal text-muted-foreground">
                      Cycle {col.cycleNumber}
                    </span>
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
                    return (
                      <td key={key} className="px-2 py-1.5">
                        <Input
                          type="number"
                          min={0}
                          step="1"
                          inputMode="decimal"
                          placeholder="—"
                          value={raw}
                          onChange={(e) =>
                            setDraft((prev) => ({ ...prev, [key]: e.target.value }))
                          }
                          className={[
                            'min-h-10 w-full',
                            paid ? 'border-primary/40 bg-primary/5' : 'bg-muted/30',
                          ].join(' ')}
                          aria-label={`${m.label} ${col.label}`}
                        />
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
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
