'use client';

import { Button } from '@jamiya/ui';
import {
  deleteJamiyaAction,
  setJamiyaStatusAction,
} from '@/features/admin/actions/admin-actions';

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
  const canDelete =
    status === 'draft' ||
    status === 'cancelled' ||
    status === 'open';

  return (
    <div className="flex flex-wrap items-center gap-2">
      <form action={setJamiyaStatusAction} className="flex flex-wrap items-center gap-2">
        <input type="hidden" name="jamiyaId" value={jamiyaId} />
        <select
          name="status"
          defaultValue={status}
          className="h-9 rounded-md border border-input bg-background px-2 text-sm"
          aria-label={`Status for ${name}`}
        >
          {STATUSES.map((value) => (
            <option key={value} value={value}>
              {value}
            </option>
          ))}
        </select>
        <Button type="submit" size="sm" variant="outline">
          Update
        </Button>
      </form>

      {status !== 'cancelled' ? (
        <form action={setJamiyaStatusAction}>
          <input type="hidden" name="jamiyaId" value={jamiyaId} />
          <input type="hidden" name="status" value="cancelled" />
          <Button type="submit" size="sm" variant="outline">
            Cancel
          </Button>
        </form>
      ) : null}

      <form
        action={deleteJamiyaAction}
        onSubmit={(event) => {
          const ok = window.confirm(
            canDelete
              ? `Delete “${name}”? This cannot be undone.`
              : `“${name}” may still be live. Cancel it first if delete is blocked. Continue?`,
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
