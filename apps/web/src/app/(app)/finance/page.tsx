import Link from 'next/link';
import type { Route } from 'next';
import { redirect } from 'next/navigation';
import { formatCurrency } from '@jamiya/shared';
import { createClient } from '@/lib/supabase/server';
import { getDictionary } from '@/i18n/get-dictionary';

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
  if (!user) redirect('/login?next=/finance');

  const [{ dict }, { data }] = await Promise.all([
    getDictionary(),
    supabase
      .from('welfare_funds')
      .select('jamiya_id, balance, currency, jamiya:jamiyas(name)')
      .order('created_at'),
  ]);

  const labels = dict.finance;
  const funds = (data ?? []) as unknown as Fund[];
  const items = [
    ['Insights', 'This month’s inflow, on-time rate, and upcoming dues.', '/finance/insights'],
    [labels.welfareTitle, labels.welfareDesc, '/finance/welfare'],
    [labels.qardTitle, labels.qardDesc, '/finance/qard'],
    [labels.tawarruqTitle, labels.tawarruqDesc, '/finance/tawarruq'],
    [labels.goalsTitle, labels.goalsDesc, '/finance/goals'],
  ] as const;

  return (
    <div className="space-y-10">
      <div>
        <p className="text-sm font-medium uppercase tracking-[0.16em] text-accent">
          {labels.eyebrow}
        </p>
        <h1 className="mt-2 font-[family-name:var(--font-display)] text-4xl font-semibold">
          {labels.title}
        </h1>
        <p className="mt-2 text-muted-foreground">{labels.subtitle}</p>
      </div>
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
          <p className="mt-3 text-muted-foreground">{labels.noWelfare}</p>
        )}
      </section>
    </div>
  );
}
