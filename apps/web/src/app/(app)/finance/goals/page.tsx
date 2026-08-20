import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { formatCurrency } from '@jamiya/shared';
import { Button, Input } from '@jamiya/ui';
import { createClient } from '@/lib/supabase/server';
import { deleteGoalAction, updateGoalFormAction } from '@/features/finance/actions';
import { CreateGoalForm } from '@/features/finance/components/create-goal-form';

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

export default async function GoalsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login?next=/finance/goals');

  const { data } = await supabase
    .from('savings_goals')
    .select('id, title, target_amount, saved_amount, currency, target_date, duration_months')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });
  const goals = (data ?? []) as unknown as Goal[];

  return (
    <div className="space-y-8">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-accent">
          Personal savings
        </p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight md:text-4xl">Goals</h1>
        <p className="mt-2 max-w-xl text-muted-foreground">
          Hajj, Umra, Udhiyah, emergency fund — track progress with a clear target.
        </p>
      </div>

      <div className="amanah-surface p-5">
        <CreateGoalForm />
      </div>

      <section className="space-y-3">
        {goals.map((goal) => {
          const target = Number(goal.target_amount);
          const saved = Number(goal.saved_amount);
          const progress = target > 0 ? Math.min(100, Math.round((saved / target) * 100)) : 0;
          return (
            <article key={goal.id} className="amanah-surface p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="text-xl font-bold tracking-tight">{goal.title}</h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {formatCurrency(saved, goal.currency)} / {formatCurrency(target, goal.currency)}
                    {goal.duration_months ? ` · ${goal.duration_months} months` : ''}
                    {goal.target_date ? ` · by ${goal.target_date}` : ''}
                  </p>
                </div>
                <form action={deleteGoalAction}>
                  <input type="hidden" name="goalId" value={goal.id} />
                  <Button type="submit" variant="outline" size="sm">
                    Delete
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
              <form action={updateGoalFormAction} className="mt-4 flex max-w-xs gap-2">
                <input type="hidden" name="goalId" value={goal.id} />
                <Input
                  name="savedAmount"
                  type="number"
                  inputMode="decimal"
                  min="0"
                  defaultValue={saved}
                  className="h-11 text-base sm:h-10 sm:text-sm"
                />
                <Button type="submit" className="min-h-11">
                  Update
                </Button>
              </form>
            </article>
          );
        })}
        {!goals.length ? (
          <p className="text-sm text-muted-foreground">Create your first savings goal above.</p>
        ) : null}
      </section>
    </div>
  );
}
