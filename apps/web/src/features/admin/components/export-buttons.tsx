'use client';

import { useTransition } from 'react';
import { Button } from '@jamiya/ui';
import { downloadBlob } from '@/lib/export/spreadsheet';
import {
  exportAuditLogsCsvAction,
  exportTransactionsCsvAction,
} from '../actions/export-actions';

export function ExportAuditButton() {
  const [pending, start] = useTransition();

  return (
    <div className="flex flex-wrap gap-2">
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={pending}
        onClick={() =>
          start(async () => {
            const result = await exportAuditLogsCsvAction();
            if (result) downloadBlob(result.filename, result.csv, 'text/csv;charset=utf-8');
          })
        }
      >
        {pending ? 'Exporting…' : 'Export CSV'}
      </Button>
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={pending}
        onClick={() =>
          start(async () => {
            const result = await exportAuditLogsCsvAction();
            if (result) {
              downloadBlob(result.xlsFilename, result.xls, 'application/vnd.ms-excel');
            }
          })
        }
      >
        {pending ? 'Exporting…' : 'Export Excel'}
      </Button>
    </div>
  );
}

export function ExportTransactionsButton() {
  const [pending, start] = useTransition();

  return (
    <div className="flex flex-wrap gap-2">
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={pending}
        onClick={() =>
          start(async () => {
            const result = await exportTransactionsCsvAction();
            if (result) downloadBlob(result.filename, result.csv, 'text/csv;charset=utf-8');
          })
        }
      >
        {pending ? 'Exporting…' : 'Export CSV'}
      </Button>
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={pending}
        onClick={() =>
          start(async () => {
            const result = await exportTransactionsCsvAction();
            if (result) {
              downloadBlob(result.xlsFilename, result.xls, 'application/vnd.ms-excel');
            }
          })
        }
      >
        {pending ? 'Exporting…' : 'Export Excel'}
      </Button>
    </div>
  );
}
