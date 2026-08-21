import type { Metadata } from 'next';
import type { Route } from 'next';
import { redirect } from 'next/navigation';
import { formatCurrency } from '@jamiya/shared';
import { createClient } from '@/lib/supabase/server';
import { PaySheet } from '@/features/wallet/components/pay-sheet';
import { getDashboardData } from '@/features/dashboard';
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

  const data = await getDashboardData(user.id);
  const nextDue = data.contributions[0] ?? null;
  const currency = data.wallet?.currency ?? 'KES';
  const available = data.wallet?.availableBalance ?? data.wallet?.balance ?? 0;
  const dueHref = nextDue
    ? (`/circles/${nextDue.jamiyaSlug}#pay` as Route)
    : null;
  const dueAmountLabel = nextDue
    ? formatCurrency(
        Math.max(nextDue.amount - nextDue.amountPaid, 0),
        nextDue.currency,
      )
    : null;

  return (
    <PaySheet
      labels={dict.paySheet}
      available={available}
      currency={currency}
      dueHref={dueHref}
      dueAmountLabel={dueAmountLabel}
    />
  );
}
