'use client';

import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Alert, AlertDescription, Button, Label, Textarea } from '@jamiya/ui';
import { bulkImportBankSmsAction } from '../actions/shares-actions';
import { splitAndParseBankSms } from '../lib/split-bank-sms';

type Account = { id: string; name: string };

export function BankSmsImportForm({
  jamiyaId,
  slug,
  currency,
  accounts,
}: {
  jamiyaId: string;
  slug: string;
  currency: string;
  accounts: Account[];
}) {
  const router = useRouter();
  const [paste, setPaste] = useState('');
  const [bankAccountId, setBankAccountId] = useState('');
  const [pending, startTransition] = useTransition();
  const [notice, setNotice] = useState<{ type: 'success' | 'error'; message: string } | null>(
    null,
  );

  const preview = useMemo(() => splitAndParseBankSms(paste), [paste]);

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const fd = new FormData();
    fd.set('jamiyaId', jamiyaId);
    fd.set('slug', slug);
    fd.set('currency', currency);
    fd.set('bankAccountId', bankAccountId);
    fd.set('smsPaste', paste);
    startTransition(async () => {
      const result = await bulkImportBankSmsAction(fd);
      setNotice({
        type: result.success ? 'success' : 'error',
        message: result.message,
      });
      if (result.success) {
        setPaste('');
        router.refresh();
      }
    });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3 rounded-xl border border-border bg-card p-5">
      <p className="text-sm text-muted-foreground">
        Paste one or more bank / M-Pesa SMS messages (blank line between each). Amount, direction,
        provider, and reference are filled from the text.
      </p>
      {notice ? (
        <Alert variant={notice.type === 'success' ? 'success' : 'destructive'}>
          <AlertDescription>{notice.message}</AlertDescription>
        </Alert>
      ) : null}
      <div className="space-y-1">
        <Label htmlFor="bankAccountPick">Link to account (optional)</Label>
        <select
          id="bankAccountPick"
          value={bankAccountId}
          onChange={(e) => setBankAccountId(e.target.value)}
          className="h-10 w-full max-w-md rounded-md border border-input bg-background px-3 text-sm"
        >
          <option value="">—</option>
          {accounts.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </select>
      </div>
      <div className="space-y-1">
        <Label htmlFor="smsPaste">SMS paste</Label>
        <Textarea
          id="smsPaste"
          rows={6}
          className="font-mono text-xs"
          value={paste}
          onChange={(e) => setPaste(e.target.value)}
          placeholder={`KCB: You have received Ksh 5,000.00 from JANE DOE. Ref KCB12345678.

Equity: Dear customer, Ksh 2,500.00 has been credited to your account. Ref EQ987654.`}
        />
      </div>
      {preview.length > 0 ? (
        <div className="rounded-lg border border-border bg-muted/30 px-4 py-3 text-sm">
          <p className="font-medium text-foreground">
            Preview: {preview.length} message{preview.length === 1 ? '' : 's'}
          </p>
          <ul className="mt-2 space-y-1 text-muted-foreground">
            {preview.slice(0, 8).map((row, i) => (
              <li key={`${row.parsed.externalRef ?? i}-${i}`}>
                {row.parsed.provider.toUpperCase()} · {row.parsed.direction ?? '?'} ·{' '}
                {row.parsed.amount != null ? `KES ${row.parsed.amount}` : 'amount?'}
                {row.parsed.externalRef ? ` · ${row.parsed.externalRef}` : ''}
              </li>
            ))}
            {preview.length > 8 ? (
              <li className="text-xs">…and {preview.length - 8} more</li>
            ) : null}
          </ul>
        </div>
      ) : null}
      <Button type="submit" className="min-h-11" disabled={pending || !paste.trim()}>
        {pending ? 'Queuing…' : 'Queue parsed alerts'}
      </Button>
    </form>
  );
}
