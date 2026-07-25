import type { Metadata } from 'next';
import { AuthCard, ForgotPasswordForm } from '@/features/auth';

export const metadata: Metadata = {
  title: 'Forgot password',
};

export default function ForgotPasswordPage() {
  return (
    <AuthCard
      title="Reset your password"
      description="Enter your email and we’ll send a secure reset link."
    >
      <ForgotPasswordForm />
    </AuthCard>
  );
}
