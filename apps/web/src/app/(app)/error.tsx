'use client';

import { AppPage, PageCard } from '@/components/app-page';
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

function isStaleChunkError(error: Error): boolean {
  const msg = `${error.name} ${error.message}`.toLowerCase();
  return (
    msg.includes('chunkloaderror') ||
    msg.includes('loading chunk') ||
    msg.includes('failed to fetch dynamically imported module') ||
    msg.includes('unexpected token') ||
    msg.includes('module script failed')
  );
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
  const autoTried = useRef(false);

  useEffect(() => {
    setLabels(dictionaries[readLocale()].errors);
  }, []);

  useEffect(() => {
    console.error('[app-error]', error.digest ?? '', error);
  }, [error]);

  // Auto-retry once only — never loop “Retrying…”.
  useEffect(() => {
    if (autoTried.current) {
      setRetrying(false);
      return;
    }
    autoTried.current = true;

    if (isStaleChunkError(error)) {
      const key = 'jameiyah-chunk-reload';
      try {
        if (sessionStorage.getItem(key) !== '1') {
          sessionStorage.setItem(key, '1');
          window.location.reload();
          return;
        }
        sessionStorage.removeItem(key);
      } catch {
        window.location.reload();
        return;
      }
    }

    const t = window.setTimeout(() => {
      setRetrying(false);
      reset();
    }, 900);
    return () => window.clearTimeout(t);
  }, [error, reset]);

  return (
    <AppPage width="narrow">
      <PageCard>
        <h1 className="font-[family-name:var(--font-display)] text-2xl font-semibold">
          {labels.title}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {retrying
            ? labels.body
            : 'If you just saved a payment, it may already be recorded. Open the circle and check Record so far — or reload for a fresh page.'}
        </p>
        {error.digest ? (
          <p className="mt-2 font-mono text-[11px] text-muted-foreground/80">
            Ref {error.digest}
          </p>
        ) : null}
        <div className="mt-4 flex flex-wrap gap-2">
          <Button
            type="button"
            onClick={() => {
              try {
                sessionStorage.removeItem('jameiyah-chunk-reload');
              } catch {
                /* ignore */
              }
              window.location.reload();
            }}
            disabled={retrying}
          >
            {retrying ? 'Retrying…' : 'Reload page'}
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
