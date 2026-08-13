import Link from 'next/link';
import type { Route } from 'next';
import { Button } from '@jamiya/ui';
import type { Dictionary } from '@/i18n/dictionaries';
import { t } from '@/i18n/dictionaries';
import type { DashboardProfile } from '../types';

export function DashboardHero({
  profile,
  email,
  labels,
}: {
  profile: DashboardProfile | null;
  email: string | null | undefined;
  labels: Dictionary['dashboard'];
}) {
  const firstName = profile?.full_name?.split(/\s+/)[0];

  return (
    <div className="flex flex-col gap-4 border-b border-border/70 pb-6 md:gap-6 md:pb-8 lg:flex-row lg:items-end lg:justify-between">
      <div>
        <p className="hidden text-sm font-medium uppercase tracking-[0.16em] text-accent sm:block">
          {labels.eyebrow}
        </p>
        <h1 className="font-[family-name:var(--font-display)] text-3xl font-semibold tracking-tight text-foreground sm:mt-2 md:text-5xl">
          {labels.greeting}
          {firstName ? `, ${firstName}` : ''}
        </h1>
        <p className="mt-2 max-w-xl text-sm text-muted-foreground md:mt-3 md:text-base">
          {labels.subtitle}
          {profile && !profile.profile_completed ? labels.completeProfileHint : null}
        </p>
        <p className="mt-1 hidden text-sm text-muted-foreground sm:block">
          {t(labels.signedInAs, { who: profile?.email ?? email ?? '—' })}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:gap-3">
        <Button asChild className="min-h-11">
          <Link href={'/circles/new' as Route}>{labels.createCircle}</Link>
        </Button>
        <Button asChild variant="outline" className="min-h-11">
          <Link href={'/circles' as Route}>{labels.myCircles}</Link>
        </Button>
        {profile && !profile.profile_completed ? (
          <Button asChild variant="accent" className="col-span-2 min-h-11 sm:col-span-1">
            <Link href={'/profile' as Route}>{labels.completeProfile}</Link>
          </Button>
        ) : null}
      </div>
    </div>
  );
}
