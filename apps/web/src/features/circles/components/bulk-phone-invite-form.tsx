'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { KE_PHONE_PLACEHOLDER } from '@jamiya/shared';
import { Alert, AlertDescription, Button, Label, Textarea } from '@jamiya/ui';
import { addMembersBatchAction } from '../actions/add-member';
import type { BulkAddResultRow } from '../lib/action-state';
import { BULK_PHONE_MAX_ROWS, parseBulkPhoneLines } from '../lib/parse-bulk-phones';
import { InviteSharePanel } from './invite-share-panel';

const BATCH = 25;

type FormState = {
  success: boolean;
  message?: string;
  results?: BulkAddResultRow[];
  fieldErrors?: { phones?: string[] };
};

export function BulkPhoneInviteForm({
  jamiyaId,
  circleName,
}: {
  jamiyaId: string;
  circleName?: string;
}) {
  const router = useRouter();
  const [text, setText] = useState('');
  const [state, setState] = useState<FormState>({ success: false });
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [pending, startTransition] = useTransition();

  function addAll(e: React.FormEvent) {
    e.preventDefault();
    const rows = parseBulkPhoneLines(text);
    if (rows.length === 0) {
      setState({
        success: false,
        message: 'Paste at least one Kenya mobile number.',
        fieldErrors: { phones: ['Paste phone numbers (one per line).'] },
      });
      return;
    }
    startTransition(async () => {
      const results: BulkAddResultRow[] = rows
        .filter((r) => !r.phone)
        .map((r) => ({
          phone: r.raw,
          fullName: r.fullName,
          success: false,
          message: 'Invalid Kenya mobile (use 07… or +254…).',
        }));
      const valid = rows.filter((r): r is typeof r & { phone: string } => Boolean(r.phone));
      setProgress({ done: 0, total: valid.length });
      for (let i = 0; i < valid.length; i += BATCH) {
        const batch = valid.slice(i, i + BATCH).map((r) => ({ phone: r.phone, fullName: r.fullName }));
        try {
          results.push(...(await addMembersBatchAction(jamiyaId, batch)));
        } catch {
          results.push(
            ...batch.map((r) => ({ ...r, success: false, message: 'Could not reach the server. Try these again.' })),
          );
        }
        setProgress({ done: Math.min(i + BATCH, valid.length), total: valid.length });
      }
      setProgress(null);
      const ok = results.filter((r) => r.success).length;
      const failed = results.length - ok;
      setState({
        success: ok > 0,
        message:
          failed === 0
            ? `Added ${ok} member${ok === 1 ? '' : 's'}.`
            : `Added ${ok}, ${failed} failed. Check the list below.`,
        results,
      });
      if (ok > 0) {
        setText('');
        router.refresh();
      }
    });
  }

  const shareable = (state.results ?? []).filter(
    (r) => r.success && r.inviteUrl && r.inviteCode,
  );

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Paste many Kenya mobiles at once — one per line,{' '}
        <span className="font-medium text-foreground">Name, 07…</span>, or rows copied straight
        from an Excel member list (name and phone columns; the header row is skipped). Existing
        Jameiyah users join immediately; new numbers get an account and invite code.
      </p>

      {state.message ? (
        <Alert variant={state.success ? 'success' : 'destructive'}>
          <AlertDescription>{state.message}</AlertDescription>
        </Alert>
      ) : null}

      <form onSubmit={addAll} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="bulkPhones">Phone list</Label>
          <Textarea
            id="bulkPhones"
            name="phones"
            rows={6}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={`Amina, ${KE_PHONE_PLACEHOLDER}\n0712345678\n+254712345679`}
            className="min-h-[140px] font-mono text-sm"
            required
          />
          {state.fieldErrors?.phones?.[0] ? (
            <p className="text-sm text-destructive">{state.fieldErrors.phones[0]}</p>
          ) : null}
          <p className="text-[11px] text-muted-foreground">
            Up to {BULK_PHONE_MAX_ROWS.toLocaleString('en-KE')} numbers. Duplicates in the paste are skipped.
          </p>
        </div>
        <Button type="submit" disabled={pending} className="min-h-11">
          {pending
            ? progress
              ? `Adding… ${progress.done} of ${progress.total}`
              : 'Adding…'
            : 'Add all'}
        </Button>
      </form>

      {state.results && state.results.length > 0 ? (
        <ul className="divide-y divide-border rounded-xl border border-border bg-card">
          {state.results.map((row) => (
            <li key={`${row.phone}-${row.fullName ?? ''}`} className="space-y-2 px-4 py-3">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className="font-medium text-foreground">
                  {row.fullName ? `${row.fullName} · ` : ''}
                  <span className="font-mono text-sm">{row.phone}</span>
                </p>
                <span
                  className={
                    row.success
                      ? 'text-xs font-medium text-success-text'
                      : 'text-xs font-medium text-destructive'
                  }
                >
                  {row.success ? 'Added' : 'Failed'}
                </span>
              </div>
              <p className="text-sm text-muted-foreground">{row.message}</p>
              {row.success && row.inviteUrl && row.inviteCode ? (
                <InviteSharePanel
                  compact
                  inviteUrl={row.inviteUrl}
                  inviteCode={row.inviteCode}
                  circleName={circleName}
                />
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}

      {shareable.length > 1 ? (
        <p className="text-xs text-muted-foreground">
          Use Copy link / WhatsApp on each row to share that person’s invite.
        </p>
      ) : null}
    </div>
  );
}
