import type { Metadata } from 'next';
import Link from 'next/link';
import type { Route } from 'next';
import { formatCurrency } from '@jamiya/shared';
import { Button } from '@jamiya/ui';
import { getDictionary } from '@/i18n/get-dictionary';
import { getActivePlatformPlans } from '@/lib/platform-plans';
import { LanguageSwitcher } from '@/i18n/language-switcher';

export const metadata: Metadata = {
  title: 'Pricing',
  description: 'Clear group plans for Amanah circles — Free, Starter, and Pro.',
};

export const revalidate = 3600;

export default async function PricingPage() {
  const [{ locale, dict }, plans] = await Promise.all([getDictionary(), getActivePlatformPlans()]);

  return (
    <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6 sm:py-12">
      <div className="mb-6 flex flex-wrap items-center gap-2 sm:mb-8 sm:gap-3">
        <Button asChild variant="outline" size="sm">
          <Link href={'/' as Route}>{dict.common.home}</Link>
        </Button>
        <Button asChild variant="ghost" size="sm">
          <Link href={'/dashboard' as Route}>{dict.common.backToDashboard}</Link>
        </Button>
        <LanguageSwitcher locale={locale} label={dict.common.language} />
      </div>

      <p className="text-sm font-medium uppercase tracking-[0.16em] text-accent">
        Group plans
      </p>
      <h1 className="mt-2 font-[family-name:var(--font-display)] text-3xl font-semibold tracking-tight sm:text-5xl">
        Pricing for your circle
      </h1>
      <p className="mt-4 max-w-2xl text-lg text-muted-foreground">
        Pick a plan that matches your chama size. Officers change the plan from the
        officer console. Starter and Pro collect fees from the officer&apos;s Amanah
        wallet (top up with Paystack or M-Pesa when those providers are on).
      </p>

      <ul className="mt-12 grid gap-6 md:grid-cols-3">
        {plans.map((plan) => {
          const price = typeof plan.price_kes === 'number' ? plan.price_kes : Number(plan.price_kes);
          return (
            <li
              key={plan.id}
              className="flex flex-col border border-border bg-card p-6"
            >
              <p className="text-sm font-medium uppercase tracking-[0.14em] text-accent">
                {plan.name}
              </p>
              <p className="mt-3 font-[family-name:var(--font-display)] text-4xl font-semibold">
                {price <= 0 ? 'Free' : formatCurrency(price, 'KES')}
                {price > 0 ? (
                  <span className="text-base font-normal text-muted-foreground"> / month</span>
                ) : null}
              </p>
              <p className="mt-3 text-sm text-muted-foreground">{plan.description}</p>
              <ul className="mt-6 space-y-2 text-sm">
                <li>Up to {plan.max_members} members</li>
                <li>{plan.sms_credits_month} SMS credits / month</li>
                <li>WhatsApp reminders: {plan.whatsapp_enabled ? 'Yes' : 'No'}</li>
                <li>Dual approval: {plan.dual_approval_included ? 'Included' : 'Optional'}</li>
                <li>Exports / print statements: {plan.exports_included ? 'Yes' : 'No'}</li>
              </ul>
              <div className="mt-8">
                <Button asChild className="w-full">
                  <Link href={'/circles' as Route}>Choose in a circle</Link>
                </Button>
              </div>
            </li>
          );
        })}
      </ul>

      {plans.length === 0 ? (
        <p className="mt-10 text-sm text-muted-foreground">
          Plans will appear after the latest database migration is applied.
        </p>
      ) : null}
    </main>
  );
}
