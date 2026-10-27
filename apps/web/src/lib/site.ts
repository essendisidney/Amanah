/** The public site: its address and how it describes itself in search results and link previews. */
export const SITE_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://jameiyah.com';

export const SITE_DESCRIPTION =
  'Community finance for Kenyan circles: merry-go-round, table banking and savings, with statements officers and members can both see. No riba.';

/** Public pages search engines should list. Signed-in pages are left out on purpose. */
export const PUBLIC_PATHS = [
  '/',
  '/pricing',
  '/shariah',
  '/zakat',
  '/sadaka',
  '/sadaka/adopt',
  '/support',
  '/privacy',
  '/terms',
  '/login',
  '/register',
] as const;
