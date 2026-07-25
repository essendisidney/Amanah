import type { Metadata } from 'next';
import { AuthCard, LoginForm } from '@/features/auth';

export const metadata: Metadata = {
  title: 'Sign in',
};

type SearchParams = Promise<{ next?: string; error?: string }>;

export default async function LoginPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;

  return (
    <AuthCard
      title="Welcome back"
      description="Sign in to manage your circles, contributions, and payouts."
    >
      <LoginForm next={params.next ?? '/dashboard'} error={params.error} />
    </AuthCard>
  );
}
