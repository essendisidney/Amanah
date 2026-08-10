'use client';

import { Button } from '@jamiya/ui';

export function PrintReportButton() {
  return (
    <Button type="button" size="sm" onClick={() => window.print()}>
      Print / Save PDF
    </Button>
  );
}
