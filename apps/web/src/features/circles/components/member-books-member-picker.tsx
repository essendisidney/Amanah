'use client';

import { useRouter } from 'next/navigation';
import { Label } from '@jamiya/ui';
import { booksHref } from '@/features/circles/lib/member-books-view';

type MemberOption = {
  id: string;
  label: string;
};

type Props = {
  slug: string;
  members: MemberOption[];
};

export function MemberBooksMemberPicker({ slug, members }: Props) {
  const router = useRouter();

  if (members.length === 0) return null;

  return (
    <div className="space-y-1">
      <Label htmlFor="pickMember">Or pick one member</Label>
      <select
        id="pickMember"
        defaultValue=""
        className="flex min-h-11 w-full rounded-md border border-input bg-background px-3 text-sm"
        onChange={(e) => {
          const id = e.target.value;
          if (!id) return;
          router.push(booksHref(slug, 'member', id));
        }}
      >
        <option value="">Choose a name…</option>
        {[...members]
          .sort((a, b) => a.label.localeCompare(b.label))
          .map((m) => (
            <option key={m.id} value={m.id}>
              {m.label}
            </option>
          ))}
      </select>
    </div>
  );
}
