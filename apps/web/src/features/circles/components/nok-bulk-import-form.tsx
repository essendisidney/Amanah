'use client';

import { useActionState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Alert, AlertDescription, Button, Label, Textarea } from '@jamiya/ui';
import { bulkUpsertNextOfKinAction } from '../actions/next-of-kin-actions';
import { initialActionState } from '../lib/action-state';

export function NokBulkImportForm({
  jamiyaId,
  slug,
}: {
  jamiyaId: string;
  slug: string;
}) {
  const router = useRouter();
  const [state, formAction, pending] = useActionState(
    bulkUpsertNextOfKinAction,
    initialActionState,
  );

  useEffect(() => {
    if (state.success) router.refresh();
  }, [state.success, router]);

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        Paste many rows:{' '}
        <span className="font-mono text-xs text-foreground">
          member_code_or_name, nok_name, phone, relationship
        </span>
        . One per line. Relationship: spouse, parent, sibling, child, guardian, friend, other.
      </p>
      {state.message ? (
        <Alert variant={state.success ? 'success' : 'destructive'}>
          <AlertDescription>{state.message}</AlertDescription>
        </Alert>
      ) : null}
      <form action={formAction} className="space-y-3">
        <input type="hidden" name="jamiyaId" value={jamiyaId} />
        <input type="hidden" name="slug" value={slug} />
        <input type="hidden" name="returnTo" value="next-of-kin" />
        <div className="space-y-1">
          <Label htmlFor="nokBulkPaste">Bulk next of kin</Label>
          <Textarea
            id="nokBulkPaste"
            name="rowsPaste"
            rows={8}
            className="font-mono text-sm"
            placeholder={`TABLE001, Jane Doe, +254712345678, spouse
Khadija Mahmoud, Ahmed Ali, 0712345678, parent`}
          />
        </div>
        <Button type="submit" disabled={pending} className="min-h-11">
          {pending ? 'Importing…' : 'Import next of kin'}
        </Button>
      </form>
    </div>
  );
}
