import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { formatDate } from '@jamiya/shared';
import { Button } from '@jamiya/ui';
import { createClient } from '@/lib/supabase/server';
import { signOutAction } from '@/features/auth';
import { StatusBadge } from '@/features/dashboard/components/dashboard-stats';
import { ProfileForm } from '@/features/profile/components/profile-form';
import { KycUploadForm } from '@/features/profile/components/kyc-upload-form';
import { IprsVerifyForm } from '@/features/profile/components/iprs-verify-form';
import { MpesaLinkForm } from '@/features/profile/components/mpesa-link-form';
import { ReferralPanel } from '@/features/profile/components/referral-panel';
import { ProfileOnboardingBanner } from '@/features/profile/components/profile-onboarding-banner';
import { getDictionary } from '@/i18n/get-dictionary';
import { t } from '@/i18n/dictionaries';

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
  national_id: string | null;
  iprs_status: string | null;
};

type KycRow = {
  id: string;
  document_type: string;
  status: string;
  file_name: string;
  created_at: string;
  rejection_reason: string | null;
};

type Props = {
  searchParams?: Promise<{ onboarding?: string; next?: string }>;
};

export default async function ProfilePage({ searchParams }: Props) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login?next=/profile');
  }

  const params = (await searchParams) ?? {};
  const onboarding = params.onboarding === '1';
  const continueHref = params.next;

  const { dict } = await getDictionary();
  const labels = dict.profile;

  const [{ data: profileData }, { data: docsData }, { data: referralData }] = await Promise.all([
    supabase
      .from('profiles')
      .select(
        'full_name, email, phone, mpesa_phone, bio, country_code, platform_role, kyc_status, profile_completed, referral_code, national_id, iprs_status',
      )
      .eq('id', user.id)
      .maybeSingle(),
    supabase
      .from('kyc_documents')
      .select('id, document_type, status, file_name, created_at, rejection_reason')
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
      {onboarding ? (
        <ProfileOnboardingBanner
          continueHref={continueHref}
          profileCompleted={Boolean(profile?.profile_completed && profile?.full_name?.trim())}
          hasKycDoc={docs.length > 0}
        />
      ) : null}

      <div>
        <p className="text-sm font-medium uppercase tracking-[0.16em] text-accent">
          {labels.eyebrow}
        </p>
        <h1 className="mt-2 font-[family-name:var(--font-display)] text-4xl font-semibold tracking-tight">
          {labels.title}
        </h1>
        <p className="mt-2 text-muted-foreground">{labels.subtitle}</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <StatusBadge status={profile?.platform_role ?? 'member'} />
          <StatusBadge status={profile?.kyc_status ?? 'not_started'} />
          <StatusBadge
            status={profile?.profile_completed ? 'active' : 'pending'}
          />
        </div>
      </div>

      <section className="grid gap-8 lg:grid-cols-2">
        <div id="personal-details" className="rounded-xl border border-border bg-card p-6">
          <h2 className="mb-4 font-[family-name:var(--font-display)] text-xl font-semibold">
            {labels.personalDetails}
          </h2>
          <p className="mb-4 text-sm text-muted-foreground">
            {t(labels.email, { email: profile?.email ?? user.email ?? '—' })}
          </p>
          <ProfileForm
            labels={labels}
            continueHref={onboarding ? continueHref : undefined}
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
            {labels.mpesaLinkage}
          </h2>
          <MpesaLinkForm
            labels={labels}
            defaultPhone={profile?.mpesa_phone ?? profile?.phone ?? ''}
          />
        </div>

        <ReferralPanel
          labels={labels}
          referralCode={profile?.referral_code ?? null}
          referrals={referrals}
        />

        <div className="rounded-xl border border-border bg-card p-6">
          <h2 className="mb-4 font-[family-name:var(--font-display)] text-xl font-semibold">
            IPRS identity (Kenya)
          </h2>
          <IprsVerifyForm
            defaultFirstName={(profile?.full_name ?? '').split(' ')[0] ?? ''}
            defaultLastName={(profile?.full_name ?? '').split(' ').slice(1).join(' ')}
            defaultNationalId={profile?.national_id ?? ''}
            iprsStatus={profile?.iprs_status ?? 'not_checked'}
          />
        </div>

        <div className="space-y-6">
          <div id="kyc-documents" className="rounded-xl border border-border bg-card p-6">
            <h2 className="mb-4 font-[family-name:var(--font-display)] text-xl font-semibold">
              {labels.kycDocuments}
            </h2>
            <KycUploadForm labels={labels} />
          </div>

          <div className="rounded-xl border border-border bg-card p-6">
            <h2 className="mb-4 font-[family-name:var(--font-display)] text-xl font-semibold">
              {labels.uploadedFiles}
            </h2>
            {docs.length === 0 ? (
              <p className="text-sm text-muted-foreground">{labels.noDocuments}</p>
            ) : (
              <ul className="divide-y divide-border">
                {docs.map((doc) => (
                  <li key={doc.id} className="flex items-center justify-between gap-3 py-3">
                    <div className="min-w-0">
                      <p className="text-sm font-medium capitalize">
                        {doc.document_type.replaceAll('_', ' ')}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {doc.file_name} · {formatDate(doc.created_at)}
                      </p>
                      {doc.status === 'rejected' && doc.rejection_reason ? (
                        <p className="mt-1 text-xs text-destructive">
                          Reason: {doc.rejection_reason}
                        </p>
                      ) : null}
                    </div>
                    <StatusBadge status={doc.status} />
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </section>

      <section className="rounded-xl border border-border bg-card p-6 sm:hidden">
        <h2 className="mb-2 font-[family-name:var(--font-display)] text-xl font-semibold">
          {dict.common.signOut}
        </h2>
        <p className="mb-4 text-sm text-muted-foreground">{dict.common.signOutHint}</p>
        <form action={signOutAction}>
          <Button type="submit" variant="outline" className="min-h-11 w-full">
            {dict.common.signOut}
          </Button>
        </form>
      </section>
    </div>
  );
}
