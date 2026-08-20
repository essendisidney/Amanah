import Link from 'next/link';
import type { Route } from 'next';
import { Button } from '@jamiya/ui';
import { isValidKeMobile } from '@jamiya/shared';
import type { Dictionary } from '@/i18n/dictionaries';

function safeContinuePath(next: string | undefined): Route {
  if (!next || !next.startsWith('/') || next.startsWith('//')) {
    return '/dashboard' as Route;
  }
  if (next.includes('\\') || next.includes('://')) {
    return '/dashboard' as Route;
  }
  return next as Route;
}

export function ProfileOnboardingBanner({
  labels,
  continueHref,
  profileCompleted,
  hasPhone,
  hasKycDoc,
}: {
  labels: Dictionary['profile'];
  continueHref?: string;
  profileCompleted: boolean;
  hasPhone: boolean;
  hasKycDoc: boolean;
}) {
  const dest = safeContinuePath(continueHref);
  const nameDone = profileCompleted;
  const phoneDone = hasPhone;
  const ready = nameDone && phoneDone;
  const kycDone = hasKycDoc;

  return (
    <section className="amanah-surface space-y-4 border-primary/25 px-4 py-4 md:px-5">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-primary">
          {labels.onboardingEyebrow}
        </p>
        <h2 className="mt-1 text-xl font-bold tracking-tight">{labels.onboardingTitle}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{labels.onboardingBody}</p>
      </div>

      <ol className="space-y-2 text-sm">
        <li className="flex items-center gap-2">
          <span
            className={
              nameDone
                ? 'inline-flex h-5 w-5 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground'
                : 'inline-flex h-5 w-5 items-center justify-center rounded-full border border-border text-[10px] font-bold text-muted-foreground'
            }
          >
            {nameDone ? '✓' : '1'}
          </span>
          <span className={nameDone ? 'text-muted-foreground line-through' : 'font-medium'}>
            {labels.onboardingStepName}
          </span>
        </li>
        <li className="flex items-center gap-2">
          <span
            className={
              phoneDone
                ? 'inline-flex h-5 w-5 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground'
                : 'inline-flex h-5 w-5 items-center justify-center rounded-full border border-border text-[10px] font-bold text-muted-foreground'
            }
          >
            {phoneDone ? '✓' : '2'}
          </span>
          <span className={phoneDone ? 'text-muted-foreground line-through' : 'font-medium'}>
            {labels.onboardingStepPhone}
          </span>
        </li>
        <li className="flex items-center gap-2">
          <span
            className={
              kycDone
                ? 'inline-flex h-5 w-5 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground'
                : 'inline-flex h-5 w-5 items-center justify-center rounded-full border border-border text-[10px] font-bold text-muted-foreground'
            }
          >
            {kycDone ? '✓' : '3'}
          </span>
          <span className={kycDone ? 'text-muted-foreground line-through' : 'font-medium'}>
            {labels.onboardingStepKyc}
          </span>
        </li>
      </ol>

      <div className="flex flex-col gap-2 sm:flex-row">
        {ready ? (
          <Button asChild className="min-h-11">
            <Link href={dest}>{labels.onboardingHome}</Link>
          </Button>
        ) : (
          <Button asChild variant="outline" className="min-h-11">
            <a href="#personal-details">
              {!nameDone ? labels.onboardingAddName : labels.onboardingAddPhone}
            </a>
          </Button>
        )}
        {!kycDone ? (
          <Button asChild variant="ghost" className="min-h-11">
            <a href="#kyc-documents">{labels.onboardingVerification}</a>
          </Button>
        ) : null}
      </div>
    </section>
  );
}

/** Helper for callers that already have a raw phone string. */
export function hasValidProfilePhone(phone: string | null | undefined): boolean {
  return Boolean(phone?.trim() && isValidKeMobile(phone));
}
