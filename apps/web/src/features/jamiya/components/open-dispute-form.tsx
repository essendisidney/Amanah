'use client';

import { useActionState } from 'react';
import { Button, Input, Label, Textarea } from '@jamiya/ui';
import {
  openDisputeAction,
  type DisputeActionState,
} from '../actions/dispute-actions';

const initial: DisputeActionState = { success: false, message: '' };

export function OpenDisputeForm({
  jamiyaId,
  slug,
}: {
  jamiyaId: string;
  slug: string;
}) {
  const [state, action, pending] = useActionState(openDisputeAction, initial);

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="jamiyaId" value={jamiyaId} />
      <input type="hidden" name="slug" value={slug} />
      <div className="space-y-2">
        <Label htmlFor="type">Type</Label>
        <select
          id="type"
          name="type"
          className="flex h-10 w-full rounded-md border border-border bg-background px-3 text-sm"
          defaultValue="other"
        >
          <option value="missed_contribution">Missed contribution</option>
          <option value="payout_delay">Payout delay</option>
          <option value="incorrect_amount">Incorrect amount</option>
          <option value="membership">Membership</option>
          <option value="other">Other</option>
        </select>
      </div>
      <div className="space-y-2">
        <Label htmlFor="title">Title</Label>
        <Input id="title" name="title" required minLength={3} maxLength={200} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="description">Description</Label>
        <Textarea
          id="description"
          name="description"
          required
          minLength={10}
          rows={4}
        />
      </div>
      {state.message ? (
        <p
          className={
            state.success ? 'text-sm text-primary' : 'text-sm text-destructive'
          }
        >
          {state.message}
        </p>
      ) : null}
      <Button type="submit" variant="outline" disabled={pending}>
        {pending ? 'Submitting…' : 'Open dispute'}
      </Button>
    </form>
  );
}
