import type { Metadata } from 'next';
import { formatDate } from '@jamiya/shared';
import { createClient } from '@/lib/supabase/server';
import { requireAdminAccess } from '@/features/admin/lib/require-admin';
import { StatusBadge } from '@/features/dashboard/components/dashboard-stats';

export const metadata: Metadata = { title: 'Admin · Playbooks' };
export const dynamic = 'force-dynamic';

type Playbook = {
  id: string;
  code: string;
  name: string;
  description: string | null;
  min_days_overdue: number;
  max_days_overdue: number | null;
  severity: string | null;
  is_active: boolean;
  priority: number;
};

type Step = {
  id: string;
  playbook_id: string;
  step_order: number;
  channel: string;
  delay_hours: number;
  template_subject: string | null;
  template_body: string;
  create_agent_task: boolean;
};

export default async function AdminPlaybooksPage() {
  await requireAdminAccess('compliance');
  const supabase = await createClient();

  const [{ data: playbooks }, { data: steps }, { data: recentActions }] = await Promise.all([
    supabase
      .from('collection_playbooks')
      .select(
        'id, code, name, description, min_days_overdue, max_days_overdue, severity, is_active, priority',
      )
      .order('priority'),
    supabase
      .from('collection_playbook_steps')
      .select(
        'id, playbook_id, step_order, channel, delay_hours, template_subject, template_body, create_agent_task',
      )
      .order('step_order'),
    supabase
      .from('collection_case_actions')
      .select('id, case_id, action, channel, created_at, notes')
      .order('created_at', { ascending: false })
      .limit(25),
  ]);

  const rows = (playbooks ?? []) as unknown as Playbook[];
  const stepRows = (steps ?? []) as unknown as Step[];
  const actions = (recentActions ?? []) as Array<{
    id: string;
    case_id: string;
    action: string;
    channel: string | null;
    created_at: string;
    notes: string | null;
  }>;

  return (
    <div className="space-y-8">
      <div>
        <h2 className="font-[family-name:var(--font-display)] text-2xl font-semibold">
          Collections playbooks
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Automated outreach sequences by days overdue. Run the next step from a collection case.
        </p>
      </div>

      <ul className="space-y-4">
        {rows.map((pb) => {
          const pbSteps = stepRows.filter((s) => s.playbook_id === pb.id);
          return (
            <li
              key={pb.id}
              className="rounded-xl border border-border bg-card px-5 py-4 shadow-[0_1px_0_rgba(26,31,28,0.04)]"
            >
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-lg font-medium">{pb.name}</p>
                <StatusBadge status={pb.is_active ? 'active' : 'paused'} />
                {pb.severity ? <StatusBadge status={pb.severity} /> : null}
              </div>
              <p className="mt-1 text-sm text-muted-foreground">
                {pb.description ?? pb.code} · days {pb.min_days_overdue}
                {pb.max_days_overdue != null ? `–${pb.max_days_overdue}` : '+'} · priority{' '}
                {pb.priority}
              </p>
              <ol className="mt-4 space-y-2 border-t border-border pt-3">
                {pbSteps.map((step) => (
                  <li key={step.id} className="text-sm">
                    <span className="font-medium">
                      {step.step_order}. {step.channel}
                    </span>
                    {step.delay_hours > 0 ? (
                      <span className="text-muted-foreground"> · +{step.delay_hours}h</span>
                    ) : null}
                    {step.create_agent_task ? (
                      <span className="text-accent"> · agent task</span>
                    ) : null}
                    <p className="mt-0.5 text-muted-foreground">
                      {step.template_subject ? `${step.template_subject} — ` : ''}
                      {step.template_body}
                    </p>
                  </li>
                ))}
              </ol>
            </li>
          );
        })}
      </ul>

      <section>
        <h3 className="mb-3 font-[family-name:var(--font-display)] text-xl font-semibold">
          Recent playbook actions
        </h3>
        {actions.length === 0 ? (
          <p className="text-sm text-muted-foreground">No actions yet.</p>
        ) : (
          <ul className="divide-y divide-border rounded-xl border border-border bg-card">
            {actions.map((row) => (
              <li key={row.id} className="px-5 py-3 text-sm">
                <div className="flex flex-wrap items-center gap-2">
                  <StatusBadge status={row.action} />
                  {row.channel ? <StatusBadge status={row.channel} /> : null}
                  <span className="text-muted-foreground">{formatDate(row.created_at)}</span>
                </div>
                <p className="mt-1 text-muted-foreground">
                  Case {row.case_id.slice(0, 8)}…{row.notes ? ` — ${row.notes.slice(0, 120)}` : ''}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
