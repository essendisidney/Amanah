import type { Metadata } from 'next';
import { AuthCard, RegisterForm } from '@/features/auth';

export const metadata: Metadata = {
  title: 'Create account',
};

type SearchParams = Promise<{ next?: string }>;

export default async function RegisterPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const next = params.next ?? '/dashboard';

  return (
    <AuthCard
      title="Create your account"
      description="Join with email — or use phone SMS / Google. We’ll continue to where you were headed."
    >
      <RegisterForm next={next} />
    </AuthCard>
  );
}
