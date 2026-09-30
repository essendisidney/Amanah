import Link from 'next/link';
import type { Route } from 'next';
import { APP_NAME } from '@jamiya/shared';
import { PublicSiteHeader } from '@/components/public-site-header';
import { PesaraCredit } from '@/components/pesara-credit';
import { landingCopy } from '@/features/landing/landing-copy';
import { getDictionary } from '@/i18n/get-dictionary';

/** Dark header band shared by public and sign-in pages (matches the home hero). */
export async function SiteHeaderBand() {
  const { locale, dict } = await getDictionary();
  const c = landingCopy(locale);
  return (
    <div className="jameiyah-on-dark relative z-30 overflow-hidden bg-[#03201b] text-white">
      <div aria-hidden className="pointer-events-none absolute -right-24 -top-28 h-64 w-64 rounded-full bg-[#D8A038]/15 blur-[90px]" />
      <div aria-hidden className="pointer-events-none absolute -left-24 -bottom-32 h-64 w-64 rounded-full bg-[#00705f]/25 blur-[90px]" />
      <div className="relative mx-auto w-full max-w-6xl px-4 py-4 sm:px-6">
        <PublicSiteHeader
          locale={locale}
          languageLabel={dict.common.language}
          homeHref={'/' as Route}
          links={[
            { href: '/#how' as Route, label: dict.landing.joinCircle },
            { href: '/#circles' as Route, label: c.navCircles },
            { href: '/shariah' as Route, label: dict.landing.shariaEyebrow },
            { href: '/pricing' as Route, label: c.navPricing },
            { href: '/sadaka' as Route, label: dict.common.sadaka },
            { href: '/login' as Route, label: dict.common.signIn, variant: 'ghost' },
          ]}
          cta={{ href: '/welcome' as Route, label: dict.landing.startWithPhone }}
        />
      </div>
    </div>
  );
}

/** Dark footer shared by the home page and public pages. */
export async function SiteFooter() {
  const { locale, dict } = await getDictionary();
  const c = landingCopy(locale);
  const link = 'inline-flex min-h-11 items-center hover:text-white';
  return (
    <footer className="jameiyah-on-dark relative z-10 bg-[#021814] text-white/70">
      <div className="mx-auto flex max-w-6xl flex-col gap-10 px-4 py-14 sm:px-6 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="font-[family-name:var(--font-grotesk)] text-2xl font-bold tracking-tight text-white">{APP_NAME}</p>
          <p className="mt-1 text-sm">{dict.brand.tagline}</p>
          <p className="mt-3 text-xs text-white/45">jameiyah.com · Jameiyah Limited</p>
          <PesaraCredit className="mt-3" />
        </div>
        <nav className="flex flex-wrap gap-x-6 gap-y-1 text-sm font-medium text-white/80" aria-label="Footer">
          <Link href={'/pricing' as Route} className={link}>
            {c.footerPricing}
          </Link>
          <Link href={'/sadaka' as Route} className={link}>
            {dict.common.sadaka}
          </Link>
          <Link href={'/support' as Route} className={link}>
            {dict.common.support}
          </Link>
          <Link href={'/login' as Route} className={link}>
            {dict.common.signIn}
          </Link>
          <Link href={'/privacy' as Route} className={link}>
            {c.footerPrivacy}
          </Link>
          <Link href={'/terms' as Route} className={link}>
            {c.footerTerms}
          </Link>
        </nav>
      </div>
    </footer>
  );
}
