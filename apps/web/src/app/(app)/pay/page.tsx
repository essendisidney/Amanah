import type { Metadata } from 'next';
import type { Route } from 'next';
import { redirect } from 'next/navigation';
import { formatCurrency } from '@jamiya/shared';
import { createClient } from '@/lib/supabase/server';
import { PaySheet } from '@/features/wallet/components/pay-sheet';
import { CircleNoticeBanner } from '@/features/circles/components/circle-notice-banner';
import { NextContributionCard } from '@/features/circles/components/next-contribution-card';
import { PayIntoCircleForm } from '@/features/circles/components/pay-into-circle-form';
import { isShareDividendKind } from '@/features/circles/lib/circle-mode';
import { getDashboardData } from '@/features/dashboard';
import { getDictionary } from '@/i18n/get-dictionary';
import { AppPage, PageHeader } from '@/components/app-page';

export const metadata: Metadata = {
  title: 'Pay',
};

export const dynamic = 'force-dynamic';

type Props = {
  searchParams?: Promise<{ notice?: string; noticeType?: string }>;
};

export default async function PayPage({ searchParams }: Props) {
  const notices = (await searchParams) ?? {};
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
  const openDueCircleIds = new Set(data.contributions.map((due) => due.jamiyaId));
  const shareCircles = data.jamiyas.filter(
    (circle) =>
      circle.jamiya.status === 'active' &&
      isShareDividendKind(circle.jamiya.challengeKind) &&
      !openDueCircleIds.has(circle.jamiya.id),
  );

  return (
    <AppPage width="medium">
      <PageHeader title={dict.paySheet.title} subtitle={dict.paySheet.subtitle} />
      <CircleNoticeBanner notice={notices.notice} noticeType={notices.noticeType} />
      {shareCircles.length > 0 ? (
        <div className="mb-5 space-y-3">
          {shareCircles.map((circle) => (
            <PayIntoCircleForm
              key={circle.jamiya.id}
              jamiyaId={circle.jamiya.id}
              slug={circle.jamiya.slug}
              circleName={circle.jamiya.name}
              defaultAmount={circle.jamiya.contributionAmount}
              currency={circle.jamiya.currency}
              defaultPhone={payPhone}
              returnTo="/pay"
              anchorId={`pay-into-${circle.jamiya.slug}`}
            />
          ))}
        </div>
      ) : null}
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
              circleName={due.notes ? `${due.jamiyaName} · ${due.notes}` : due.jamiyaName}
              heading={due.notes}
              defaultPhone={payPhone}
              showAnchor={false}
              showCalendar={false}
              returnTo="/pay"
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
