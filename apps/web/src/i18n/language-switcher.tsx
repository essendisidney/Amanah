'use client';

import { usePathname } from 'next/navigation';
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
  const other: Locale = locale === 'en' ? 'sw' : 'en';
  const otherLabel = other === 'sw' ? 'Kiswahili' : 'English';

  return (
    <form action={setLocaleAction} className="inline-flex items-center">
      <input type="hidden" name="locale" value={other} />
      <input type="hidden" name="path" value={pathname} />
      <button
        type="submit"
        className="rounded-md px-2.5 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        aria-label={`${label}: ${otherLabel}`}
        title={`${label}: ${otherLabel}`}
      >
        {other === 'sw' ? 'SW' : 'EN'}
      </button>
    </form>
  );
}
