'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Alert, AlertDescription, Button, Label, Textarea } from '@jamiya/ui';
import {
  importTbSheetAction,
  previewTbSheetImportAction,
  type TbImportPreview,
} from '../actions/books-actions';

export function TbSheetImportForm({
  jamiyaId,
  slug,
  parValue,
}: {
  jamiyaId: string;
  slug: string;
  parValue: number;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [previewPending, startPreview] = useTransition();
  const [preview, setPreview] = useState<TbImportPreview | null>(null);
  const [importNotice, setImportNotice] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);

  function runPreview(form: HTMLFormElement) {
    const fd = new FormData(form);
    startPreview(async () => {
      const result = await previewTbSheetImportAction(fd);
      setPreview(result);
      setImportNotice(null);
    });
  }

  const canImport = Boolean(preview?.ok && preview.unmatched.length === 0 && preview.matched.length > 0);

  function runImport(form: HTMLFormElement) {
    const fd = new FormData(form);
    startTransition(async () => {
      const result = await importTbSheetAction(fd);
      setImportNotice({
        type: result.success ? 'success' : 'error',
        message: result.message,
      });
      if (result.success) router.refresh();
    });
  }

  return (
    <form
      className="mt-4 space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        runImport(e.currentTarget);
      }}
    >
      <input type="hidden" name="jamiyaId" value={jamiyaId} />
      <input type="hidden" name="slug" value={slug} />
      <input type="hidden" name="parValue" value={parValue || 100} />
      <input type="hidden" name="year" value="2026" />
      <div className="space-y-1">
        <Label htmlFor="contributionsPaste">Contributions (AMANAH TEST rows 1–10)</Label>
        <Textarea
          id="contributionsPaste"
          name="contributionsPaste"
          rows={10}
          className="font-mono text-xs"
          placeholder={`NEXT OF KIN	NAME	SHARES	CONTRIBUTION
		ONE OFF	5TH FEB	5TH MARCH
HUSBAE…	KHADIJA ALADINA	5000	2000	2000`}
          onChange={() => setPreview(null)}
        />
      </div>
      <div className="space-y-1">
        <Label htmlFor="loansPaste">Loans (AMANAH TEST from row 17 downward)</Label>
        <Textarea
          id="loansPaste"
          name="loansPaste"
          rows={8}
          className="font-mono text-xs"
          placeholder={`FEB	LOANS
5TH FEB	JULIET	16000	paid 3k contribution plus profit`}
          onChange={() => setPreview(null)}
        />
      </div>

      {preview?.error ? (
        <Alert variant="destructive">
          <AlertDescription>{preview.error}</AlertDescription>
        </Alert>
      ) : null}

      {preview?.ok ? (
        <div className="space-y-2 rounded-lg border border-border bg-muted/30 px-4 py-3 text-sm">
          <p className="font-medium text-foreground">
            Preview: {preview.matched.length} matched
            {preview.unmatched.length ? ` · ${preview.unmatched.length} unmatched` : ''}
          </p>
          {preview.matched.length ? (
            <ul className="space-y-1 text-muted-foreground">
              {preview.matched.map((row) => (
                <li key={row.sheetName}>
                  {row.sheetName} → {row.memberLabel}
                  {row.shareAmount ? ` · shares ${row.shareAmount.toLocaleString()}` : ''}
                  {row.months ? ` · ${row.months} months` : ''}
                  {row.loans ? ` · ${row.loans} loan${row.loans === 1 ? '' : 's'}` : ''}
                </li>
              ))}
            </ul>
          ) : null}
          {preview.unmatched.length ? (
            <p className="text-destructive">
              Blocked — unmatched: {preview.unmatched.join(', ')}. Add them on Members or fix the
              spelling, then preview again. Nothing is imported until every name matches.
            </p>
          ) : (
            <p className="text-muted-foreground">Every name matches. You can import.</p>
          )}
        </div>
      ) : null}

      {importNotice ? (
        <Alert variant={importNotice.type === 'success' ? 'success' : 'destructive'}>
          <AlertDescription>{importNotice.message}</AlertDescription>
        </Alert>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="outline"
          className="min-h-11"
          disabled={previewPending || pending}
          onClick={(e) => runPreview(e.currentTarget.form as HTMLFormElement)}
        >
          {previewPending ? 'Checking names…' : 'Preview names'}
        </Button>
        <Button type="submit" className="min-h-11" disabled={pending || previewPending || !canImport}>
          {pending ? 'Importing…' : 'Import sheet'}
        </Button>
      </div>
    </form>
  );
}
