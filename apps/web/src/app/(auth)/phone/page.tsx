import type { Metadata } from 'next';
import { AuthCard, PhoneOtpForm } from '@/features/auth';

export const metadata: Metadata = {
  title: 'Phone sign in',
};

type SearchParams = Promise<{ next?: string }>;

export default async function PhoneAuthPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  return (
    <AuthCard
      title="Sign in with phone"
      description="Kenya mobile OTP — the fastest way to join and manage your circle."
    >
      <PhoneOtpForm next={params.next ?? '/dashboard'} />
    </AuthCard>
  );
}
