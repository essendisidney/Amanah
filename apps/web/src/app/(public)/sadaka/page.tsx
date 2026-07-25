import Link from 'next/link';
import type { Route } from 'next';
import { formatCurrency } from '@jamiya/shared';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

type Campaign = {
  id: string; slug: string; title: string; summary: string; goal_amount: number | string;
  raised_amount: number | string; currency: string; sharia_board_endorsed: boolean;
};

export default async function SadakaPage() {
  const supabase = await createClient();
  const { data } = await supabase
    .from('charity_campaigns')
    .select('id, slug, title, summary, goal_amount, raised_amount, currency, sharia_board_endorsed')
    .eq('status', 'live')
    .order('created_at', { ascending: false });
  const campaigns = (data ?? []) as unknown as Campaign[];

  return (
    <main className="mx-auto max-w-6xl px-6 py-12">
      <p className="text-sm font-medium uppercase tracking-[0.16em] text-accent">Give with care</p>
      <h1 className="mt-2 font-[family-name:var(--font-display)] text-5xl font-semibold tracking-tight">
        Sadaka
      </h1>
      <p className="mt-4 max-w-2xl text-lg text-muted-foreground">
        Support verified community causes. Every campaign discloses its fee before you give.
      </p>
      <div className="mt-10 space-y-4">
        {campaigns.length ? campaigns.map((campaign) => {
          const goal = Number(campaign.goal_amount);
          const raised = Number(campaign.raised_amount);
          const progress = Math.min(100, Math.round((raised / goal) * 100));
          return (
            <Link key={campaign.id} href={`/sadaka/${campaign.slug}` as Route}
              className="block border-b border-border py-6 transition-colors hover:bg-muted/30">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="font-[family-name:var(--font-display)] text-2xl font-semibold">{campaign.title}</h2>
                    {campaign.sharia_board_endorsed ? <span className="rounded-full bg-primary/10 px-2 py-1 text-xs font-medium text-primary">Sharia board endorsed</span> : null}
                  </div>
                  <p className="mt-2 max-w-2xl text-muted-foreground">{campaign.summary}</p>
                </div>
                <p className="font-semibold">{formatCurrency(raised, campaign.currency)} raised</p>
              </div>
              <div className="mt-5 h-2 w-full overflow-hidden rounded-full bg-muted">
                <div className="h-full rounded-full bg-primary" style={{ width: `${progress}%` }} />
              </div>
              <p className="mt-2 text-sm text-muted-foreground">{progress}% of {formatCurrency(goal, campaign.currency)}</p>
            </Link>
          );
        }) : <p className="py-10 text-muted-foreground">No live campaigns at the moment.</p>}
      </div>
    </main>
  );
}
