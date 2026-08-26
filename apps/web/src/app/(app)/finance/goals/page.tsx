import type { Metadata } from 'next';
import Link from 'next/link';
import type { Route } from 'next';
import { redirect } from 'next/navigation';
import { formatCurrency } from '@jamiya/shared';
import { Button, Input } from '@jamiya/ui';
import { createClient } from '@/lib/supabase/server';
import { deleteGoalAction, updateGoalFormAction } from '@/features/finance/actions';
import { CreateGoalForm } from '@/features/finance/components/create-goal-form';
import { EmptyState } from '@/features/dashboard/components/empty-state';

export const metadata: Metadata = { title: 'Goals' };
export const dynamic = 'force-dynamic';

type Goal = {
  id: string;
  title: string;
  target_amount: number | string;
  saved_amount: number | string;
  currency: string;
  target_date: string | null;
  duration_months: number | null;
};

export default async function GoalsPage({
  searchParams,
}: {
  searchParams?: Promise<{ jamiyaId?: string }>;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/phone?next=/finance/goals');

  const qs = (await searchParams) ?? {};
  const defaultJamiya = String(qs.jamiyaId ?? '');

  const { data } = await supabase
    .from('savings_goals')
    .select('id, title, target_amount, saved_amount, currency, target_date, duration_months, jamiya_id')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });
  const goals = (data ?? []) as unknown as Array<Goal & { jamiya_id?: string | null }>;

  const { data: memberships } = await supabase
    .from('members')
    .select('jamiya_id, jamiyas(id, name)')
    .eq('user_id', user.id)
    .eq('status', 'active');

  const circles = (
    (memberships ?? []) as Array<{
      jamiya_id: string;
      jamiyas: { id: string; name: string } | { id: string; name: string }[] | null;
    }>
  )
    .map((m) => {
      const j = Array.isArray(m.jamiyas) ? m.jamiyas[0] : m.jamiyas;
      return j ? { id: j.id, name: j.name } : null;
    })
    .filter(Boolean) as Array<{ id: string; name: string }>;

  const circleName = new Map(circles.map((c) => [c.id, c.name]));

  return (
    <div className="space-y-8">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-accent">
          <Link href={'/finance' as Route} className="hover:text-primary">
            Finance
          </Link>
        </p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight md:text-4xl">Goals</h1>
        <p className="mt-2 max-w-xl text-muted-foreground">
          Hajj, Umra, Udhiyah, emergency fund — track progress and optionally link a circle so
          payouts stay tied to what you are saving for.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button asChild variant="outline" className="min-h-11">
            <Link href={'/finance' as Route}>Back to Finance</Link>
          </Button>
          <Button asChild variant="outline" className="min-h-11">
            <Link href={'/wallet#top-up' as Route}>Open Money</Link>
          </Button>
        </div>
      </div>

      <div className="amanah-surface p-5">
        <CreateGoalForm circles={circles} defaultJamiyaId={defaultJamiya} />
      </div>

      <section className="space-y-3">
        {goals.length === 0 ? (
          <EmptyState
            title="No goals yet"
            description="Create your first savings goal above — Hajj, emergency, or any target you care about."
            actionLabel="Open Money"
            actionHref={'/wallet#top-up' as Route}
          />
        ) : null}
        {goals.map((goal) => {
          const target = Number(goal.target_amount);
          const saved = Number(goal.saved_amount);
          const remaining = Math.max(target - saved, 0);
          const progress = target > 0 ? Math.min(100, Math.round((saved / target) * 100)) : 0;
          const monthlyHint =
            goal.duration_months && goal.duration_months > 0 && remaining > 0
              ? Math.ceil(remaining / goal.duration_months)
              : null;
          const topUpAmount = Math.max(Math.ceil(remaining || 100), 100);
          const reached = remaining === 0;

          return (
            <article key={goal.id} className="amanah-surface p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="text-xl font-bold tracking-tight">{goal.title}</h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {formatCurrency(saved, goal.currency)} / {formatCurrency(target, goal.currency)}
                    {goal.duration_months ? ` · ${goal.duration_months} months` : ''}
                    {goal.target_date ? ` · by ${goal.target_date}` : ''}
                    {goal.jamiya_id && circleName.get(goal.jamiya_id)
                      ? ` · ${circleName.get(goal.jamiya_id)}`
                      : ''}
                  </p>
                  {reached ? (
                    <p className="mt-1 text-sm font-medium text-primary">Target reached</p>
                  ) : (
                    <p className="mt-1 text-sm font-medium text-foreground">
                      {formatCurrency(remaining, goal.currency)} still to go
                      {monthlyHint
                        ? ` · about ${formatCurrency(monthlyHint, goal.currency)} / month`
                        : ''}
                    </p>
                  )}
                </div>
                <form action={deleteGoalAction}>
                  <input type="hidden" name="goalId" value={goal.id} />
                  <Button type="submit" variant={reached ? 'default' : 'outline'} size="sm">
                    {reached ? 'Archive / delete' : 'Delete'}
                  </Button>
                </form>
              </div>
              <div className="mt-4 h-2 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-primary transition-[width] duration-500"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <p className="mt-2 text-xs font-semibold text-primary">{progress}% complete</p>
              {!reached ? (
                <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
                  <Button asChild className="min-h-11">
                    <Link
                      href={
                        `/wallet?next=${encodeURIComponent('/finance/goals')}&amount=${topUpAmount}#top-up` as Route
                      }
                    >
                      Top up Money toward this
                    </Link>
                  </Button>
                  <form action={updateGoalFormAction} className="flex max-w-xs flex-1 gap-2">
                    <input type="hidden" name="goalId" value={goal.id} />
                    <Input
                      name="savedAmount"
                      type="number"
                      inputMode="decimal"
                      min="0"
                      defaultValue={saved}
                      className="h-11 text-base sm:h-10 sm:text-sm"
                      aria-label="Saved amount"
                    />
                    <Button type="submit" variant="outline" className="min-h-11">
                      Update
                    </Button>
                  </form>
                </div>
              ) : (
                <p className="mt-4 text-sm text-muted-foreground">
                  Nice work. You can archive this goal or keep it for your records.
                </p>
              )}
              {!reached ? (
                <p className="mt-2 text-xs text-muted-foreground">
                  Update records how much you have set aside after topping up or transferring.
                </p>
              ) : null}
            </article>
          );
        })}
      </section>
    </div>
  );
}
