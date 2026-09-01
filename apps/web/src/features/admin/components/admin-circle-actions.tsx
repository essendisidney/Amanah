'use client';

import { Button } from '@jamiya/ui';
import {
  deleteJamiyaAction,
  resetCircleDataAction,
  setJamiyaStatusAction,
} from '@/features/admin/actions/admin-actions';

/** Values that exist on the live DB enum today. Suspend uses paused under the hood. */
const STATUSES = ['draft', 'open', 'active', 'paused', 'completed', 'cancelled'] as const;

export function AdminCircleActions({
  jamiyaId,
  name,
  status,
}: {
  jamiyaId: string;
  name: string;
  status: string;
}) {
  const normalizedStatus = status === 'suspended' ? 'paused' : status;
  const canDelete =
    normalizedStatus === 'draft' ||
    normalizedStatus === 'cancelled' ||
    normalizedStatus === 'paused' ||
    normalizedStatus === 'open';

  const selectStatuses = STATUSES.includes(normalizedStatus as (typeof STATUSES)[number])
    ? STATUSES
    : ([...STATUSES, normalizedStatus] as string[]);

  return (
    <div className="flex flex-wrap items-center gap-2">
      <form action={setJamiyaStatusAction} className="flex flex-wrap items-center gap-2">
        <input type="hidden" name="jamiyaId" value={jamiyaId} />
        <select
          name="status"
          defaultValue={normalizedStatus}
          key={normalizedStatus}
          className="h-9 rounded-md border border-input bg-background px-2 text-sm"
          aria-label={`Status for ${name}`}
        >
          {selectStatuses.map((value) => (
            <option key={value} value={value}>
              {value === 'paused' ? 'paused / suspended' : value}
            </option>
          ))}
        </select>
        <Button type="submit" size="sm" variant="outline">
          Update
        </Button>
      </form>

      {normalizedStatus !== 'paused' && normalizedStatus !== 'cancelled' ? (
        <form action={setJamiyaStatusAction}>
          <input type="hidden" name="jamiyaId" value={jamiyaId} />
          <input type="hidden" name="status" value="paused" />
          <input type="hidden" name="intent" value="suspend" />
          <Button type="submit" size="sm" variant="outline">
            Suspend
          </Button>
        </form>
      ) : null}

      {normalizedStatus !== 'cancelled' ? (
        <form action={setJamiyaStatusAction}>
          <input type="hidden" name="jamiyaId" value={jamiyaId} />
          <input type="hidden" name="status" value="cancelled" />
          <Button type="submit" size="sm" variant="outline">
            Cancel
          </Button>
        </form>
      ) : null}

      <form
        action={resetCircleDataAction}
        onSubmit={(event) => {
          const ok = window.confirm(
            `Reset data for "${name}"? This removes all members except one admin, clears ledger/invites, and cannot be undone.`,
          );
          if (!ok) event.preventDefault();
        }}
      >
        <input type="hidden" name="jamiyaId" value={jamiyaId} />
        <Button type="submit" size="sm" variant="outline">
          Reset data
        </Button>
      </form>

      <form
        action={deleteJamiyaAction}
        onSubmit={(event) => {
          const ok = window.confirm(
            canDelete
              ? `Delete "${name}"? This cannot be undone.`
              : `"${name}" may still be live. Cancel or suspend it first if delete is blocked. Continue?`,
          );
          if (!ok) event.preventDefault();
        }}
      >
        <input type="hidden" name="jamiyaId" value={jamiyaId} />
        <Button type="submit" size="sm" variant="destructive">
          Delete
        </Button>
      </form>
    </div>
  );
}
