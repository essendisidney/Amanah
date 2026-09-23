import type { Metadata } from 'next';
import Link from 'next/link';
import type { Route } from 'next';
import { redirect } from 'next/navigation';
import { Button } from '@jamiya/ui';
import { CreateCampaignForm } from '@/features/charity/components/create-campaign-form';
import { createClient } from '@/lib/supabase/server';

export const metadata: Metadata = { title: 'Start a Sadaka campaign' };
export const dynamic = 'force-dynamic';

type KycDoc = {
  id: string;
  document_type: string;
  storage_path: string;
  file_name: string | null;
  status: string;
};

export default async function NewSadakaCampaignPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login?next=/sadaka/new');

  const { count } = await supabase
    .from('members')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .eq('status', 'active');
  const isCircleMember = (count ?? 0) > 0;

  if (!isCircleMember) {
    return (
      <main className="space-y-6 py-6 sm:py-10">
        <header className="space-y-2">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-primary">
            Sadaka
          </p>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
            Members start campaigns
          </h1>
          <p className="text-sm text-muted-foreground">
            Join a circle first. Anyone can still give to live campaigns.
          </p>
        </header>
        <div className="flex flex-wrap gap-2">
          <Button asChild className="min-h-11">
            <Link href={'/circles' as Route}>Circles</Link>
          </Button>
          <Button asChild variant="outline" className="min-h-11">
            <Link href={'/sadaka' as Route}>Active campaigns</Link>
          </Button>
        </div>
      </main>
    );
  }

  const { data: docs } = await supabase
    .from('kyc_documents')
    .select('id, document_type, storage_path, file_name, status')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(20);

  return (
    <main className="space-y-6 py-6 sm:py-10">
      <header className="space-y-2">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-primary">Sadaka</p>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Create a campaign</h1>
        <p className="text-sm text-muted-foreground">
          Story, target, and docs — live after admin review.
        </p>
      </header>
      <div className="amanah-surface px-4 py-4 sm:px-5">
        <CreateCampaignForm kycDocs={(docs ?? []) as unknown as KycDoc[]} />
      </div>
      <p className="text-sm text-muted-foreground">
        <Link href={'/sadaka' as Route} className="font-semibold text-primary hover:underline">
          Back to Sadaka
        </Link>
        {' · '}
        <Link href={'/profile' as Route} className="font-semibold text-primary hover:underline">
          KYC on You
        </Link>
      </p>
    </main>
  );
}
