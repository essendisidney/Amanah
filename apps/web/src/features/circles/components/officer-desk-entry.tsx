import Link from 'next/link';
import type { Route } from 'next';
import { Button } from '@jamiya/ui';

type Props = {
  slug: string;
  lateCount?: number;
  pendingInvites?: number;
  unpaidCount?: number;
};

/** Compact entry so officers leave the member “Today” view for ops tools. */
export function OfficerDeskEntry({
  slug,
  lateCount = 0,
  pendingInvites = 0,
  unpaidCount = 0,
}: Props) {
  const bits = [
    lateCount > 0 ? `${lateCount} late` : null,
    unpaidCount > 0 ? `${unpaidCount} unpaid` : null,
    pendingInvites > 0 ? `${pendingInvites} invites` : null,
  ].filter(Boolean);

  return (
    <section className="amanah-surface flex flex-col gap-3 border-primary/20 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">
          Officer
        </p>
        <h2 className="mt-1 text-base font-semibold tracking-tight">Officer desk</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {bits.length > 0
            ? bits.join(' · ')
            : 'Record payments, invite people, and run this circle.'}
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button asChild className="min-h-11">
          <a href="#officer-desk">Open desk</a>
        </Button>
        <Button asChild variant="outline" className="min-h-11">
          <Link href={`/circles/${slug}/officer` as Route}>Full console</Link>
        </Button>
      </div>
    </section>
  );
}
