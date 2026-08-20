import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { PaySheet } from '@/features/wallet/components/pay-sheet';

export const metadata: Metadata = {
  title: 'Pay',
};

export const dynamic = 'force-dynamic';

export default async function PayPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/phone?next=/pay');
  }

  return <PaySheet />;
}
