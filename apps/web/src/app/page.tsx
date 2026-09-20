import Image from 'next/image';
import Link from 'next/link';
import type { Route } from 'next';
import type { Metadata } from 'next';
import { APP_NAME, APP_DESCRIPTION, APP_TAGLINE } from '@jamiya/shared';
import { Button } from '@jamiya/ui';
import { PublicSiteHeader } from '@/components/public-site-header';
import { getDictionary } from '@/i18n/get-dictionary';

export const metadata: Metadata = {
  title: `${APP_NAME} - ${APP_TAGLINE}`,
  description: APP_DESCRIPTION,
  openGraph: {
    title: APP_NAME,
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

  return (
    <div className="relative min-h-dvh overflow-x-hidden bg-[#f6f8f7] text-foreground">
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
            { href: '/#shariah' as Route, label: dict.landing.shariaEyebrow },
            { href: '/pricing' as Route, label: 'Pricing' },
            { href: '/sadaka' as Route, label: dict.common.sadaka },
            { href: '/phone' as Route, label: dict.common.signIn, variant: 'ghost' },
          ]}
          cta={{ href: '/welcome' as Route, label: dict.landing.startWithPhone }}
        />
      </div>

      <section className="relative z-10 mx-auto flex min-h-[88dvh] w-full max-w-6xl flex-col justify-center px-4 pb-16 pt-10 sm:px-6 lg:pt-6">
        <div className="grid items-center gap-10 lg:grid-cols-2 lg:gap-8">
          <div className="order-2 lg:order-1">
            <p className="mb-5 text-xs font-semibold uppercase tracking-[0.22em] text-[#0d5c45]">
              {dict.brand.tagline}
            </p>
            <h1 className="max-w-xl text-5xl font-bold leading-none tracking-tight text-[#0b4a3c] sm:text-6xl md:text-7xl">
              {APP_NAME}
            </h1>
            <p className="mt-5 max-w-md text-base leading-relaxed text-[#3d524a] sm:text-lg">
              {dict.brand.description}
            </p>
            <div className="mt-9 flex w-full max-w-md flex-col gap-3 sm:flex-row sm:items-center">
              <Button
                size="lg"
                className="min-h-12 w-full bg-[#0d5c45] text-white hover:bg-[#0a4a37] sm:w-auto"
                asChild
              >
                <Link href="/welcome">{dict.landing.startWithPhone}</Link>
              </Button>
              <Button
                size="lg"
                variant="outline"
                className="min-h-12 w-full border-[#0d5c45]/40 text-[#0d5c45] sm:w-auto"
                asChild
              >
                <Link href="/#how">{dict.landing.joinCircle}</Link>
              </Button>
            </div>
            <p className="mt-5 text-sm text-[#5a6f66]">
              {dict.landing.preferEmail}{' '}
              <Link href="/login" className="font-semibold text-[#0d5c45] hover:underline">
                {dict.common.signIn}
              </Link>
              {' · '}
              <Link href="/register" className="font-semibold text-[#0d5c45] hover:underline">
                {dict.landing.createAccount}
              </Link>
            </p>
          </div>

          <div className="order-1 flex justify-center lg:order-2 lg:justify-end">
            <div className="relative">
              <div
                aria-hidden
                className="absolute -inset-8 rounded-full blur-2xl"
                style={{
                  background:
                    'radial-gradient(circle, rgba(197, 160, 68, 0.22) 0%, transparent 68%)',
                }}
              />
              <Image
                src="/brand/jameiyah-mark.png"
                alt=""
                width={420}
                height={420}
                priority
                className="relative h-auto w-72 object-contain sm:w-[26rem] lg:w-[28rem]"
                style={{ filter: 'drop-shadow(0 24px 48px rgba(11, 74, 60, 0.18))' }}
              />
            </div>
          </div>
        </div>
      </section>

      <section id="how" className="relative z-10 scroll-mt-24 border-t border-[#0d5c45]/10 bg-white/50">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#c5a044]">
            How it works
          </p>
          <h2 className="mt-3 max-w-2xl text-3xl font-bold tracking-tight text-[#0b4a3c] sm:text-4xl">
            Circles, wallet, and trust - in one place
          </h2>
          <p className="mt-3 max-w-2xl text-base leading-relaxed text-[#5a6f66]">
            Create or join a savings circle, contribute on schedule, and keep every shilling
            visible to the people who share it.
          </p>
          <ol className="mt-12 grid gap-10 md:grid-cols-3">
            {[
              {
                step: '01',
                title: 'Start or join a circle',
                body: 'Merry-go-round, savings, or table banking - invite members with a link or code.',
              },
              {
                step: '02',
                title: 'Contribute on time',
                body: 'Pay dues from your wallet, get reminders, and see who is current.',
              },
              {
                step: '03',
                title: 'Grow with trust',
                body: 'Statements, officer tools, KYC, and audit trails keep community money clear.',
              },
            ].map((item) => (
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
            {dict.landing.shariaDisclaimer}
          </p>
        </div>
      </section>

      <section className="relative z-10 border-t border-[#0d5c45]/10">
        <div className="mx-auto flex max-w-6xl flex-col items-start gap-6 px-4 py-16 sm:px-6 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-3xl font-bold tracking-tight text-[#0b4a3c]">
              Ready for your circle?
            </h2>
            <p className="mt-2 max-w-lg text-base text-[#5a6f66]">
              Sign in with your Kenyan phone number and start in minutes.
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
            <p className="mt-3 text-xs text-[#7a8f86]">
              jameiyah.com · jameiyah.co.ke · Jameiyah Limited
            </p>
          </div>
          <nav className="flex flex-wrap gap-4 text-sm font-medium text-[#0d5c45]">
            <Link href="/pricing" className="hover:underline">
              Pricing
            </Link>
            <Link href="/sadaka" className="hover:underline">
              {dict.common.sadaka}
            </Link>
            <Link href="/support" className="hover:underline">
              {dict.common.support}
            </Link>
            <Link href="/phone" className="hover:underline">
              {dict.common.signIn}
            </Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}
