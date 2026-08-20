import type { Metadata } from 'next';
import Link from 'next/link';
import type { Route } from 'next';
import { CreateCircleForm } from '@/features/circles';

export const metadata: Metadata = {
  title: 'Create circle',
};

export default function CreateCirclePage() {
  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <div>
        <p className="text-sm font-medium uppercase tracking-[0.16em] text-accent">New circle</p>
        <h1 className="mt-2 font-[family-name:var(--font-display)] text-4xl font-semibold tracking-tight text-foreground">
          Create a circle
        </h1>
        <p className="mt-3 max-w-xl text-muted-foreground">
          Set contribution rules for your rotating savings circle. You become the circle admin
          automatically.
        </p>
        <p className="mt-3 text-sm text-muted-foreground">
          Have an invite?{' '}
          <Link
            href={'/circles#redeem-invite' as Route}
            className="text-accent underline-offset-4 hover:underline"
          >
            Enter your code instead
          </Link>
          .
        </p>
      </div>

      <div className="rounded-xl border border-border bg-card p-6 shadow-[0_1px_0_rgba(26,31,28,0.04)] md:p-8">
        <CreateCircleForm />
      </div>
    </div>
  );
}
