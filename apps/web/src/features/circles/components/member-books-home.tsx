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
      <section className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-foreground">Members</h2>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
            <Button asChild variant="outline" className="min-h-11 w-full sm:w-auto">
              <Link href={booksHref(slug, 'grid') as Route}>Everyone&apos;s payments</Link>
            </Button>
            <Button asChild variant="outline" className="min-h-11 w-full sm:w-auto">
              <Link href={booksHref(slug, 'import') as Route}>Paste from Excel</Link>
            </Button>
            <Button asChild variant="outline" className="min-h-11 w-full sm:w-auto">
              <Link href={`/circles/${slug}/treasury#member-fining` as Route}>Fines</Link>
            </Button>
          </div>
        </div>
        <div className="max-w-md">
          <MemberBooksMemberPicker slug={slug} members={pickerMembers} />
        </div>
        <MemberBooksMemberList slug={slug} currency={currency} members={members} />
      </section>
    </div>
  );
}
