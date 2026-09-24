const PRODUCTION_APP_URL = 'https://jameiyah.com';

/** Public origin for invite links, OAuth redirects, emails, and WhatsApp shares. */
export function getSiteUrl(): string {
  const fromEnv = process.env.NEXT_PUBLIC_APP_URL?.trim().replace(/\/$/, '');
  if (fromEnv && !/localhost|127\.0\.0\.1/i.test(fromEnv)) {
    return fromEnv;
  }
  return PRODUCTION_APP_URL;
}
