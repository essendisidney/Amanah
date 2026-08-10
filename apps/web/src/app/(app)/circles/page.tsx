import type { Metadata } from 'next';
import Link from 'next/link';
import type { Route } from 'next';
import { redirect } from 'next/navigation';
import { formatCurrency, formatDate } from '@jamiya/shared';
import { Button } from '@jamiya/ui';
import { createClient } from '@/lib/supabase/server';
import { EmptyState } from '@/features/dashboard/components/empty-state';
import { StatusBadge } from '@/features/dashboard/components/dashboard-stats';

export const metadata: Metadata = {
  title: 'My circles',
};

export const dynamic = 'force-dynamic';

type MembershipRow = {
  id: string;
  role: string;
  status: string;
  payout_position: number | null;
  jamiya: {
    id: string;
    name: string;
    slug: string;
    status: string;
    segment: string;
    contribution_amount: number | string;
    currency: string;
    member_count: number;
    max_members: number;
    current_cycle: number;
    cycle_count: number;
    start_date: string | null;
  } | null;
};

export default async function MyCirclesPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login?next=/circles');
  }

  const { data } = await supabase
    .from('members')
    .select(
      `
      id,
      role,
      status,
      payout_position,
      jamiya:jamiyas (
        id,
        name,
        slug,
        status,
        segment,
        contribution_amount,
        currency,
        member_count,
        max_members,
        current_cycle,
        cycle_count,
        start_date
      )
    `,
    )
    .eq('user_id', user.id)
    .in('status', ['active', 'invited', 'suspended'])
    .order('created_at', { ascending: false });

  const rows = ((data ?? []) as unknown as MembershipRow[]).filter((row) => row.jamiya);

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-medium uppercase tracking-[0.16em] text-accent">Circles</p>
          <h1 className="mt-2 font-[family-name:var(--font-display)] text-4xl font-semibold tracking-tight">
            My circles
          </h1>
          <p className="mt-2 text-muted-foreground">
            All rotating savings circles linked to your account.
          </p>
        </div>
        <Button asChild>
          <Link href={'/circles/new' as Route}>Create circle</Link>
        </Button>
      </div>

      {rows.length === 0 ? (
        <EmptyState
          title="You have not joined a circle yet"
          description="Create a new circle or wait for an invitation from your community."
          actionLabel="Create a circle"
          actionHref={'/circles/new' as Route}
        />
      ) : (
        <ul className="divide-y divide-border rounded-xl border border-border bg-card">
          {rows.map((row) => {
            const jamiya = row.jamiya!;
            const amount =
              typeof jamiya.contribution_amount === 'number'
                ? jamiya.contribution_amount
                : Number(jamiya.contribution_amount);

            return (
              <li key={row.id}>
                <Link
                  href={`/circles/${jamiya.slug}` as Route}
                  className="flex flex-col gap-3 px-5 py-5 transition-colors hover:bg-muted/50 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-lg font-medium text-foreground">{jamiya.name}</p>
                      <StatusBadge status={jamiya.status} />
                      <StatusBadge status={row.role} />
                      {jamiya.segment && jamiya.segment !== 'general' ? (
                        <StatusBadge status={jamiya.segment} />
                      ) : null}
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {jamiya.member_count}/{jamiya.max_members} members · Cycle{' '}
                      {jamiya.current_cycle}/{jamiya.cycle_count}
                      {jamiya.start_date ? ` · Starts ${formatDate(jamiya.start_date)}` : ''}
                    </p>
                  </div>
                  <div className="text-sm font-semibold text-foreground sm:text-right">
                    {formatCurrency(amount, jamiya.currency)}
                    <span className="block text-xs font-normal text-muted-foreground">
                      per cycle
                      {row.payout_position ? ` · #${row.payout_position}` : ''}
                    </span>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
