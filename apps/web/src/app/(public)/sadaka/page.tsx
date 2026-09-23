import Link from 'next/link';
import type { Route } from 'next';
import { ChevronRight } from 'lucide-react';
import { formatCurrency } from '@jamiya/shared';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

type Campaign = {
  id: string;
  slug: string;
  title: string;
  summary: string;
  goal_amount: number | string;
  raised_amount: number | string;
  currency: string;
  sharia_board_endorsed: boolean;
  category: string | null;
  fee_bps: number;
  status: string;
  cover_image_url: string | null;
};

const CATEGORY_LABELS: Record<string, string> = {
  medical: 'Medical',
  funeral: 'Funeral',
  education: 'Education',
  business_startup: 'Business startup',
  emergency_disaster: 'Emergency / disaster',
  institutional: 'Institutional',
};

type Props = { searchParams: Promise<{ category?: string; amount?: string; from?: string }> };

export default async function SadakaPage({ searchParams }: Props) {
  const { category, amount, from } = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let isCircleMember = false;
  if (user) {
    const { count } = await supabase
      .from('members')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('status', 'active');
    isCircleMember = (count ?? 0) > 0;
  }

  let query = supabase
    .from('charity_campaigns')
    .select(
      'id, slug, title, summary, goal_amount, raised_amount, currency, sharia_board_endorsed, category, fee_bps, status, cover_image_url',
    )
    .in('status', ['live', 'funded', 'disbursed'])
    .order('created_at', { ascending: false });

  if (category && CATEGORY_LABELS[category]) {
    query = query.eq('category', category);
  }

  const { data } = await query;
  const campaigns = (data ?? []) as unknown as Campaign[];

  const startHref = (
    isCircleMember
      ? '/sadaka/new'
      : user
        ? '/circles'
        : '/login?next=/sadaka/new'
  ) as Route;
  const startLabel = isCircleMember
    ? 'Start a campaign'
    : user
      ? 'Join a circle first'
      : 'Sign in to start';

  const shortcuts: Array<{ href: Route | string; title: string; meta: string }> = [
    { href: startHref, title: startLabel, meta: 'Members' },
    { href: '#active-campaigns', title: 'Active campaigns', meta: 'Give' },
    {
      href: (user ? '/sadaka/my' : '/login?next=/sadaka/my') as Route,
      title: 'My campaigns',
      meta: 'Yours',
    },
    { href: '/sadaka/adopt' as Route, title: 'Adopt an institution', meta: 'Monthly' },
  ];

  const zakatAmount = from === 'zakat' ? Number(amount) : NaN;
  const hasZakatAmount = Number.isFinite(zakatAmount) && zakatAmount >= 10;

  return (
    <main className="space-y-6 py-6 sm:py-10">
      <header className="space-y-2">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-primary">
          Give with care
        </p>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
          Sadaka
        </h1>
        <p className="max-w-2xl text-sm text-muted-foreground sm:text-base">
          Approved causes anyone can support.
        </p>
      </header>

      {hasZakatAmount ? (
        <div className="amanah-surface space-y-1 px-4 py-4 sm:px-5">
          <p className="text-sm font-semibold text-foreground">Pay your zakat estimate</p>
          <p className="text-sm text-muted-foreground">
            Suggested gift: KES {Math.round(zakatAmount).toLocaleString()}. Pick a live campaign
            below — amount carries over.
          </p>
        </div>
      ) : null}

      <section className="space-y-2.5">
        <h2 className="text-sm font-semibold text-foreground">Shortcuts</h2>
        <ul className="amanah-surface divide-y divide-border/70">
          {shortcuts.map((item) => (
            <li key={item.title}>
              <Link
                href={item.href as Route}
                className="flex min-h-11 items-center justify-between gap-3 px-4 py-3 text-sm transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 sm:px-5"
              >
                <span>
                  <span className="block font-semibold text-foreground">{item.title}</span>
                  <span className="mt-0.5 block text-xs text-muted-foreground">{item.meta}</span>
                </span>
                <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <div className="flex flex-wrap gap-2">
        <Link
          href={'/sadaka' as Route}
          className={`inline-flex min-h-11 items-center rounded-md px-3 text-sm font-semibold ${
            !category
              ? 'bg-primary text-primary-foreground'
              : 'border border-border/70 text-foreground'
          }`}
        >
          All
        </Link>
        {Object.entries(CATEGORY_LABELS).map(([value, label]) => (
          <Link
            key={value}
            href={`/sadaka?category=${value}` as Route}
            className={`inline-flex min-h-11 items-center rounded-md px-3 text-sm font-semibold ${
              category === value
                ? 'bg-primary text-primary-foreground'
                : 'border border-border/70 text-foreground'
            }`}
          >
            {label}
          </Link>
        ))}
      </div>

      <section className="space-y-2.5" aria-labelledby="active-campaigns">
        <h2
          id="active-campaigns"
          className="scroll-mt-24 text-sm font-semibold text-foreground"
        >
          Active campaigns
        </h2>
        {campaigns.length ? (
          <ul className="amanah-surface divide-y divide-border/70">
            {campaigns.map((campaign) => {
              const goal = Number(campaign.goal_amount);
              const raised = Number(campaign.raised_amount);
              const progress = Math.min(100, Math.round((raised / Math.max(goal, 1)) * 100));
              return (
                <li key={campaign.id}>
                  <Link
                    href={
                      (hasZakatAmount
                        ? `/sadaka/${campaign.slug}?amount=${Math.round(zakatAmount)}&from=zakat`
                        : `/sadaka/${campaign.slug}`) as Route
                    }
                    className="block px-4 py-4 transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 sm:px-5"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0 flex-1 space-y-1">
                        <p className="font-semibold text-foreground">{campaign.title}</p>
                        <p className="line-clamp-2 text-sm text-muted-foreground">
                          {campaign.summary}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {[
                            campaign.category
                              ? CATEGORY_LABELS[campaign.category] ?? campaign.category
                              : null,
                            campaign.sharia_board_endorsed ? 'Sharia endorsed' : null,
                            campaign.status !== 'live' ? campaign.status : null,
                          ]
                            .filter(Boolean)
                            .join(' · ')}
                        </p>
                      </div>
                      <p className="shrink-0 text-sm font-semibold text-foreground">
                        {formatCurrency(raised, campaign.currency)}
                      </p>
                    </div>
                    <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full bg-primary"
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                    <p className="mt-1.5 text-xs text-muted-foreground">
                      {progress}% of {formatCurrency(goal, campaign.currency)}
                    </p>
                  </Link>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="amanah-surface px-4 py-5 text-sm text-muted-foreground sm:px-5">
            No active campaigns yet.
          </p>
        )}
      </section>
    </main>
  );
}
