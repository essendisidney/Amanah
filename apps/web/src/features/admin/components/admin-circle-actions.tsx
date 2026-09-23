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
      <div className="rounded-lg border border-border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
        <p className="font-medium text-foreground">Routine vs destructive</p>
        <ul className="mt-1 list-inside list-disc space-y-0.5">
          <li>
            <span className="font-medium text-foreground">Update</span> — change status without wiping
            members or ledger.
          </li>
          <li>
            <span className="font-medium text-foreground">Suspend</span> — sets status to paused;
            members keep history; activity stops.
          </li>
          <li>
            <span className="font-medium text-foreground">Cancel</span> — marks the circle cancelled;
            does not delete rows.
          </li>
          <li>
            <span className="font-medium text-foreground">Reset data</span> — keeps one admin; wipes
            other members, ledger, and invites.
          </li>
          <li>
            <span className="font-medium text-foreground">Delete</span> — removes the circle when
            allowed (usually draft/cancelled/paused/open without paid activity).
          </li>
        </ul>
      </div>

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
            Update status
          </Button>
        </form>
      </div>

      <div className="flex flex-wrap items-center gap-2 border-t border-border/70 pt-3">
        <p className="w-full text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
          Destructive
        </p>

        {normalizedStatus !== 'paused' && normalizedStatus !== 'cancelled' ? (
          <form
            action={setJamiyaStatusAction}
            onSubmit={(event) => {
              const ok = window.confirm(
                `Suspend "${name}"? The circle becomes paused. Members and ledger stay; new activity should stop until reopened.`,
              );
              if (!ok) event.preventDefault();
            }}
          >
            <input type="hidden" name="jamiyaId" value={jamiyaId} />
            <input type="hidden" name="status" value="paused" />
            <input type="hidden" name="intent" value="suspend" />
            <Button type="submit" size="sm" variant="outline">
              Suspend
            </Button>
          </form>
        ) : null}

        {normalizedStatus !== 'cancelled' ? (
          <form
            action={setJamiyaStatusAction}
            onSubmit={(event) => {
              const ok = window.confirm(
                `Cancel "${name}"? Status becomes cancelled. This does not delete the circle or wipe member data.`,
              );
              if (!ok) event.preventDefault();
            }}
          >
            <input type="hidden" name="jamiyaId" value={jamiyaId} />
            <input type="hidden" name="status" value="cancelled" />
            <Button type="submit" size="sm" variant="outline">
              Cancel circle
            </Button>
          </form>
        ) : null}

        <form
          action={resetCircleDataAction}
          onSubmit={(event) => {
            const ok = window.confirm(
              `Reset data for "${name}"? Keeps one admin seat. Removes other members, ledger, invites, and related money rows. Cannot be undone.`,
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
                ? `Delete "${name}" permanently? This cannot be undone.`
                : `"${name}" may still be live (${normalizedStatus}). Cancel or suspend first if delete is blocked. Continue anyway?`,
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
    </div>
  );
}
