import type { Metadata } from 'next';
import { AuthCard, ResetPasswordForm } from '@/features/auth';

export const metadata: Metadata = {
  title: 'Set new password',
  description: 'Choose a new password for your Jameiyah account.',
};

export default function ResetPasswordPage() {
  return (
    <AuthCard
      title="Choose a new password"
      description="Use a strong password with upper, lower, and numeric characters."
    >
      <ResetPasswordForm />
    </AuthCard>
  );
}
