import Link from 'next/link';
import type { Route } from 'next';
import type { Metadata } from 'next';
import { APP_NAME, APP_DESCRIPTION } from '@jamiya/shared';
import { Button } from '@jamiya/ui';
import { PublicSiteHeader } from '@/components/public-site-header';
import { PesaraCredit } from '@/components/pesara-credit';
import { PhoneAdvert } from '@/features/landing/phone-advert';
import { landingCopy } from '@/features/landing/landing-copy';
import { getDictionary } from '@/i18n/get-dictionary';

export const metadata: Metadata = {
  title: `${APP_NAME} — Save together, without interest`,
  description:
    'Jameiyah is community finance for Kenyan circles: merry-go-round, table banking, and savings, with statements officers and members can both see. No riba.',
  openGraph: {
    title: `${APP_NAME} — Save together, without interest`,
    description: APP_DESCRIPTION,
    siteName: APP_NAME,
    type: 'website',
  },
  alternates: {
    canonical: '/',
  },
};

export default async function LandingPage() {
  const { locale, dict } = await getDictionary();
  const c = landingCopy(locale);

  return (
    <div className="jameiyah-light relative min-h-dvh overflow-x-hidden bg-[#f6f8f7] text-foreground">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage:
            'radial-gradient(ellipse 90% 60% at 50% -10%, rgba(13, 92, 69, 0.14), transparent 55%), radial-gradient(ellipse 50% 40% at 100% 20%, rgba(197, 160, 68, 0.12), transparent 50%), linear-gradient(180deg, #f6f8f7 0%, #eef4f1 45%, #f6f8f7 100%)',
        }}
      />

      <div className="relative z-10 mx-auto w-full max-w-6xl px-4 pt-4 sm:px-6 sm:pt-6">
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

      <section className="relative z-10 mx-auto grid min-h-[88dvh] w-full max-w-6xl items-center gap-12 px-4 pb-16 pt-10 sm:px-6 lg:grid-cols-[minmax(0,1fr)_340px] lg:pt-6">
        <div className="order-2 pt-2 lg:order-2 lg:pt-0">
          <PhoneAdvert ad={c.ad} mock={c.mock} />
        </div>
        <div className="max-w-2xl lg:order-1">
          <p className="mb-5 text-xs font-semibold uppercase tracking-[0.22em] text-[#0d5c45]">
            {dict.brand.tagline}
          </p>
          <h1 className="max-w-xl text-4xl font-bold leading-[1.05] tracking-tight text-[#0b4a3c] sm:text-5xl md:text-6xl">
            {c.heroTitle}
          </h1>
          <p className="mt-5 max-w-md text-base leading-relaxed text-[#3d524a] sm:text-lg">
            {c.heroLead}
          </p>
          <div className="mt-9 flex w-full max-w-md flex-col gap-3 sm:flex-row sm:items-center">
            <Button
              size="lg"
              className="min-h-12 w-full bg-[#0d5c45] text-white hover:bg-[#0a4a37] sm:w-auto"
              asChild
            >
              <Link href="/circles/new">{c.createCircle}</Link>
            </Button>
            <Button
              size="lg"
              variant="outline"
              className="min-h-12 w-full border-[#0d5c45]/40 text-[#0d5c45] sm:w-auto"
              asChild
            >
              <Link href="/circles?redeem=1">{c.joinWithCode}</Link>
            </Button>
          </div>
          <p className="mt-3 text-sm text-[#5a6f66]">
            {c.newHere}{' '}
            <Link href="/welcome" className="-my-2.5 inline-block py-2.5 font-semibold text-[#0d5c45] hover:underline">
              {dict.landing.startWithPhone}
            </Link>
          </p>
          <ul className="mt-6 flex max-w-lg flex-wrap gap-2 text-xs font-medium text-[#0b4a3c]">
            {c.chips.map(
              (item) => (
                <li key={item} className="rounded-full border border-[#0d5c45]/20 bg-white/80 px-3 py-1.5">
                  {item}
                </li>
              ),
            )}
          </ul>
          <p className="mt-5 text-sm text-[#5a6f66]">
            {dict.landing.preferEmail}{' '}
            <Link href="/login" className="-my-2.5 inline-block py-2.5 font-semibold text-[#0d5c45] hover:underline">
              {dict.common.signIn}
            </Link>
            {' · '}
            <Link href="/register" className="-my-2.5 inline-block py-2.5 font-semibold text-[#0d5c45] hover:underline">
              {dict.landing.createAccount}
            </Link>
          </p>
        </div>
      </section>

      <section id="circles" className="relative z-10 scroll-mt-24 border-t border-[#0d5c45]/10 bg-white/70">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#c5a044]">
            {c.circlesEyebrow}
          </p>
          <h2 className="mt-3 max-w-2xl text-3xl font-bold tracking-tight text-[#0b4a3c] sm:text-4xl">
            {c.circlesTitle}
          </h2>
          <p className="mt-3 max-w-2xl text-base leading-relaxed text-[#5a6f66]">
            {c.circlesLead}
          </p>
          <ul className="mt-12 grid gap-6 md:grid-cols-2">
            {c.circleTypes
              .map((item, i) => ({ ...item, href: i === 3 ? ('/sadaka' as Route) : (null as Route | null) }))
              .map((item) => (
              <li key={item.title} className="rounded-2xl border border-[#0d5c45]/10 bg-white p-6">
                <h3 className="text-xl font-bold tracking-tight text-[#0b4a3c]">{item.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-[#5a6f66]">{item.body}</p>
                {item.href ? (
                  <Link
                    href={item.href}
                    className="mt-4 inline-flex min-h-11 items-center text-sm font-semibold text-[#0d5c45] hover:underline"
                  >
                    {c.openGiving}
                  </Link>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="relative z-10 border-t border-[#0d5c45]/10">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#c5a044]">{c.whoEyebrow}</p>
          <h2 className="mt-3 max-w-2xl text-3xl font-bold tracking-tight text-[#0b4a3c] sm:text-4xl">
            {c.whoTitle}
          </h2>
          <div className="mt-12 grid gap-10 md:grid-cols-3">
            {c.who.map((item) => (
              <div key={item.title}>
                <h3 className="text-lg font-bold tracking-tight text-[#0b4a3c]">{item.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-[#5a6f66]">{item.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="how" className="relative z-10 scroll-mt-24 border-t border-[#0d5c45]/10 bg-white/50">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#c5a044]">
            {c.howEyebrow}
          </p>
          <h2 className="mt-3 max-w-2xl text-3xl font-bold tracking-tight text-[#0b4a3c] sm:text-4xl">
            {c.howTitle}
          </h2>
          <p className="mt-3 max-w-2xl text-base leading-relaxed text-[#5a6f66]">
            {c.howLead}
          </p>
          <ol className="mt-12 grid gap-10 md:grid-cols-3">
            {c.steps
              .map((item, i) => ({ ...item, step: `0${i + 1}` }))
              .map((item) => (
              <li key={item.step}>
                <p className="text-sm font-semibold tracking-wide text-[#c5a044]">{item.step}</p>
                <h3 className="mt-2 text-xl font-bold tracking-tight text-[#0b4a3c]">{item.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-[#5a6f66]">{item.body}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section
        id="shariah"
        className="relative z-10 scroll-mt-24 border-t border-[#0d5c45]/10 bg-[#0b4a3c] text-[#eef8f3]"
      >
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#c5a044]">
            {dict.landing.shariaEyebrow}
          </p>
          <h2 className="mt-3 max-w-2xl text-3xl font-bold tracking-tight sm:text-4xl">
            {dict.landing.shariaTitle}
          </h2>
          <p className="mt-3 max-w-2xl text-base leading-relaxed text-white/75">
            {dict.landing.shariaLead}
          </p>
          <div className="mt-12 grid gap-10 md:grid-cols-3">
            {[
              {
                title: dict.landing.shariaNoRibaTitle,
                body: dict.landing.shariaNoRibaBody,
              },
              {
                title: dict.landing.shariaMutualTitle,
                body: dict.landing.shariaMutualBody,
              },
              {
                title: dict.landing.shariaGivingTitle,
                body: dict.landing.shariaGivingBody,
              },
            ].map((item) => (
              <div key={item.title}>
                <h3 className="text-lg font-bold tracking-tight text-white">{item.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-white/70">{item.body}</p>
              </div>
            ))}
          </div>
          <p className="mt-10 max-w-2xl text-xs leading-relaxed text-white/50">
            {dict.landing.shariaDisclaimer}{' '}
            <Link href={'/shariah' as Route} className="-my-2.5 inline-block py-2.5 underline underline-offset-2 hover:text-white">
              {c.shariahLink}
            </Link>
            {c.shariahTail}
          </p>
        </div>
      </section>

      <section id="trust" className="relative z-10 scroll-mt-24 border-t border-[#0d5c45]/10 bg-white/60">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#c5a044]">
            {c.trustEyebrow}
          </p>
          <h2 className="mt-3 max-w-2xl text-3xl font-bold tracking-tight text-[#0b4a3c] sm:text-4xl">
            {c.trustTitle}
          </h2>
          <dl className="mt-12 grid gap-8 md:grid-cols-2">
            {c.trust.map((item) => (
              <div key={item.q}>
                <dt className="text-lg font-bold tracking-tight text-[#0b4a3c]">{item.q}</dt>
                <dd className="mt-2 text-sm leading-relaxed text-[#5a6f66]">{item.a}</dd>
              </div>
            ))}
          </dl>
          <div className="mt-10">
            <Button
              size="lg"
              variant="outline"
              className="min-h-12 border-[#0d5c45]/40 text-[#0d5c45]"
              asChild
            >
              <Link href="/pricing">{c.seePricing}</Link>
            </Button>
          </div>
        </div>
      </section>

      <section className="relative z-10 border-t border-[#0d5c45]/10">
        <div className="mx-auto flex max-w-6xl flex-col items-start gap-6 px-4 py-16 sm:px-6 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-3xl font-bold tracking-tight text-[#0b4a3c]">
              {c.readyTitle}
            </h2>
            <p className="mt-2 max-w-lg text-base text-[#5a6f66]">
              {c.readyLead}
            </p>
          </div>
          <Button
            size="lg"
            className="min-h-12 bg-[#0d5c45] text-white hover:bg-[#0a4a37]"
            asChild
          >
            <Link href="/welcome">{dict.landing.startWithPhone}</Link>
          </Button>
        </div>
      </section>

      <footer className="relative z-10 border-t border-[#0d5c45]/10 bg-white/70">
        <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-10 sm:px-6 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-lg font-bold tracking-tight text-[#0b4a3c]">{APP_NAME}</p>
            <p className="mt-1 text-sm text-[#5a6f66]">{dict.brand.tagline}</p>
            <p className="mt-3 text-xs text-[#7a8f86]">jameiyah.com · Jameiyah Limited</p>
            <PesaraCredit className="mt-3" />
          </div>
          <nav className="flex flex-wrap gap-4 text-sm font-medium text-[#0d5c45]">
            <Link href="/pricing" className="inline-flex min-h-11 items-center hover:underline">
              {c.footerPricing}
            </Link>
            <Link href="/sadaka" className="inline-flex min-h-11 items-center hover:underline">
              {dict.common.sadaka}
            </Link>
            <Link href="/support" className="inline-flex min-h-11 items-center hover:underline">
              {dict.common.support}
            </Link>
            <Link href="/login" className="inline-flex min-h-11 items-center hover:underline">
              {dict.common.signIn}
            </Link>
            <Link href="/privacy" className="inline-flex min-h-11 items-center hover:underline">
              {c.footerPrivacy}
            </Link>
            <Link href="/terms" className="inline-flex min-h-11 items-center hover:underline">
              {c.footerTerms}
            </Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}
