import type { Metadata } from 'next';
import Link from 'next/link';
import type { Route } from 'next';
import { redirect } from 'next/navigation';
import { formatCurrency, formatDate } from '@jamiya/shared';
import { Button } from '@jamiya/ui';
import { createClient } from '@/lib/supabase/server';
import { EmptyState } from '@/features/dashboard/components/empty-state';
import { RedeemInviteCodeForm } from '@/features/circles/components/redeem-invite-code-form';
import { getDictionary } from '@/i18n/get-dictionary';

export const metadata: Metadata = {
  title: 'Amanah Circles',
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
    cycle_count: number | null;
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

  const [{ dict }, { data }] = await Promise.all([
    getDictionary(),
    supabase
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
      .order('created_at', { ascending: false }),
  ]);

  const labels = dict.circles;
  const common = dict.common;
  const rows = ((data ?? []) as unknown as MembershipRow[]).filter((row) => row.jamiya);

  return (
    <div className="space-y-7">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-accent">
            Amanah Circles
          </p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight md:text-4xl">{labels.title}</h1>
          <p className="mt-2 max-w-xl text-muted-foreground">
            Each circle is a trusted financial account for your community.
          </p>
        </div>
        <Button asChild>
          <Link href={'/circles/new' as Route}>{labels.createCircle}</Link>
        </Button>
      </div>

      <section className="amanah-surface p-5">
        <RedeemInviteCodeForm
          title={labels.redeemTitle}
          hint={labels.redeemHint}
          placeholder={labels.redeemPlaceholder}
          submitLabel={labels.redeemSubmit}
          workingLabel={labels.redeemWorking}
          invalidLabel={labels.redeemInvalid}
        />
      </section>

      {rows.length === 0 ? (
        <EmptyState
          title={labels.emptyTitle}
          description={labels.emptyDesc}
          actionLabel={labels.createACircle}
          actionHref={'/circles/new' as Route}
        />
      ) : (
        <ul className="grid gap-3 md:grid-cols-2">
          {rows.map((row) => {
            const jamiya = row.jamiya!;
            const amount =
              typeof jamiya.contribution_amount === 'number'
                ? jamiya.contribution_amount
                : Number(jamiya.contribution_amount);
            const progress =
              jamiya.cycle_count && jamiya.cycle_count > 0
                ? Math.min(100, Math.round((jamiya.current_cycle / jamiya.cycle_count) * 100))
                : 0;
            const estimated = amount * Math.max(jamiya.current_cycle, 1);

            return (
              <li key={row.id}>
                <Link
                  href={`/circles/${jamiya.slug}` as Route}
                  className="amanah-surface block p-5 transition-colors hover:border-primary/30"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-lg font-bold tracking-tight">{jamiya.name}</p>
                      <p className="mt-1 text-xs capitalize text-muted-foreground">
                        {jamiya.status.replaceAll('_', ' ')} · {jamiya.member_count}/
                        {jamiya.max_members} {common.members}
                      </p>
                    </div>
                    <p className="amanah-money shrink-0 text-lg font-bold">
                      {formatCurrency(estimated, jamiya.currency)}
                    </p>
                  </div>
                  <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-primary"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                  <p className="mt-2 text-xs text-muted-foreground">
                    {progress}% · next {formatCurrency(amount, jamiya.currency)} {common.perCycle}
                    {jamiya.start_date ? ` · ${common.starts} ${formatDate(jamiya.start_date)}` : ''}
                  </p>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
