'use server';

import { createClient } from '@/lib/supabase/server';
import { toSpreadsheetMl } from '@/lib/export/spreadsheet';
import { requireAdminAccess } from '../lib/require-admin';

function toCsv(rows: string[][]): string {
  return rows
    .map((row) =>
      row
        .map((cell) => {
          const value = cell ?? '';
          if (/[",\n]/.test(value)) {
            return `"${value.replaceAll('"', '""')}"`;
          }
          return value;
        })
        .join(','),
    )
    .join('\n');
}

export type ExportPayload = {
  filename: string;
  csv: string;
  xls: string;
  xlsFilename: string;
};

function withExcel(
  baseName: string,
  sheetName: string,
  headerAndRows: string[][],
): ExportPayload {
  const day = new Date().toISOString().slice(0, 10);
  return {
    filename: `${baseName}-${day}.csv`,
    csv: toCsv(headerAndRows),
    xlsFilename: `${baseName}-${day}.xls`,
    xls: toSpreadsheetMl(sheetName, headerAndRows),
  };
}

export async function exportAuditLogsCsvAction(): Promise<ExportPayload | null> {
  const { userId } = await requireAdminAccess('compliance');
  const supabase = await createClient();
  const { data } = await supabase
    .from('audit_logs')
    .select(
      'id, actor_id, action, entity_type, entity_id, jamiya_id, created_at, metadata',
    )
    .order('created_at', { ascending: false })
    .limit(2000);

  const rows = (data ?? []) as unknown as Array<{
    id: string;
    actor_id: string | null;
    action: string;
    entity_type: string;
    entity_id: string | null;
    jamiya_id: string | null;
    created_at: string;
    metadata: unknown;
  }>;

  const table = [
    [
      'id',
      'created_at',
      'actor_id',
      'action',
      'entity_type',
      'entity_id',
      'jamiya_id',
      'metadata',
    ],
    ...rows.map((row) => [
      row.id,
      row.created_at,
      row.actor_id ?? '',
      row.action,
      row.entity_type,
      row.entity_id ?? '',
      row.jamiya_id ?? '',
      JSON.stringify(row.metadata ?? {}),
    ]),
  ];

  await supabase.from('audit_logs').insert({
    actor_id: userId,
    action: 'export',
    entity_type: 'audit_logs',
    metadata: { count: rows.length, format: 'csv+xls' },
  } as never);

  return withExcel('amanah-audit', 'Audit', table);
}

export async function exportTransactionsCsvAction(): Promise<ExportPayload | null> {
  const { userId } = await requireAdminAccess('admin');
  const supabase = await createClient();
  const { data } = await supabase
    .from('transactions')
    .select(
      'id, user_id, jamiya_id, type, status, amount, currency, direction, reference, created_at',
    )
    .order('created_at', { ascending: false })
    .limit(2000);

  const rows = (data ?? []) as unknown as Array<{
    id: string;
    user_id: string;
    jamiya_id: string | null;
    type: string;
    status: string;
    amount: number | string;
    currency: string;
    direction: string;
    reference: string | null;
    created_at: string;
  }>;

  const table = [
    [
      'id',
      'created_at',
      'user_id',
      'jamiya_id',
      'type',
      'status',
      'direction',
      'amount',
      'currency',
      'reference',
    ],
    ...rows.map((row) => [
      row.id,
      row.created_at,
      row.user_id,
      row.jamiya_id ?? '',
      row.type,
      row.status,
      row.direction,
      String(row.amount),
      row.currency,
      row.reference ?? '',
    ]),
  ];

  await supabase.from('audit_logs').insert({
    actor_id: userId,
    action: 'export',
    entity_type: 'transactions',
    metadata: { count: rows.length, format: 'csv+xls' },
  } as never);

  return withExcel('amanah-transactions', 'Transactions', table);
}
