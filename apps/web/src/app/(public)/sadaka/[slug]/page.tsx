import { notFound } from 'next/navigation';
import { formatCurrency } from '@jamiya/shared';
import { Button, Input, Label } from '@jamiya/ui';
import { donateFormAction } from '@/features/charity/actions';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

type Props = { params: Promise<{ slug: string }> };
type Campaign = {
  id: string; slug: string; title: string; summary: string; description: string | null;
  goal_amount: number | string; raised_amount: number | string; currency: string;
  fee_mode: string; fee_bps: number; sharia_board_endorsed: boolean;
};

export default async function CampaignPage({ params }: Props) {
  const { slug } = await params;
  const supabase = await createClient();
  const { data } = await supabase.from('charity_campaigns')
    .select('id, slug, title, summary, description, goal_amount, raised_amount, currency, fee_mode, fee_bps, sharia_board_endorsed')
    .eq('slug', slug).eq('status', 'live').maybeSingle();
  if (!data) notFound();
  const campaign = data as unknown as Campaign;
  const goal = Number(campaign.goal_amount);
  const raised = Number(campaign.raised_amount);
  const progress = Math.min(100, Math.round((raised / goal) * 100));
  const addon = campaign.fee_mode === 'donation_addon';

  return (
    <main className="mx-auto max-w-4xl px-6 py-12">
      <p className="text-sm font-medium uppercase tracking-[0.16em] text-accent">Public sadaka campaign</p>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <h1 className="font-[family-name:var(--font-display)] text-5xl font-semibold tracking-tight">{campaign.title}</h1>
        {campaign.sharia_board_endorsed ? <span className="rounded-full bg-primary/10 px-3 py-1 text-sm font-medium text-primary">Sharia board endorsed</span> : null}
      </div>
      <p className="mt-5 max-w-2xl text-lg text-muted-foreground">{campaign.description ?? campaign.summary}</p>
      <div className="mt-8">
        <div className="h-3 overflow-hidden rounded-full bg-muted"><div className="h-full bg-primary" style={{ width: `${progress}%` }} /></div>
        <p className="mt-2 text-sm text-muted-foreground">{formatCurrency(raised, campaign.currency)} of {formatCurrency(goal, campaign.currency)} · {progress}% funded</p>
      </div>

      <section className="mt-12 grid gap-10 md:grid-cols-[1fr_0.9fr]">
        <div>
          <h2 className="font-[family-name:var(--font-display)] text-2xl font-semibold">Fee disclosure</h2>
          <p className="mt-3 text-muted-foreground">
            {addon
              ? `${(campaign.fee_bps / 100).toFixed(2)}% is added on top of your gift. The full gift amount reaches this cause.`
              : 'The campaign fee arrangement is shown before your donation is recorded.'}
          </p>
          <p className="mt-2 text-sm text-muted-foreground">The addon model is the current default while the Sharia board completes its final fee-policy review.</p>
        </div>
        <form action={donateFormAction} className="space-y-4 border border-border bg-card p-6">
          <input type="hidden" name="campaignId" value={campaign.id} />
          <input type="hidden" name="slug" value={campaign.slug} />
          <h2 className="font-[family-name:var(--font-display)] text-2xl font-semibold">Make a gift</h2>
          <div className="space-y-2"><Label htmlFor="amount">Amount ({campaign.currency})</Label><Input id="amount" name="amount" type="number" min="10" step="1" required /></div>
          <div className="space-y-2"><Label htmlFor="donorName">Name (optional)</Label><Input id="donorName" name="donorName" /></div>
          <div className="space-y-2"><Label htmlFor="donorPhone">Phone (optional)</Label><Input id="donorPhone" name="donorPhone" type="tel" /></div>
          <label className="flex items-center gap-2 text-sm"><input name="anonymous" type="checkbox" /> Give anonymously</label>
          <Button type="submit">Record donation</Button>
        </form>
      </section>
    </main>
  );
}
