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
}: {
  labels: Dictionary['profile'];
  continueHref?: string;
  profileCompleted: boolean;
  hasPhone: boolean;
}) {
  const dest = safeContinuePath(continueHref);
  const nameDone = profileCompleted;
  const phoneDone = hasPhone;
  const ready = nameDone && phoneDone;

  return (
    <section className="amanah-surface space-y-4 border-primary/25 px-4 py-4 md:px-5">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-primary">
          {labels.onboardingEyebrow}
        </p>
        <h2 className="mt-1 text-xl font-bold tracking-tight">{labels.onboardingTitle}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{labels.onboardingBody}</p>
      </div>

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
      </div>
    </section>
  );
}

/** Helper for callers that already have a raw phone string. */
export function hasValidProfilePhone(phone: string | null | undefined): boolean {
  return Boolean(phone?.trim() && isValidKeMobile(phone));
}
