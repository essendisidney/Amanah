import type { Metadata } from 'next';
import Link from 'next/link';
import type { Route } from 'next';
import { redirect } from 'next/navigation';
import { formatCurrency } from '@jamiya/shared';
import { Button } from '@jamiya/ui';
import { createClient } from '@/lib/supabase/server';
import { EmptyState } from '@/features/dashboard/components/empty-state';
import { RedeemInviteCodeForm } from '@/features/circles/components/redeem-invite-code-form';
import { circleAccentClass } from '@/features/circles/lib/circle-accent';
import { AppPage } from '@/components/app-page';
import { getDictionary } from '@/i18n/get-dictionary';

export const metadata: Metadata = {
  title: 'Circles',
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
    redirect('/phone?next=/circles');
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
    <AppPage>
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="font-[family-name:var(--font-display)] text-3xl font-semibold tracking-tight">
              {labels.title}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Your chamas, savings groups, and table banking circles.
            </p>
          </div>
          <Button asChild size="sm" className="h-10 rounded-full px-4">
            <Link href={'/circles/new' as Route}>{labels.createCircle}</Link>
          </Button>
        </div>

        <section id="redeem-invite" className="scroll-mt-24">
          <div className="amanah-surface px-4 py-4 sm:px-5">
            <RedeemInviteCodeForm
              title={labels.redeemTitle}
              hint={labels.redeemHint}
              placeholder={labels.redeemPlaceholder}
              submitLabel={labels.redeemSubmit}
              workingLabel={labels.redeemWorking}
              invalidLabel={labels.redeemInvalid}
            />
          </div>
        </section>

        {rows.length === 0 ? (
          <div className="space-y-3">
            <EmptyState
              title={labels.emptyTitle}
              description={labels.emptyDesc}
              actionLabel={labels.createACircle}
              actionHref={'/circles/new' as Route}
            />
            <Button asChild variant="outline" className="min-h-11 rounded-full">
              <a href="#redeem-invite">Enter invite code</a>
            </Button>
          </div>
        ) : (
          <ul className="grid gap-4 sm:grid-cols-2">
            {rows.map((row) => {
              const jamiya = row.jamiya!;
              const amount =
                typeof jamiya.contribution_amount === 'number'
                  ? jamiya.contribution_amount
                  : Number(jamiya.contribution_amount);
              const identity = circleAccentClass(jamiya.slug);

              return (
                <li key={row.id} className={identity}>
                  <Link
                    href={`/circles/${jamiya.slug}` as Route}
                    className="amanah-surface flex items-start justify-between gap-4 px-4 py-4 transition-transform active:scale-[0.99] sm:px-5 sm:py-5"
                  >
                    <div className="flex min-w-0 items-start gap-3">
                      <span
                        className="mt-0.5 inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl"
                        style={{
                          background: 'var(--circle-wash)',
                          color: 'var(--circle-accent)',
                        }}
                      >
                        <span className="h-2.5 w-2.5 rounded-full bg-current" />
                      </span>
                      <div className="min-w-0">
                        <p className="truncate font-semibold tracking-tight text-foreground">
                          {jamiya.name}
                        </p>
                        <p className="mt-1 text-sm capitalize text-muted-foreground">
                          {jamiya.status.replaceAll('_', ' ')} · {jamiya.member_count}{' '}
                          {common.members}
                        </p>
                      </div>
                    </div>
                    <p className="amanah-money shrink-0 text-lg font-semibold text-foreground">
                      {formatCurrency(amount, jamiya.currency)}
                    </p>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
    </AppPage>
  );
}
