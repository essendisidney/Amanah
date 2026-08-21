import Link from 'next/link';
import type { Route } from 'next';
import { redirect } from 'next/navigation';
import { formatCurrency } from '@jamiya/shared';
import { Button } from '@jamiya/ui';
import { createClient } from '@/lib/supabase/server';
import { getDictionary } from '@/i18n/get-dictionary';
import { getDashboardData } from '@/features/dashboard';
import { t } from '@/i18n/dictionaries';

export const dynamic = 'force-dynamic';

type Fund = {
  jamiya_id: string;
  balance: number | string;
  currency: string;
  jamiya: { name: string } | null;
};

export default async function FinancePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/phone?next=/finance');

  const [{ dict }, { data }, dashboard] = await Promise.all([
    getDictionary(),
    supabase
      .from('welfare_funds')
      .select('jamiya_id, balance, currency, jamiya:jamiyas(name)')
      .order('created_at'),
    getDashboardData(user.id),
  ]);

  const labels = dict.finance;
  const funds = (data ?? []) as unknown as Fund[];
  const wallet = dashboard.wallet;
  const openDues = dashboard.stats.pendingContributions;
  const openDueTotal = dashboard.contributions.reduce(
    (sum, item) => sum + Math.max(item.amount - item.amountPaid, 0),
    0,
  );
  const currency = wallet?.currency ?? 'KES';
  const openDueAmount = formatCurrency(openDueTotal, currency);

  const items = [
    [labels.insightsTitle, labels.insightsDesc, '/finance/insights'],
    [labels.investTitle, labels.investDesc, '/finance/invest'],
    [labels.welfareTitle, labels.welfareDesc, '/finance/welfare'],
    [labels.qardTitle, labels.qardDesc, '/finance/qard'],
    [labels.tawarruqTitle, labels.tawarruqDesc, '/finance/tawarruq'],
    [labels.goalsTitle, labels.goalsDesc, '/finance/goals'],
  ] as const;

  return (
    <div className="space-y-10">
      <div>
        <p className="text-sm font-medium uppercase tracking-[0.16em] text-accent">
          <Link href={'/pay' as Route} className="hover:text-primary">
            {dict.paySheet.title}
          </Link>
          <span className="text-muted-foreground"> · </span>
          {labels.eyebrow}
        </p>
        <h1 className="mt-2 font-[family-name:var(--font-display)] text-4xl font-semibold">
          {labels.title}
        </h1>
        <p className="mt-2 text-muted-foreground">{labels.subtitle}</p>
      </div>

      <section className="amanah-surface flex flex-col gap-4 border-primary/20 px-4 py-4 sm:flex-row sm:items-center sm:justify-between md:px-5">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {labels.moneyAvailable}
          </p>
          <p className="amanah-money mt-1 text-2xl font-bold tracking-tight">
            {formatCurrency(wallet?.availableBalance ?? 0, currency)}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            {openDues > 0
              ? t(openDues === 1 ? labels.openDuesOne : labels.openDuesMany, {
                  count: openDues,
                  amount: openDueAmount,
                })
              : labels.noOpenDues}
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Button asChild className="min-h-11">
            <Link href={'/wallet#top-up' as Route}>{labels.addMoney}</Link>
          </Button>
          {openDues > 0 && dashboard.contributions[0] ? (
            <Button asChild variant="outline" className="min-h-11">
              <Link
                href={
                  `/circles/${dashboard.contributions[0].jamiyaSlug}#pay` as Route
                }
              >
                {labels.payDues}
              </Link>
            </Button>
          ) : (
            <Button asChild variant="outline" className="min-h-11">
              <Link href={'/finance/goals' as Route}>{labels.goalsCta}</Link>
            </Button>
          )}
        </div>
      </section>

      <div className="divide-y divide-border border-y border-border">
        {items.map(([title, description, href]) => (
          <Link
            key={href}
            href={href as Route}
            className="flex items-center justify-between gap-4 py-5 hover:text-primary"
          >
            <div>
              <h2 className="font-[family-name:var(--font-display)] text-2xl font-semibold">
                {title}
              </h2>
              <p className="mt-1 text-muted-foreground">{description}</p>
            </div>
            <span aria-hidden>→</span>
          </Link>
        ))}
      </div>

      <section className="amanah-surface space-y-3 border-primary/15 px-4 py-5 md:px-5">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-accent">Shariah</p>
        <h2 className="font-[family-name:var(--font-display)] text-2xl font-semibold">
          {labels.shariaTitle}
        </h2>
        <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">
          {labels.shariaLead}
        </p>
        <Button asChild variant="outline" className="min-h-11">
          <Link href={'/#shariah' as Route}>{labels.shariaCta}</Link>
        </Button>
      </section>

      <section>
        <h2 className="font-[family-name:var(--font-display)] text-2xl font-semibold">
          {labels.welfareOverview}
        </h2>
        {funds.length ? (
          <ul className="mt-4 divide-y divide-border border-y border-border">
            {funds.map((fund) => (
              <li key={fund.jamiya_id} className="flex justify-between py-4">
                <span>{fund.jamiya?.name ?? labels.circleFallback}</span>
                <strong>{formatCurrency(Number(fund.balance), fund.currency)}</strong>
              </li>
            ))}
          </ul>
        ) : (
          <div className="mt-3 space-y-3">
            <p className="text-sm text-muted-foreground">{labels.noWelfare}</p>
            <Button asChild variant="outline" className="min-h-11">
              <Link href={'/finance/welfare' as Route}>Open Welfare</Link>
            </Button>
          </div>
        )}
      </section>
    </div>
  );
}
