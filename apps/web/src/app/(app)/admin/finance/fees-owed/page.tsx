import type { Metadata } from 'next';
import { callRpc } from '@/lib/supabase/rpc';
import { requireAdminAccess } from '@/features/admin/lib/require-admin';
import {
  FEES_OWED_STATUSES,
  FeesOwedView,
  type FeeOwedRow,
  type FeesOwedStatus,
  type FeesOwedSummary,
} from '@/features/admin/components/fees-owed-view';

export const metadata: Metadata = { title: 'Admin · Fees owed' };
export const dynamic = 'force-dynamic';

type Overview = {
  ok?: boolean;
  error?: string;
  summary?: FeesOwedSummary;
  rows?: FeeOwedRow[];
};

type Props = { searchParams?: Promise<{ status?: string }> };

export default async function AdminFeesOwedPage({ searchParams }: Props) {
  await requireAdminAccess('admin');
  const params = (await searchParams) ?? {};
  const status: FeesOwedStatus = FEES_OWED_STATUSES.some(([s]) => s === params.status)
    ? (params.status as FeesOwedStatus)
    : 'owed';

  const { data, error } = await callRpc('admin_fees_owed_overview', {
    p_status: status,
    p_limit: 200,
  });
  const overview = (data ?? {}) as Overview;
  const failed = error?.message ?? (overview.ok ? null : (overview.error ?? 'unknown'));

  return (
    <FeesOwedView
      status={status}
      summary={overview.summary}
      rows={overview.rows ?? []}
      failed={failed}
    />
  );
}
