'use client';

import { useRef, useState } from 'react';
import { Button, Input, Label } from '@jamiya/ui';
import { voidLedgerLineAction } from '../actions/books-actions';

type VoidKind = 'book_entry' | 'share_lot' | 'loan_event' | 'contribution';

/** Officer control to remove a mistaken ledger line (with confirmation). */
export function VoidLedgerButton({
  slug,
  memberId,
  kind,
  id,
  label = 'Void',
  returnPath,
}: {
  slug: string;
  memberId: string;
  kind: VoidKind;
  id: string;
  label?: string;
  /** e.g. `/circles/foo/books` or `#monthly-payments` */
  returnPath?: string;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [reason, setReason] = useState('');

  return (
    <>
      <Button
        type="button"
        size="sm"
        variant="ghost"
        className="min-h-9 text-destructive hover:bg-destructive/10 hover:text-destructive"
        onClick={() => dialogRef.current?.showModal()}
      >
        {label}
      </Button>
      <dialog
        ref={dialogRef}
        className="w-[min(100%,24rem)] rounded-xl border border-border bg-card p-0 shadow-lg backdrop:bg-black/40"
        onClose={() => setReason('')}
      >
        <form action={voidLedgerLineAction} className="space-y-4 p-5">
          <input type="hidden" name="slug" value={slug} />
          <input type="hidden" name="memberId" value={memberId} />
          <input type="hidden" name="kind" value={kind} />
          <input type="hidden" name="id" value={id} />
          {returnPath ? <input type="hidden" name="returnPath" value={returnPath} /> : null}
          <div>
            <p className="font-[family-name:var(--font-display)] text-lg font-semibold">
              Void this line?
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              This removes the recorded amount. You can re-enter it correctly afterwards.
            </p>
          </div>
          <div className="space-y-1">
            <Label htmlFor={`void-reason-${id}`}>Reason (optional)</Label>
            <Input
              id={`void-reason-${id}`}
              name="reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. wrong month entered"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="submit" variant="destructive" className="min-h-11">
              Yes, void
            </Button>
            <Button
              type="button"
              variant="outline"
              className="min-h-11"
              onClick={() => dialogRef.current?.close()}
            >
              Cancel
            </Button>
          </div>
        </form>
      </dialog>
    </>
  );
}
