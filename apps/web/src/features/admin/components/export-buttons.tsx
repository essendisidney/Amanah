'use client';

import { useTransition } from 'react';
import { Button } from '@jamiya/ui';
import {
  exportAuditLogsCsvAction,
  exportTransactionsCsvAction,
} from '../actions/export-actions';

function downloadCsv(filename: string, csv: string) {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function ExportAuditButton() {
  const [pending, start] = useTransition();

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      disabled={pending}
      onClick={() =>
        start(async () => {
          const result = await exportAuditLogsCsvAction();
          if (result) downloadCsv(result.filename, result.csv);
        })
      }
    >
      {pending ? 'Exporting…' : 'Export CSV'}
    </Button>
  );
}

export function ExportTransactionsButton() {
  const [pending, start] = useTransition();

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      disabled={pending}
      onClick={() =>
        start(async () => {
          const result = await exportTransactionsCsvAction();
          if (result) downloadCsv(result.filename, result.csv);
        })
      }
    >
      {pending ? 'Exporting…' : 'Export CSV'}
    </Button>
  );
}
