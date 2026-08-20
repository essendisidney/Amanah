import type { Metadata } from 'next';
import Link from 'next/link';
import { APP_NAME } from '@jamiya/shared';
import { WelcomeIntentForm } from '@/features/auth/components/welcome-intent-form';

export const metadata: Metadata = {
  title: 'Welcome',
};

export default function WelcomePage() {
  return (
    <div className="mx-auto w-full max-w-md space-y-8">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-accent">
          Welcome to {APP_NAME}
        </p>
        <h1 className="mt-3 text-3xl font-bold tracking-tight">
          Save together.
          <br />
          Build together.
          <br />
          Prosper together.
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
          What brings you to Amanah today?
        </p>
      </div>
      <WelcomeIntentForm />
      <p className="text-center text-sm text-muted-foreground">
        Already have an account?{' '}
        <Link href="/phone" className="font-semibold text-primary hover:underline">
          Sign in with phone
        </Link>
      </p>
    </div>
  );
}
