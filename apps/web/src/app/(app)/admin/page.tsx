import type { Metadata } from 'next';
import Link from 'next/link';
import type { Route } from 'next';
import { Button } from '@jamiya/ui';
import { createClient } from '@/lib/supabase/server';
import { requireAdminAccess } from '@/features/admin/lib/require-admin';
import { AdminSectionHeader } from '@/features/admin/components/admin-section-header';

export const metadata: Metadata = { title: 'Admin' };
export const dynamic = 'force-dynamic';

type QueueItem = {
  href: Route;
  title: string;
  count: number;
  blurb: string;
  cta: string;
  priority: number;
};

export default async function AdminOverviewPage() {
  await requireAdminAccess('compliance');
  const supabase = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any;

  const [
    pendingKyc,
    pendingCircleKyc,
    pendingWithdrawals,
    dualPending,
    pendingSadaka,
    openDisputes,
    pendingTawarruq,
    pendingInstitutions,
  ] = await Promise.all([
    supabase
      .from('kyc_documents')
      .select('id', { count: 'exact', head: true })
      .in('status', ['uploaded', 'under_review']),
    supabase
      .from('jamiya_kyc_documents')
      .select('id', { count: 'exact', head: true })
      .in('status', ['uploaded', 'under_review']),
    supabase
      .from('withdrawal_requests')
      .select('id', { count: 'exact', head: true })
      .in('status', ['pending', 'processing']),
    db
      .from('dual_approval_requests')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'pending'),
    supabase
      .from('charity_campaigns')
      .select('id', { count: 'exact', head: true })
      .in('status', ['pending_review', 'draft']),
    supabase
      .from('disputes')
      .select('id', { count: 'exact', head: true })
      .in('status', ['open', 'under_review']),
    supabase
      .from('tawarruq_applications')
      .select('id', { count: 'exact', head: true })
      .in('status', ['submitted', 'under_review', 'pending']),
    supabase
      .from('sadaka_institutions')
      .select('id', { count: 'exact', head: true })
      .eq('verification_status', 'pending_verification'),
  ]);

  const kycCount = (pendingKyc.count ?? 0) + (pendingCircleKyc.count ?? 0);
  const moneyOutCount = (pendingWithdrawals.count ?? 0) + (dualPending.count ?? 0);
  const sadakaCount = (pendingSadaka.count ?? 0) + (pendingInstitutions.count ?? 0);

  const queues: QueueItem[] = [
    {
      href: '/admin/kyc' as Route,
      title: 'KYC review',
      count: kycCount,
      blurb: 'Personal and circle documents.',
      cta: 'Review',
      priority: 1,
    },
    {
      href: '/admin/withdrawals' as Route,
      title: 'Money out',
      count: moneyOutCount,
      blurb: 'Withdrawals and second approvals.',
      cta: 'Open',
      priority: 2,
    },
    {
      href: '/admin/sadaka' as Route,
      title: 'Sadaka',
      count: sadakaCount,
      blurb: 'Campaigns and institutions.',
      cta: 'Review',
      priority: 3,
    },
    {
      href: '/admin/disputes' as Route,
      title: 'Disputes',
      count: openDisputes.count ?? 0,
      blurb: 'Open or under review.',
      cta: 'Open',
      priority: 4,
    },
    {
      href: '/admin/tawarruq' as Route,
      title: 'Tawarruq',
      count: pendingTawarruq.count ?? 0,
      blurb: 'Partner applications.',
      cta: 'Open',
      priority: 5,
    },
  ];

  const actionable = queues
    .filter((q) => q.count > 0)
    .sort((a, b) => b.count - a.count || a.priority - b.priority);
  const clear = queues.filter((q) => q.count === 0);
  const totalWaiting = queues.reduce((sum, q) => sum + q.count, 0);

  return (
    <div className="space-y-6">
      <AdminSectionHeader
        title="Inbox"
        subtitle={
          totalWaiting === 0
            ? 'Nothing waiting right now.'
            : `${totalWaiting} item${totalWaiting === 1 ? '' : 's'} across ${actionable.length} queue${actionable.length === 1 ? '' : 's'}.`
        }
      />

      <section className="amanah-surface space-y-3 px-4 py-4 sm:px-5">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
          Today
        </p>
        <p className="amanah-money text-3xl font-semibold tracking-tight sm:text-4xl">
          {totalWaiting === 0 ? 'All clear' : totalWaiting}
        </p>
        <div className="flex flex-wrap gap-2">
          {actionable[0] ? (
            <Button asChild className="min-h-11 w-full sm:w-auto">
              <Link href={actionable[0].href}>
                Start with {actionable[0].title} ({actionable[0].count})
              </Link>
            </Button>
          ) : null}
          <Button asChild variant="outline" className="min-h-11 w-full sm:w-auto">
            <Link href={'/admin/insights' as Route}>Insights</Link>
          </Button>
        </div>
      </section>

      {actionable.length > 0 ? (
        <section className="space-y-2.5">
          <h3 className="text-sm font-semibold text-foreground">Needs action</h3>
          <ul className="amanah-surface divide-y divide-border/70">
            {actionable.map((item) => (
              <li
                key={item.href}
                className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-semibold text-foreground">{item.title}</p>
                    <span className="inline-flex min-w-7 items-center justify-center rounded-md bg-primary px-2 py-0.5 text-xs font-bold text-primary-foreground">
                      {item.count}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">{item.blurb}</p>
                </div>
                <Button asChild className="min-h-11 w-full shrink-0 sm:w-auto">
                  <Link href={item.href}>{item.cta}</Link>
                </Button>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {clear.length > 0 ? (
        <section className="space-y-2">
          <h3 className="text-sm font-semibold text-muted-foreground">Caught up</h3>
          <ul className="amanah-surface divide-y divide-border/70 text-sm">
            {clear.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className="flex min-h-11 items-center justify-between gap-3 px-4 py-3 text-muted-foreground transition-colors hover:bg-muted/40 hover:text-foreground sm:px-5"
                >
                  <span>{item.title}</span>
                  <span>0</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
