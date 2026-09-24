import type { Metadata } from 'next';
import Link from 'next/link';
import type { Route } from 'next';
import { redirect } from 'next/navigation';
import { formatDate } from '@jamiya/shared';
import { Button } from '@jamiya/ui';
import { ChevronRight } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { signOutAction } from '@/features/auth';
import { resolveVerificationState } from '@/features/profile/lib/verification-state';
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
import { AppPage, PageHeader } from '@/components/app-page';
import { ShareAppInvite } from '@/components/share-app-invite';
import { getDictionary } from '@/i18n/get-dictionary';
import { getSiteUrl } from '@/lib/site-url';

export const metadata: Metadata = {
  title: 'You',
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
    redirect(`/login?next=${encodeURIComponent(profilePath)}`);
  }

  const { dict } = await getDictionary();
  const labels = dict.profile;

  const [{ data: profileData }, { data: docsData }, { data: referralData }, { data: latestIprs }] =
    await Promise.all([
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
    supabase
      .from('iprs_verifications')
      .select('provider, matched, created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  const profile = profileData as unknown as ProfileRow | null;
  const docs = (docsData ?? []) as unknown as KycRow[];
  const hasPhone = hasValidProfilePhone(profile?.phone);
  const hasMpesa = Boolean(profile?.mpesa_phone?.trim() || (hasPhone && profile?.phone));
  const referrals = (referralData ?? []) as unknown as Array<{
    id: string;
    status: string;
    reward_amount: number | string;
    currency: string;
    created_at: string;
  }>;
  const iprsProvider =
    (latestIprs as { provider?: string } | null)?.provider ?? null;

  const verification = resolveVerificationState({
    kycStatus: profile?.kyc_status,
    docs,
    iprsProvider,
    iprsStatus: profile?.iprs_status,
  });

  const setupSteps = [
    {
      done: hasPhone,
      label: labels.scoreStepPhone,
      href: '/profile#personal-details' as Route,
    },
    {
      done: Boolean(profile?.profile_completed && profile?.full_name?.trim()),
      label: labels.scoreStepProfile,
      href: '/profile#personal-details' as Route,
    },
    {
      done: hasMpesa,
      label: labels.mpesaLinkage,
      href: '/profile#mpesa' as Route,
    },
    {
      done: verification.setupComplete,
      label: verification.setupComplete
        ? labels.scoreStepKyc
        : verification.state === 'not_started'
          ? 'Complete verification'
          : verification.label,
      href: '/profile#kyc-documents' as Route,
    },
  ];
  const openSteps = setupSteps.filter((s) => !s.done);
  const setupComplete = openSteps.length === 0;

  const youLinks: Array<{ href: Route; title: string; meta: string | null }> = [
    {
      href: '/profile#kyc-documents' as Route,
      title: labels.linkVerification,
      meta: verification.label,
    },
    { href: '/zakat' as Route, title: labels.linkZakat, meta: null },
    { href: '/shariah' as Route, title: 'Shariah', meta: null },
    { href: '/help' as Route, title: labels.linkHelp, meta: null },
    { href: '/support' as Route, title: labels.linkSupportJameiyah, meta: null },
  ];

  return (
    <AppPage width="medium">
      {onboarding ? (
        <ProfileOnboardingBanner
          labels={labels}
          continueHref={continueHref}
          profileCompleted={Boolean(profile?.profile_completed && profile?.full_name?.trim())}
          hasPhone={hasPhone}
          verificationComplete={verification.setupComplete}
        />
      ) : null}

      <PageHeader
        title={profile?.full_name?.trim() || labels.youFallback}
        subtitle={profile?.phone || profile?.email || user.email || '—'}
      />

      <section className="space-y-2.5">
        <h2 className="text-sm font-semibold text-foreground">Invite someone to try</h2>
        <div className="amanah-surface space-y-3 px-4 py-4 sm:px-5">
          <p className="text-sm text-muted-foreground">
            Send a WhatsApp message with a link to start on Jameiyah. They sign in, then create or
            join a circle.
          </p>
          <ShareAppInvite siteUrl={getSiteUrl()} />
        </div>
      </section>

      <section
        className={
          setupComplete
            ? 'amanah-surface space-y-2 px-4 py-4 sm:px-5'
            : 'amanah-surface space-y-3 border-primary/20 px-4 py-4 sm:px-5'
        }
      >
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-primary">
            {setupComplete ? labels.setupDone : labels.setupTitle}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            {setupComplete
              ? labels.scoreHint
              : `${openSteps.length} step${openSteps.length === 1 ? '' : 's'} left`}
          </p>
        </div>
        {!setupComplete ? (
          <ul className="divide-y divide-border/70 overflow-hidden rounded-lg border border-border/70">
            {openSteps.map((step) => (
              <li key={step.label}>
                <Link
                  href={step.href}
                  className="flex min-h-11 items-center justify-between gap-3 px-3.5 py-3 text-sm font-semibold text-foreground transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                >
                  <span className="min-w-0 truncate">{step.label}</span>
                  <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">{labels.scoreNotCredit}</p>
        )}
      </section>

      <section id="verification-status" className="space-y-2.5">
        <h2 className="text-sm font-semibold text-foreground">{labels.linkVerification}</h2>
        <div className="amanah-surface space-y-3.5 px-4 py-4 sm:px-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-semibold text-foreground">{verification.label}</p>
            <StatusBadge status={verification.state} />
          </div>
          <p className="text-sm text-muted-foreground">{verification.detail}</p>
          <p className="text-sm font-medium text-foreground">Next: {verification.nextAction}</p>
          {verification.state !== 'approved' ? (
            <Button asChild variant="outline" className="min-h-11 w-full sm:w-auto">
              <a href={verification.nextHref}>{verification.nextAction}</a>
            </Button>
          ) : null}
        </div>
      </section>

      <section className="space-y-2.5">
        <h2 className="text-sm font-semibold text-foreground">Shortcuts</h2>
        <ul className="amanah-surface divide-y divide-border/70">
          {youLinks.map((item) => (
            <li key={item.href}>
              <Link
                href={item.href}
                className="flex min-h-11 items-center justify-between gap-3 px-4 py-3 text-sm font-semibold text-foreground transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 sm:px-5"
              >
                <span className="min-w-0">
                  <span className="block truncate">{item.title}</span>
                  {item.meta ? (
                    <span className="mt-0.5 block truncate text-xs font-normal capitalize text-muted-foreground">
                      {String(item.meta).replaceAll('_', ' ')}
                    </span>
                  ) : null}
                </span>
                <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <div className="amanah-surface flex min-h-11 items-center justify-between gap-3 px-4 py-3 sm:px-5">
        <p className="text-sm font-semibold text-foreground">{labels.appearance}</p>
        <ThemeToggle variant="segmented" />
      </div>

      <section className="grid gap-5 lg:grid-cols-2">
        <div id="personal-details" className="space-y-2.5">
          <h2 className="text-sm font-semibold text-foreground">{labels.personalDetails}</h2>
          <div className="amanah-surface px-4 py-4 sm:px-5">
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
        </div>

        <div id="mpesa" className="space-y-2.5">
          <h2 className="text-sm font-semibold text-foreground">{labels.mpesaLinkage}</h2>
          <div className="amanah-surface px-4 py-4 sm:px-5">
            <MpesaLinkForm
              labels={labels}
              defaultPhone={profile?.mpesa_phone ?? profile?.phone ?? ''}
            />
          </div>
        </div>
      </section>

      <details className="amanah-surface overflow-hidden">
        <summary className="cursor-pointer px-4 py-4 text-sm font-semibold text-foreground sm:px-5">
          {labels.moreAccount}
        </summary>
        <div className="space-y-6 border-t border-border/70 px-4 py-5 sm:px-5">
          <ReferralPanel
            labels={labels}
            referralCode={profile?.referral_code ?? null}
            referrals={referrals}
          />

          <div className="space-y-2.5">
            <h2 className="text-sm font-semibold text-foreground">IPRS identity</h2>
            <IprsVerifyForm
              defaultFirstName={(profile?.full_name ?? '').split(' ')[0] ?? ''}
              defaultLastName={(profile?.full_name ?? '').split(' ').slice(1).join(' ')}
              defaultNationalId={profile?.national_id ?? ''}
              iprsStatus={profile?.iprs_status ?? 'not_checked'}
            />
            {verification.state === 'simulated' ? (
              <p className="mt-3 text-xs text-amber-800 dark:text-amber-300">
                Demo IPRS does not approve live KYC. Upload documents below for real review.
              </p>
            ) : null}
          </div>

          <div id="kyc-documents" className="space-y-3">
            <h2 className="text-sm font-semibold text-foreground">{labels.kycDocuments}</h2>
            <KycUploadForm labels={labels} />
            <div className="space-y-2.5 border-t border-border/70 pt-4">
              <h3 className="text-sm font-semibold text-foreground">{labels.uploadedFiles}</h3>
              {docs.length === 0 ? (
                <p className="text-sm text-muted-foreground">{labels.noDocuments}</p>
              ) : (
                <ul className="divide-y divide-border/70">
                  {docs.map((doc) => (
                    <li key={doc.id} className="flex items-center justify-between gap-3 py-3">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold capitalize text-foreground">
                          {doc.document_type.replaceAll('_', ' ')}
                        </p>
                        <p className="mt-0.5 text-xs text-muted-foreground">
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
        </div>
      </details>

      <form action={signOutAction}>
        <Button type="submit" variant="outline" className="min-h-11 w-full">
          {dict.common.signOut}
        </Button>
      </form>
    </AppPage>
  );
}
