'use client';

import { Button, Input, Label } from '@jamiya/ui';
import { formatCurrency, formatDate } from '@jamiya/shared';
import { recordGoalContributionAction } from '@/features/finance/actions/goal-contribution-actions';

export type GoalMemberTotal = {
  member_id: string;
  member_code: string | null;
  label: string;
  total_saved: number;
  entry_count: number;
};

export type GoalContributionEvent = {
  id: string;
  member_id: string;
  amount: number;
  effective_date: string;
  notes: string | null;
  created_at: string;
  member_label: string;
};

type Props = {
  goalId: string;
  slug: string;
  currency: string;
  canRecord: boolean;
  members: GoalMemberTotal[];
  events: GoalContributionEvent[];
};

export function CircleGoalMemberBoard({
  goalId,
  slug,
  currency,
  canRecord,
  members,
  events,
}: Props) {
  const today = new Date().toISOString().slice(0, 10);

  return (
    <div className="space-y-8">
      <section className="space-y-3">
        <h2 className="font-[family-name:var(--font-display)] text-xl font-semibold">
          Saved by member
        </h2>
        <p className="text-sm text-muted-foreground">
          Each person can save a different amount toward this goal. Totals update when an officer
          records a deposit below.
        </p>
        <ul className="divide-y divide-border/60 overflow-hidden rounded-xl border border-border/70 bg-card/80">
          {members.map((m) => (
            <li
              key={m.member_id}
              className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 sm:px-5"
            >
              <div>
                <p className="font-medium text-foreground">{m.label}</p>
                <p className="text-xs text-muted-foreground">
                  {m.member_code ? `${m.member_code} · ` : ''}
                  {m.entry_count} {m.entry_count === 1 ? 'entry' : 'entries'}
                </p>
              </div>
              <p className="amanah-money text-lg font-semibold">
                {formatCurrency(Number(m.total_saved), currency)}
              </p>
            </li>
          ))}
        </ul>
      </section>

      {canRecord ? (
        <section className="amanah-surface space-y-4 px-5 py-5">
          <div>
            <h2 className="font-[family-name:var(--font-display)] text-lg font-semibold">
              Record a member&apos;s savings
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Example: Asha saved 2,000 this month toward school fees — pick Asha, enter 2000, save.
            </p>
          </div>
          <form action={recordGoalContributionAction} className="grid gap-3 sm:grid-cols-2">
            <input type="hidden" name="goalId" value={goalId} />
            <input type="hidden" name="slug" value={slug} />
            <div className="space-y-1 sm:col-span-2">
              <Label htmlFor="memberId">Member</Label>
              <select
                id="memberId"
                name="memberId"
                required
                className="flex min-h-11 w-full rounded-md border border-input bg-background px-3 text-sm"
                defaultValue=""
              >
                <option value="" disabled>
                  Choose who saved…
                </option>
                {members.map((m) => (
                  <option key={m.member_id} value={m.member_id}>
                    {m.label}
                    {m.member_code ? ` (${m.member_code})` : ''}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="amount">Amount</Label>
              <Input
                id="amount"
                name="amount"
                type="number"
                inputMode="decimal"
                min="1"
                step="0.01"
                required
                placeholder="e.g. 2000"
                className="min-h-11"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="effectiveDate">Date</Label>
              <Input
                id="effectiveDate"
                name="effectiveDate"
                type="date"
                defaultValue={today}
                required
                className="min-h-11"
              />
            </div>
            <div className="space-y-1 sm:col-span-2">
              <Label htmlFor="notes">Note (optional)</Label>
              <Input id="notes" name="notes" placeholder="e.g. March school fees" className="min-h-11" />
            </div>
            <Button type="submit" className="min-h-11 rounded-full sm:col-span-2 sm:w-fit">
              Save contribution
            </Button>
          </form>
        </section>
      ) : (
        <p className="text-sm text-muted-foreground">
          Ask a circle officer to record deposits when someone saves toward this goal.
        </p>
      )}

      <section className="space-y-3">
        <h2 className="font-[family-name:var(--font-display)] text-xl font-semibold">
          Recent deposits
        </h2>
        {events.length === 0 ? (
          <p className="text-sm text-muted-foreground">No deposits recorded yet.</p>
        ) : (
          <ul className="divide-y divide-border/60 overflow-hidden rounded-xl border border-border/70 bg-card/80">
            {events.map((e) => (
              <li
                key={e.id}
                className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 sm:px-5"
              >
                <div>
                  <p className="font-medium">{e.member_label}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatDate(e.effective_date)}
                    {e.notes ? ` · ${e.notes}` : ''}
                  </p>
                </div>
                <p className="amanah-money font-semibold text-primary">
                  +{formatCurrency(Number(e.amount), currency)}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
