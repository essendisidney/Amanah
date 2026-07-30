import { notFound } from 'next/navigation';
import { formatCurrency } from '@jamiya/shared';
import { DonateForm } from '@/features/charity/components/donate-form';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

type Props = { params: Promise<{ slug: string }> };
type Campaign = {
  id: string;
  slug: string;
  title: string;
  summary: string;
  description: string | null;
  goal_amount: number | string;
  raised_amount: number | string;
  currency: string;
  fee_mode: string;
  fee_bps: number;
  sharia_board_endorsed: boolean;
};

export default async function CampaignPage({ params }: Props) {
  const { slug } = await params;
  const supabase = await createClient();
  const { data } = await supabase
    .from('charity_campaigns')
    .select(
      'id, slug, title, summary, description, goal_amount, raised_amount, currency, fee_mode, fee_bps, sharia_board_endorsed',
    )
    .eq('slug', slug)
    .eq('status', 'live')
    .maybeSingle();
  if (!data) notFound();
  const campaign = data as unknown as Campaign;
  const goal = Number(campaign.goal_amount);
  const raised = Number(campaign.raised_amount);
  const progress = Math.min(100, Math.round((raised / goal) * 100));
  const addon = campaign.fee_mode === 'donation_addon';
  const feePct = (campaign.fee_bps / 100).toFixed(2);

  return (
    <main className="mx-auto max-w-4xl px-6 py-12">
      <p className="text-sm font-medium uppercase tracking-[0.16em] text-accent">
        Public sadaka campaign
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <h1 className="font-[family-name:var(--font-display)] text-5xl font-semibold tracking-tight">
          {campaign.title}
        </h1>
        {campaign.sharia_board_endorsed ? (
          <span className="rounded-md bg-primary/10 px-3 py-1 text-sm font-medium text-primary">
            Sharia board endorsed
          </span>
        ) : (
          <span className="rounded-md border border-border px-3 py-1 text-sm text-muted-foreground">
            Fee policy under Sharia review
          </span>
        )}
      </div>
      <p className="mt-5 max-w-2xl text-lg text-muted-foreground">
        {campaign.description ?? campaign.summary}
      </p>
      <div className="mt-8">
        <div className="h-3 overflow-hidden rounded-full bg-muted">
          <div className="h-full bg-primary" style={{ width: `${progress}%` }} />
        </div>
        <p className="mt-2 text-sm text-muted-foreground">
          {formatCurrency(raised, campaign.currency)} of{' '}
          {formatCurrency(goal, campaign.currency)} · {progress}% funded
        </p>
      </div>

      <section className="mt-12 grid gap-10 md:grid-cols-[1fr_0.9fr]">
        <div>
          <h2 className="font-[family-name:var(--font-display)] text-2xl font-semibold">
            Fee disclosure
          </h2>
          <p className="mt-3 text-muted-foreground">
            {addon
              ? `${feePct}% platform fee is added on top of your gift. 100% of the gift amount reaches this cause.`
              : `${feePct}% platform fee is deducted from your payment. The remaining net amount reaches this cause. Both figures are shown before you confirm.`}
          </p>
          <p className="mt-2 text-sm text-muted-foreground">
            Default model is fee-on-top (addon) pending final Sharia board sign-off. Campaigns can
            switch to deduct with clear disclosure.
          </p>
        </div>
        <DonateForm
          campaignId={campaign.id}
          slug={campaign.slug}
          currency={campaign.currency}
          feeMode={campaign.fee_mode}
          feeBps={campaign.fee_bps}
        />
      </section>
    </main>
  );
}
