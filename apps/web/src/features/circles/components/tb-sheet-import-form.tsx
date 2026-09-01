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
  const [importMsg, setImportMsg] = useState<string | null>(null);

  function runPreview(form: HTMLFormElement) {
    const fd = new FormData(form);
    startPreview(async () => {
      const result = await previewTbSheetImportAction(fd);
      setPreview(result);
      setImportMsg(null);
    });
  }

  function runImport(form: HTMLFormElement) {
    const fd = new FormData(form);
    startTransition(async () => {
      await importTbSheetAction(fd);
      router.refresh();
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
            <ul className="text-muted-foreground">
              {preview.matched.map((row) => (
                <li key={row.sheetName}>
                  {row.sheetName} → {row.memberLabel}
                </li>
              ))}
            </ul>
          ) : null}
          {preview.unmatched.length ? (
            <p className="text-destructive">
              Unmatched: {preview.unmatched.join(', ')} — add these members first or fix spelling.
            </p>
          ) : null}
        </div>
      ) : null}

      {importMsg ? (
        <Alert variant="destructive">
          <AlertDescription>{importMsg}</AlertDescription>
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
        <Button type="submit" className="min-h-11" disabled={pending || previewPending}>
          {pending ? 'Importing…' : 'Import sheet'}
        </Button>
      </div>
    </form>
  );
}
