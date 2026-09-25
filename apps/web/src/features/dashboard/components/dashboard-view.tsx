import Link from 'next/link';
import type { Route } from 'next';
import { Plus, CircleDollarSign } from 'lucide-react';
import { formatCurrency, formatDate, formatRelativeTime, isValidKeMobile } from '@jamiya/shared';
import { Button } from '@jamiya/ui';
import type { Dictionary } from '@/i18n/dictionaries';
import type { DashboardData } from '../types';
import { walletTopUpHref } from '@/features/wallet/lib/wallet-focus-href';
import { StatusBadge } from './dashboard-stats';

function greetingForHour(hour: number, labels: Dictionary['dashboard']) {
  if (hour < 12) return labels.greetingMorning;
  if (hour < 17) return labels.greetingAfternoon;
  return labels.greetingEvening;
}

/** Phone sign-in stores a digit-only email. Don't greet people with that. */
function displayFirstName(
  fullName: string | null | undefined,
  email: string | null | undefined,
  fallback: string,
) {
  const fromName = fullName?.trim().split(/\s+/)[0];
  if (fromName && !isPhoneHandle(fromName)) return fromName;
  const local = email?.split('@')[0]?.trim();
  if (local && !isPhoneHandle(local)) return local;
  return fallback;
}

function isPhoneHandle(value: string) {
  const compact = value.replace(/[\s+-]/g, '');
  return /^\d{9,15}$/.test(compact);
}

export function DashboardView({
  data,
  email,
  labels,
  common,
}: {
  data: DashboardData;
  email?: string | null;
  labels: Dictionary['dashboard'];
  common: Dictionary['common'];
}) {
  const firstName = displayFirstName(
    data.profile?.full_name,
    email,
    labels.nameFallback,
  );
  const greeting = greetingForHour(new Date().getHours(), labels);
  const currency = data.wallet?.currency ?? 'KES';
  const available = data.wallet?.availableBalance ?? data.wallet?.balance ?? 0;
  const nextDue = data.contributions[0] ?? null;
  const nextPayout = data.payouts[0] ?? null;
  const needsPhone =
    Boolean(data.profile) &&
    !isValidKeMobile(String(data.profile?.phone ?? '').trim());
  const needsProfile = Boolean(data.profile && !data.profile.profile_completed);
  const dueRemaining = nextDue
    ? Math.max(nextDue.amount - nextDue.amountPaid, 0)
    : 0;
  const needsTopUpForDue = Boolean(nextDue && available <= 0 && dueRemaining > 0);
  const topUpForDueHref = nextDue
    ? (walletTopUpHref({
        amount: Math.ceil(dueRemaining),
        next: `/circles/${nextDue.jamiyaSlug}#pay`,
      }) as Route)
    : (walletTopUpHref() as Route);
  const payHref = nextDue
    ? (`/circles/${nextDue.jamiyaSlug}#pay-due` as Route)
    : ('/pay' as Route);
  const circle = data.jamiyas[0] ?? null;
  const hasMultipleCircles = data.jamiyas.length > 1;
  const recent = data.activity.slice(0, 5);

  /** Only surface next due / payout when real rows exist — never invent them. */
  const circleContribution = circle && nextDue ? nextDue : null;
  const circlePayout = circle && nextPayout ? nextPayout : null;

  return (
    <div className="grid items-start gap-6 md:grid-cols-[minmax(0,1fr)_minmax(260px,300px)] md:gap-8">
      <div className="space-y-5">
        <header className="space-y-1">
          <p className="text-sm text-muted-foreground">
            {greeting},{' '}
            <span className="font-semibold text-foreground">{firstName}</span>
          </p>
          {(needsPhone || needsProfile) && (
            <Link
              href={
                (needsPhone
                  ? '/profile?onboarding=1&next=/dashboard#personal-details'
                  : '/profile') as Route
              }
              className="inline-block text-sm font-semibold text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            >
              {needsPhone ? labels.addPhone : labels.completeProfile}
            </Link>
          )}
        </header>

        <section className="amanah-surface space-y-3.5 px-4 py-4 sm:px-5">
          <Link
            href={'/wallet' as Route}
            className="block rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          >
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              {labels.available}
            </p>
            <p className="amanah-money mt-1 text-3xl font-bold leading-none tracking-tight text-foreground sm:text-4xl">
              {formatCurrency(available, currency)}
            </p>
          </Link>

          <div className="grid grid-cols-2 gap-2">
            <Button asChild className="min-h-11 w-full">
              <Link href={walletTopUpHref() as Route}>
                <Plus className="h-4 w-4" />
                {labels.quickAdd}
              </Link>
            </Button>
            <Button asChild variant="outline" className="min-h-11 w-full">
              <Link href={payHref}>
                <CircleDollarSign className="h-4 w-4" />
                {nextDue ? labels.quickPayDue : labels.quickPay}
              </Link>
            </Button>
          </div>
        </section>

        {needsTopUpForDue && !circle ? (
          <Link
            href={topUpForDueHref}
            className="amanah-surface flex items-center justify-between gap-3 border-primary/30 bg-primary/8 px-4 py-3.5 transition-colors hover:bg-primary/12 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          >
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-primary">
                {labels.duePrefix}
              </p>
              <p className="amanah-money mt-1 text-lg font-bold text-foreground">
                {formatCurrency(dueRemaining, nextDue!.currency)}
              </p>
              <p className="mt-0.5 truncate text-xs text-muted-foreground">
                {nextDue?.jamiyaName
                  ? `${labels.addMoneyToPay} · ${nextDue.jamiyaName}`
                  : labels.addMoneyToPay}
              </p>
            </div>
            <span className="shrink-0 text-sm font-semibold text-primary">→</span>
          </Link>
        ) : null}

        <section className="space-y-2.5">
          {!circle ? (
            <div className="amanah-surface space-y-3.5 border-primary/20 px-4 py-4 sm:px-5">
              <div>
                <h2 className="text-base font-semibold tracking-tight text-foreground sm:text-lg">
                  {labels.noCirclesTitle}
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">{labels.noCirclesDesc}</p>
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                <Button asChild className="min-h-11 w-full">
                  <Link href={'/circles/new' as Route}>{labels.createACircle}</Link>
                </Button>
                <Button asChild variant="outline" className="min-h-11 w-full">
                  <Link href={'/circles?redeem=1' as Route}>{labels.joinWithInvite}</Link>
                </Button>
              </div>
            </div>
          ) : (
            <>
              <div className="flex items-baseline justify-between gap-3 px-0.5">
                <h2 className="text-sm font-semibold text-foreground">{labels.yourCircle}</h2>
                {hasMultipleCircles ? (
                  <Link
                    href={'/circles' as Route}
                    className="text-sm font-semibold text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  >
                    {labels.viewAllCircles}
                  </Link>
                ) : null}
              </div>
              <Link
                href={`/circles/${circle.jamiya.slug}` as Route}
                className="amanah-surface amanah-circle-mint block border-l-4 border-l-primary px-4 py-4 transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="truncate text-[15px] font-semibold tracking-tight text-foreground">
                        {circle.jamiya.name}
                      </p>
                      <StatusBadge status={circle.jamiya.status} />
                    </div>
                    <p className="mt-1 text-xs capitalize text-muted-foreground">
                      {circle.jamiya.memberCount}/{circle.jamiya.maxMembers} {common.members}
                    </p>
                  </div>
                  <p className="amanah-money shrink-0 text-base font-semibold text-foreground">
                    {formatCurrency(circle.jamiya.contributionAmount, circle.jamiya.currency)}
                  </p>
                </div>

                {(circleContribution || circlePayout) ? (
                  <dl className="mt-3.5 grid gap-2.5 border-t border-border/70 pt-3 sm:grid-cols-2">
                    {circleContribution ? (
                      <div>
                        <dt className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                          {labels.nextContribution}
                        </dt>
                        <dd className="amanah-money mt-0.5 text-sm font-semibold text-foreground">
                          {formatCurrency(
                            Math.max(
                              circleContribution.amount - circleContribution.amountPaid,
                              0,
                            ),
                            circleContribution.currency,
                          )}
                        </dd>
                        <dd className="mt-0.5 text-xs text-muted-foreground">
                          {formatDate(circleContribution.dueDate)}
                          {needsTopUpForDue ? ` · ${labels.addMoneyToPay}` : ''}
                        </dd>
                      </div>
                    ) : null}
                    {circlePayout ? (
                      <div>
                        <dt className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                          {labels.nextPayout}
                        </dt>
                        <dd className="amanah-money mt-0.5 text-sm font-semibold text-foreground">
                          {formatCurrency(circlePayout.amount, circlePayout.currency)}
                        </dd>
                        <dd className="mt-0.5 text-xs text-muted-foreground">
                          {formatDate(circlePayout.scheduledDate)}
                        </dd>
                      </div>
                    ) : null}
                  </dl>
                ) : null}
              </Link>
            </>
          )}
        </section>

        <section className="space-y-2.5 md:hidden">
          <RecentSection labels={labels} rows={recent} />
        </section>
      </div>

      <aside className="hidden space-y-2.5 md:block">
        <RecentSection labels={labels} rows={recent} />
      </aside>
    </div>
  );
}

