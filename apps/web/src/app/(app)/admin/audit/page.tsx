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
  jamiya_id: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
};

function summarizeMetadata(metadata: Record<string, unknown> | null): string | null {
  if (!metadata || typeof metadata !== 'object') return null;
  const bits: string[] = [];
  for (const key of ['status', 'email', 'phone', 'notes', 'amount', 'kind', 'slug']) {
    const value = metadata[key];
    if (value == null || value === '') continue;
    bits.push(`${key}: ${String(value)}`);
  }
  return bits.length ? bits.join(' · ') : null;
}

export default async function AdminAuditPage() {
  await requireAdminAccess('compliance');
  const { getDictionary } = await import('@/i18n/get-dictionary');
  const { dict } = await getDictionary();
  const supabase = await createClient();
  const { data } = await supabase
    .from('audit_logs')
    .select('id, actor_id, action, entity_type, entity_id, jamiya_id, metadata, created_at')
    .order('created_at', { ascending: false })
    .limit(150);

  const rows = (data ?? []) as unknown as AuditRow[];
  const actorIds = Array.from(
    new Set(rows.map((row) => row.actor_id).filter(Boolean)),
  ) as string[];
  const jamiyaIds = Array.from(
    new Set(rows.map((row) => row.jamiya_id).filter(Boolean)),
  ) as string[];

  const [{ data: profiles }, { data: circles }] = await Promise.all([
    actorIds.length
      ? supabase.from('profiles').select('id, full_name, phone, email').in('id', actorIds)
      : Promise.resolve({ data: [] as unknown[] }),
    jamiyaIds.length
      ? supabase.from('jamiyas').select('id, name').in('id', jamiyaIds)
      : Promise.resolve({ data: [] as unknown[] }),
  ]);

  const actorName = new Map(
    ((profiles ?? []) as Array<{
      id: string;
      full_name: string | null;
      phone: string | null;
      email: string | null;
    }>).map((p) => [
      p.id,
      p.full_name?.trim() || p.phone || p.email || p.id.slice(0, 8),
    ]),
  );
  const circleName = new Map(
    ((circles ?? []) as Array<{ id: string; name: string }>).map((c) => [c.id, c.name]),
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-[family-name:var(--font-display)] text-2xl font-semibold">
            {dict.admin.auditTitle}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Who did what across circles, KYC, invites, and wallet actions.
          </p>
        </div>
        <ExportAuditButton />
      </div>
      <ul className="divide-y divide-border rounded-xl border border-border bg-card">
        {rows.map((row) => {
          const meta = summarizeMetadata(row.metadata);
          const who = row.actor_id ? actorName.get(row.actor_id) : null;
          const circle = row.jamiya_id ? circleName.get(row.jamiya_id) : null;
          return (
            <li key={row.id} className="flex items-start justify-between gap-4 px-5 py-3">
              <div className="min-w-0 space-y-1">
                <p className="text-sm font-medium">
                  <span className="capitalize">{row.action.replaceAll('_', ' ')}</span>
                  {' · '}
                  {row.entity_type.replaceAll('_', ' ')}
                  {circle ? ` · ${circle}` : ''}
                </p>
                <p className="text-xs text-muted-foreground">
                  {formatDate(row.created_at)}
                  {who ? ` · ${who}` : ''}
                  {row.entity_id ? ` · id ${row.entity_id.slice(0, 8)}…` : ''}
                </p>
                {meta ? <p className="text-xs text-muted-foreground">{meta}</p> : null}
              </div>
              <StatusBadge status={row.action} />
            </li>
          );
        })}
      </ul>
    </div>
  );
}
