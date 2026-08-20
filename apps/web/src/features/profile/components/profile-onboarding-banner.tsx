import Link from 'next/link';
import type { Route } from 'next';
import { Button } from '@jamiya/ui';

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
  continueHref,
  profileCompleted,
  hasKycDoc,
}: {
  continueHref?: string;
  profileCompleted: boolean;
  hasKycDoc: boolean;
}) {
  const dest = safeContinuePath(continueHref);
  const nameDone = profileCompleted;
  const kycDone = hasKycDoc;

  return (
    <section className="amanah-surface space-y-4 border-primary/25 px-4 py-4 md:px-5">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-primary">
          Finish setting up
        </p>
        <h2 className="mt-1 text-xl font-bold tracking-tight">Welcome to Amanah</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Add your name so your circle knows you. KYC is recommended before large transfers —
          you can finish it now or later.
        </p>
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
            Save your full name
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
            {kycDone ? '✓' : '2'}
          </span>
          <span className={kycDone ? 'text-muted-foreground line-through' : 'font-medium'}>
            Upload a KYC document (optional)
          </span>
        </li>
      </ol>

      <div className="flex flex-col gap-2 sm:flex-row">
        {nameDone ? (
          <Button asChild className="min-h-11">
            <Link href={dest}>Continue to Amanah</Link>
          </Button>
        ) : (
          <Button asChild variant="outline" className="min-h-11">
            <a href="#personal-details">Add your name below</a>
          </Button>
        )}
        {!kycDone ? (
          <Button asChild variant="ghost" className="min-h-11">
            <a href="#kyc-documents">Go to KYC</a>
          </Button>
        ) : null}
        {nameDone ? null : (
          <Button asChild variant="ghost" size="sm" className="min-h-11">
            <Link href={dest}>Skip for now</Link>
          </Button>
        )}
      </div>
    </section>
  );
}
