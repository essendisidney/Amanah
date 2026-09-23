import type { Metadata } from 'next';
import Link from 'next/link';
import type { Route } from 'next';
import { redirect } from 'next/navigation';
import { Button } from '@jamiya/ui';
import { createClient } from '@/lib/supabase/server';
import { RedeemInviteCodeForm } from '@/features/circles/components/redeem-invite-code-form';
import { FocusRedeemInvite } from '@/features/circles/components/focus-redeem-invite';
import { CirclesListCard } from '@/features/circles/components/circles-list-card';
import { AppPage, PageHeader } from '@/components/app-page';
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
  const dash = dict.dashboard;
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

  const subtitle = focusRedeem
    ? 'Enter your invite code to join the circle.'
    : labels.subtitle;

  return (
    <AppPage>
      <FocusRedeemInvite active={focusRedeem} />
      <PageHeader
        title={labels.title}
        subtitle={subtitle}
        action={
          <Button asChild className="min-h-11 shrink-0">
            <Link href={'/circles/new' as Route}>{labels.createCircle}</Link>
          </Button>
        }
      />

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
              <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-primary">
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
        <section className="space-y-2.5">
          <div>
            <h2 className="text-sm font-semibold text-foreground">Reserved seats</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              An officer added you, but you have not fully joined yet. Enter the invite code to
              become an active member.
            </p>
          </div>
          <ul className="amanah-surface divide-y divide-border/70">
            {invitedRows.map((row) => (
              <li
                key={row.id}
                className="flex min-h-11 items-center justify-between gap-3 px-4 py-3 sm:px-5"
              >
                <div className="min-w-0">
                  <p className="truncate font-semibold text-foreground">{row.jamiya!.name}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">Invited · enter code to join</p>
                </div>
                <Button asChild variant="outline" className="min-h-11 shrink-0">
                  <a href="#redeem-invite">Enter code</a>
                </Button>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {rows.length === 0 ? (
        <div className="amanah-surface space-y-3.5 border-primary/20 px-4 py-4 sm:px-5">
          <div>
            <h2 className="text-base font-semibold tracking-tight text-foreground sm:text-lg">
              {invitedRows.length > 0 ? 'No active circles yet' : labels.emptyTitle}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {invitedRows.length > 0
                ? 'You have a reserved seat above. Enter the invite code to become an active member.'
                : labels.emptyDesc}
            </p>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            <Button asChild className="min-h-11 w-full">
              <Link href={'/circles/new' as Route}>{labels.createACircle}</Link>
            </Button>
            <Button asChild variant="outline" className="min-h-11 w-full">
              <a href="#redeem-invite">{dash.joinWithInvite}</a>
            </Button>
          </div>
        </div>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {rows.map((row) => {
            const jamiya = row.jamiya!;
            const amount =
              typeof jamiya.contribution_amount === 'number'
                ? jamiya.contribution_amount
                : Number(jamiya.contribution_amount);
            const due = dueByMember.get(row.id);
            const dueHref = due
              ? (`/circles/${jamiya.slug}#pay-due` as Route)
              : (`/circles/${jamiya.slug}` as Route);

            return (
              <li key={row.id}>
                <CirclesListCard
                  href={dueHref}
                  name={jamiya.name}
                  status={jamiya.status}
                  memberLabel={`${jamiya.member_count}/${jamiya.max_members} ${common.members}`}
                  monthlyAmount={amount}
                  currency={jamiya.currency}
                  due={due}
                  nextContributionLabel={dash.nextContribution}
                />
              </li>
            );
          })}
        </ul>
      )}
    </AppPage>
  );
}
