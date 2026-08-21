import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getAuthUser } from '@/lib/supabase/auth';
import { getInsightsData } from '@/features/insights/lib/get-insights-data';
import { InsightsView } from '@/features/insights/components/insights-view';
import { getDictionary } from '@/i18n/get-dictionary';

export const metadata: Metadata = {
  title: 'Insights',
};

export const dynamic = 'force-dynamic';

export default async function FinanceInsightsPage() {
  const [{ user }, { dict }] = await Promise.all([getAuthUser(), getDictionary()]);
  if (!user) redirect('/phone?next=/finance/insights');

  const data = await getInsightsData(user.id);
  return (
    <InsightsView
      data={data}
      contributionLabels={dict.contributionCard}
      payLabels={dict.paySheet}
    />
  );
}
