import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { DashboardView, getDashboardData } from '@/features/dashboard';
import { getDictionary } from '@/i18n/get-dictionary';
import { getAuthUser } from '@/lib/supabase/auth';

export const metadata: Metadata = {
  title: 'Home',
};

export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  const [{ user }, { dict }] = await Promise.all([getAuthUser(), getDictionary()]);

  if (!user) {
    redirect('/login?next=/dashboard');
  }

  const data = await getDashboardData(user.id);

  return (
    <DashboardView
      data={data}
      email={user.email}
      labels={dict.dashboard}
      common={dict.common}
    />
  );
}
