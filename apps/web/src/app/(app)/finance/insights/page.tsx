import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getAuthUser } from '@/lib/supabase/auth';
import { getInsightsData } from '@/features/insights/lib/get-insights-data';
import { InsightsView } from '@/features/insights/components/insights-view';

export const metadata: Metadata = {
  title: 'Insights',
};

export const dynamic = 'force-dynamic';

export default async function FinanceInsightsPage() {
  const { user } = await getAuthUser();
  if (!user) redirect('/phone?next=/finance/insights');

  const data = await getInsightsData(user.id);
  return <InsightsView data={data} />;
}
