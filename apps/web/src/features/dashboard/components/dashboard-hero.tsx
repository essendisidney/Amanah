import Link from 'next/link';
import type { Route } from 'next';
import { Button } from '@jamiya/ui';
import type { DashboardProfile } from '../types';

export function DashboardHero({
  profile,
  email,
}: {
  profile: DashboardProfile | null;
  email: string | null | undefined;
}) {
  const firstName = profile?.full_name?.split(/\s+/)[0];

  return (
    <div className="flex flex-col gap-6 border-b border-border/70 pb-8 lg:flex-row lg:items-end lg:justify-between">
      <div>
        <p className="text-sm font-medium uppercase tracking-[0.16em] text-accent">
          Member home
        </p>
        <h1 className="mt-2 font-[family-name:var(--font-display)] text-4xl font-semibold tracking-tight text-foreground md:text-5xl">
          Assalamu alaikum{firstName ? `, ${firstName}` : ''}
        </h1>
        <p className="mt-3 max-w-xl text-muted-foreground">
          Track your circles, contributions, and payout turns in one place.
          {profile && !profile.profile_completed
            ? ' Complete your profile to unlock invitations and KYC.'
            : null}
        </p>
        <p className="mt-2 text-sm text-muted-foreground">
          Signed in as {profile?.email ?? email ?? '—'}
        </p>
      </div>

      <div className="flex flex-wrap gap-3">
        <Button asChild>
          <Link href={'/circles/new' as Route}>Create circle</Link>
        </Button>
        <Button asChild variant="outline">
          <Link href={'/circles' as Route}>My circles</Link>
        </Button>
        {profile && !profile.profile_completed ? (
          <Button asChild variant="accent">
            <Link href={'/profile' as Route}>Complete profile</Link>
          </Button>
        ) : null}
      </div>
    </div>
  );
}
