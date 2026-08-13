import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { DashboardView, getDashboardData } from '@/features/dashboard';
import { getDictionary } from '@/i18n/get-dictionary';

export const metadata: Metadata = {
  title: 'Dashboard',
};

export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login?next=/dashboard');
  }

  const [{ dict }, data] = await Promise.all([
    getDictionary(),
    getDashboardData(user.id),
  ]);

  return (
    <DashboardView
      data={data}
      email={user.email}
      labels={dict.dashboard}
      common={dict.common}
    />
  );
}
