import Image from 'next/image';
import Link from 'next/link';
import type { Route } from 'next';
import type { Metadata } from 'next';
import { APP_NAME, APP_DESCRIPTION } from '@jamiya/shared';
import { Button } from '@jamiya/ui';
import { PublicSiteHeader } from '@/components/public-site-header';
import { PesaraCredit } from '@/components/pesara-credit';
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
            { href: '/#circles' as Route, label: 'Circles' },
            { href: '/shariah' as Route, label: dict.landing.shariaEyebrow },
            { href: '/pricing' as Route, label: 'Pricing' },
            { href: '/sadaka' as Route, label: dict.common.sadaka },
            { href: '/login' as Route, label: dict.common.signIn, variant: 'ghost' },
          ]}
          cta={{ href: '/welcome' as Route, label: dict.landing.startWithPhone }}
        />
      </div>

      <section className="relative z-10 mx-auto flex min-h-[88dvh] w-full max-w-6xl flex-col justify-center px-4 pb-16 pt-10 sm:px-6 lg:pt-6">
        <div className="grid items-center gap-10 lg:grid-cols-2 lg:gap-8">
          <div className="order-1 lg:order-1">
            <p className="mb-5 text-xs font-semibold uppercase tracking-[0.22em] text-[#0d5c45]">
              {dict.brand.tagline}
            </p>
            <h1 className="max-w-xl text-4xl font-bold leading-[1.05] tracking-tight text-[#0b4a3c] sm:text-5xl md:text-6xl">
              Save together. See every shilling. Stay riba-free.
            </h1>
            <p className="mt-5 max-w-md text-base leading-relaxed text-[#3d524a] sm:text-lg">
              Jameiyah is the digital home for Kenyan circles — merry-go-round, table banking, and
              savings. Officers replace the spreadsheet. Members see what they paid.
            </p>
            <div className="mt-9 flex w-full max-w-md flex-col gap-3 sm:flex-row sm:items-center">
              <Button
                size="lg"
                className="min-h-12 w-full bg-[#0d5c45] text-white hover:bg-[#0a4a37] sm:w-auto"
                asChild
              >
                <Link href="/circles/new">Create a circle</Link>
              </Button>
              <Button
                size="lg"
                variant="outline"
                className="min-h-12 w-full border-[#0d5c45]/40 text-[#0d5c45] sm:w-auto"
                asChild
              >
                <Link href="/circles?redeem=1">Join with a code</Link>
              </Button>
            </div>
            <p className="mt-3 text-sm text-[#5a6f66]">
              New here?{' '}
              <Link href="/welcome" className="font-semibold text-[#0d5c45] hover:underline">
                {dict.landing.startWithPhone}
              </Link>
            </p>
            <ul className="mt-6 flex max-w-lg flex-wrap gap-2 text-xs font-medium text-[#0b4a3c]">
              {['No interest (riba)', 'Private to your circle', 'Phone, email, or Google', 'Member statements'].map(
                (item) => (
                  <li key={item} className="rounded-full border border-[#0d5c45]/20 bg-white/80 px-3 py-1.5">
                    {item}
                  </li>
                ),
              )}
            </ul>
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

          <div className="order-2 flex justify-center lg:order-2 lg:justify-end">
            <div className="relative w-full max-w-sm">
              <div
                aria-hidden
                className="absolute -inset-8 rounded-full blur-2xl"
                style={{
                  background:
                    'radial-gradient(circle, rgba(197, 160, 68, 0.22) 0%, transparent 68%)',
                }}
              />
              <div className="relative overflow-hidden rounded-2xl border border-[#0d5c45]/20 bg-white p-5 shadow-[0_8px_28px_rgba(11,74,60,0.08)]">
                <p className="inline-flex rounded-md bg-[#f7f0de] px-2 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-[#8a6d1f]">
                  Sample preview — not live data
                </p>
                <p className="mt-3 font-[family-name:var(--font-display)] text-xl font-semibold text-[#0b4a3c]">
                  Sisters Circle
                </p>
                <p className="mt-1 text-sm text-[#5a6f66]">Merry-go-round · 8/10 members · cycle 2/8</p>
                <div className="mt-4 flex items-end justify-between gap-3">
                  <div>
                    <p className="text-[11px] font-medium uppercase tracking-wide text-[#5a6f66]">
                      This month
                    </p>
                    <p className="mt-0.5 text-2xl font-bold tabular-nums text-[#0b4a3c]">KES 2,000</p>
                  </div>
                  <span className="rounded-full bg-[#e6f2ed] px-3 py-1 text-xs font-semibold text-[#0d5c45]">
                    Due soon
                  </span>
                </div>
                <Image
                  src="/brand/jameiyah-mark.png"
                  alt=""
                  width={120}
                  height={120}
                  priority
                  className="pointer-events-none absolute -bottom-4 -right-4 h-28 w-28 opacity-20"
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="circles" className="relative z-10 scroll-mt-24 border-t border-[#0d5c45]/10 bg-white/70">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#c5a044]">
            Built for how circles already work
          </p>
          <h2 className="mt-3 max-w-2xl text-3xl font-bold tracking-tight text-[#0b4a3c] sm:text-4xl">
            One practice. Many names. Your chama, recorded.
          </h2>
          <p className="mt-3 max-w-2xl text-base leading-relaxed text-[#5a6f66]">
            Merry-go-round, chama, jam&apos;iyah, susu, esusu, tontine — communities have pooled money
            this way for generations. Jameiyah keeps that trust, and replaces the notebook.
          </p>
          <ul className="mt-12 grid gap-6 md:grid-cols-2">
            {[
              {
                title: 'Merry-go-round',
                body: 'Monthly contributions, payout turns, and a board that shows who has received the pot.',
                href: null as Route | null,
              },
              {
                title: 'Table banking',
                body: 'Share buy-in, monthly savings, and loans. Paste past Excel records once names match, or enter one member at a time.',
                href: null as Route | null,
              },
              {
                title: 'Savings',
                body: 'A contribution calendar and shared goals — school fees, a trip, a wedding — without a rotating pot.',
                href: null as Route | null,
              },
              {
                title: 'Sadaka & zakat',
                body: 'Give in the open. Campaigns with receipts, and a zakat calculator that explains the nisab.',
                href: '/sadaka' as Route,
              },
            ].map((item) => (
              <li key={item.title} className="rounded-2xl border border-[#0d5c45]/10 bg-white p-6">
                <h3 className="text-xl font-bold tracking-tight text-[#0b4a3c]">{item.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-[#5a6f66]">{item.body}</p>
                {item.href ? (
                  <Link
                    href={item.href}
                    className="mt-4 inline-block text-sm font-semibold text-[#0d5c45] hover:underline"
                  >
                    Open giving →
                  </Link>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="relative z-10 border-t border-[#0d5c45]/10">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#c5a044]">Who it is for</p>
          <h2 className="mt-3 max-w-2xl text-3xl font-bold tracking-tight text-[#0b4a3c] sm:text-4xl">
            Officers run the books. Members see their own.
          </h2>
          <div className="mt-12 grid gap-10 md:grid-cols-3">
            {[
              {
                title: 'Circle officers',
                body: 'Invite by phone, record shares and monthly savings, import a past sheet, and export statements. The Excel file stays a backup, not the only book.',
              },
              {
                title: 'Members',
                body: 'Join with a code from WhatsApp, pay from Money, and open your statement. You see your circle — not everyone else\u2019s private groups.',
              },
              {
                title: 'Mosques & campaigns',
                body: 'Publish a sadaka page, share a link, and give donors a receipt. Zakat stays a calculator, not a hidden fee.',
              },
            ].map((item) => (
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
            {dict.landing.shariaDisclaimer}{' '}
            <Link href={'/shariah' as Route} className="underline underline-offset-2 hover:text-white">
              Full Shariah stance
            </Link>
            . Jameiyah is community software, not a bank and not an investment fund. We do not claim
            a regulator licence or a named Shariah board until one is appointed and published.
          </p>
        </div>
      </section>

      <section id="trust" className="relative z-10 scroll-mt-24 border-t border-[#0d5c45]/10 bg-white/60">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#c5a044]">
            What serious platforms show — stated plainly
          </p>
          <h2 className="mt-3 max-w-2xl text-3xl font-bold tracking-tight text-[#0b4a3c] sm:text-4xl">
            Trust you can check, not a slogan.
          </h2>
          <dl className="mt-12 grid gap-8 md:grid-cols-2">
            {[
              {
                q: 'Where does the money sit?',
                a: 'Circle records live in Jameiyah. Wallet top-ups use the payment providers configured for your account (such as M-Pesa or card). Officers still reconcile the circle bank account.',
              },
              {
                q: 'Who can see a payment?',
                a: 'Officers of that circle, and the member it belongs to. Other circles on the platform cannot open your books.',
              },
              {
                q: 'Can we bring last year’s Excel?',
                a: 'Yes for table banking. Paste the sheet, preview every name, and import only when each row matches a member. Nothing is skipped quietly.',
              },
              {
                q: 'What does it cost?',
                a: 'Group plans are listed in Kenyan shillings. A small circle can start free. Officers change the plan from the circle console.',
              },
            ].map((item) => (
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
              <Link href="/pricing">See pricing</Link>
            </Button>
          </div>
        </div>
      </section>

      <section className="relative z-10 border-t border-[#0d5c45]/10">
        <div className="mx-auto flex max-w-6xl flex-col items-start gap-6 px-4 py-16 sm:px-6 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-3xl font-bold tracking-tight text-[#0b4a3c]">
              Ready for your circle?
            </h2>
            <p className="mt-2 max-w-lg text-base text-[#5a6f66]">
              Sign in with phone SMS, email, or Google — and start in minutes.
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
            <Link href="/pricing" className="hover:underline">
              Pricing
            </Link>
            <Link href="/sadaka" className="hover:underline">
              {dict.common.sadaka}
            </Link>
            <Link href="/support" className="hover:underline">
              {dict.common.support}
            </Link>
            <Link href="/login" className="hover:underline">
              {dict.common.signIn}
            </Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}
