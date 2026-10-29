'use client';

import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { formatCurrency } from '@jamiya/shared';
import { Alert, AlertDescription, Button, Input, Label, NativeSelect, Textarea } from '@jamiya/ui';
import {
  recordStatementPaymentsAction,
  recordStatementPayoutsAction,
  type PayoutKind,
  type RecordStatementResult,
} from '../actions/statement-actions';
import {
  matchMember,
  parseStatement,
  type StatementDirection,
  type StatementLine,
  type StatementMember,
} from '../lib/statement-match';

type Row = StatementLine & {
  memberId: string;
  how: 'phone' | 'phone_tail' | 'name' | null;
  include: boolean;
  amountText: string;
  /** Money out only: what the payment was. */
  kind: PayoutKind;
  /** Circle this payment was already recorded in, if any. */
  already: string | null;
};

export type RecordedRef = { reference: string; circle: string; here: boolean };

const KIND_LABEL: Record<PayoutKind, string> = {
  payout: 'Payout to member',
  withdrawal: 'Savings withdrawal',
  loan: 'Loan to member',
  expense: 'Expense / bank charge',
};
const MEMBER_KINDS: PayoutKind[] = ['payout', 'withdrawal', 'loan'];

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
  const [direction, setDirection] = useState<StatementDirection>('in');
  const [memberKind, setMemberKind] = useState<PayoutKind>('payout');
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
      read(text, direction);
    } catch {
      setNotice({
        ok: false,
        message: 'Could not read that PDF. If it is password-protected, open it and copy the rows instead.',
      });
    } finally {
      setReading(false);
    }
  }

  function read(source = paste, dir = direction) {
    const lines = parseStatement(source, dir);
    setRows(
      lines.map((line) => {
        const match = matchMember(line, members);
        const already = recorded.get(line.reference) ?? null;
        return {
          ...line,
          memberId: match.memberId ?? '',
          how: match.how,
          // Money out to someone who is not a member is left for the officer to say what it was.
          include: Boolean(match.memberId) && !already,
          amountText: String(line.amount ?? ''),
          kind: match.memberId ? memberKind : 'expense',
          already,
        };
      }),
    );
    setNotice(
      lines.length === 0
        ? {
            ok: false,
            message: `No money-${dir} lines found. Copy the rows of the statement, including the header row if it has one.`,
          }
        : {
            ok: true,
            message: `Found ${lines.length} payment${lines.length === 1 ? '' : 's'} ${dir}, totalling ${formatCurrency(
              lines.reduce((sum, l) => sum + (l.amount ?? 0), 0),
              'KES',
            )}. Check this against the statement's "${dir === 'in' ? 'Total Credits' : 'Total Debits'}" before recording.`,
          },
    );
  }

  function update(i: number, patch: Partial<Row>) {
    setRows((prev) => prev.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  }

  function switchDirection(dir: StatementDirection) {
    setDirection(dir);
    setRows([]);
    setNotice(null);
    if (paste.trim()) read(paste, dir);
  }

  /** Set every money-out line that has a member to one kind (most chamas pay out one way). */
  function setAllMemberKinds(kind: PayoutKind) {
    setMemberKind(kind);
    setRows((prev) => prev.map((r) => (r.memberId && !r.already ? { ...r, kind } : r)));
  }

  const chosen = rows.filter(
    (r) =>
      r.include &&
      Number(r.amountText) > 0 &&
      (direction === 'out' && r.kind === 'expense' ? true : Boolean(r.memberId)),
  );
  const total = chosen.reduce((s, r) => s + Number(r.amountText), 0);

  function record() {
    startTransition(async () => {
      const send = (part: Row[]): Promise<RecordStatementResult> =>
        direction === 'in'
          ? recordStatementPaymentsAction(
              jamiyaId,
              slug,
              part.map((r) => ({
                reference: r.reference,
                paid_on: r.date,
                amount: Number(r.amountText),
                member_id: r.memberId,
                details: r.details.slice(0, 500),
              })),
            )
          : recordStatementPayoutsAction(
              jamiyaId,
              slug,
              part.map((r) => ({
                reference: r.reference,
                paid_on: r.date,
                amount: Number(r.amountText),
                kind: r.kind,
                member_id: r.memberId || null,
                details: r.details.slice(0, 500),
              })),
            );
      // The database takes up to 500 lines a call; long SACCO statements go in parts.
      let recordedCount = 0;
      let duplicates = 0;
      let unallocated = 0;
      for (let i = 0; i < chosen.length; i += 400) {
        const result = await send(chosen.slice(i, i + 400));
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
      const parts = [
        `Recorded ${recordedCount} payment${recordedCount === 1 ? '' : 's'} ${direction}${direction === 'out' ? ' in Books' : ''}.`,
      ];
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
          them below. Each payment is matched to a member by phone number or name; check the matches,
          then record them. A payment is only ever counted once, even across circles that share the
          same bank account.
        </p>
      </div>

      <div className="flex flex-wrap gap-2" role="group" aria-label="Which payments to read">
        <Button
          type="button"
          size="sm"
          className="min-h-11"
          variant={direction === 'in' ? 'default' : 'outline'}
          aria-pressed={direction === 'in'}
          onClick={() => switchDirection('in')}
        >
          Money in (contributions)
        </Button>
        <Button
          type="button"
          size="sm"
          className="min-h-11"
          variant={direction === 'out' ? 'default' : 'outline'}
          aria-pressed={direction === 'out'}
          onClick={() => switchDirection('out')}
        >
          Money out (payouts, loans, expenses)
        </Button>
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
          {direction === 'out' ? (
            <div className="max-w-xs space-y-1">
              <Label htmlFor="memberKind" className="text-xs">
                Set every payment to a member as
              </Label>
              <NativeSelect
                id="memberKind"
                value={memberKind}
                onChange={(e) => setAllMemberKinds(e.target.value as PayoutKind)}
              >
                {MEMBER_KINDS.map((k) => (
                  <option key={k} value={k}>
                    {KIND_LABEL[k]}
                  </option>
                ))}
              </NativeSelect>
            </div>
          ) : null}
          <p className="text-sm text-muted-foreground">
            {rows.length} payment{rows.length === 1 ? '' : 's'} {direction} ·{' '}
            {rows.filter((r) => r.memberId).length} matched ·{' '}
            {rows.filter((r) => !r.memberId).length} {direction === 'in' ? 'need a member' : 'not to a member'} ·{' '}
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
                    {direction === 'out' ? (
                      <div className="min-w-[11rem] space-y-1">
                        <Label htmlFor={`k-${i}`} className="text-xs">
                          What was it
                        </Label>
                        <NativeSelect
                          id={`k-${i}`}
                          value={r.kind}
                          onChange={(e) => {
                            const kind = e.target.value as PayoutKind;
                            update(i, { kind, include: kind === 'expense' || Boolean(r.memberId) });
                          }}
                        >
                          {(Object.keys(KIND_LABEL) as PayoutKind[]).map((k) => (
                            <option key={k} value={k}>
                              {KIND_LABEL[k]}
                            </option>
                          ))}
                        </NativeSelect>
                      </div>
                    ) : null}
                    <div className="min-w-[12rem] flex-1 space-y-1">
                      <Label htmlFor={`m-${i}`} className="text-xs">
                        Member
                      </Label>
                      <NativeSelect
                        id={`m-${i}`}
                        value={r.memberId}
                        onChange={(e) =>
                          update(i, {
                            memberId: e.target.value,
                            include: Boolean(e.target.value) || (direction === 'out' && r.kind === 'expense'),
                            how: null,
                            // Picking a member for money out usually means it was paid to them.
                            ...(direction === 'out' && e.target.value && r.kind === 'expense'
                              ? { kind: memberKind }
                              : {}),
                          })
                        }
                      >
                        <option value="">{direction === 'out' ? 'No member' : 'Choose a member…'}</option>
                        {sortedMembers.map((m) => (
                          <option key={m.id} value={m.id}>
                            {m.name}
                            {direction === 'in' && owed[m.id] ? ` (owes ${formatCurrency(owed[m.id]!, 'KES')})` : ''}
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
              : `Record ${chosen.length} payment${chosen.length === 1 ? '' : 's'} ${direction} · ${formatCurrency(total, 'KES')}`}
          </Button>
        </div>
      ) : null}
    </section>
  );
}
