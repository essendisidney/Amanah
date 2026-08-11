import type { Metadata } from 'next';
import Link from 'next/link';
import type { Route } from 'next';
import { formatCurrency, formatDate } from '@jamiya/shared';
import { Button } from '@jamiya/ui';
import { createClient } from '@/lib/supabase/server';
import { requireAdminAccess } from '@/features/admin/lib/require-admin';
import { setJamiyaStatusAction } from '@/features/admin/actions/admin-actions';
import { StatusBadge } from '@/features/dashboard/components/dashboard-stats';

export const metadata: Metadata = { title: 'Admin · Circles' };
export const dynamic = 'force-dynamic';

type JamiyaRow = {
  id: string;
  name: string;
  slug: string;
  status: string;
  contribution_amount: number | string;
  currency: string;
  member_count: number;
  max_members: number;
  created_at: string;
};

const STATUSES = ['draft', 'open', 'active', 'paused', 'completed', 'cancelled'] as const;

export default async function AdminCirclesPage() {
  await requireAdminAccess('admin');
  const supabase = await createClient();
  const { data } = await supabase
    .from('jamiyas')
    .select(
      'id, name, slug, status, contribution_amount, currency, member_count, max_members, created_at',
    )
    .order('created_at', { ascending: false })
    .limit(100);

  const rows = (data ?? []) as unknown as JamiyaRow[];

  return (
    <div className="space-y-4">
      <div>
        <h2 className="font-[family-name:var(--font-display)] text-2xl font-semibold">Circles</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Open, activate, pause, or close circles across the platform.
        </p>
      </div>
      <ul className="divide-y divide-border rounded-xl border border-border bg-card">
        {rows.map((item) => {
          const amount =
            typeof item.contribution_amount === 'number'
              ? item.contribution_amount
              : Number(item.contribution_amount);
          return (
            <li
              key={item.id}
              className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between"
            >
              <div>
                <Link
                  href={`/circles/${item.slug}` as Route}
                  className="font-medium hover:text-primary"
                >
                  {item.name}
                </Link>
                <p className="mt-1 text-sm text-muted-foreground">
                  {item.member_count}/{item.max_members} members ·{' '}
                  {formatCurrency(amount, item.currency)} · {formatDate(item.created_at)}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <StatusBadge status={item.status} />
                <form action={setJamiyaStatusAction} className="flex flex-wrap items-center gap-2">
                  <input type="hidden" name="jamiyaId" value={item.id} />
                  <select
                    name="status"
                    defaultValue={item.status}
                    className="h-9 rounded-md border border-input bg-background px-2 text-sm"
                  >
                    {STATUSES.map((status) => (
                      <option key={status} value={status}>
                        {status}
                      </option>
                    ))}
                  </select>
                  <Button type="submit" size="sm" variant="outline">
                    Update
                  </Button>
                </form>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
