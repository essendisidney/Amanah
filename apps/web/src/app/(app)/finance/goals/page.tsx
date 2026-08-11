import { redirect } from 'next/navigation';
import { Button, Input, Label } from '@jamiya/ui';
import { createClient } from '@/lib/supabase/server';
import {
  createGoalFormAction,
  deleteGoalAction,
  updateGoalFormAction,
} from '@/features/finance/actions';

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

const PERIODS = [
  { value: '1', label: '1 month' },
  { value: '3', label: '3 months' },
  { value: '6', label: '6 months' },
  { value: '12', label: '12 months' },
] as const;

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
    <div className="space-y-10">
      <div>
        <p className="text-sm font-medium uppercase tracking-[0.16em] text-accent">
          Personal savings
        </p>
        <h1 className="mt-2 font-[family-name:var(--font-display)] text-4xl font-semibold">
          Savings goals
        </h1>
        <p className="mt-2 text-muted-foreground">
          Set a target with a 1, 3, 6, or 12 month horizon.
        </p>
      </div>

      <form
        action={createGoalFormAction}
        className="grid max-w-2xl gap-4 rounded-xl border border-border bg-card p-5 sm:grid-cols-2 sm:p-6"
      >
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="title">Goal</Label>
          <Input id="title" name="title" required placeholder="School fees, business stock…" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="targetAmount">Target (KES)</Label>
          <Input
            id="targetAmount"
            name="targetAmount"
            type="number"
            inputMode="decimal"
            min="1"
            required
            className="h-11 text-base sm:h-10 sm:text-sm"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="durationMonths">Period</Label>
          <select
            id="durationMonths"
            name="durationMonths"
            required
            defaultValue="3"
            className="flex h-11 w-full rounded-md border border-input bg-background px-3 text-base sm:h-10 sm:text-sm"
          >
            {PERIODS.map((p) => (
              <option key={p.value} value={p.value}>
                {p.label}
              </option>
            ))}
          </select>
        </div>
        <div className="sm:col-span-2">
          <Button type="submit" className="min-h-11 w-full sm:w-auto">
            Create goal
          </Button>
        </div>
      </form>

      <section className="space-y-5">
        {goals.map((goal) => {
          const target = Number(goal.target_amount);
          const saved = Number(goal.saved_amount);
          const progress = Math.min(100, Math.round((saved / target) * 100));
          return (
            <div key={goal.id} className="border-b border-border pb-5">
              <div className="flex flex-wrap justify-between gap-3">
                <div>
                  <h2 className="font-[family-name:var(--font-display)] text-2xl font-semibold">
                    {goal.title}
                  </h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    KES {saved.toLocaleString()} of {target.toLocaleString()}
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
                <div className="h-full bg-primary" style={{ width: `${progress}%` }} />
              </div>
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
            </div>
          );
        })}
        {!goals.length ? (
          <p className="text-muted-foreground">Create your first savings goal above.</p>
        ) : null}
      </section>
    </div>
  );
}
