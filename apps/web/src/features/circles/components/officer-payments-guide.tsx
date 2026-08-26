import Link from 'next/link';
import type { Route } from 'next';
import { Button } from '@jamiya/ui';

type Props = {
  slug: string;
};

export function OfficerPaymentsGuide({ slug }: Props) {
  return (
    <section className="rounded-xl border border-accent/25 bg-accent/5 p-5 sm:p-6">
      <h2 className="text-lg font-semibold">Officer: record member payments</h2>
      <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm text-muted-foreground">
        <li>
          <strong className="font-medium text-foreground">Add members</strong> below if anyone is
          missing from the list.
        </li>
        <li>
          Open <strong className="font-medium text-foreground">Member payments</strong> to enter
          each person&apos;s share buy-in (e.g. 5,000 on 5 Feb) and monthly savings (e.g. 2,000 per
          month).
        </li>
        <li>
          Use <strong className="font-medium text-foreground">Enter everyone&apos;s payments</strong>{' '}
          for the full table, or pick one member at a time.
        </li>
        <li>Check <strong className="font-medium text-foreground">Statements</strong> when done.</li>
      </ol>
      <div className="mt-4">
        <Button asChild size="lg" className="min-h-11">
          <Link href={`/circles/${slug}/books` as Route}>Open member payments</Link>
        </Button>
      </div>
    </section>
  );
}
