import type { Metadata } from 'next';
import Link from 'next/link';
import type { Route } from 'next';
import { notFound, redirect } from 'next/navigation';
import { formatCurrency } from '@jamiya/shared';
import { Button } from '@jamiya/ui';
import { AppPage, PageHeader } from '@/components/app-page';
import { CircleNoticeBanner } from '@/features/circles/components/circle-notice-banner';
import {
  CircleGoalMemberBoard,
  type GoalContributionEvent,
  type GoalMemberTotal,
} from '@/features/finance/components/circle-goal-member-board';
import { getAuthUser } from '@/lib/supabase/auth';
import { callRpc } from '@/lib/supabase/rpc';

export const metadata: Metadata = { title: 'Circle goal' };
export const dynamic = 'force-dynamic';

type Props = {
  params: Promise<{ slug: string; goalId: string }>;
  searchParams?: Promise<{ notice?: string; noticeType?: string }>;
};

export default async function CircleGoalDetailPage({ params, searchParams }: Props) {
  const { slug, goalId } = await params;
  const notices = (await searchParams) ?? {};
  const { user } = await getAuthUser();
  if (!user) redirect(`/phone?next=/circles/${slug}/goals/${goalId}`);

  const { data, error } = await callRpc('goal_member_totals', { p_goal_id: goalId });
  if (error) {
    return (
      <AppPage width="medium">
        <p className="text-sm text-destructive">{error.message}</p>
        <Button asChild variant="outline" className="rounded-full">
          <Link href={`/circles/${slug}` as Route}>Back to circle</Link>
        </Button>
      </AppPage>
    );
  }

  const payload = data as {
    ok?: boolean;
    error?: string;
    goal?: {
      id: string;
      title: string;
      target_amount: number;
      saved_amount: number;
      currency: string;
      jamiya_id: string;
      duration_months: number | null;
      target_date: string | null;
    };
    members?: GoalMemberTotal[];
    events?: GoalContributionEvent[];
    can_record?: boolean;
  } | null;

  if (!payload?.ok || !payload.goal) {
    if (payload?.error === 'FORBIDDEN' || payload?.error === 'GOAL_NOT_FOUND') notFound();
    return (
      <AppPage width="medium">
        <p className="text-sm text-muted-foreground">
          {payload?.error === 'GOAL_NOT_LINKED_TO_CIRCLE'
            ? 'This goal is not linked to a circle. Edit it under Finance → Goals and choose a circle.'
            : payload?.error ?? 'Could not load goal.'}
        </p>
        <Button asChild variant="outline" className="mt-4 rounded-full">
          <Link href={`/circles/${slug}` as Route}>Back to circle</Link>
        </Button>
      </AppPage>
    );
  }

  const goal = payload.goal;
  const target = Number(goal.target_amount);
  const saved = Number(goal.saved_amount);
  const pct = target > 0 ? Math.min(100, Math.round((saved / target) * 100)) : 0;

  return (
    <AppPage width="medium">
      <CircleNoticeBanner notice={notices.notice} noticeType={notices.noticeType} />

      <PageHeader
        eyebrow="Circle goal · shared challenge"
        title={goal.title}
        subtitle={`${formatCurrency(saved, goal.currency)} of ${formatCurrency(target, goal.currency)} from all members · ${pct}%`}
        action={
          <Button asChild variant="outline" size="sm" className="rounded-full">
            <Link href={`/circles/${slug}` as Route}>Back to circle</Link>
          </Button>
        }
      />

      <p className="text-sm text-muted-foreground">
        This is a <strong className="font-medium text-foreground">whole-circle</strong> goal.
        Members save at their own pace; officers record each deposit below. Personal goals (just you)
        live under Finance → Goals.
      </p>

      <div className="h-2 overflow-hidden rounded-full bg-muted">
        <div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
      </div>

      <CircleGoalMemberBoard
        goalId={goal.id}
        slug={slug}
        currency={goal.currency}
        canRecord={Boolean(payload.can_record)}
        members={payload.members ?? []}
        events={payload.events ?? []}
      />
    </AppPage>
  );
}
