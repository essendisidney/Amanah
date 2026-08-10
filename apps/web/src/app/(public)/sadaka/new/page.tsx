import type { Metadata } from 'next';
import Link from 'next/link';
import type { Route } from 'next';
import { redirect } from 'next/navigation';
import { CreateCampaignForm } from '@/features/charity/components/create-campaign-form';
import { createClient } from '@/lib/supabase/server';

export const metadata: Metadata = { title: 'Start a Sadaka campaign' };
export const dynamic = 'force-dynamic';

export default async function NewSadakaCampaignPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login?next=/sadaka/new');

  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <p className="text-sm font-medium uppercase tracking-[0.16em] text-accent">Sadaka</p>
      <h1 className="mt-2 font-[family-name:var(--font-display)] text-4xl font-semibold">
        Create a campaign
      </h1>
      <p className="mt-3 max-w-2xl text-muted-foreground">
        Anyone can submit. Nothing goes live until compliance review — KYC and beneficiary M-Pesa
        are required. Amanah only briefly passes funds through (MVP Option B); live Daraja B2C comes
        later.
      </p>
      <div className="mt-8 rounded-xl border border-border bg-card p-6">
        <CreateCampaignForm />
      </div>
      <p className="mt-6 text-sm">
        <Link href={'/sadaka' as Route} className="text-accent hover:underline">
          Back to Sadaka
        </Link>
      </p>
    </main>
  );
}
