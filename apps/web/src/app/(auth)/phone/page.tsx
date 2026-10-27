import type { Metadata } from 'next';
import { AuthCard, PhoneOtpForm } from '@/features/auth';
import { getDictionary } from '@/i18n/get-dictionary';

export const metadata: Metadata = {
  title: 'Phone sign in',
  description: 'Sign in to Jameiyah with a one-time SMS code. No password needed.',
};

type SearchParams = Promise<{ next?: string }>;

export default async function PhoneAuthPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const { dict } = await getDictionary();
  return (
    <AuthCard
      title={dict.common.signIn}
      description={dict.phoneAuth.phoneHint}
    >
      <PhoneOtpForm next={params.next ?? '/dashboard'} labels={dict.phoneAuth} />
    </AuthCard>
  );
}
