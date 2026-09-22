import type { Metadata } from 'next';
import Link from 'next/link';
import type { Route } from 'next';
import { redirect } from 'next/navigation';
import { formatCurrency } from '@jamiya/shared';
import { Button } from '@jamiya/ui';
import { createClient } from '@/lib/supabase/server';
import { EmptyState } from '@/features/dashboard/components/empty-state';
import { getDictionary } from '@/i18n/get-dictionary';

export const metadata: Metadata = { title: 'Investments' };
export const dynamic = 'force-dynamic';

type CircleRow = {
  jamiya: { id: string; name: string; slug: string; currency: string } | null;
};

type ProjectRow = {
  id: string;
  name: string;
  status: string;
  principal: number;
  current_value: number;
  currency: string;
  jamiya_id: string;
};

export default async function InvestPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login?next=/finance/invest');

  const { dict } = await getDictionary();
  const labels = dict.finance;
  const { data } = await supabase
    .from('members')
    .select('jamiya:jamiyas(id, name, slug, currency)')
    .eq('user_id', user.id)
    .eq('status', 'active');

  const circles = ((data ?? []) as unknown as CircleRow[])
    .map((row) => row.jamiya)
    .filter((j): j is NonNullable<typeof j> => Boolean(j?.slug));

  const jamiyaIds = circles.map((c) => c.id);
  const { data: projectData } = jamiyaIds.length
    ? await supabase
        .from('circle_investments')
        .select('id, name, status, principal, current_value, currency, jamiya_id')
        .in('jamiya_id', jamiyaIds)
        .in('status', ['planned', 'active'])
        .order('started_on', { ascending: false })
    : { data: [] };

  const projects = (projectData ?? []) as ProjectRow[];
  const circleById = new Map(circles.map((c) => [c.id, c]));

  const options = [
    {
      title: labels.investSharesTitle,
      body: labels.investSharesBody,
      href: circles[0]
        ? (`/circles/${circles[0].slug}/shares` as Route)
        : ('/circles/new' as Route),
      cta: circles.length ? labels.investSharesCta : labels.investSharesJoinCta,
    },
    {
      title: labels.investTreasuryTitle,
      body: labels.investTreasuryBody,
      href: circles[0]
        ? (`/circles/${circles[0].slug}/treasury` as Route)
        : ('/circles/new' as Route),
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
          {labels.eyebrow}
        </p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight md:text-4xl">
          {labels.investTitle}
        </h1>
        <p className="mt-2 max-w-xl text-muted-foreground">{labels.investDesc}</p>
        {circles.length > 1 ? (
          <p className="mt-2 max-w-xl text-sm text-muted-foreground">{labels.investMultiHint}</p>
        ) : null}
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

      {projects.length > 0 ? (
        <section className="space-y-3">
          <h2 className="text-lg font-bold tracking-tight">{labels.investActiveProjects}</h2>
          <p className="text-sm text-muted-foreground">{labels.investActiveProjectsDesc}</p>
          <ul className="divide-y divide-border border-y border-border">
            {projects.map((project) => {
              const circle = circleById.get(project.jamiya_id);
              if (!circle) return null;
              const currency = project.currency || circle.currency || 'KES';
              return (
                <li
                  key={project.id}
                  className="flex flex-wrap items-center justify-between gap-3 py-4"
                >
                  <div>
                    <p className="font-medium">{project.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {circle.name} · {project.status}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-3">
                    <p className="text-sm font-semibold tabular-nums">
                      {formatCurrency(Number(project.current_value ?? 0), currency)}
                    </p>
                    <Button asChild size="sm" variant="outline">
                      <Link href={`/circles/${circle.slug}/treasury` as Route}>
                        {labels.investTreasuryCta}
                      </Link>
                    </Button>
                    <Button asChild size="sm" variant="ghost">
                      <Link href={`/circles/${circle.slug}/statement` as Route}>
                        {labels.investStatementCta}
                      </Link>
                    </Button>
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}

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
                  <Button asChild size="sm" variant="ghost">
                    <Link href={`/circles/${circle.slug}/statement` as Route}>
                      {labels.investStatementCta}
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
            actionLabel={labels.investSharesJoinCta}
            actionHref={'/circles/new' as Route}
          />
        )}
      </section>
    </div>
  );
}
