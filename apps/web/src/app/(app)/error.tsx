'use client';

import { AppPage, PageCard } from '@/components/app-page';
import { useEffect, useState } from 'react';
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
  const [labels, setLabels] = useState(dictionaries[DEFAULT_LOCALE].errors);
  const [retrying, setRetrying] = useState(true);

  useEffect(() => {
    setLabels(dictionaries[readLocale()].errors);
  }, []);

  useEffect(() => {
    console.error(error);
  }, [error]);

  // Auto-retry once — saves often succeed before the follow-up page hiccups.
  useEffect(() => {
    const t = window.setTimeout(() => {
      setRetrying(false);
      reset();
    }, 1200);
    return () => window.clearTimeout(t);
  }, [reset, error]);

  return (
    <AppPage width="narrow">
      <PageCard>
        <h1 className="font-[family-name:var(--font-display)] text-2xl font-semibold">
          {labels.title}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {retrying
            ? labels.body
            : 'If you just saved a payment, it may already be recorded. Open the circle and check Record so far.'}
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button type="button" onClick={reset} disabled={retrying}>
            {retrying ? 'Retrying…' : labels.tryAgain}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              window.location.href = '/circles';
            }}
          >
            Back to circles
          </Button>
        </div>
      </PageCard>
    </AppPage>
  );
}
