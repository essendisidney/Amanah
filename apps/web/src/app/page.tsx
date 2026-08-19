import Link from 'next/link';
import type { Route } from 'next';
import { APP_NAME } from '@jamiya/shared';
import { Button } from '@jamiya/ui';
import { PublicSiteHeader } from '@/components/public-site-header';
import { getDictionary } from '@/i18n/get-dictionary';

export default async function LandingPage() {
  const { locale, dict } = await getDictionary();

  return (
    <div
      className="relative min-h-dvh overflow-x-hidden bg-[#fbfcfa] text-foreground [color-scheme:light]"
      style={{ colorScheme: 'light' }}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,_#d1fae5_0%,_transparent_55%),linear-gradient(160deg,_#fbfcfa_0%,_#eef5f0_45%,_#f5ecd0_100%)]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.035]"
        style={{
          backgroundImage:
            'url("data:image/svg+xml,%3Csvg width=\'60\' height=\'60\' viewBox=\'0 0 60 60\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cg fill=\'none\' fill-rule=\'evenodd\'%3E%3Cg fill=\'%23047857\' fill-opacity=\'1\'%3E%3Cpath d=\'M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z\'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")',
        }}
      />

      <div className="relative z-10 mx-auto w-full max-w-6xl px-4 pt-[max(1rem,env(safe-area-inset-top))] sm:px-6 sm:py-6">
        <PublicSiteHeader
          locale={locale}
          languageLabel={dict.common.language}
          links={[
            { href: '/sadaka' as Route, label: dict.common.sadaka },
            { href: '/pricing' as Route, label: 'Pricing' },
            { href: '/phone' as Route, label: dict.common.signIn, variant: 'ghost' },
          ]}
          cta={{ href: '/phone' as Route, label: dict.common.getStarted }}
        />
      </div>

      <main className="relative z-10 mx-auto flex w-full max-w-6xl flex-col justify-center px-4 pb-[max(2rem,env(safe-area-inset-bottom))] pt-6 sm:min-h-[calc(100dvh-5.5rem)] sm:px-6 sm:pb-24 sm:pt-8">
        <p className="mb-3 text-xs font-medium uppercase tracking-[0.18em] text-accent sm:mb-4 sm:text-sm sm:tracking-[0.2em]">
          {dict.brand.tagline}
        </p>
        <h1 className="max-w-3xl font-[family-name:var(--font-display)] text-4xl font-semibold leading-[1.08] tracking-tight text-foreground sm:text-5xl md:text-7xl">
          {APP_NAME}
        </h1>
        <p className="mt-4 max-w-xl text-base leading-relaxed text-muted-foreground sm:mt-6 sm:text-lg md:text-xl">
          {dict.brand.description}
        </p>
        <div className="mt-8 flex w-full max-w-md flex-col gap-3 sm:mt-10 sm:max-w-none sm:flex-row sm:flex-wrap sm:items-center sm:gap-4">
          <Button size="lg" className="min-h-12 w-full sm:w-auto" asChild>
            <Link href="/phone">{dict.landing.startWithPhone}</Link>
          </Button>
          <Button size="lg" variant="outline" className="min-h-12 w-full sm:w-auto" asChild>
            <Link href="/phone">{dict.landing.joinCircle}</Link>
          </Button>
        </div>
        <p className="mt-4 max-w-md text-sm leading-relaxed text-muted-foreground">
          {dict.landing.preferEmail}{' '}
          <Link href="/login" className="font-medium text-primary hover:underline">
            {dict.common.signIn}
          </Link>
          {' · '}
          <Link href="/register" className="font-medium text-primary hover:underline">
            {dict.landing.createAccount}
          </Link>
        </p>
      </main>
    </div>
  );
}
