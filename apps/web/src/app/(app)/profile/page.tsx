import type { Metadata } from 'next';
import Link from 'next/link';
import type { Route } from 'next';
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
import {
  ProfileOnboardingBanner,
  hasValidProfilePhone,
} from '@/features/profile/components/profile-onboarding-banner';
import { ThemeToggle } from '@/components/theme-toggle';
import { getDictionary } from '@/i18n/get-dictionary';

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
  const params = (await searchParams) ?? {};
  const onboarding = params.onboarding === '1';
  const continueHref = params.next;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    const nextBits = new URLSearchParams();
    if (onboarding) nextBits.set('onboarding', '1');
    if (continueHref) nextBits.set('next', continueHref);
    const profilePath = nextBits.toString()
      ? `/profile?${nextBits.toString()}`
      : '/profile';
    redirect(`/phone?next=${encodeURIComponent(profilePath)}`);
  }

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
  const hasPhone = hasValidProfilePhone(profile?.phone);
  const referrals = (referralData ?? []) as unknown as Array<{
    id: string;
    status: string;
    reward_amount: number | string;
    currency: string;
    created_at: string;
  }>;

  const amanahScore = Math.min(
    850,
    620 +
      (profile?.kyc_status === 'approved' ? 80 : 0) +
      (profile?.profile_completed ? 40 : 0) +
      (hasPhone ? 30 : 0) +
      Math.min(docs.length, 3) * 15,
  );
  const scoreLabel =
    amanahScore >= 750 ? 'Excellent' : amanahScore >= 680 ? 'Strong' : 'Building';

  const youLinks: Array<{ href: Route; title: string; meta: string | null }> = [
    { href: '/wallet', title: 'Money', meta: null },
    { href: '/finance/goals', title: 'Goals', meta: null },
    { href: '/profile#kyc-documents' as Route, title: 'Verification', meta: profile?.kyc_status ?? null },
    { href: '/sadaka', title: 'Sadaka', meta: null },
    { href: '/zakat', title: 'Zakat', meta: null },
    { href: '/support', title: 'Support', meta: null },
  ];

  return (
    <div className="mx-auto w-full max-w-[390px] space-y-10 md:max-w-2xl">
      {onboarding ? (
        <ProfileOnboardingBanner
          continueHref={continueHref}
          profileCompleted={Boolean(profile?.profile_completed && profile?.full_name?.trim())}
          hasPhone={hasPhone}
          hasKycDoc={docs.length > 0}
        />
      ) : null}

      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">
          {profile?.full_name?.trim() || 'You'}
        </h1>
        <p className="text-sm text-muted-foreground">
          {profile?.phone || profile?.email || user.email || '—'}
        </p>
      </header>

      <Link
        href={'/finance/insights' as Route}
        className="amanah-forest block rounded-[1.5rem] px-5 py-5 transition-transform active:scale-[0.99]"
      >
        <p className="text-xs font-medium uppercase tracking-[0.14em] text-white/55">
          Amanah Score
        </p>
        <div className="mt-2 flex items-end justify-between gap-3">
          <p className="amanah-money text-4xl font-bold tracking-tight text-primary">{amanahScore}</p>
          <span className="text-sm font-medium text-primary">{scoreLabel}</span>
        </div>
      </Link>

      <ul className="divide-y divide-border/40">
        {youLinks.map((item) => (
          <li key={item.href}>
            <Link
              href={item.href}
              className="flex items-center justify-between gap-3 py-4 text-[15px] font-medium"
            >
              <span>{item.title}</span>
              <span className="text-sm font-normal capitalize text-muted-foreground">
                {item.meta ? String(item.meta).replaceAll('_', ' ') : '›'}
              </span>
            </Link>
          </li>
        ))}
      </ul>

      <section className="flex items-center justify-between gap-3 py-1">
        <p className="text-sm text-muted-foreground">Appearance</p>
        <ThemeToggle variant="segmented" />
      </section>

      <section className="grid gap-8 lg:grid-cols-2">
        <div id="personal-details" className="space-y-4">
          <h2 className="text-base font-semibold">{labels.personalDetails}</h2>
          <ProfileForm
            labels={labels}
            continueHref={onboarding ? continueHref : undefined}
            requirePhone={onboarding || !hasPhone}
            defaultValues={{
              fullName: profile?.full_name ?? '',
              phone: profile?.phone ?? '',
              bio: profile?.bio ?? '',
              countryCode: profile?.country_code ?? '',
            }}
          />
        </div>

        <div className="space-y-4">
          <h2 className="text-base font-semibold">{labels.mpesaLinkage}</h2>
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

        <div className="space-y-4">
          <h2 className="text-base font-semibold">IPRS identity</h2>
          <IprsVerifyForm
            defaultFirstName={(profile?.full_name ?? '').split(' ')[0] ?? ''}
            defaultLastName={(profile?.full_name ?? '').split(' ').slice(1).join(' ')}
            defaultNationalId={profile?.national_id ?? ''}
            iprsStatus={profile?.iprs_status ?? 'not_checked'}
          />
        </div>

        <div className="space-y-6 lg:col-span-2">
          <div id="kyc-documents" className="space-y-4">
            <h2 className="text-base font-semibold">{labels.kycDocuments}</h2>
            <KycUploadForm labels={labels} />
          </div>

          <div className="space-y-3">
            <h2 className="text-base font-semibold">{labels.uploadedFiles}</h2>
            {docs.length === 0 ? (
              <p className="text-sm text-muted-foreground">{labels.noDocuments}</p>
            ) : (
              <ul className="divide-y divide-border/40">
                {docs.map((doc) => (
                  <li key={doc.id} className="flex items-center justify-between gap-3 py-3">
                    <div className="min-w-0">
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

      <form action={signOutAction} className="pb-4">
        <Button type="submit" variant="outline" className="min-h-11 w-full rounded-full">
          {dict.common.signOut}
        </Button>
      </form>
    </div>
  );
}
