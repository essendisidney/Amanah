import Link from 'next/link';
import type { Route } from 'next';
import { formatCurrency } from '@jamiya/shared';
import { Button } from '@jamiya/ui';
import { createClient } from '@/lib/supabase/server';

/** Goals linked to this circle — tap one to see how much each member has saved. */
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

  return (
    <section className="amanah-surface px-5 py-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-lg font-semibold">Circle goals</h2>
          <p className="text-sm text-muted-foreground">
            Shared challenges for the whole chama. Each person can save a different amount — tap a
            goal anytime to see who has put in what. Personal goals stay under Finance → Goals.
          </p>
        </div>
        <Button asChild size="sm" variant="outline" className="min-h-10 rounded-full">
          <Link href={`/finance/goals?jamiyaId=${jamiyaId}` as Route}>Add / manage goals</Link>
        </Button>
      </div>
      {goals.length === 0 ? (
        <p className="mt-3 text-sm text-muted-foreground">
          No shared circle goals yet. Add one and choose <strong className="font-medium text-foreground">Whole circle</strong>{' '}
          (e.g. school fees). For your own private target, use Finance → Goals → Just me.
        </p>
      ) : (
        <ul className="mt-4 divide-y divide-border/60 overflow-hidden rounded-xl border border-border/70">
          {goals.map((g) => {
            const target = Number(g.target_amount);
            const saved = Number(g.saved_amount);
            const pct = target > 0 ? Math.min(100, Math.round((saved / target) * 100)) : 0;
            return (
              <li key={g.id}>
                <Link
                  href={`/circles/${slug}/goals/${g.id}` as Route}
                  className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 transition-colors hover:bg-secondary/40"
                >
                  <div>
                    <p className="font-medium">
                      {g.title}
                      {g.user_id === userId ? (
                        <span className="ml-2 text-xs font-normal text-primary">Yours</span>
                      ) : null}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {formatCurrency(saved, g.currency)} / {formatCurrency(target, g.currency)} ·{' '}
                      {pct}% · View by member →
                    </p>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
