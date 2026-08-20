import Link from 'next/link';
import type { Route } from 'next';
import { APP_NAME } from '@jamiya/shared';
import { Button } from '@jamiya/ui';
import { PublicSiteHeader } from '@/components/public-site-header';
import { getDictionary } from '@/i18n/get-dictionary';

export default async function LandingPage() {
  const { locale, dict } = await getDictionary();

  return (
    <div className="relative min-h-dvh overflow-x-hidden bg-background text-foreground">
      <div
        aria-hidden
        className="amanah-geo pointer-events-none absolute inset-0 opacity-90"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-[70vh] bg-[radial-gradient(ellipse_at_top,_rgba(11,92,66,0.12)_0%,_transparent_58%)]"
      />

      <div className="relative z-10 mx-auto w-full max-w-6xl px-4 pt-[max(1rem,env(safe-area-inset-top))] sm:px-6 sm:py-6">
        <PublicSiteHeader
          locale={locale}
          languageLabel={dict.common.language}
          links={[
            { href: '/pricing' as Route, label: 'Pricing' },
            { href: '/sadaka' as Route, label: dict.common.sadaka },
            { href: '/phone' as Route, label: dict.common.signIn, variant: 'ghost' },
          ]}
          cta={{ href: '/phone' as Route, label: dict.common.getStarted }}
        />
      </div>

      <main className="relative z-10 mx-auto grid w-full max-w-6xl gap-10 px-4 pb-[max(2.5rem,env(safe-area-inset-bottom))] pt-8 sm:px-6 lg:grid-cols-[1.05fr_0.95fr] lg:items-center lg:gap-14 lg:pt-12">
        <div>
          <p className="mb-4 text-xs font-semibold uppercase tracking-[0.2em] text-accent">
            {dict.brand.tagline}
          </p>
          <h1 className="max-w-xl text-4xl font-bold leading-[1.05] tracking-tight text-foreground sm:text-5xl md:text-6xl">
            {APP_NAME}
          </h1>
          <p className="mt-5 max-w-lg text-base leading-relaxed text-muted-foreground sm:text-lg">
            {dict.brand.description}
          </p>
          <div className="mt-8 flex w-full max-w-md flex-col gap-3 sm:flex-row sm:items-center">
            <Button size="lg" className="min-h-12 w-full sm:w-auto" asChild>
              <Link href="/phone">{dict.landing.startWithPhone}</Link>
            </Button>
            <Button size="lg" variant="outline" className="min-h-12 w-full sm:w-auto" asChild>
              <Link href="/pricing">{dict.landing.joinCircle}</Link>
            </Button>
          </div>
          <p className="mt-4 text-sm text-muted-foreground">
            {dict.landing.preferEmail}{' '}
            <Link href="/login" className="font-semibold text-primary hover:underline">
              {dict.common.signIn}
            </Link>
            {' · '}
            <Link href="/register" className="font-semibold text-primary hover:underline">
              {dict.landing.createAccount}
            </Link>
          </p>
        </div>

        <div className="relative mx-auto w-full max-w-sm lg:max-w-none">
          <div className="amanah-surface overflow-hidden p-4 sm:p-5">
            <div className="rounded-2xl bg-[linear-gradient(145deg,#0b5c42_0%,#0f766e_60%,#0b5c42_100%)] p-5 text-primary-foreground">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/70">
                Total Amanah
              </p>
              <p className="amanah-money mt-2 text-3xl font-bold tracking-tight">KES 84,250.00</p>
              <p className="mt-1 text-sm text-white/80">↑ KES 12,400 this month</p>
              <div className="mt-5 grid grid-cols-2 gap-2">
                {['Add money', 'Send', 'Save', 'Withdraw'].map((label) => (
                  <div
                    key={label}
                    className="rounded-xl bg-white/10 px-3 py-2.5 text-center text-xs font-semibold backdrop-blur-sm"
                  >
                    {label}
                  </div>
                ))}
              </div>
            </div>
            <div className="mt-4 space-y-3">
              {[
                { name: 'Family Circle', amount: 'KES 42,000', meta: '8 members · 84%' },
                { name: 'Business Circle', amount: 'KES 27,500', meta: '5 members · 61%' },
              ].map((circle) => (
                <div
                  key={circle.name}
                  className="rounded-2xl border border-border/70 bg-background/70 px-4 py-3"
                >
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-semibold">{circle.name}</p>
                    <p className="amanah-money text-sm font-bold">{circle.amount}</p>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">{circle.meta}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </main>

      <section className="relative z-10 border-t border-border/60 bg-card/50">
        <div className="mx-auto grid max-w-6xl gap-8 px-4 py-12 sm:px-6 md:grid-cols-3">
          {[
            {
              title: 'One place for all your circles',
              body: 'Family, friends, business, and community — each circle feels like a real financial account.',
            },
            {
              title: 'Money that works for communities',
              body: 'Contribute, pay out, and track every shilling with Shariah-conscious rails.',
            },
            {
              title: 'Built for trust',
              body: 'KYC, audit trails, dual approval, and an Amanah Score that reflects consistency — not hype.',
            },
          ].map((item) => (
            <div key={item.title}>
              <h2 className="text-lg font-bold tracking-tight">{item.title}</h2>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{item.body}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
