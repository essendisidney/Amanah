'use client';

import { useEffect, useRef } from 'react';
import { Button } from '@jamiya/ui';

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const retried = useRef(false);

  useEffect(() => {
    console.error(error);
  }, [error]);

  useEffect(() => {
    if (retried.current) return;
    retried.current = true;
    reset();
  }, [reset]);

  return (
    <div className="mx-auto max-w-lg space-y-4 rounded-xl border border-border bg-card p-6">
      <h1 className="font-[family-name:var(--font-display)] text-2xl font-semibold">
        Something went wrong
      </h1>
      <p className="text-sm text-muted-foreground">
        We are retrying this page. Tap below if it does not load automatically.
      </p>
      <Button type="button" onClick={reset}>
        Try again
      </Button>
    </div>
  );
}
