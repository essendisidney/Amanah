'use client';

import { useActionState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { KE_PHONE_PLACEHOLDER } from '@jamiya/shared';
import { Alert, AlertDescription, Button, Label, Textarea } from '@jamiya/ui';
import {
  bulkAddMembersByPhoneAction,
} from '../actions/add-member';
import { initialBulkAddState } from '../lib/action-state';
import { InviteSharePanel } from './invite-share-panel';

export function BulkPhoneInviteForm({
  jamiyaId,
  circleName,
}: {
  jamiyaId: string;
  circleName?: string;
}) {
  const router = useRouter();
  const [state, formAction, pending] = useActionState(
    bulkAddMembersByPhoneAction,
    initialBulkAddState,
  );

  useEffect(() => {
    if (state.success) {
      router.refresh();
    }
  }, [state.success, state.message, router]);

  const shareable = (state.results ?? []).filter(
    (r) => r.success && r.inviteUrl && r.inviteCode,
  );

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Paste many Kenya mobiles at once — one per line, or{' '}
        <span className="font-medium text-foreground">Name, 07…</span>. Existing Amanah
        users join immediately; new numbers get an account and invite code.
      </p>

      {state.message ? (
        <Alert variant={state.success ? 'success' : 'destructive'}>
          <AlertDescription>{state.message}</AlertDescription>
        </Alert>
      ) : null}

      <form action={formAction} className="space-y-4">
        <input type="hidden" name="jamiyaId" value={jamiyaId} />
        <div className="space-y-2">
          <Label htmlFor="bulkPhones">Phone list</Label>
          <Textarea
            id="bulkPhones"
            name="phones"
            rows={6}
            placeholder={`Amina, ${KE_PHONE_PLACEHOLDER}\n0712345678\n+254712345679`}
            className="min-h-[140px] font-mono text-sm"
            required
          />
          {state.fieldErrors?.phones?.[0] ? (
            <p className="text-sm text-destructive">{state.fieldErrors.phones[0]}</p>
          ) : null}
          <p className="text-[11px] text-muted-foreground">
            Up to 40 numbers. Duplicates in the paste are skipped.
          </p>
        </div>
        <Button type="submit" disabled={pending} className="min-h-11">
          {pending ? 'Adding…' : 'Add all'}
        </Button>
      </form>

      {state.results && state.results.length > 0 ? (
        <ul className="divide-y divide-border rounded-xl border border-border bg-card">
          {state.results.map((row) => (
            <li key={`${row.phone}-${row.fullName ?? ''}`} className="space-y-2 px-4 py-3">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className="font-medium text-foreground">
                  {row.fullName ? `${row.fullName} · ` : ''}
                  <span className="font-mono text-sm">{row.phone}</span>
                </p>
                <span
                  className={
                    row.success
                      ? 'text-xs font-medium text-emerald-700 dark:text-emerald-400'
                      : 'text-xs font-medium text-destructive'
                  }
                >
                  {row.success ? 'Added' : 'Failed'}
                </span>
              </div>
              <p className="text-sm text-muted-foreground">{row.message}</p>
              {row.success && row.inviteUrl && row.inviteCode ? (
                <InviteSharePanel
                  compact
                  inviteUrl={row.inviteUrl}
                  inviteCode={row.inviteCode}
                  circleName={circleName}
                />
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}

      {shareable.length > 1 ? (
        <p className="text-xs text-muted-foreground">
          Use Copy link / WhatsApp on each row to share that person’s invite.
        </p>
      ) : null}
    </div>
  );
}
