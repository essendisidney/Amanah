'use client';

import { useEffect, useRef, useState } from 'react';
import { Button } from '@jamiya/ui';
import { dictionaries } from '@/i18n/dictionaries';
import { DEFAULT_LOCALE, LOCALE_COOKIE, isLocale } from '@/i18n/config';

function readLocale(): keyof typeof dictionaries {
  if (typeof document === 'undefined') return DEFAULT_LOCALE;
  const match = document.cookie.match(new RegExp(`(?:^|; )${LOCALE_COOKIE}=([^;]*)`));
  const raw = match?.[1] ? decodeURIComponent(match[1]) : null;
  return isLocale(raw) ? raw : DEFAULT_LOCALE;
}

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const retried = useRef(false);
  const [labels, setLabels] = useState(dictionaries[DEFAULT_LOCALE].errors);

  useEffect(() => {
    setLabels(dictionaries[readLocale()].errors);
  }, []);

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
        {labels.title}
      </h1>
      <p className="text-sm text-muted-foreground">{labels.body}</p>
      <Button type="button" onClick={reset}>
        {labels.tryAgain}
      </Button>
    </div>
  );
}
