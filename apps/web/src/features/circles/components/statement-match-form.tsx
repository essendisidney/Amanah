'use client';

import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { formatCurrency } from '@jamiya/shared';
import { Alert, AlertDescription, Button, Input, Label, NativeSelect, Textarea } from '@jamiya/ui';
import { recordStatementPaymentsAction } from '../actions/statement-actions';
import {
  matchMember,
  parseStatement,
  type StatementLine,
  type StatementMember,
} from '../lib/statement-match';

type Row = StatementLine & {
  memberId: string;
  how: 'phone' | 'phone_tail' | 'name' | null;
  include: boolean;
  amountText: string;
  /** Circle this payment was already recorded in, if any. */
  already: string | null;
};

export type RecordedRef = { reference: string; circle: string; here: boolean };

const HOW_LABEL: Record<NonNullable<Row['how']>, string> = {
  phone: 'phone',
  phone_tail: 'masked phone',
  name: 'name',
};

export function StatementMatchForm({
  jamiyaId,
  slug,
  members,
  owed,
  recordedRefs,
}: {
  jamiyaId: string;
  slug: string;
  members: StatementMember[];
  /** What each member still owes on open contributions, by member id. */
  owed: Record<string, number>;
  /** References already recorded in this circle or a circle sharing its bank account. */
  recordedRefs: RecordedRef[];
}) {
  const router = useRouter();
  const [paste, setPaste] = useState('');
  const [rows, setRows] = useState<Row[]>([]);
  const [pending, startTransition] = useTransition();
  const [notice, setNotice] = useState<{ ok: boolean; message: string } | null>(null);
  const recorded = useMemo(
    () => new Map(recordedRefs.map((r) => [r.reference, r.here ? 'this circle' : r.circle])),
    [recordedRefs],
  );
  const [reading, setReading] = useState(false);
  const sortedMembers = useMemo(
    () => [...members].sort((a, b) => a.name.localeCompare(b.name)),
    [members],
  );

  /** Read a bank statement PDF in the browser; the file itself is never uploaded. */
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
      setNotice({
        ok: false,
        message: 'Could not read that PDF. If it is password-protected, open it and copy the rows instead.',
      });
    } finally {
      setReading(false);
    }
  }

  function read(source = paste) {
    const lines = parseStatement(source);
    setRows(
      lines.map((line) => {
        const match = matchMember(line, members);
        const already = recorded.get(line.reference) ?? null;
        return {
          ...line,
          memberId: match.memberId ?? '',
          how: match.how,
          include: Boolean(match.memberId) && !already,
          amountText: String(line.amount ?? ''),
          already,
        };
      }),
    );
    setNotice(
      lines.length === 0
        ? {
            ok: false,
            message:
              'No money-in lines found. Copy the rows of the statement, including the header row if it has one.',
          }
        : {
            ok: true,
            message: `Found ${lines.length} payment${lines.length === 1 ? '' : 's'} in, totalling ${formatCurrency(
              lines.reduce((sum, l) => sum + (l.amount ?? 0), 0),
              'KES',
            )}. Check this against the statement's "Total Credits" before recording.`,
          },
    );
  }

  function update(i: number, patch: Partial<Row>) {
    setRows((prev) => prev.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  }

  const chosen = rows.filter((r) => r.include && r.memberId && Number(r.amountText) > 0);
  const total = chosen.reduce((s, r) => s + Number(r.amountText), 0);

  function record() {
    startTransition(async () => {
      const payload = chosen.map((r) => ({
        reference: r.reference,
        paid_on: r.date,
        amount: Number(r.amountText),
        member_id: r.memberId,
        details: r.details.slice(0, 500),
      }));
      // The database takes up to 500 lines a call; long SACCO statements go in parts.
      let recordedCount = 0;
      let duplicates = 0;
      let unallocated = 0;
      for (let i = 0; i < payload.length; i += 400) {
        const result = await recordStatementPaymentsAction(jamiyaId, slug, payload.slice(i, i + 400));
        if (!result.ok) {
          setNotice({
            ok: false,
            message:
              recordedCount > 0
                ? `Recorded ${recordedCount} before an error: ${result.message} Read the statement again to see what is left.`
                : result.message,
          });
          router.refresh();
          return;
        }
        recordedCount += result.recorded ?? 0;
        duplicates += result.duplicates ?? 0;
        unallocated += result.unallocated ?? 0;
      }
      const parts = [`Recorded ${recordedCount} payment${recordedCount === 1 ? '' : 's'}.`];
      if (duplicates > 0) parts.push(`${duplicates} already recorded and skipped.`);
      if (unallocated > 0) {
        parts.push(
          `${formatCurrency(unallocated, 'KES')} was more than those members owed; it is listed below for you to record in Books.`,
        );
      }
      setNotice({ ok: true, message: parts.join(' ') });
      setRows([]);
      setPaste('');
      router.refresh();
    });
  }

  return (
    <section className="space-y-4 rounded-xl border border-border bg-card p-5">
      <div>
        <h2 className="font-[family-name:var(--font-display)] text-xl font-semibold">
          Match a bank or M-Pesa statement
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Choose the bank statement PDF, or copy the statement rows (from Excel or the PDF) and paste
          them below. Each payment in is matched to a member by phone number or name; check the matches,
          then record them. A payment is only ever counted once, even across circles that share the
          same bank account.
        </p>
      </div>

      {notice ? (
        <Alert variant={notice.ok ? 'success' : 'destructive'}>
          <AlertDescription>{notice.message}</AlertDescription>
        </Alert>
      ) : null}

      <div className="space-y-1">
        <Label htmlFor="statementPdf">Statement PDF</Label>
        <Input
          id="statementPdf"
          type="file"
          accept="application/pdf"
          disabled={reading}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void readPdf(file);
            e.target.value = '';
          }}
        />
        <p className="text-xs text-muted-foreground">
          {reading ? 'Reading the PDF…' : 'Read on this device; the statement itself is not uploaded.'}
        </p>
      </div>

      <div className="space-y-1">
        <Label htmlFor="statementPaste">Or paste statement rows</Label>
        <Textarea
          id="statementPaste"
          rows={7}
          className="font-mono text-xs"
          value={paste}
          onChange={(e) => setPaste(e.target.value)}
          placeholder={`Date\tNarration\tDebit\tCredit\tBalance
02/11/2026\tMPESA C2B 2547******888 ASHA RASHID SKB1XY2Z3A\t\t2,000.00\t14,000.00`}
        />
      </div>
      <Button type="button" variant="outline" className="min-h-11" onClick={() => read()} disabled={!paste.trim()}>
        Read statement
      </Button>

      {rows.length > 0 ? (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            {rows.length} payment{rows.length === 1 ? '' : 's'} in ·{' '}
            {rows.filter((r) => r.memberId).length} matched ·{' '}
            {rows.filter((r) => !r.memberId).length} need a member ·{' '}
            {rows.filter((r) => r.already).length} already recorded
          </p>
          <ul className="divide-y divide-border/70 rounded-lg border border-border">
            {rows.map((r, i) => (
              <li key={`${r.reference}-${i}`} className="space-y-2 px-3 py-3">
                <div className="flex flex-wrap items-start gap-3">
                  <input
                    type="checkbox"
                    className="mt-1 h-5 w-5"
                    aria-label={`Record ${r.reference}`}
                    checked={r.include}
                    disabled={Boolean(r.already)}
                    onChange={(e) => update(i, { include: e.target.checked })}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="break-words font-mono text-xs text-muted-foreground">{r.raw}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {r.date ?? 'No date'} · Ref {r.reference}
                      {r.already ? ` · Already recorded in ${r.already}` : ''}
                      {r.how ? ` · Matched by ${HOW_LABEL[r.how]}` : ''}
                    </p>
                  </div>
                </div>
                {!r.already ? (
                  <div className="flex flex-wrap items-end gap-3 pl-8">
                    <div className="min-w-[12rem] flex-1 space-y-1">
                      <Label htmlFor={`m-${i}`} className="text-xs">
                        Member
                      </Label>
                      <NativeSelect
                        id={`m-${i}`}
                        value={r.memberId}
                        onChange={(e) =>
                          update(i, { memberId: e.target.value, include: Boolean(e.target.value), how: null })
                        }
                      >
                        <option value="">Choose a member…</option>
                        {sortedMembers.map((m) => (
                          <option key={m.id} value={m.id}>
                            {m.name}
                            {owed[m.id] ? ` (owes ${formatCurrency(owed[m.id]!, 'KES')})` : ''}
                          </option>
                        ))}
                      </NativeSelect>
                    </div>
                    <div className="w-32 space-y-1">
                      <Label htmlFor={`a-${i}`} className="text-xs">
                        Amount (KES)
                      </Label>
                      <Input
                        id={`a-${i}`}
                        inputMode="decimal"
                        value={r.amountText}
                        onChange={(e) => update(i, { amountText: e.target.value.replace(/[^\d.]/g, '') })}
                      />
                    </div>
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
          <Button type="button" className="min-h-11" onClick={record} disabled={pending || chosen.length === 0}>
            {pending
              ? 'Recording…'
              : `Record ${chosen.length} payment${chosen.length === 1 ? '' : 's'} · ${formatCurrency(total, 'KES')}`}
          </Button>
        </div>
      ) : null}
    </section>
  );
}
