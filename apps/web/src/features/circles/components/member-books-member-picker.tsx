'use client';

import type { Route } from 'next';
import { useRouter } from 'next/navigation';
import { Label, NativeSelect } from '@jamiya/ui';
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
      <NativeSelect
        id="pickMember"
        defaultValue=""
        className="min-h-11"
        onChange={(e) => {
          const id = e.target.value;
          if (!id) return;
          router.push(booksHref(slug, 'member', id) as Route);
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
      </NativeSelect>
    </div>
  );
}