function RecentSection({
  labels,
  rows,
}: {
  labels: Dictionary['dashboard'];
  rows: DashboardData['activity'];
}) {
  return (
    <>
      <div className="flex items-baseline justify-between px-0.5">
        <h2 className="text-sm font-semibold text-foreground">{labels.recent}</h2>
        <Link
          href={'/notifications' as Route}
          className="text-sm font-semibold text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        >
          {labels.activity}
        </Link>
      </div>
      <div className="amanah-surface px-3 py-1">
        <RecentList rows={rows} emptyLabel={labels.nothingYet} />
      </div>
    </>
  );
}

function RecentList({
  rows,
  emptyLabel,
}: {
  rows: DashboardData['activity'];
  emptyLabel: string;
}) {
  if (rows.length === 0) {
    return <p className="px-1 py-3 text-sm text-muted-foreground">{emptyLabel}</p>;
  }

  return (
    <ul className="divide-y divide-border/70">
      {rows.map((row) => {
        const inflow = row.direction === 'credit';
        return (
          <li key={row.id} className="flex items-center justify-between gap-3 py-3">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <p className="truncate text-sm font-medium capitalize text-foreground">
                  {row.type.replaceAll('_', ' ')}
                </p>
                {row.status ? <StatusBadge status={row.status} /> : null}
              </div>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {formatRelativeTime(row.createdAt)}
              </p>
            </div>
            <p
              className={
                inflow
                  ? 'amanah-money amanah-money-in shrink-0 text-sm font-semibold'
                  : 'amanah-money amanah-money-out shrink-0 text-sm font-semibold'
              }
            >
              {inflow ? '+' : '−'}
              {formatCurrency(row.amount, row.currency)}
            </p>
          </li>
        );
      })}
    </ul>
  );
}
