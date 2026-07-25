import type { Metadata } from 'next';
import { formatDate } from '@jamiya/shared';
import { createClient } from '@/lib/supabase/server';
import { requireAdminAccess } from '@/features/admin/lib/require-admin';
import { ExportAuditButton } from '@/features/admin/components/export-buttons';
import { StatusBadge } from '@/features/dashboard/components/dashboard-stats';

export const metadata: Metadata = { title: 'Admin · Audit' };
export const dynamic = 'force-dynamic';

type AuditRow = {
  id: string;
  actor_id: string | null;
  action: string;
  entity_type: string;
  entity_id: string | null;
  created_at: string;
};

export default async function AdminAuditPage() {
  await requireAdminAccess('compliance');
  const supabase = await createClient();
  const { data } = await supabase
    .from('audit_logs')
    .select('id, actor_id, action, entity_type, entity_id, created_at')
    .order('created_at', { ascending: false })
    .limit(150);

  const rows = (data ?? []) as unknown as AuditRow[];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-[family-name:var(--font-display)] text-2xl font-semibold">
          Audit logs
        </h2>
        <ExportAuditButton />
      </div>
      <ul className="divide-y divide-border rounded-xl border border-border bg-card">
        {rows.map((row) => (
          <li key={row.id} className="flex items-center justify-between gap-4 px-5 py-3">
            <div>
              <p className="text-sm font-medium">
                <span className="capitalize">{row.action.replaceAll('_', ' ')}</span> ·{' '}
                {row.entity_type}
                {row.entity_id ? ` · ${row.entity_id.slice(0, 8)}…` : ''}
              </p>
              <p className="text-xs text-muted-foreground">
                {formatDate(row.created_at)}
                {row.actor_id ? ` · actor ${row.actor_id.slice(0, 8)}…` : ''}
              </p>
            </div>
            <StatusBadge status={row.action} />
          </li>
        ))}
      </ul>
    </div>
  );
}
