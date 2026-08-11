import Link from 'next/link';
import type { Route } from 'next';
import { notFound } from 'next/navigation';
import { formatCurrency, formatDate } from '@jamiya/shared';
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
  category: string | null;
  beneficiary_name: string | null;
  status: string;
  created_by: string | null;
  rejection_reason: string | null;
  disbursed_amount: number | string | null;
  last_disbursed_at: string | null;
  cover_image_url: string | null;
  public_media_urls: string[] | null;
};

type Disbursement = {
  id: string;
  net_amount: number | string;
  currency: string;
  paid_at: string | null;
  status: string;
};

export default async function CampaignPage({ params }: Props) {
  const { slug } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data } = await supabase
    .from('charity_campaigns')
    .select(
      `id, slug, title, summary, description, goal_amount, raised_amount, currency, fee_mode, fee_bps,
       sharia_board_endorsed, category, beneficiary_name, status, created_by, rejection_reason,
       disbursed_amount, last_disbursed_at, cover_image_url, public_media_urls`,
    )
    .eq('slug', slug)
    .maybeSingle();

  if (!data) notFound();
  const campaign = data as unknown as Campaign;
  const isCreator = Boolean(user && campaign.created_by === user.id);
  const publicOk = ['live', 'funded', 'disbursed', 'closed'].includes(campaign.status);
  if (!publicOk && !isCreator) notFound();

  const goal = Number(campaign.goal_amount);
  const raised = Number(campaign.raised_amount);
  const progress = Math.min(100, Math.round((raised / Math.max(goal, 1)) * 100));
  const addon = campaign.fee_mode === 'donation_addon';
  const feePct = (campaign.fee_bps / 100).toFixed(2);
  const canDonate = campaign.status === 'live';

  const { data: disbursementsData } = await supabase
    .from('charity_disbursements')
    .select('id, net_amount, currency, paid_at, status')
    .eq('campaign_id', campaign.id)
    .eq('status', 'paid')
    .order('created_at', { ascending: false })
    .limit(10);
  const disbursements = (disbursementsData ?? []) as unknown as Disbursement[];

  return (
    <main className="mx-auto max-w-4xl px-6 py-12">
      <p className="text-sm font-medium uppercase tracking-[0.16em] text-accent">
        Sadaka campaign
        {campaign.category ? ` · ${campaign.category.replaceAll('_', ' ')}` : ''}
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <h1 className="font-[family-name:var(--font-display)] text-5xl font-semibold tracking-tight">
          {campaign.title}
        </h1>
        <span className="rounded-md border border-border px-3 py-1 text-sm capitalize">
          {campaign.status.replace(/_/g, ' ')}
        </span>
        {campaign.sharia_board_endorsed ? (
          <span className="rounded-md bg-primary/10 px-3 py-1 text-sm font-medium text-primary">
            Sharia board endorsed
          </span>
        ) : campaign.status === 'live' ? (
          <span className="rounded-md border border-border px-3 py-1 text-sm text-muted-foreground">
            Fee policy under Sharia review
          </span>
        ) : null}
      </div>

      {campaign.cover_image_url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={campaign.cover_image_url}
          alt=""
          className="mt-6 aspect-[16/9] w-full rounded-xl object-cover"
        />
      ) : null}

      {campaign.status === 'pending_review' ? (
        <p className="mt-4 rounded-md border border-border bg-muted/40 px-4 py-3 text-sm">
          Waiting for admin review. This campaign is not public yet — only you and compliance can see
          it.
        </p>
      ) : null}
      {campaign.status === 'rejected' && campaign.rejection_reason ? (
        <p className="mt-4 rounded-md border border-destructive/40 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          Rejected: {campaign.rejection_reason}
        </p>
      ) : null}
      {campaign.status === 'funded' ? (
        <p className="mt-4 rounded-md border border-border bg-muted/40 px-4 py-3 text-sm">
          Target reached. Contributions are closed. Funds are being released to the beneficiary
          M-Pesa.
        </p>
      ) : null}
      {campaign.status === 'disbursed' ? (
        <p className="mt-4 rounded-md border border-border bg-muted/40 px-4 py-3 text-sm">
          Campaign complete — raised funds have been sent to the beneficiary.
        </p>
      ) : null}

      <p className="mt-5 max-w-2xl text-lg text-muted-foreground">
        {campaign.description ?? campaign.summary}
      </p>
      {campaign.beneficiary_name ? (
        <p className="mt-3 text-sm text-muted-foreground">
          Beneficiary: {campaign.beneficiary_name}
        </p>
      ) : null}

      {(campaign.public_media_urls ?? []).length > 0 ? (
        <section className="mt-8">
          <h2 className="font-[family-name:var(--font-display)] text-xl font-semibold">
            Photos
          </h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {(campaign.public_media_urls ?? []).map((url) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                key={url}
                src={url}
                alt=""
                className="aspect-[4/3] w-full rounded-lg object-cover"
              />
            ))}
          </div>
        </section>
      ) : null}

      <div className="mt-8">
        <div className="h-3 overflow-hidden rounded-full bg-muted">
          <div className="h-full bg-primary" style={{ width: `${progress}%` }} />
        </div>
        <p className="mt-2 text-sm text-muted-foreground">
          {formatCurrency(raised, campaign.currency)} of{' '}
          {formatCurrency(goal, campaign.currency)} · {progress}% funded
        </p>
        {Number(campaign.disbursed_amount ?? 0) > 0 ? (
          <p className="mt-1 text-sm font-medium">
            Sent to beneficiary:{' '}
            {formatCurrency(Number(campaign.disbursed_amount), campaign.currency)}
            {campaign.last_disbursed_at ? ` on ${formatDate(campaign.last_disbursed_at)}` : ''}
          </p>
        ) : null}
      </div>

      {disbursements.length ? (
        <section className="mt-8 space-y-2">
          <h2 className="font-[family-name:var(--font-display)] text-xl font-semibold">
            Disbursement log
          </h2>
          <ul className="text-sm text-muted-foreground">
            {disbursements.map((d) => (
              <li key={d.id}>
                Sent {formatCurrency(Number(d.net_amount), d.currency)}
                {d.paid_at ? ` on ${formatDate(d.paid_at)}` : ''}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="mt-12 grid gap-10 md:grid-cols-[1fr_0.9fr]">
        <div>
          <h2 className="font-[family-name:var(--font-display)] text-2xl font-semibold">
            Fee disclosure
          </h2>
          <p className="mt-3 text-muted-foreground">
            {addon
              ? `${feePct}% platform fee is added on top of your gift. 100% of the gift amount reaches this cause.`
              : `${feePct}% platform fee is deducted from your payment. The remaining net amount reaches this cause.`}
          </p>
          {!user && canDonate ? (
            <p className="mt-4 text-sm text-muted-foreground">
              You do not need an Amanah account to contribute. Sign in only if you want M-Pesa STK
              tied to your wallet profile.{' '}
              <Link href={`/login?next=/sadaka/${slug}` as Route} className="underline">
                Sign in
              </Link>
            </p>
          ) : null}
        </div>
        {canDonate ? (
          <DonateForm
            campaignId={campaign.id}
            slug={campaign.slug}
            currency={campaign.currency}
            feeMode={campaign.fee_mode}
            feeBps={campaign.fee_bps}
          />
        ) : (
          <p className="text-sm text-muted-foreground">
            {campaign.status === 'pending_review'
              ? 'Contributions open after admin approval.'
              : 'This campaign is not accepting contributions right now.'}
          </p>
        )}
      </section>
    </main>
  );
}
