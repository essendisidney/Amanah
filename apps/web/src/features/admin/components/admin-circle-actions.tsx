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
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">
        Update keeps history. Suspend/cancel stop activity. Reset and delete wipe data.
      </p>

      <div className="flex flex-wrap items-center gap-2">
        <form action={setJamiyaStatusAction} className="flex flex-wrap items-center gap-2">
          <input type="hidden" name="jamiyaId" value={jamiyaId} />
          <select
            name="status"
            defaultValue={normalizedStatus}
            key={normalizedStatus}
            className="h-11 border border-input bg-background px-2 text-sm"
            aria-label={`Status for ${name}`}
          >
            {selectStatuses.map((value) => (
              <option key={value} value={value}>
                {value === 'paused' ? 'paused / suspended' : value}
              </option>
            ))}
          </select>
          <Button type="submit" variant="outline" className="min-h-11">
            Update
          </Button>
        </form>
      </div>

      <div className="flex flex-wrap items-center gap-2 border-t border-border/70 pt-3">
        <p className="w-full text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          Destructive
        </p>

        {normalizedStatus !== 'paused' && normalizedStatus !== 'cancelled' ? (
          <form
            action={setJamiyaStatusAction}
            onSubmit={(event) => {
              const ok = window.confirm(
                `Suspend "${name}"? Circle becomes paused. Members and ledger stay.`,
              );
              if (!ok) event.preventDefault();
            }}
          >
            <input type="hidden" name="jamiyaId" value={jamiyaId} />
            <input type="hidden" name="status" value="paused" />
            <input type="hidden" name="intent" value="suspend" />
            <Button type="submit" variant="outline" className="min-h-11">
              Suspend
            </Button>
          </form>
        ) : null}

        {normalizedStatus !== 'cancelled' ? (
          <form
            action={setJamiyaStatusAction}
            onSubmit={(event) => {
              const ok = window.confirm(
                `Cancel "${name}"? Does not delete the circle or wipe member data.`,
              );
              if (!ok) event.preventDefault();
            }}
          >
            <input type="hidden" name="jamiyaId" value={jamiyaId} />
            <input type="hidden" name="status" value="cancelled" />
            <Button type="submit" variant="outline" className="min-h-11">
              Cancel
            </Button>
          </form>
        ) : null}

        <form
          action={resetCircleDataAction}
          onSubmit={(event) => {
            const ok = window.confirm(
              `Reset data for "${name}"? Keeps one admin. Removes other members, ledger, invites. Cannot be undone.`,
            );
            if (!ok) event.preventDefault();
          }}
        >
          <input type="hidden" name="jamiyaId" value={jamiyaId} />
          <Button type="submit" variant="outline" className="min-h-11">
            Reset data
          </Button>
        </form>

        <form
          action={deleteJamiyaAction}
          onSubmit={(event) => {
            const ok = window.confirm(
              canDelete
                ? `Delete "${name}" permanently? This cannot be undone.`
                : `"${name}" may still be live (${normalizedStatus}). Cancel or suspend first if delete is blocked. Continue anyway?`,
            );
            if (!ok) event.preventDefault();
          }}
        >
          <input type="hidden" name="jamiyaId" value={jamiyaId} />
          <Button type="submit" variant="destructive" className="min-h-11">
            Delete
          </Button>
        </form>
      </div>
    </div>
  );
}
