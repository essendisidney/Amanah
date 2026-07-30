import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { formatDate } from '@jamiya/shared';
import { createClient } from '@/lib/supabase/server';
import { StatusBadge } from '@/features/dashboard/components/dashboard-stats';
import { ProfileForm } from '@/features/profile/components/profile-form';
import { KycUploadForm } from '@/features/profile/components/kyc-upload-form';
import { MpesaLinkForm } from '@/features/profile/components/mpesa-link-form';
import { ReferralPanel } from '@/features/profile/components/referral-panel';

export const metadata: Metadata = {
  title: 'Profile',
};

export const dynamic = 'force-dynamic';

type ProfileRow = {
  full_name: string | null;
  email: string | null;
  phone: string | null;
  mpesa_phone: string | null;
  bio: string | null;
  country_code: string | null;
  platform_role: string;
  kyc_status: string;
  profile_completed: boolean;
  referral_code: string | null;
};

type KycRow = {
  id: string;
  document_type: string;
  status: string;
  file_name: string;
  created_at: string;
};

export default async function ProfilePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login?next=/profile');
  }

  const [{ data: profileData }, { data: docsData }, { data: referralData }] = await Promise.all([
    supabase
      .from('profiles')
      .select(
        'full_name, email, phone, mpesa_phone, bio, country_code, platform_role, kyc_status, profile_completed, referral_code',
      )
      .eq('id', user.id)
      .maybeSingle(),
    supabase
      .from('kyc_documents')
      .select('id, document_type, status, file_name, created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(20),
    supabase
      .from('referrals')
      .select('id, status, reward_amount, currency, created_at')
      .or(`referrer_id.eq.${user.id},referee_id.eq.${user.id}`)
      .order('created_at', { ascending: false })
      .limit(20),
  ]);

  const profile = profileData as unknown as ProfileRow | null;
  const docs = (docsData ?? []) as unknown as KycRow[];
  const referrals = (referralData ?? []) as unknown as Array<{
    id: string;
    status: string;
    reward_amount: number | string;
    currency: string;
    created_at: string;
  }>;

  return (
    <div className="space-y-10">
      <div>
        <p className="text-sm font-medium uppercase tracking-[0.16em] text-accent">Account</p>
        <h1 className="mt-2 font-[family-name:var(--font-display)] text-4xl font-semibold tracking-tight">
          Profile
        </h1>
        <p className="mt-2 text-muted-foreground">
          Keep your details current and submit KYC documents for compliance review.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <StatusBadge status={profile?.platform_role ?? 'member'} />
          <StatusBadge status={profile?.kyc_status ?? 'not_started'} />
          <StatusBadge
            status={profile?.profile_completed ? 'active' : 'pending'}
          />
        </div>
      </div>

      <section className="grid gap-8 lg:grid-cols-2">
        <div className="rounded-xl border border-border bg-card p-6">
          <h2 className="mb-4 font-[family-name:var(--font-display)] text-xl font-semibold">
            Personal details
          </h2>
          <p className="mb-4 text-sm text-muted-foreground">
            Email: {profile?.email ?? user.email ?? '—'}
          </p>
          <ProfileForm
            defaultValues={{
              fullName: profile?.full_name ?? '',
              phone: profile?.phone ?? '',
              bio: profile?.bio ?? '',
              countryCode: profile?.country_code ?? '',
            }}
          />
        </div>

        <div className="rounded-xl border border-border bg-card p-6">
          <h2 className="mb-4 font-[family-name:var(--font-display)] text-xl font-semibold">
            M-Pesa linkage
          </h2>
          <MpesaLinkForm defaultPhone={profile?.mpesa_phone ?? profile?.phone ?? ''} />
        </div>

        <ReferralPanel referralCode={profile?.referral_code ?? null} referrals={referrals} />

        <div className="space-y-6">
          <div className="rounded-xl border border-border bg-card p-6">
            <h2 className="mb-4 font-[family-name:var(--font-display)] text-xl font-semibold">
              KYC documents
            </h2>
            <KycUploadForm />
          </div>

          <div className="rounded-xl border border-border bg-card p-6">
            <h2 className="mb-4 font-[family-name:var(--font-display)] text-xl font-semibold">
              Uploaded files
            </h2>
            {docs.length === 0 ? (
              <p className="text-sm text-muted-foreground">No documents uploaded yet.</p>
            ) : (
              <ul className="divide-y divide-border">
                {docs.map((doc) => (
                  <li key={doc.id} className="flex items-center justify-between gap-3 py-3">
                    <div>
                      <p className="text-sm font-medium capitalize">
                        {doc.document_type.replaceAll('_', ' ')}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {doc.file_name} · {formatDate(doc.created_at)}
                      </p>
                    </div>
                    <StatusBadge status={doc.status} />
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
