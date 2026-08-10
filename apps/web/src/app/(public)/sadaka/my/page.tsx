import type { Metadata } from 'next';
import Link from 'next/link';
import type { Route } from 'next';
import { redirect } from 'next/navigation';
import { formatCurrency } from '@jamiya/shared';
import { StatusBadge } from '@/features/dashboard/components/dashboard-stats';
import { createClient } from '@/lib/supabase/server';

export const metadata: Metadata = { title: 'My Sadaka campaigns' };
export const dynamic = 'force-dynamic';

type Campaign = {
  id: string;
  slug: string;
  title: string;
  status: string;
  category: string | null;
  goal_amount: number | string;
  raised_amount: number | string;
  currency: string;
  rejection_reason: string | null;
};

export default async function MySadakaCampaignsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login?next=/sadaka/my');

  const { data } = await supabase
    .from('charity_campaigns')
    .select(
      'id, slug, title, status, category, goal_amount, raised_amount, currency, rejection_reason',
    )
    .eq('created_by', user.id)
    .order('created_at', { ascending: false });

  const rows = (data ?? []) as unknown as Campaign[];

  return (
    <main className="mx-auto max-w-4xl px-6 py-12">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-medium uppercase tracking-[0.16em] text-accent">Sadaka</p>
          <h1 className="mt-2 font-[family-name:var(--font-display)] text-4xl font-semibold">
            My campaigns
          </h1>
        </div>
        <Link
          href={'/sadaka/new' as Route}
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
        >
          New campaign
        </Link>
      </div>
      <ul className="mt-8 divide-y divide-border rounded-xl border border-border bg-card">
        {rows.length ? (
          rows.map((row) => (
            <li key={row.id} className="px-5 py-4">
              <div className="flex flex-wrap items-center gap-2">
                <Link
                  href={`/sadaka/${row.slug}` as Route}
                  className="font-medium hover:underline"
                >
                  {row.title}
                </Link>
                <StatusBadge status={row.status} />
                {row.category ? <StatusBadge status={row.category} /> : null}
              </div>
              <p className="mt-1 text-sm text-muted-foreground">
                {formatCurrency(Number(row.raised_amount), row.currency)} of{' '}
                {formatCurrency(Number(row.goal_amount), row.currency)}
              </p>
              {row.rejection_reason ? (
                <p className="mt-2 text-sm text-destructive">Rejected: {row.rejection_reason}</p>
              ) : null}
            </li>
          ))
        ) : (
          <li className="px-5 py-8 text-sm text-muted-foreground">No campaigns yet.</li>
        )}
      </ul>
    </main>
  );
}
