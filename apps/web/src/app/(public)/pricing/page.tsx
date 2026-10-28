import type { Metadata } from 'next';
import Link from 'next/link';
import type { Route } from 'next';
import { formatCurrency } from '@jamiya/shared';
import { Button } from '@jamiya/ui';
import { getActivePlatformPlans, type PlatformPlan } from '@/lib/platform-plans';
import { planListPrice } from '@/features/circles/lib/plan-price';

export const metadata: Metadata = {
  title: 'Pricing',
  alternates: { canonical: '/pricing' },
  description:
    'Clear plans for Jameiyah circles, priced by group size: Free, Starter, Growth, Pro and Enterprise. 14-day free trial.',
};

export const revalidate = 3600;

const kes = (n: number) => formatCurrency(n, 'KES');

function membersLabel(plan: PlatformPlan): string {
  if (plan.included_members != null) return `${plan.min_members}+ members`;
  if (plan.min_members > 0) return `${plan.min_members}–${plan.max_members} members`;
  return `Up to ${plan.max_members} members`;
}

const EXTRAS: Array<[string, string]> = [
  ['Setup and remote onboarding', 'Free'],
  ['Moving your records from another app or Excel', 'KES 1,000–3,000, quoted first; free on yearly Pro and Enterprise'],
  ['In-person training', 'From KES 3,000, plus travel outside Nairobi'],
  ['Custom reports or setup', 'KES 2,500 an hour, or a fixed quote agreed in writing'],
  ['Large organisations, SACCOs and API links', 'From KES 10,000, quoted by scope'],
];

export default async function PricingPage() {
  const plans = await getActivePlatformPlans();

  return (
    <main className="mx-auto max-w-6xl px-4 py-12 sm:px-6 sm:py-16">
      <p className="text-sm font-medium uppercase tracking-[0.16em] text-accent">Group plans</p>
      <h1 className="mt-2 font-[family-name:var(--font-display)] text-3xl font-semibold tracking-tight sm:text-5xl">
        Pricing for your circle
      </h1>
      <p className="mt-4 max-w-2xl text-lg text-muted-foreground">
        Pay for the size of your chama. Every paid plan starts with a 14-day free trial, and nothing
        is charged when it ends unless an officer chooses to pay. Pay monthly, quarterly (about 5%
        off) or yearly (2 months free). Prices are in Kenya shillings and include VAT.
      </p>

      <ul className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-5">
        {plans.map((plan) => {
          const monthly = Number(plan.price_kes);
          const free = monthly <= 0;
          const perMember = plan.included_members != null;
          return (
            <li key={plan.id} className="jameiyah-surface flex flex-col rounded-2xl p-5">
              <p className="text-sm font-medium uppercase tracking-[0.14em] text-accent">
                {plan.name}
              </p>
              <p className="mt-1 text-sm text-muted-foreground">{membersLabel(plan)}</p>
              <p className="mt-3 font-[family-name:var(--font-display)] text-3xl font-semibold">
                {free ? 'Free' : `${perMember ? 'From ' : ''}${kes(monthly)}`}
                {free ? null : (
                  <span className="text-base font-normal text-muted-foreground"> / month</span>
                )}
              </p>
              {free ? null : perMember ? (
                <p className="mt-1 text-xs text-muted-foreground">
                  + {kes(Number(plan.per_member_kes))} a member above {plan.included_members}, up to{' '}
                  {kes(Number(plan.price_cap_kes))} a month. 3 months less 5%; a year is 10 months.
                </p>
              ) : (
                <p className="mt-1 text-xs text-muted-foreground">
                  {kes(planListPrice(plan, plan.max_members, 'quarterly'))} a quarter ·{' '}
                  {kes(planListPrice(plan, plan.max_members, 'annual'))} a year
                </p>
              )}
              <p className="mt-3 text-sm text-muted-foreground">{plan.description}</p>
              <ul className="mt-4 space-y-1.5 text-sm">
                <li>
                  {plan.sms_credits_month > 0
                    ? `${plan.sms_credits_month} SMS reminders a month`
                    : 'In-app reminders'}
                </li>
                <li>Statements and exports: {plan.exports_included ? 'Yes' : 'Basic statement'}</li>
                <li>Officer approvals: {plan.dual_approval_included ? 'Included' : 'Optional'}</li>
              </ul>
              <div className="mt-auto pt-6">
                <Button asChild className="min-h-11 w-full" variant={free ? 'outline' : 'default'}>
                  <Link href={'/circles' as Route}>{free ? 'Start free' : 'Try free for 14 days'}</Link>
                </Button>
              </div>
            </li>
          );
        })}
      </ul>

      {plans.length === 0 ? (
        <p className="mt-10 text-sm text-muted-foreground">
          Plans are temporarily unavailable. Try again later.
        </p>
      ) : null}

      <p className="mt-6 text-sm text-muted-foreground">
        Officers choose and pay for the plan under Officer console → Circle plan, from their
        Jameiyah wallet. If your circle grows past its plan, the next renewal moves to the plan that
        fits and you are told the new price three days before. Recording contributions never stops
        because of a plan.
      </p>

      <section className="mt-14">
        <h2 className="font-[family-name:var(--font-display)] text-2xl font-semibold">
          Other services
        </h2>
        <dl className="mt-4 divide-y divide-border/70 rounded-xl border border-border/70">
          {EXTRAS.map(([name, price]) => (
            <div key={name} className="flex flex-col gap-1 px-4 py-3 sm:flex-row sm:justify-between">
              <dt className="font-medium">{name}</dt>
              <dd className="text-sm text-muted-foreground sm:text-right">{price}</dd>
            </div>
          ))}
        </dl>
        <p className="mt-4 text-sm text-muted-foreground">
          Qard Hasan loans between members are always free: Jameiyah never takes a share of a
          repayment.
        </p>
      </section>
    </main>
  );
}
