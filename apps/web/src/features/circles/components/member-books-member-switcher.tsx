'use client';

import { useRouter } from 'next/navigation';
import Link from 'next/link';
import type { Route } from 'next';
import { Label } from '@jamiya/ui';
import { booksHref } from '@/features/circles/lib/member-books-view';

type MemberOption = {
  id: string;
  label: string;
};

type Props = {
  slug: string;
  members: MemberOption[];
  currentMemberId: string;
};

export function MemberBooksMemberSwitcher({ slug, members, currentMemberId }: Props) {
  const router = useRouter();

  if (members.length <= 1) return null;

  return (
    <div className="flex flex-wrap items-end gap-3 rounded-xl border border-border bg-card p-4">
      <div className="min-w-[12rem] flex-1 space-y-1">
        <Label htmlFor="switchMember">Switch member</Label>
        <select
          id="switchMember"
          value={currentMemberId}
          className="flex min-h-11 w-full rounded-md border border-input bg-background px-3 text-sm"
          onChange={(e) => {
            const id = e.target.value;
            if (id) router.push(booksHref(slug, 'member', id));
          }}
        >
          {[...members]
            .sort((a, b) => a.label.localeCompare(b.label))
            .map((m) => (
              <option key={m.id} value={m.id}>
                {m.label}
              </option>
            ))}
        </select>
      </div>
      <Link
        href={booksHref(slug, 'home') as Route}
        className="inline-flex min-h-11 items-center text-sm font-medium text-accent underline-offset-4 hover:underline"
      >
        ← All members
      </Link>
    </div>
  );
}
