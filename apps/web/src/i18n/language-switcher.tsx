'use client';

import { usePathname } from 'next/navigation';
import { useTransition } from 'react';
import { setLocaleAction } from './set-locale-action';
import type { Locale } from './config';

export function LanguageSwitcher({
  locale,
  label,
}: {
  locale: Locale;
  label: string;
}) {
  const pathname = usePathname() || '/';
  const [pending, startTransition] = useTransition();
  const other: Locale = locale === 'en' ? 'sw' : 'en';
  const otherLabel = other === 'sw' ? 'Kiswahili' : 'English';

  return (
    <button
      type="button"
      disabled={pending}
      className="rounded-md px-2.5 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-60"
      aria-label={`${label}: ${otherLabel}`}
      title={`${label}: ${otherLabel}`}
      onClick={() => {
        startTransition(async () => {
          const fd = new FormData();
          fd.set('locale', other);
          fd.set('path', pathname);
          await setLocaleAction(fd);
          // Full reload so every page remounts in the selected locale.
          window.location.assign(pathname);
        });
      }}
    >
      {other === 'sw' ? 'SW' : 'EN'}
    </button>
  );
}
