import type { Metadata } from 'next';
import { AuthCard, PhoneOtpForm } from '@/features/auth';

export const metadata: Metadata = {
  title: 'Phone sign in',
};

export default function PhoneAuthPage() {
  return (
    <AuthCard
      title="Sign in with phone"
      description="We’ll text you a one-time code. Standard SMS rates may apply."
    >
      <PhoneOtpForm />
    </AuthCard>
  );
}
