import Link from 'next/link';
import type { Route } from 'next';
import { formatCurrency } from '@jamiya/shared';
import { Button } from '@jamiya/ui';
import { createClient } from '@/lib/supabase/server';

/** Goals linked to this circle (owner or shared via RLS after migration). */
export async function CircleLinkedGoals({
  jamiyaId,
  slug,
  userId,
}: {
  jamiyaId: string;
  slug: string;
  userId: string;
}) {
  const supabase = await createClient();
  const { data } = await supabase
    .from('savings_goals')
    .select('id, title, target_amount, saved_amount, currency, user_id')
    .eq('jamiya_id', jamiyaId)
    .order('created_at', { ascending: false })
    .limit(8);

  const goals = (data ?? []) as Array<{
    id: string;
    title: string;
    target_amount: number | string;
    saved_amount: number | string;
    currency: string;
    user_id: string;
  }>;

  const mine = goals.filter((g) => g.user_id === userId);

  return (
    <section className="space-y-3 rounded-xl border border-border bg-card p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-lg font-semibold">Circle goals</h2>
          <p className="text-sm text-muted-foreground">
            Link a savings goal (school fees, wedding, Hajj) to this chama.
          </p>
        </div>
        <Button asChild size="sm" variant="outline" className="min-h-11">
          <Link href={`/finance/goals?jamiyaId=${jamiyaId}` as Route}>Add / manage goals</Link>
        </Button>
      </div>
      {goals.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No goals linked yet. Open Goals and choose this circle when creating one.
        </p>
      ) : (
        <ul className="divide-y divide-border rounded-lg border border-border">
          {goals.map((g) => {
            const target = Number(g.target_amount);
            const saved = Number(g.saved_amount);
            const pct = target > 0 ? Math.min(100, Math.round((saved / target) * 100)) : 0;
            return (
              <li key={g.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
                <div>
                  <p className="font-medium">
                    {g.title}
                    {g.user_id === userId ? (
                      <span className="ml-2 text-xs font-normal text-primary">Yours</span>
                    ) : null}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {formatCurrency(saved, g.currency)} / {formatCurrency(target, g.currency)} ·{' '}
                    {pct}%
                  </p>
                </div>
              </li>
            );
          })}
        </ul>
      )}
      {mine.length === 0 && goals.length > 0 ? (
        <p className="text-xs text-muted-foreground">
          Tip: create your own goal linked to{' '}
          <Link href={`/finance/goals?jamiyaId=${jamiyaId}` as Route} className="text-primary underline-offset-4 hover:underline">
            /finance/goals
          </Link>
          .
        </p>
      ) : null}
      <p className="sr-only">{slug}</p>
    </section>
  );
}
