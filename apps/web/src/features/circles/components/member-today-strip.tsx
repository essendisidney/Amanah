import Link from 'next/link';
import type { Route } from 'next';
import { formatCurrency, formatDate } from '@jamiya/shared';
import { Button } from '@jamiya/ui';

type MemberTodayProps = {
  welcome?: boolean;
  circleName: string;
  slug: string;
  currency: string;
  due?: {
    id: string;
    amount: number;
    amountPaid: number;
    dueDate: string | null;
    status: string;
  } | null;
  walletAvailable?: number | null;
};

/** Wave 10 — one job for a member: know what to do today. */
export function MemberTodayStrip({
  welcome,
  circleName,
  slug,
  currency,
  due,
  walletAvailable,
}: MemberTodayProps) {
  const remaining = due ? Math.max(due.amount - due.amountPaid, 0) : 0;
  const needsTopUp =
    due != null &&
    remaining > 0 &&
    walletAvailable != null &&
    Number.isFinite(walletAvailable) &&
    walletAvailable < remaining;

  if (!welcome && !due) return null;

  return (
    <section className="amanah-surface space-y-3 border-primary/25 px-5 py-5">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">
          {welcome ? 'Welcome' : 'Today'}
        </p>
        <h2 className="mt-1 font-[family-name:var(--font-display)] text-xl font-semibold tracking-tight">
          {welcome ? `You're in ${circleName}` : 'Your next step'}
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {welcome
            ? due
              ? 'Pay your first contribution to stay current with the group.'
              : 'You’re a member. When a due is posted, pay it here.'
            : due
              ? `Pay ${formatCurrency(remaining, currency)} for ${circleName}${
                  due.dueDate ? ` · due ${formatDate(due.dueDate)}` : ''
                }.`
              : null}
        </p>
      </div>

      {due && remaining > 0 ? (
        <div className="flex flex-wrap gap-2">
          {needsTopUp ? (
            <Button asChild className="min-h-11">
              <Link
                href={
                  `/wallet?amount=${Math.ceil(remaining)}&next=${encodeURIComponent(
                    `/circles/${slug}#pay-due`,
                  )}#top-up` as Route
                }
              >
                Add money · then pay
              </Link>
            </Button>
          ) : (
            <Button asChild className="min-h-11">
              <a href="#pay-due">Pay {formatCurrency(remaining, currency)}</a>
            </Button>
          )}
          <Button asChild variant="outline" className="min-h-11">
            <Link href={`/circles/${slug}/statement` as Route}>Statement</Link>
          </Button>
        </div>
      ) : welcome ? (
        <Button asChild variant="outline" className="min-h-11">
          <a href="#members">See members</a>
        </Button>
      ) : null}
    </section>
  );
}
