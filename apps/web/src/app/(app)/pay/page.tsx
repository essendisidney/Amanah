import type { Metadata } from 'next';
import type { Route } from 'next';
import { redirect } from 'next/navigation';
import { formatCurrency } from '@jamiya/shared';
import { createClient } from '@/lib/supabase/server';
import { PaySheet } from '@/features/wallet/components/pay-sheet';
import { getDashboardData } from '@/features/dashboard';
import { getDictionary } from '@/i18n/get-dictionary';
import { AppPage, PageHeader } from '@/components/app-page';

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
    redirect('/login?next=/pay');
  }

  const data = await getDashboardData(user.id, { contributionHorizonDays: null });
  const currency = data.wallet?.currency ?? 'KES';
  const available = data.wallet?.availableBalance ?? data.wallet?.balance ?? 0;

  const dues = data.contributions.map((nextDue) => {
    const remaining = Math.max(nextDue.amount - nextDue.amountPaid, 0);
    const overdue =
      nextDue.status === 'late' || new Date(nextDue.dueDate).getTime() < Date.now();
    return {
      href: `/circles/${nextDue.jamiyaSlug}#pay-due` as Route,
      amountLabel: formatCurrency(remaining, nextDue.currency),
      circleName: nextDue.jamiyaName,
      overdue,
    };
  });

  return (
    <AppPage width="medium">
      <PageHeader title={dict.paySheet.title} subtitle={dict.paySheet.subtitle} />
      <PaySheet
        labels={dict.paySheet}
        available={available}
        currency={currency}
        dues={dues}
      />
    </AppPage>
  );
}
