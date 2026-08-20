import type { Metadata } from 'next';
import Link from 'next/link';
import type { Route } from 'next';
import { redirect } from 'next/navigation';
import { Button } from '@jamiya/ui';
import { createClient } from '@/lib/supabase/server';
import { EmptyState } from '@/features/dashboard/components/empty-state';
import { getDictionary } from '@/i18n/get-dictionary';

export const metadata: Metadata = { title: 'Investments' };
export const dynamic = 'force-dynamic';

type CircleRow = {
  jamiya: { id: string; name: string; slug: string } | null;
};

export default async function InvestPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/phone?next=/finance/invest');

  const { dict } = await getDictionary();
  const labels = dict.finance;
  const { data } = await supabase
    .from('members')
    .select('jamiya:jamiyas(id, name, slug)')
    .eq('user_id', user.id)
    .eq('status', 'active');

  const circles = ((data ?? []) as unknown as CircleRow[])
    .map((row) => row.jamiya)
    .filter((j): j is NonNullable<typeof j> => Boolean(j?.slug));

  const options = [
    {
      title: labels.investSharesTitle,
      body: labels.investSharesBody,
      href: circles[0] ? (`/circles/${circles[0].slug}/shares` as Route) : ('/circles' as Route),
      cta: circles.length ? labels.investSharesCta : labels.investSharesJoinCta,
    },
    {
      title: labels.investTreasuryTitle,
      body: labels.investTreasuryBody,
      href: circles[0]
        ? (`/circles/${circles[0].slug}/treasury` as Route)
        : ('/circles' as Route),
      cta: circles.length ? labels.investTreasuryCta : labels.investTreasuryBrowseCta,
    },
    {
      title: labels.investTawarruqTitle,
      body: labels.investTawarruqBody,
      href: '/finance/tawarruq' as Route,
      cta: labels.investTawarruqCta,
    },
  ] as const;

  return (
    <div className="space-y-8">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-accent">
          <Link href={'/finance' as Route} className="hover:text-primary">
            {labels.eyebrow}
          </Link>
        </p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight md:text-4xl">
          {labels.investTitle}
        </h1>
        <p className="mt-2 max-w-xl text-muted-foreground">{labels.investDesc}</p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button asChild variant="outline" className="min-h-11">
            <Link href={'/finance' as Route}>{labels.backToFinance}</Link>
          </Button>
        </div>
      </div>

      <section className="divide-y divide-border border-y border-border">
        {options.map((item) => (
          <div
            key={item.title}
            className="flex flex-col gap-3 py-5 sm:flex-row sm:items-center sm:justify-between"
          >
            <div className="max-w-xl">
              <h2 className="font-[family-name:var(--font-display)] text-2xl font-semibold">
                {item.title}
              </h2>
              <p className="mt-1 text-muted-foreground">{item.body}</p>
            </div>
            <Button asChild className="min-h-11 shrink-0">
              <Link href={item.href}>{item.cta}</Link>
            </Button>
          </div>
        ))}
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-bold tracking-tight">{labels.investYourCircles}</h2>
        {circles.length ? (
          <ul className="divide-y divide-border border-y border-border">
            {circles.map((circle) => (
              <li
                key={circle.id}
                className="flex flex-wrap items-center justify-between gap-3 py-4"
              >
                <span className="font-medium">{circle.name}</span>
                <div className="flex flex-wrap gap-2">
                  <Button asChild size="sm" variant="outline">
                    <Link href={`/circles/${circle.slug}/shares` as Route}>
                      {labels.investSharesCta}
                    </Link>
                  </Button>
                  <Button asChild size="sm" variant="outline">
                    <Link href={`/circles/${circle.slug}/treasury` as Route}>
                      {labels.investTreasuryCta}
                    </Link>
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState
            title={labels.investEmptyTitle}
            description={labels.investEmptyDesc}
            actionLabel={labels.investEmptyCta}
            actionHref={'/circles' as Route}
          />
        )}
      </section>
    </div>
  );
}
