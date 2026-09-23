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

/**
 * Welcome-only strip after join.
 * Ongoing dues live in the hero + NextContributionCard — do not duplicate here.
 */
export function MemberTodayStrip({
  welcome,
  circleName,
  slug,
  currency,
  due,
  walletAvailable,
}: MemberTodayProps) {
  if (!welcome) return null;

  const remaining = due ? Math.max(due.amount - due.amountPaid, 0) : 0;
  const needsTopUp =
    due != null &&
    remaining > 0 &&
    walletAvailable != null &&
    Number.isFinite(walletAvailable) &&
    walletAvailable < remaining;

  return (
    <section className="amanah-surface space-y-3.5 border-primary/20 px-4 py-4 sm:px-5">
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-primary">
          Welcome
        </p>
        <h2 className="mt-1 text-base font-semibold tracking-tight text-foreground sm:text-lg">
          You&apos;re in {circleName}
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {due && remaining > 0
            ? `Pay your first contribution (${formatCurrency(remaining, currency)}${
                due.dueDate ? ` · due ${formatDate(due.dueDate)}` : ''
              }) to stay current.`
            : 'You’re a member. When a due is posted, pay it from this circle page.'}
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {due && remaining > 0 ? (
          <>
            <Button asChild className="min-h-11">
              <a href="#pay-due">Pay {formatCurrency(remaining, currency)}</a>
            </Button>
            {needsTopUp ? (
              <Button asChild variant="outline" className="min-h-11">
                <Link
                  href={
                    `/wallet?focus=top-up&amount=${Math.ceil(remaining)}&next=${encodeURIComponent(
                      `/circles/${slug}#pay-due`,
                    )}#top-up` as Route
                  }
                >
                  Add money
                </Link>
              </Button>
            ) : null}
          </>
        ) : (
          <Button asChild variant="outline" className="min-h-11">
            <a href="#members">See members</a>
          </Button>
        )}
        <Button asChild variant="outline" className="min-h-11">
          <Link href={`/circles/${slug}/statement` as Route}>Statement</Link>
        </Button>
      </div>
    </section>
  );
}
