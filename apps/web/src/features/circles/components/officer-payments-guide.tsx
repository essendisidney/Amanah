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
        <h2 className="font-[family-name:var(--font-display)] text-lg font-semibold">
          Record contributions
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Enter what each person paid this month — including past months.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button asChild className="min-h-11">
            <a href="#monthly-payments">Enter payments</a>
          </Button>
          <Button asChild variant="outline" className="min-h-11">
            <a href="#merry-go-round">Slots</a>
          </Button>
        </div>
      </section>
    );
  }

  if (isShareDividend) {
    return (
      <section className="amanah-surface border-primary/20 px-5 py-5 sm:px-6">
        <h2 className="font-[family-name:var(--font-display)] text-lg font-semibold">
          Record member payments
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Paste Excel once, or enter shares and monthly savings by member.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button asChild className="min-h-11">
            <Link href={`/circles/${slug}/books` as Route}>Member payments</Link>
          </Button>
          <Button asChild variant="outline" className="min-h-11">
            <Link href={`/circles/${slug}/books?view=import` as Route}>Paste Excel</Link>
          </Button>
        </div>
      </section>
    );
  }

  return (
    <section className="amanah-surface border-primary/20 px-5 py-5 sm:px-6">
      <h2 className="font-[family-name:var(--font-display)] text-lg font-semibold">
        Track savings
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Enter what each person paid for the month.
      </p>
      <div className="mt-4 flex flex-wrap gap-2">
        <Button asChild className="min-h-11">
          <a href="#monthly-payments">Enter savings</a>
        </Button>
      </div>
    </section>
  );
}
