import type { Metadata } from 'next';
import { formatDate } from '@jamiya/shared';
import { Button } from '@jamiya/ui';
import { createClient } from '@/lib/supabase/server';
import { requireAdminAccess } from '@/features/admin/lib/require-admin';
import { recomputeAllRiskAction } from '@/features/admin/actions/risk-actions';
import { StatusBadge } from '@/features/dashboard/components/dashboard-stats';

export const metadata: Metadata = { title: 'Admin · Risk' };
export const dynamic = 'force-dynamic';

type RiskRow = {
  user_id: string;
  score: number;
  band: string;
  late_contributions: number;
  open_disputes: number;
  failed_payments: number;
  computed_at: string;
};

export default async function AdminRiskPage() {
  await requireAdminAccess('compliance');
  const supabase = await createClient();

  const { data } = await supabase
    .from('member_risk_scores')
    .select(
      'user_id, score, band, late_contributions, open_disputes, failed_payments, computed_at',
    )
    .order('score', { ascending: false })
    .limit(100);

  const rows = (data ?? []) as unknown as RiskRow[];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-[family-name:var(--font-display)] text-2xl font-semibold">
          Member risk
        </h2>
        <form action={recomputeAllRiskAction}>
          <Button type="submit" variant="outline" size="sm">
            Recompute all scores
          </Button>
        </form>
      </div>
      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No scores yet. Click “Recompute all scores” after members are active.
        </p>
      ) : (
        <ul className="divide-y divide-border rounded-xl border border-border bg-card">
          {rows.map((row) => (
            <li
              key={row.user_id}
              className="flex flex-col gap-2 px-5 py-4 sm:flex-row sm:items-center sm:justify-between"
            >
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-medium">user {row.user_id.slice(0, 8)}…</p>
                  <StatusBadge status={row.band} />
                </div>
                <p className="mt-1 text-sm text-muted-foreground">
                  Late {row.late_contributions} · Disputes {row.open_disputes} · Failed
                  payments {row.failed_payments} · {formatDate(row.computed_at)}
                </p>
              </div>
              <p className="text-2xl font-semibold tabular-nums">{row.score}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
