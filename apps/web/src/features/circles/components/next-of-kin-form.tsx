'use client';

import { useMemo, useState, useTransition } from 'react';
import { KE_PHONE_PLACEHOLDER } from '@jamiya/shared';
import { Button, Input, Label } from '@jamiya/ui';
import { upsertMemberNextOfKinAction } from '../actions/next-of-kin-actions';

export type NextOfKinMemberOption = {
  id: string;
  label: string;
};

export type NextOfKinExisting = {
  memberId: string;
  fullName: string;
  phone: string | null;
  relationship: string;
  notes: string | null;
};

const RELATIONSHIPS = [
  { value: 'spouse', label: 'Spouse' },
  { value: 'parent', label: 'Parent' },
  { value: 'sibling', label: 'Sibling' },
  { value: 'child', label: 'Child' },
  { value: 'guardian', label: 'Guardian' },
  { value: 'friend', label: 'Friend' },
  { value: 'other', label: 'Other' },
] as const;

type Props = {
  jamiyaId: string;
  slug: string;
  members: NextOfKinMemberOption[];
  existing?: NextOfKinExisting[];
  /** When set to next-of-kin, redirects stay on that page */
  returnTo?: 'next-of-kin' | '';
};

export function NextOfKinForm({
  jamiyaId,
  slug,
  members,
  existing = [],
  returnTo = '',
}: Props) {
  const [pending, startTransition] = useTransition();
  const byMember = useMemo(() => {
    const map = new Map(existing.map((e) => [e.memberId, e]));
    return map;
  }, [existing]);

  const first = members[0]?.id ?? '';
  const [memberId, setMemberId] = useState(first);
  const current = byMember.get(memberId);

  if (members.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Add members first, then capture their next of kin here.
      </p>
    );
  }

  return (
    <form
      className="space-y-4"
      action={(fd) => {
        startTransition(() => {
          void upsertMemberNextOfKinAction(fd);
        });
      }}
    >
      <input type="hidden" name="jamiyaId" value={jamiyaId} />
      <input type="hidden" name="slug" value={slug} />
      {returnTo ? <input type="hidden" name="returnTo" value={returnTo} /> : null}

      <div className="space-y-2">
        <Label htmlFor="nokMember">Member</Label>
        <select
          id="nokMember"
          name="memberId"
          value={memberId}
          onChange={(e) => setMemberId(e.target.value)}
          className="block h-11 w-full rounded-md border border-input bg-background px-3 text-sm"
          required
        >
          {members.map((m) => (
            <option key={m.id} value={m.id}>
              {m.label}
              {byMember.has(m.id) ? ' · has next of kin' : ''}
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="nokFullName">Next of kin full name</Label>
        <Input
          id="nokFullName"
          name="fullName"
          key={`name-${memberId}-${current?.fullName ?? ''}`}
          defaultValue={current?.fullName ?? ''}
          placeholder="Jane Wanjiku"
          autoComplete="name"
          required
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="nokPhone">Phone</Label>
          <Input
            id="nokPhone"
            name="phone"
            type="tel"
            key={`phone-${memberId}-${current?.phone ?? ''}`}
            defaultValue={current?.phone ?? ''}
            placeholder={KE_PHONE_PLACEHOLDER}
            autoComplete="tel"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="nokRelationship">Relationship</Label>
          <select
            id="nokRelationship"
            name="relationship"
            key={`rel-${memberId}-${current?.relationship ?? ''}`}
            defaultValue={current?.relationship ?? 'other'}
            className="block h-11 w-full rounded-md border border-input bg-background px-3 text-sm"
          >
            {RELATIONSHIPS.map((r) => (
              <option key={r.value} value={r.value}>
                {r.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="nokNotes">Notes (optional)</Label>
        <Input
          id="nokNotes"
          name="notes"
          key={`notes-${memberId}-${current?.notes ?? ''}`}
          defaultValue={current?.notes ?? ''}
          placeholder="Lives in Nairobi · available evenings"
        />
      </div>

      <Button type="submit" disabled={pending} className="min-h-11">
        {pending ? 'Saving…' : current ? 'Update next of kin' : 'Save next of kin'}
      </Button>
    </form>
  );
}
