import { redirect } from 'next/navigation';
import { Button, Input, Label } from '@jamiya/ui';
import { createClient } from '@/lib/supabase/server';
import { createGoalFormAction, deleteGoalAction, updateGoalFormAction } from '@/features/finance/actions';

export const dynamic = 'force-dynamic';
type Goal = { id: string; title: string; target_amount: number | string; saved_amount: number | string; currency: string; target_date: string | null };

export default async function GoalsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login?next=/finance/goals');
  const { data } = await supabase.from('savings_goals').select('id, title, target_amount, saved_amount, currency, target_date').eq('user_id', user.id).order('created_at', { ascending: false });
  const goals = (data ?? []) as unknown as Goal[];
  return <div className="space-y-10"><div><p className="text-sm font-medium uppercase tracking-[0.16em] text-accent">Personal savings</p><h1 className="mt-2 font-[family-name:var(--font-display)] text-4xl font-semibold">Savings goals</h1></div>
    <form action={createGoalFormAction} className="grid max-w-2xl gap-4 border border-border bg-card p-6 sm:grid-cols-2"><div className="space-y-2"><Label htmlFor="title">Goal</Label><Input id="title" name="title" required /></div><div className="space-y-2"><Label htmlFor="targetAmount">Target (KES)</Label><Input id="targetAmount" name="targetAmount" type="number" min="1" required /></div><div className="space-y-2"><Label htmlFor="targetDate">Target date (optional)</Label><Input id="targetDate" name="targetDate" type="date" /></div><div className="flex items-end"><Button type="submit">Create goal</Button></div></form>
    <section className="space-y-5">{goals.map((goal) => { const target = Number(goal.target_amount); const saved = Number(goal.saved_amount); const progress = Math.min(100, Math.round((saved / target) * 100)); return <div key={goal.id} className="border-b border-border pb-5"><div className="flex flex-wrap justify-between gap-3"><div><h2 className="font-[family-name:var(--font-display)] text-2xl font-semibold">{goal.title}</h2><p className="mt-1 text-sm text-muted-foreground">KES {saved.toLocaleString()} of {target.toLocaleString()}{goal.target_date ? ` · target ${goal.target_date}` : ''}</p></div><form action={deleteGoalAction}><input type="hidden" name="goalId" value={goal.id} /><Button type="submit" variant="outline" size="sm">Delete</Button></form></div><div className="mt-4 h-2 overflow-hidden rounded-full bg-muted"><div className="h-full bg-primary" style={{ width: `${progress}%` }} /></div><form action={updateGoalFormAction} className="mt-4 flex max-w-xs gap-2"><input type="hidden" name="goalId" value={goal.id} /><Input name="savedAmount" type="number" min="0" defaultValue={saved} /><Button type="submit" size="sm">Update</Button></form></div>; })}{!goals.length ? <p className="text-muted-foreground">Create your first savings goal above.</p> : null}</section>
  </div>;
}
