import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { PaySheet } from '@/features/wallet/components/pay-sheet';
import { getDictionary } from '@/i18n/get-dictionary';

export const metadata: Metadata = {
  title: 'Pay',
};

export const dynamic = 'force-dynamic';

export default async function PayPage() {
  const [{ dict }, supabase] = await Promise.all([getDictionary(), createClient()]);
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/phone?next=/pay');
  }

  return <PaySheet labels={dict.paySheet} />;
}
