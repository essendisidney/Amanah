import type { Metadata } from 'next';
import Link from 'next/link';
import type { Route } from 'next';
import { redirect } from 'next/navigation';
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
      <main className="mx-auto max-w-3xl px-6 py-12">
        <p className="text-sm font-medium uppercase tracking-[0.16em] text-accent">Sadaka</p>
        <h1 className="mt-2 font-[family-name:var(--font-display)] text-4xl font-semibold">
          Members start campaigns
        </h1>
        <p className="mt-3 max-w-2xl text-muted-foreground">
          You need an active circle membership to submit a Sadaka campaign. Anyone can still
          contribute to active campaigns without joining.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link
            href={'/circles' as Route}
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
          >
            Browse circles
          </Link>
          <Link href={'/sadaka' as Route} className="rounded-md border border-border px-4 py-2 text-sm">
            View active campaigns
          </Link>
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
    <main className="mx-auto max-w-3xl px-6 py-12">
      <p className="text-sm font-medium uppercase tracking-[0.16em] text-accent">Sadaka</p>
      <h1 className="mt-2 font-[family-name:var(--font-display)] text-4xl font-semibold">
        Create a campaign
      </h1>
      <p className="mt-3 max-w-2xl text-muted-foreground">
        Submit your story, target, beneficiary M-Pesa, and supporting documentation. An admin must
        confirm before the campaign goes live. When the target is reached, funds are released to the
        beneficiary.
      </p>
      <div className="mt-8 rounded-xl border border-border bg-card p-6">
        <CreateCampaignForm kycDocs={(docs ?? []) as unknown as KycDoc[]} />
      </div>
      <p className="mt-6 text-sm">
        <Link href={'/sadaka' as Route} className="text-accent hover:underline">
          Back to Sadaka
        </Link>
        {' · '}
        <Link href={'/profile' as Route} className="text-accent hover:underline">
          Upload KYC docs in Profile
        </Link>
      </p>
    </main>
  );
}
