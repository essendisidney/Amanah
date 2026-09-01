'use client';

import Link from 'next/link';
import type { Route } from 'next';
import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Alert, AlertDescription, Button, Input, Label } from '@jamiya/ui';
import { saveMonthlyPaymentsGridAction } from '@/features/circles/actions/books-actions';
import { booksHref } from '@/features/circles/lib/member-books-view';

export type GridMember = {
  id: string;
  label: string;
};

export type MonthKey = {
  year: number;
  month: number;
  label: string;
};

type Props = {
  jamiyaId: string;
  slug: string;
  members: GridMember[];
  months: MonthKey[];
  monthAmounts: Record<string, Record<string, number>>;
  shareAmounts: Record<string, number>;
  defaultMonthAmount: number;
  defaultShareAmount: number;
  defaultShareDate: string;
};

function monthKey(year: number, month: number) {
  return `${year}-${String(month).padStart(2, '0')}`;
}

function cellKey(memberId: string, year: number, month: number) {
  return `${memberId}:${monthKey(year, month)}`;
}

export function MonthlyPaymentsGrid({
  jamiyaId,
  slug,
  members,
  months: initialMonths,
  monthAmounts,
  shareAmounts,
  defaultMonthAmount,
  defaultShareAmount,
  defaultShareDate,
}: Props) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const [saveNotice, setSaveNotice] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);
  const [months, setMonths] = useState(initialMonths);
  const [shareDate, setShareDate] = useState(defaultShareDate);
  const [fillMonth, setFillMonth] = useState(String(defaultMonthAmount || 2000));
  const [fillShare, setFillShare] = useState(String(defaultShareAmount || 5000));
  const [mobileMemberId, setMobileMemberId] = useState(members[0]?.id ?? '');

  const [shareDraft, setShareDraft] = useState<Record<string, string>>(() => {
    const next: Record<string, string> = {};
    for (const m of members) {
      const v = shareAmounts[m.id];
      next[m.id] = v && v > 0 ? String(v) : '';
    }
    return next;
  });

  const [monthDraft, setMonthDraft] = useState<Record<string, string>>(() => {
    const next: Record<string, string> = {};
    for (const m of members) {
      for (const col of initialMonths) {
        const key = cellKey(m.id, col.year, col.month);
        const v = monthAmounts[m.id]?.[monthKey(col.year, col.month)];
        next[key] = v && v > 0 ? String(v) : '';
      }
    }
    return next;
  });

  const dirtyShareIds = useMemo(() => {
    const ids = new Set<string>();
    for (const m of members) {
      const draft = Number(shareDraft[m.id] || 0);
      const orig = shareAmounts[m.id] ?? 0;
      if ((Number.isFinite(draft) ? draft : 0) !== orig) ids.add(m.id);
    }
    return ids;
  }, [members, shareDraft, shareAmounts]);

  const dirtyMonthKeys = useMemo(() => {
    const keys = new Set<string>();
    for (const m of members) {
      for (const col of months) {
        const key = cellKey(m.id, col.year, col.month);
        const draft = Number(monthDraft[key] || 0);
        const orig = monthAmounts[m.id]?.[monthKey(col.year, col.month)] ?? 0;
        if ((Number.isFinite(draft) ? draft : 0) !== orig) keys.add(key);
      }
    }
    return keys;
  }, [members, months, monthDraft, monthAmounts]);

  const dirtyCount = dirtyShareIds.size + dirtyMonthKeys.size;

  function addNextMonth() {
    setMonths((prev) => {
      if (prev.length === 0) {
        const now = new Date();
        return [
          {
            year: now.getFullYear(),
            month: now.getMonth() + 1,
            label: now.toLocaleString('en-GB', { month: 'short', year: '2-digit' }),
          },
        ];
      }
      const last = prev[prev.length - 1]!;
      const d = new Date(last.year, last.month - 1, 1);
      d.setMonth(d.getMonth() + 1);
      const year = d.getFullYear();
      const month = d.getMonth() + 1;
      if (prev.some((p) => p.year === year && p.month === month)) return prev;
      return [
        ...prev,
        {
          year,
          month,
          label: d.toLocaleString('en-GB', { month: 'short', year: '2-digit' }),
        },
      ];
    });
  }

  function fillEmptyMonths() {
    const amount = Number(fillMonth);
    if (!Number.isFinite(amount) || amount <= 0) return;
    setMonthDraft((prev) => {
      const next = { ...prev };
      for (const m of members) {
        for (const col of months) {
          const key = cellKey(m.id, col.year, col.month);
          if (!next[key]?.trim()) next[key] = String(amount);
        }
      }
      return next;
    });
  }

  function fillEmptyShares() {
    const amount = Number(fillShare);
    if (!Number.isFinite(amount) || amount <= 0) return;
    setShareDraft((prev) => {
      const next = { ...prev };
      for (const m of members) {
        if (!next[m.id]?.trim()) next[m.id] = String(amount);
      }
      return next;
    });
  }

  function onSave() {
    const shareRows = [...dirtyShareIds].map((memberId) => ({
      member_id: memberId,
      amount: Number(shareDraft[memberId] || 0) || 0,
      purchased_on: shareDate,
    }));

    const monthRows = [...dirtyMonthKeys].map((key) => {
      const [memberId, ym] = key.split(':');
      const [yearStr, monthStr] = (ym ?? '').split('-');
      return {
        member_id: memberId!,
        year: Number(yearStr),
        month: Number(monthStr),
        amount: Number(monthDraft[key] || 0) || 0,
      };
    });

    const fd = new FormData();
    fd.set('jamiyaId', jamiyaId);
    fd.set('slug', slug);
    fd.set('shareRows', JSON.stringify(shareRows));
    fd.set('monthRows', JSON.stringify(monthRows));

    startTransition(async () => {
      const result = await saveMonthlyPaymentsGridAction(fd);
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
        Add members on the circle page first, then come back here.
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
        Left column <strong className="font-medium text-foreground">Shares</strong> = one-off buy-in
        (usually 5,000 on 5 Feb). Month columns = monthly savings (usually 2,000). Tap a name to
        check one person.
      </p>

      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1">
          <Label htmlFor="shareDate">Share date (5 Feb)</Label>
          <Input
            id="shareDate"
            type="date"
            value={shareDate}
            onChange={(e) => setShareDate(e.target.value)}
            className="min-h-11 w-[11rem]"
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="fillShare">Fill empty shares with</Label>
          <div className="flex gap-2">
            <Input
              id="fillShare"
              type="number"
              min={0}
              step="1"
              value={fillShare}
              onChange={(e) => setFillShare(e.target.value)}
              className="min-h-11 w-28"
            />
            <Button type="button" variant="outline" className="min-h-11" onClick={fillEmptyShares}>
              Apply
            </Button>
          </div>
        </div>
        <div className="space-y-1">
          <Label htmlFor="fillMonth">Fill empty months with</Label>
          <div className="flex gap-2">
            <Input
              id="fillMonth"
              type="number"
              min={0}
              step="1"
              value={fillMonth}
              onChange={(e) => setFillMonth(e.target.value)}
              className="min-h-11 w-28"
            />
            <Button type="button" variant="outline" className="min-h-11" onClick={fillEmptyMonths}>
              Apply
            </Button>
          </div>
        </div>
        <Button type="button" variant="outline" className="min-h-11" onClick={addNextMonth}>
          Add month
        </Button>
        <Button
          type="button"
          className="min-h-11"
          disabled={pending || dirtyCount === 0}
          onClick={onSave}
        >
          {pending ? 'Saving…' : dirtyCount ? `Save ${dirtyCount} change${dirtyCount === 1 ? '' : 's'}` : 'Save'}
        </Button>
      </div>

      {/* Mobile: one member at a time */}
      <div className="space-y-3 md:hidden">
        <Label htmlFor="tbMobileMember">Member</Label>
        <select
          id="tbMobileMember"
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
        <div className="rounded-xl border border-accent/25 bg-accent/5 px-3 py-3">
          <Label htmlFor={`tbMobileShare-${mobileMemberId}`}>Share buy-in</Label>
          <Input
            id={`tbMobileShare-${mobileMemberId}`}
            type="number"
            min={0}
            step="1"
            inputMode="decimal"
            value={shareDraft[mobileMemberId] ?? ''}
            onChange={(e) =>
              setShareDraft((prev) => ({ ...prev, [mobileMemberId]: e.target.value }))
            }
            className={`mt-1 min-h-12 text-base ${
              dirtyShareIds.has(mobileMemberId) ? 'border-accent ring-1 ring-accent/40' : ''
            }`}
          />
        </div>
        <ul className="space-y-2">
          {months.map((col) => {
            const key = cellKey(mobileMemberId, col.year, col.month);
            const raw = monthDraft[key] ?? '';
            const paid = Number(raw || 0) > 0;
            return (
              <li
                key={key}
                className="flex items-center justify-between gap-3 rounded-xl border border-border px-3 py-2"
              >
                <p className="text-sm font-medium">{col.label}</p>
                <Input
                  type="number"
                  min={0}
                  step="1"
                  inputMode="decimal"
                  placeholder="—"
                  value={raw}
                  onChange={(e) =>
                    setMonthDraft((prev) => ({ ...prev, [key]: e.target.value }))
                  }
                  className={[
                    'min-h-12 w-28 text-base',
                    paid ? 'border-primary/40 bg-primary/5' : 'bg-muted/30',
                    dirtyMonthKeys.has(key) ? 'ring-1 ring-accent/40' : '',
                  ].join(' ')}
                  aria-label={`${col.label} amount`}
                />
              </li>
            );
          })}
        </ul>
      </div>

      <div className="hidden overflow-x-auto rounded-lg border border-border md:block">
        <table className="min-w-full border-collapse text-sm">
          <thead>
            <tr className="bg-secondary/50 text-left">
              <th className="sticky left-0 z-20 bg-secondary/95 px-3 py-2 font-medium">Name</th>
              <th className="sticky left-[9rem] z-20 min-w-[7.5rem] bg-accent/10 px-2 py-2 font-medium sm:left-[11rem]">
                Shares
              </th>
              {months.map((col) => (
                <th key={monthKey(col.year, col.month)} className="min-w-[5.5rem] px-2 py-2 font-medium">
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {members.map((m) => (
              <tr key={m.id} className="border-t border-border">
                <td className="sticky left-0 z-10 max-w-[9rem] truncate bg-card px-3 py-1.5 font-medium sm:max-w-[11rem]">
                  <Link
                    href={booksHref(slug, 'member', m.id) as Route}
                    className="text-accent underline-offset-2 hover:underline"
                  >
                    {m.label}
                  </Link>
                </td>
                <td className="sticky left-[9rem] z-10 bg-accent/5 px-1.5 py-1 sm:left-[11rem]">
                  <Input
                    type="number"
                    min={0}
                    step="1"
                    inputMode="decimal"
                    aria-label={`${m.label} shares`}
                    value={shareDraft[m.id] ?? ''}
                    onChange={(e) =>
                      setShareDraft((prev) => ({ ...prev, [m.id]: e.target.value }))
                    }
                    className={`h-9 min-w-[6.5rem] px-2 ${
                      dirtyShareIds.has(m.id) ? 'border-accent ring-1 ring-accent/40' : ''
                    }`}
                  />
                </td>
                {months.map((col) => {
                  const key = cellKey(m.id, col.year, col.month);
                  return (
                    <td key={key} className="px-1.5 py-1">
                      <Input
                        type="number"
                        min={0}
                        step="1"
                        inputMode="decimal"
                        aria-label={`${m.label} ${col.label}`}
                        value={monthDraft[key] ?? ''}
                        onChange={(e) =>
                          setMonthDraft((prev) => ({ ...prev, [key]: e.target.value }))
                        }
                        className={`h-9 min-w-[5rem] px-2 ${
                          dirtyMonthKeys.has(key) ? 'border-accent ring-1 ring-accent/40' : ''
                        }`}
                      />
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}