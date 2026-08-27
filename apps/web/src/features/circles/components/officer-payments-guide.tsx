import Link from 'next/link';
import type { Route } from 'next';
import { Button } from '@jamiya/ui';

type Props = {
  slug: string;
  /** rotating | savings | share_dividend */
  challengeKind?: string | null;
};

export function OfficerPaymentsGuide({ slug, challengeKind }: Props) {
  const isRotating = challengeKind === 'rotating' || !challengeKind;
  const isShareDividend = challengeKind === 'share_dividend';

  if (isRotating) {
    return (
      <section className="amanah-surface border-primary/20 px-5 py-5 sm:px-6">
        <p className="text-xs font-semibold uppercase tracking-wide text-primary">Officer guide</p>
        <h2 className="mt-1 font-[family-name:var(--font-display)] text-lg font-semibold">
          Record merry-go-round contributions
        </h2>
        <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm text-muted-foreground">
          <li>
            <strong className="font-medium text-foreground">Add members</strong> and let each pick a
            payout slot (month).
          </li>
          <li>
            <strong className="font-medium text-foreground">Activate</strong> the circle to build the
            contribution calendar and payout turns.
          </li>
          <li>
            Open <strong className="font-medium text-foreground">Monthly contributions</strong> and
            enter what each person paid for any month — including past months (Add past month).
            Empty means they did not contribute.
          </li>
          <li>
            Use the <strong className="font-medium text-foreground">merry-go-round board</strong> to
            see slots, who already received the pot, and who still owes this round.
          </li>
        </ol>
        <div className="mt-5 flex flex-wrap gap-2">
          <Button asChild size="lg" className="min-h-11 rounded-full px-6">
            <a href="#mgr-payments">Enter payments</a>
          </Button>
          <Button asChild size="lg" variant="outline" className="min-h-11 rounded-full px-6">
            <a href="#merry-go-round">View slots</a>
          </Button>
        </div>
      </section>
    );
  }

  if (isShareDividend) {
    return (
      <section className="amanah-surface border-primary/20 px-5 py-5 sm:px-6">
        <p className="text-xs font-semibold uppercase tracking-wide text-primary">Officer guide</p>
        <h2 className="mt-1 font-[family-name:var(--font-display)] text-lg font-semibold">
          Record member payments
        </h2>
        <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm text-muted-foreground">
          <li>
            <strong className="font-medium text-foreground">Add members</strong> below if anyone is
            missing from the list.
          </li>
          <li>
            Open <strong className="font-medium text-foreground">Member payments</strong> to enter
            each person&apos;s share buy-in and monthly savings.
          </li>
          <li>
            Use <strong className="font-medium text-foreground">Enter everyone&apos;s payments</strong>{' '}
            for the full table, or pick one member at a time.
          </li>
          <li>Check <strong className="font-medium text-foreground">Statements</strong> when done.</li>
        </ol>
        <div className="mt-5">
          <Button asChild size="lg" className="min-h-11 rounded-full px-6">
            <Link href={`/circles/${slug}/books` as Route}>Open member payments</Link>
          </Button>
        </div>
      </section>
    );
  }

  return (
    <section className="amanah-surface border-primary/20 px-5 py-5 sm:px-6">
      <p className="text-xs font-semibold uppercase tracking-wide text-primary">Officer guide</p>
      <h2 className="mt-1 font-[family-name:var(--font-display)] text-lg font-semibold">
        Track savings contributions
      </h2>
      <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm text-muted-foreground">
        <li>Add members, then activate to generate the contribution calendar.</li>
        <li>Members pay from wallet, or you mark cash received on the calendar.</li>
        <li>Check statements and goals for progress toward shared targets.</li>
      </ol>
      <div className="mt-5">
        <Button asChild size="lg" className="min-h-11 rounded-full px-6">
          <a href="#calendar">Open calendar</a>
        </Button>
      </div>
    </section>
  );
}
