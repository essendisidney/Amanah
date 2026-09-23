import type { Metadata } from 'next';
import Link from 'next/link';
import type { Route } from 'next';
import { redirect } from 'next/navigation';
import { formatCurrency, formatDate } from '@jamiya/shared';
import { Button } from '@jamiya/ui';
import { createClient } from '@/lib/supabase/server';
import { EmptyState } from '@/features/dashboard/components/empty-state';
import { RedeemInviteCodeForm } from '@/features/circles/components/redeem-invite-code-form';
import { FocusRedeemInvite } from '@/features/circles/components/focus-redeem-invite';
import { circleAccentClass } from '@/features/circles/lib/circle-accent';
import { AppPage } from '@/components/app-page';
import { getDictionary } from '@/i18n/get-dictionary';
import { cn } from '@/lib/utils';

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

type DueSummary = {
  remaining: number;
  currency: string;
  dueDate: string | null;
  status: string;
};

export default async function MyCirclesPage({
  searchParams,
}: {
  searchParams?: Promise<{ redeem?: string }>;
}) {
  const params = (await searchParams) ?? {};
  const focusRedeem = params.redeem === '1' || params.redeem === 'true';
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(`/login?next=${encodeURIComponent(focusRedeem ? '/circles?redeem=1' : '/circles')}`);
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
  const allRows = ((data ?? []) as unknown as MembershipRow[]).filter((row) => row.jamiya);
  const rows = allRows.filter((row) => row.status === 'active');
  const invitedRows = allRows.filter((row) => row.status === 'invited');
  const memberIds = rows.map((row) => row.id);

  const dueByMember = new Map<string, DueSummary>();
  if (memberIds.length > 0) {
    const { data: dueRows } = await supabase
      .from('contributions')
      .select('member_id, amount, amount_paid, currency, due_date, status')
      .in('member_id', memberIds)
      .in('status', ['pending', 'late', 'partial'])
      .order('due_date', { ascending: true })
      .limit(200);

    for (const row of (dueRows ?? []) as Array<{
      member_id: string;
      amount: number | string;
      amount_paid: number | string;
      currency: string;
      due_date: string | null;
      status: string;
    }>) {
      if (dueByMember.has(row.member_id)) continue;
      const amount = typeof row.amount === 'number' ? row.amount : Number(row.amount);
      const paid =
        typeof row.amount_paid === 'number' ? row.amount_paid : Number(row.amount_paid ?? 0);
      const remaining = Math.max(amount - paid, 0);
      if (remaining <= 0) continue;
      dueByMember.set(row.member_id, {
        remaining,
        currency: row.currency,
        dueDate: row.due_date,
        status: row.status,
      });
    }
  }

  return (
    <AppPage>
        <FocusRedeemInvite active={focusRedeem} />
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="font-[family-name:var(--font-display)] text-3xl font-semibold tracking-tight">
              {labels.title}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {focusRedeem
                ? 'Enter your invite code to join the circle.'
                : 'Your chamas, savings groups, and table banking circles.'}
            </p>
          </div>
          <Button asChild size="sm" className="h-10 rounded-full px-4">
            <Link href={'/circles/new' as Route}>{labels.createCircle}</Link>
          </Button>
        </div>

        <section id="redeem-invite" className="scroll-mt-24">
          {rows.length > 0 && !focusRedeem ? (
            <details className="amanah-surface px-4 py-4 sm:px-5">
              <summary className="cursor-pointer text-sm font-semibold text-foreground">
                Have an invite code?
              </summary>
              <div className="mt-3">
                <RedeemInviteCodeForm
                  title={labels.redeemTitle}
                  hint={labels.redeemHint}
                  placeholder={labels.redeemPlaceholder}
                  submitLabel={labels.redeemSubmit}
                  workingLabel={labels.redeemWorking}
                  invalidLabel={labels.redeemInvalid}
                />
              </div>
            </details>
          ) : (
          <div
            className={cn(
              'amanah-surface px-4 py-4 sm:px-5',
              focusRedeem && 'border-primary/40 ring-2 ring-primary/20',
            )}
          >
            {focusRedeem ? (
              <p className="mb-3 text-xs font-semibold uppercase tracking-[0.14em] text-primary">
                Continue joining
              </p>
            ) : null}
            <RedeemInviteCodeForm
              title={labels.redeemTitle}
              hint={labels.redeemHint}
              placeholder={labels.redeemPlaceholder}
              submitLabel={labels.redeemSubmit}
              workingLabel={labels.redeemWorking}
              invalidLabel={labels.redeemInvalid}
            />
          </div>
          )}
        </section>

        {invitedRows.length > 0 ? (
          <section className="space-y-2">
            <h2 className="text-sm font-semibold text-foreground">Reserved seats</h2>
            <p className="text-sm text-muted-foreground">
              An officer added you, but you have not fully joined as an active member yet. Open
              your invite link or ask them to resend the code.
            </p>
            <ul className="divide-y divide-border rounded-xl border border-border bg-card">
              {invitedRows.map((row) => (
                <li key={row.id} className="flex items-center justify-between gap-3 px-4 py-3">
                  <div>
                    <p className="font-medium">{row.jamiya!.name}</p>
                    <p className="text-xs text-muted-foreground">Status: invited</p>
                  </div>
                  <Button asChild size="sm" variant="outline" className="rounded-full">
                    <a href="#redeem-invite">Enter code</a>
                  </Button>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {rows.length === 0 ? (
          <div className="space-y-3">
            <EmptyState
              title={
                invitedRows.length > 0
                  ? 'No active circles yet'
                  : labels.emptyTitle
              }
              description={
                invitedRows.length > 0
                  ? 'You have a reserved seat above. Enter the invite code to become an active member. Audit “joined” events only count for the account that accepted.'
                  : labels.emptyDesc
              }
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
              const due = dueByMember.get(row.id);
              const dueHref = due
                ? (`/circles/${jamiya.slug}#pay-due` as Route)
                : (`/circles/${jamiya.slug}` as Route);

              return (
                <li key={row.id} className={identity}>
                  <Link
                    href={dueHref}
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
                        {due ? (
                          <p
                            className={cn(
                              'mt-2 text-xs font-semibold',
                              due.status === 'late'
                                ? 'text-destructive'
                                : 'text-primary',
                            )}
                          >
                            {due.status === 'late' ? 'Overdue' : 'Due'}{' '}
                            {formatCurrency(due.remaining, due.currency)}
                            {due.dueDate ? ` · ${formatDate(due.dueDate)}` : ''}
                          </p>
                        ) : (
                          <p className="mt-2 text-xs text-muted-foreground">Clear for now</p>
                        )}
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
