'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Alert, AlertDescription, Button } from '@jamiya/ui';
import { acceptCircleTermsAction } from '../actions/circle-terms-actions';
import type { CircleTermsView } from '../lib/circle-terms';
import { CircleTermsSummary } from './circle-terms-summary';

/**
 * Shown to a member who has not accepted the circle's current fees and penalties. Until they
 * accept, no fee is charged to them (and a raised fee stays at what they accepted before).
 */
export function CircleTermsCard({
  terms,
  slug,
}: {
  terms: CircleTermsView & { ok: true; terms: NonNullable<CircleTermsView['terms']> };
  slug: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [checked, setChecked] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const changed = terms.accepted_version != null;

  return (
    <section className="jameiyah-surface space-y-4 px-5 py-5">
      <div>
        <h2 className="text-lg font-semibold">
          {changed ? 'This circle’s fees have changed' : 'Review this circle’s fees'}
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {changed
            ? 'Until you accept, you keep paying the fees you agreed to before (or less, if a fee went down).'
            : 'No fee is charged to you until you accept them.'}
        </p>
      </div>

      <CircleTermsSummary terms={terms.terms} />

      {error ? (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      <label className="flex items-start gap-2 text-sm">
        <input
          type="checkbox"
          className="mt-1 h-4 w-4"
          checked={checked}
          onChange={(e) => setChecked(e.target.checked)}
        />
        <span>I have read these fees and penalties and accept them.</span>
      </label>

      <Button
        type="button"
        disabled={!checked || pending}
        onClick={() => {
          setError(null);
          startTransition(async () => {
            const result = await acceptCircleTermsAction(
              terms.jamiya_id ?? '',
              terms.terms.version,
              slug,
            );
            if (!result.success) {
              setError(result.message ?? 'Could not record your acceptance.');
            }
            router.refresh();
          });
        }}
      >
        {pending ? 'Saving…' : 'Accept'}
      </Button>
    </section>
  );
}
