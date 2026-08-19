import Link from 'next/link';
import type { Route } from 'next';
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

type Props = { searchParams: Promise<{ category?: string }> };

export default async function SadakaPage({ searchParams }: Props) {
  const { category } = await searchParams;
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
      ? 'Join a circle to start a campaign'
      : 'Sign in to start a campaign';

  return (
    <main className="py-6 sm:py-10">
      <div>
        <p className="text-xs font-medium uppercase tracking-[0.16em] text-accent sm:text-sm sm:tracking-[0.16em]">
          Give with care
        </p>
        <h1 className="mt-2 font-[family-name:var(--font-display)] text-3xl font-semibold tracking-tight sm:text-5xl">
          Sadaka
        </h1>
        <p className="mt-4 max-w-2xl text-lg text-muted-foreground">
          Members set up campaigns with documentation. Admins approve. Anyone can contribute. When
          the target is reached, funds go to the beneficiary M-Pesa.
        </p>
      </div>

      <section className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3" aria-label="Sadaka options">
        <Link
          href={startHref}
          className="rounded-xl border border-border bg-card p-5 transition-colors hover:border-primary/40 hover:bg-muted/30"
        >
          <p className="text-xs font-medium uppercase tracking-[0.14em] text-accent">Members</p>
          <h2 className="mt-2 font-[family-name:var(--font-display)] text-xl font-semibold">
            {startLabel}
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Submit a cause with KYC docs. It goes to admin review before it goes live.
          </p>
        </Link>

        <a
          href="#active-campaigns"
          className="rounded-xl border border-border bg-card p-5 transition-colors hover:border-primary/40 hover:bg-muted/30"
        >
          <p className="text-xs font-medium uppercase tracking-[0.14em] text-accent">Everyone</p>
          <h2 className="mt-2 font-[family-name:var(--font-display)] text-xl font-semibold">
            Active campaigns
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Browse approved campaigns below and contribute — no membership required.
          </p>
        </a>

        <Link
          href={(user ? '/sadaka/my' : '/login?next=/sadaka/my') as Route}
          className="rounded-xl border border-border bg-card p-5 transition-colors hover:border-primary/40 hover:bg-muted/30"
        >
          <p className="text-xs font-medium uppercase tracking-[0.14em] text-accent">Your space</p>
          <h2 className="mt-2 font-[family-name:var(--font-display)] text-xl font-semibold">
            My campaigns
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Track pending review, live status, and sponsorships you started.
          </p>
        </Link>
      </section>

      <div className="mt-6 flex flex-wrap gap-2">
        <Link
          href={'/sadaka/adopt' as Route}
          className="rounded-md border border-border px-4 py-2 text-sm"
        >
          Adopt an institution
        </Link>
      </div>

      <ol className="mt-8 grid gap-3 text-sm text-muted-foreground sm:grid-cols-3">
        <li className="border-l-2 border-accent pl-3">
          <span className="font-medium text-foreground">1. Member submits</span>
          <br />
          Story, target, beneficiary M-Pesa, and KYC docs.
        </li>
        <li className="border-l-2 border-accent pl-3">
          <span className="font-medium text-foreground">2. Admin approves</span>
          <br />
          Only reviewed campaigns go live here.
        </li>
        <li className="border-l-2 border-accent pl-3">
          <span className="font-medium text-foreground">3. Anyone can give</span>
          <br />
          At target, funds release to the beneficiary.
        </li>
      </ol>

      <div className="mt-10 flex flex-wrap gap-2">
        <Link
          href={'/sadaka' as Route}
          className={`rounded-md px-3 py-1.5 text-sm ${!category ? 'bg-primary text-primary-foreground' : 'border border-border'}`}
        >
          All
        </Link>
        {Object.entries(CATEGORY_LABELS).map(([value, label]) => (
          <Link
            key={value}
            href={`/sadaka?category=${value}` as Route}
            className={`rounded-md px-3 py-1.5 text-sm ${category === value ? 'bg-primary text-primary-foreground' : 'border border-border'}`}
          >
            {label}
          </Link>
        ))}
      </div>

      <h2
        id="active-campaigns"
        className="mt-10 scroll-mt-24 font-[family-name:var(--font-display)] text-2xl font-semibold"
      >
        Active campaigns
      </h2>
      <div className="mt-4 space-y-4">
        {campaigns.length ? (
          campaigns.map((campaign) => {
            const goal = Number(campaign.goal_amount);
            const raised = Number(campaign.raised_amount);
            const progress = Math.min(100, Math.round((raised / Math.max(goal, 1)) * 100));
            const feePct = (campaign.fee_bps / 100).toFixed(2);
            return (
              <Link
                key={campaign.id}
                href={`/sadaka/${campaign.slug}` as Route}
                className="block border-b border-border py-6 transition-colors hover:bg-muted/30"
              >
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    {campaign.cover_image_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={campaign.cover_image_url}
                        alt=""
                        className="mb-4 aspect-[16/9] w-full max-w-xl rounded-lg object-cover"
                      />
                    ) : null}
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-[family-name:var(--font-display)] text-2xl font-semibold">
                        {campaign.title}
                      </h3>
                      {campaign.category ? (
                        <span className="rounded-md border border-border px-2 py-0.5 text-xs">
                          {CATEGORY_LABELS[campaign.category] ?? campaign.category}
                        </span>
                      ) : null}
                      {campaign.sharia_board_endorsed ? (
                        <span className="rounded-full bg-primary/10 px-2 py-1 text-xs font-medium text-primary">
                          Sharia board endorsed
                        </span>
                      ) : null}
                      {campaign.status !== 'live' ? (
                        <span className="rounded-md bg-muted px-2 py-0.5 text-xs">
                          {campaign.status}
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-2 max-w-2xl text-muted-foreground">{campaign.summary}</p>
                    <p className="mt-2 text-xs text-muted-foreground">
                      Platform fee disclosed: {feePct}%
                    </p>
                  </div>
                  <p className="font-semibold">
                    {formatCurrency(raised, campaign.currency)} raised
                  </p>
                </div>
                <div className="mt-5 h-2 w-full overflow-hidden rounded-full bg-muted">
                  <div className="h-full rounded-full bg-primary" style={{ width: `${progress}%` }} />
                </div>
                <p className="mt-2 text-sm text-muted-foreground">
                  {progress}% of {formatCurrency(goal, campaign.currency)}
                  {campaign.status === 'live' ? ' · Contribute' : ''}
                </p>
              </Link>
            );
          })
        ) : (
          <p className="py-10 text-muted-foreground">
            No active campaigns yet. Members can start one for admin review.
          </p>
        )}
      </div>
    </main>
  );
}
