import Link from 'next/link';
import type { Route } from 'next';
import { booksHref } from '@/features/circles/lib/member-books-view';

type Props = {
  slug: string;
  title?: string;
};

export function MemberBooksBackBar({ slug, title }: Props) {
  return (
    <div className="flex flex-wrap items-center gap-3 border-b border-border pb-4">
      <Link
        href={booksHref(slug, 'home') as Route}
        className="text-sm font-medium text-accent underline-offset-4 hover:underline"
      >
        ← All members
      </Link>
      {title ? (
        <>
          <span className="text-muted-foreground" aria-hidden>
            ·
          </span>
          <p className="text-sm font-medium text-foreground">{title}</p>
        </>
      ) : null}
    </div>
  );
}
