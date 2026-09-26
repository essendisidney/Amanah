import type { Metadata } from 'next';
import type { Route } from 'next';
import { redirect } from 'next/navigation';
import { formatCurrency } from '@jamiya/shared';
import { createClient } from '@/lib/supabase/server';
import { PaySheet } from '@/features/wallet/components/pay-sheet';
import { NextContributionCard } from '@/features/circles/components/next-contribution-card';
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
  const payPhone = data.profile?.mpesa_phone || data.profile?.phone || '';

  return (
    <AppPage width="medium">
      <PageHeader title={dict.paySheet.title} subtitle={dict.paySheet.subtitle} />
      {data.contributions.length > 0 ? (
        <div className="mb-5 space-y-3">
          {data.contributions.map((due) => (
            <NextContributionCard
              key={due.id}
              contributionId={due.id}
              slug={due.jamiyaSlug}
              amount={due.amount}
              amountPaid={due.amountPaid}
              currency={due.currency}
              dueDate={due.dueDate}
              status={due.status}
              walletAvailable={available}
              walletCurrency={currency}
              circleName={due.jamiyaName}
              defaultPhone={payPhone}
              showAnchor={false}
              showCalendar={false}
              labels={dict.contributionCard}
            />
          ))}
        </div>
      ) : null}
      <PaySheet
        labels={dict.paySheet}
        available={available}
        currency={currency}
        dues={data.contributions.length > 0 ? [] : dues}
        hideDueList={data.contributions.length > 0}
      />
    </AppPage>
  );
}
