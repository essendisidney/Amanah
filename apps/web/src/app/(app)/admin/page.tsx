import type { Metadata } from 'next';
import Link from 'next/link';
import type { Route } from 'next';
import { Button } from '@jamiya/ui';
import { createClient } from '@/lib/supabase/server';
import { requireAdminAccess } from '@/features/admin/lib/require-admin';

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
      blurb: 'Personal and circle documents waiting for approve or reject.',
      cta: 'Review KYC',
      priority: 1,
    },
    {
      href: '/admin/withdrawals' as Route,
      title: 'Money out',
      count: moneyOutCount,
      blurb: 'Withdrawals and second approvals that need a different admin.',
      cta: 'Open Money out',
      priority: 2,
    },
    {
      href: '/admin/sadaka' as Route,
      title: 'Sadaka & institutions',
      count: sadakaCount,
      blurb: 'Campaigns to go live and institutions to verify.',
      cta: 'Review Sadaka',
      priority: 3,
    },
    {
      href: '/admin/disputes' as Route,
      title: 'Disputes',
      count: openDisputes.count ?? 0,
      blurb: 'Member disputes still open or under review.',
      cta: 'Open disputes',
      priority: 4,
    },
    {
      href: '/admin/tawarruq' as Route,
      title: 'Tawarruq',
      count: pendingTawarruq.count ?? 0,
      blurb: 'Partner finance applications needing a status update.',
      cta: 'Open Tawarruq',
      priority: 5,
    },
  ];

  const actionable = queues
    .filter((q) => q.count > 0)
    .sort((a, b) => b.count - a.count || a.priority - b.priority);
  const clear = queues.filter((q) => q.count === 0);
  const totalWaiting = queues.reduce((sum, q) => sum + q.count, 0);

  return (
    <div className="space-y-8">
      <section className="amanah-surface space-y-3 border-primary/20 px-4 py-5 md:px-5">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-accent">
          Today
        </p>
        <p className="amanah-money text-4xl font-bold tracking-tight">
          {totalWaiting === 0 ? 'All clear' : totalWaiting}
        </p>
        <p className="max-w-xl text-sm text-muted-foreground">
          {totalWaiting === 0
            ? 'Nothing needs you right now. Check More for users, circles, and health.'
            : `${actionable.length} queue${actionable.length === 1 ? '' : 's'} need attention. Start at the top.`}
        </p>
        {actionable[0] ? (
          <Button asChild className="min-h-11 w-full sm:w-auto">
            <Link href={actionable[0].href}>
              Start with {actionable[0].title} ({actionable[0].count})
            </Link>
          </Button>
        ) : null}
      </section>

      {actionable.length > 0 ? (
        <section className="space-y-3">
          <h2 className="text-lg font-bold tracking-tight">Needs action</h2>
          <ul className="divide-y divide-border border-y border-border">
            {actionable.map((item) => (
              <li
                key={item.href}
                className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-semibold">{item.title}</h3>
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
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Caught up
          </h2>
          <ul className="space-y-1 text-sm text-muted-foreground">
            {clear.map((item) => (
              <li key={item.href}>
                <Link href={item.href} className="hover:text-foreground hover:underline">
                  {item.title}
                </Link>
                {' · '}0 waiting
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
