import type { Metadata } from 'next';
import Link from 'next/link';
import type { Route } from 'next';
import { notFound, redirect } from 'next/navigation';
import { formatDate } from '@jamiya/shared';
import { Button } from '@jamiya/ui';
import { createClient } from '@/lib/supabase/server';
import { StatusBadge } from '@/features/dashboard/components/dashboard-stats';
import { getDictionary } from '@/i18n/get-dictionary';

export const metadata: Metadata = { title: 'Circle audit trail' };
export const dynamic = 'force-dynamic';

const OFFICER_ROLES = new Set(['circle_admin', 'chair', 'treasurer', 'secretary']);

type Props = { params: Promise<{ slug: string }> };

export default async function CircleAuditPage({ params }: Props) {
  const { slug } = await params;
  const { dict } = await getDictionary();
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/login?next=/circles/${slug}/audit`);

  const { data: jamiyaData } = await supabase
    .from('jamiyas')
    .select('id, name, slug')
    .eq('slug', slug)
    .maybeSingle();
  const jamiya = jamiyaData as { id: string; name: string; slug: string } | null;
  if (!jamiya) notFound();

  const { data: membership } = await supabase
    .from('members')
    .select('role, status')
    .eq('jamiya_id', jamiya.id)
    .eq('user_id', user.id)
    .eq('status', 'active')
    .maybeSingle();
  if (!membership || !OFFICER_ROLES.has((membership as { role: string }).role)) {
    redirect(`/circles/${slug}`);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any;
  const [{ data: auditData }, { data: dualData }] = await Promise.all([
    supabase
      .from('audit_logs')
      .select('id, actor_id, action, entity_type, entity_id, metadata, created_at')
      .eq('jamiya_id', jamiya.id)
      .order('created_at', { ascending: false })
      .limit(120),
    db
      .from('dual_approval_requests')
      .select(
        'id, kind, entity_id, amount, currency, status, first_approver_id, second_approver_id, created_at, updated_at',
      )
      .eq('jamiya_id', jamiya.id)
      .order('created_at', { ascending: false })
      .limit(40),
  ]);

  const auditRows = (auditData ?? []) as Array<{
    id: string;
    actor_id: string | null;
    action: string;
    entity_type: string;
    entity_id: string | null;
    metadata: Record<string, unknown> | null;
    created_at: string;
  }>;

  const dualRows = (dualData ?? []) as Array<{
    id: string;
    kind: string;
    amount: number | string;
    currency: string;
    status: string;
    first_approver_id: string | null;
    second_approver_id: string | null;
    created_at: string;
  }>;

  const personIds = Array.from(
    new Set(
      [
        ...auditRows.map((r) => r.actor_id),
        ...dualRows.map((r) => r.first_approver_id),
        ...dualRows.map((r) => r.second_approver_id),
      ].filter(Boolean),
    ),
  ) as string[];

  const { data: profileData } = personIds.length
    ? await supabase.from('profiles').select('id, full_name, phone').in('id', personIds)
    : { data: [] as unknown[] };

  const personName = new Map(
    ((profileData ?? []) as Array<{
      id: string;
      full_name: string | null;
      phone: string | null;
    }>).map((p) => [p.id, p.full_name?.trim() || p.phone || p.id.slice(0, 8)]),
  );

  function labelPerson(id: string | null) {
    if (!id) return null;
    return personName.get(id) ?? `${id.slice(0, 8)}…`;
  }

  function metaBits(metadata: Record<string, unknown> | null) {
    if (!metadata) return null;
    const bits: string[] = [];
    for (const key of ['status', 'email', 'phone', 'notes', 'amount', 'kind']) {
      const value = metadata[key];
      if (value == null || value === '') continue;
      bits.push(`${key}: ${String(value)}`);
    }
    return bits.length ? bits.join(' · ') : null;
  }

  const treasuryish = auditRows.filter((r) =>
    ['treasury', 'book_entry', 'payout', 'fine', 'share', 'dividend', 'bank_alert', 'journal'].some(
      (k) => r.entity_type.includes(k) || String(r.metadata?.kind ?? '').includes(k),
    ),
  );

  return (
    <div className="mx-auto max-w-4xl space-y-8 px-6 py-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-medium uppercase tracking-[0.16em] text-accent">
            {dict.officer.auditEyebrow}
          </p>
          <h1 className="mt-2 font-[family-name:var(--font-display)] text-3xl font-semibold">
            {jamiya.name}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">{dict.officer.auditIntro}</p>
        </div>
        <Button asChild variant="outline" size="sm">
          <Link href={`/circles/${slug}/officer` as Route}>{dict.circle.officerConsole}</Link>
        </Button>
      </div>

      <section className="space-y-3">
        <h2 className="font-[family-name:var(--font-display)] text-xl font-semibold">
          {dict.officer.dualApprovalTrail}
        </h2>
        {!dualRows.length ? (
          <p className="text-sm text-muted-foreground">{dict.officer.noDualRequests}</p>
        ) : (
          <ul className="divide-y divide-border rounded-xl border border-border bg-card">
            {dualRows.map((row) => (
              <li key={row.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
                <div>
                  <p className="text-sm font-medium capitalize">
                    {row.kind.replaceAll('_', ' ')} · {row.amount} {row.currency}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {formatDate(row.created_at)}
                    {row.first_approver_id
                      ? ` · 1st ${labelPerson(row.first_approver_id)}`
                      : ''}
                    {row.second_approver_id
                      ? ` · 2nd ${labelPerson(row.second_approver_id)}`
                      : ''}
                  </p>
                </div>
                <StatusBadge status={row.status} />
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="font-[family-name:var(--font-display)] text-xl font-semibold">
          {dict.officer.treasuryChanges}
        </h2>
        {!treasuryish.length ? (
          <p className="text-sm text-muted-foreground">{dict.officer.noTreasuryAudit}</p>
        ) : (
          <ul className="divide-y divide-border rounded-xl border border-border bg-card">
            {treasuryish.map((row) => (
              <li key={row.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
                <div>
                  <p className="text-sm font-medium capitalize">
                    {row.action.replaceAll('_', ' ')} · {row.entity_type}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {formatDate(row.created_at)}
                    {row.actor_id ? ` · ${labelPerson(row.actor_id)}` : ''}
                    {row.entity_id ? ` · ${row.entity_id.slice(0, 8)}…` : ''}
                  </p>
                  {metaBits(row.metadata) ? (
                    <p className="text-xs text-muted-foreground">{metaBits(row.metadata)}</p>
                  ) : null}
                </div>
                <StatusBadge status={row.action} />
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="font-[family-name:var(--font-display)] text-xl font-semibold">
          {dict.officer.allCircleAudit}
        </h2>
        <ul className="divide-y divide-border rounded-xl border border-border bg-card">
          {auditRows.map((row) => (
            <li key={row.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
              <div>
                <p className="text-sm font-medium capitalize">
                  {row.action.replaceAll('_', ' ')} · {row.entity_type}
                </p>
                <p className="text-xs text-muted-foreground">
                  {formatDate(row.created_at)}
                  {row.actor_id ? ` · ${labelPerson(row.actor_id)}` : ''}
                </p>
                {metaBits(row.metadata) ? (
                  <p className="text-xs text-muted-foreground">{metaBits(row.metadata)}</p>
                ) : null}
              </div>
              <StatusBadge status={row.action} />
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
