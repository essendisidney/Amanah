export const LOCALES = ['en', 'sw'] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = 'en';
export const LOCALE_COOKIE = 'amanah_locale';

export function isLocale(value: string | undefined | null): value is Locale {
  return value === 'en' || value === 'sw';
}

export function localeLabel(locale: Locale): string {
  return locale === 'sw' ? 'Kiswahili' : 'English';
}
