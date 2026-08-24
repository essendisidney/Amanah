import type { Metadata } from 'next';
import Link from 'next/link';
import type { Route } from 'next';
import { formatCurrency, formatDate } from '@jamiya/shared';
import { createClient } from '@/lib/supabase/server';
import { requireAdminAccess } from '@/features/admin/lib/require-admin';
import { AdminCircleActions } from '@/features/admin/components/admin-circle-actions';
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
          Update status, cancel a chama, or delete draft/cancelled circles. Live circles with
          members or payments must be cancelled before delete.
        </p>
      </div>
      {rows.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border px-5 py-8 text-sm text-muted-foreground">
          No circles yet.
        </p>
      ) : (
        <ul className="divide-y divide-border rounded-xl border border-border bg-card">
          {rows.map((item) => {
            const amount =
              typeof item.contribution_amount === 'number'
                ? item.contribution_amount
                : Number(item.contribution_amount);
            return (
              <li
                key={item.id}
                className="flex flex-col gap-3 px-5 py-4 lg:flex-row lg:items-center lg:justify-between"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <Link
                      href={`/circles/${item.slug}` as Route}
                      className="font-medium hover:text-primary"
                    >
                      {item.name}
                    </Link>
                    <StatusBadge status={item.status} />
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {item.member_count}/{item.max_members} members ·{' '}
                    {formatCurrency(amount, item.currency)} · {formatDate(item.created_at)}
                  </p>
                </div>
                <AdminCircleActions
                  jamiyaId={item.id}
                  name={item.name}
                  status={item.status}
                />
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
