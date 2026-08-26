import Link from 'next/link';
import type { Route } from 'next';
import { Button } from '@jamiya/ui';
import { booksHref } from '@/features/circles/lib/member-books-view';
import { MemberBooksMemberList } from '@/features/circles/components/member-books-member-list';
import { MemberBooksMemberPicker } from '@/features/circles/components/member-books-member-picker';

export type HomeMember = {
  id: string;
  label: string;
  shareAmount: number;
  savings: number;
  loanOut: number;
};

type Props = {
  slug: string;
  currency: string;
  members: HomeMember[];
};

export function MemberBooksHome({ slug, currency, members }: Props) {
  const pickerMembers = members.map((m) => ({ id: m.id, label: m.label }));

  return (
    <div className="space-y-8">
      <section className="rounded-xl border border-accent/25 bg-accent/5 p-5 sm:p-6">
        <h2 className="text-lg font-semibold text-foreground">What do you want to do?</h2>
        <p className="mt-2 max-w-xl text-sm text-muted-foreground">
          Enter <strong className="font-medium text-foreground">share buy-in</strong> (one-off, e.g.
          5,000 on 5 Feb) and <strong className="font-medium text-foreground">monthly savings</strong>{' '}
          (e.g. 2,000 each month) for each member.
        </p>
        <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
          <Button asChild size="lg" className="min-h-12 w-full sm:w-auto">
            <Link href={booksHref(slug, 'grid') as Route}>
              Enter everyone&apos;s payments
            </Link>
          </Button>
          <Button asChild size="lg" variant="outline" className="min-h-12 w-full sm:w-auto">
            <Link href={booksHref(slug, 'import') as Route}>
              Paste from Excel
            </Link>
          </Button>
        </div>
        <div className="mt-4 max-w-md">
          <MemberBooksMemberPicker slug={slug} members={pickerMembers} />
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">All members</h2>
        <p className="text-sm text-muted-foreground">
          Search, sort, then tap <strong className="font-medium text-foreground">Enter payments</strong>{' '}
          for one person, or use the table above for everyone at once.
        </p>
        <MemberBooksMemberList slug={slug} currency={currency} members={members} />
      </section>
    </div>
  );
}
