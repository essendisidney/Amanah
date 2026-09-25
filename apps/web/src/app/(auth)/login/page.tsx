import type { Metadata } from 'next';
import { AuthCard, LoginForm } from '@/features/auth';

export const metadata: Metadata = {
  title: 'Sign in',
};

type SearchParams = Promise<{ next?: string; error?: string }>;

export default async function LoginPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const next = params.next ?? '/dashboard';
  const joining =
    next.includes('/invitations/') || next.includes('/welcome') || next.includes('redeem');

  return (
    <AuthCard
      title={joining ? 'Join Jameiyah' : 'Welcome back'}
      description={
        joining
          ? 'Choose phone SMS, email, or Google — then continue where you left off.'
          : 'Sign in with phone SMS, email, or Google.'
      }
    >
      <LoginForm next={next} error={params.error} isReturning={!joining} />
    </AuthCard>
  );
}
