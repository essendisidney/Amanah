import type { Metadata } from 'next';
import { AuthCard, RegisterForm } from '@/features/auth';

export const metadata: Metadata = {
  title: 'Create account',
};

export default function RegisterPage() {
  return (
    <AuthCard
      title="Create your account"
      description="Join Amanah to save together with your community — the Shariah-compliant way."
    >
      <RegisterForm />
    </AuthCard>
  );
}
