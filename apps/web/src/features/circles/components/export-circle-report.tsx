'use client';

import Link from 'next/link';
import type { Route } from 'next';
import { useTransition } from 'react';
import { Button } from '@jamiya/ui';
import { downloadBlob } from '@/lib/export/spreadsheet';
import { exportCircleReportAction } from '../actions/report-actions';

export function ExportCircleReportButtons({ slug }: { slug: string }) {
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
            const result = await exportCircleReportAction(slug);
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
            const result = await exportCircleReportAction(slug);
            if (result) {
              downloadBlob(result.xlsFilename, result.xls, 'application/vnd.ms-excel');
            }
          })
        }
      >
        {pending ? 'Exporting…' : 'Export Excel'}
      </Button>
      <Button asChild variant="outline" size="sm">
        <Link href={`/circles/${slug}/report` as Route}>Print / PDF</Link>
      </Button>
    </div>
  );
}
