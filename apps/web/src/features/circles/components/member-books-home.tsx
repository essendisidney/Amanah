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
      <section className="rounded-xl border border-border bg-card p-5 sm:p-6">
        <h2 className="text-lg font-semibold text-foreground">Where is the 360 view?</h2>
        <p className="mt-2 max-w-xl text-sm text-muted-foreground">
          Two places — whole chama totals above, or one member&apos;s full picture below.
        </p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <a
            href="#chama-glance"
            className="rounded-lg border border-accent/30 bg-accent/5 px-4 py-4 transition-colors hover:border-accent/50"
          >
            <p className="font-semibold text-foreground">Whole chama 360</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Scroll up — contributions, facilities, outstanding for everyone.
            </p>
          </a>
          <div className="rounded-lg border border-border px-4 py-4">
            <p className="font-semibold text-foreground">One member&apos;s 360</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Pick a name, then tap <strong className="font-medium text-foreground">Open 360</strong>.
            </p>
            <div className="mt-3">
              <MemberBooksMemberPicker slug={slug} members={pickerMembers} />
            </div>
          </div>
        </div>
      </section>

      <section className="rounded-xl border border-accent/25 bg-accent/5 p-5 sm:p-6">
        <h2 className="text-lg font-semibold text-foreground">Record payments</h2>
        <p className="mt-2 max-w-xl text-sm text-muted-foreground">
          Have past records in Excel? Paste the sheet once. Or enter share buy-in and monthly
          savings by hand.
        </p>
        <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
          <Button asChild size="lg" className="min-h-12 w-full sm:w-auto">
            <Link href={booksHref(slug, 'import') as Route}>Paste past records</Link>
          </Button>
          <Button asChild size="lg" variant="outline" className="min-h-12 w-full sm:w-auto">
            <Link href={booksHref(slug, 'grid') as Route}>
              Enter everyone&apos;s payments
            </Link>
          </Button>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">All members</h2>
        <p className="text-sm text-muted-foreground">
          Tap <strong className="font-medium text-foreground">Open 360</strong> for their full
          picture, or <strong className="font-medium text-foreground">Enter payments</strong> to
          record shares / savings / facility.
        </p>
        <MemberBooksMemberList slug={slug} currency={currency} members={members} />
      </section>
    </div>
  );
}
