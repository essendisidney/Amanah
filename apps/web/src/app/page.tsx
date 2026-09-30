import Link from 'next/link';
import type { Route } from 'next';
import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { ArrowRight, ArrowUpRight, Check } from 'lucide-react';
import { APP_NAME, APP_DESCRIPTION } from '@jamiya/shared';
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

/* Palette: deep green #004038, night #03201b, gold #D8A038, paper #f5f3ee. */
const DISPLAY = 'font-[family-name:var(--font-grotesk)]';
const GOLD_BTN =
  'inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-[#D8A038] px-7 text-[15px] font-semibold text-[#1f1606] shadow-[0_12px_30px_-12px_rgba(216,160,56,0.8)] transition hover:bg-[#e6b451] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D8A038] focus-visible:ring-offset-2 focus-visible:ring-offset-[#03201b]';
const GHOST_DARK_BTN =
  'inline-flex min-h-12 items-center justify-center gap-2 rounded-full border border-white/25 px-7 text-[15px] font-semibold text-white transition hover:border-white/50 hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60';
const INK_BTN =
  'inline-flex min-h-12 items-center justify-center gap-2 rounded-full border border-[#0b1f1b]/20 px-7 text-[15px] font-semibold text-[#0b1f1b] transition hover:border-[#0b1f1b]/50 hover:bg-[#0b1f1b]/5';

function Eyebrow({ children, onDark = false }: { children: ReactNode; onDark?: boolean }) {
  return (
    <p
      className={`flex items-center gap-3 text-[11px] font-semibold uppercase tracking-[0.28em] ${
        onDark ? 'text-[#D8A038]' : 'text-[#9a6c12]'
      }`}
    >
      <span className={`h-px w-8 ${onDark ? 'bg-[#D8A038]/70' : 'bg-[#9a6c12]/60'}`} aria-hidden />
      {children}
    </p>
  );
}

/** Colour the last sentence of a headline gold. */
function SplitHeadline({ text }: { text: string }) {
  const parts = text.split(/(?<=\.)\s+/);
  const last = parts.pop() ?? '';
  return (
    <>
      {parts.map((p) => (
        <span key={p} className="block">
          {p}
        </span>
      ))}
      <span className="block text-[#D8A038]">{last}</span>
    </>
  );
}

export default async function LandingPage() {
  const { locale, dict } = await getDictionary();
  const c = landingCopy(locale);

  return (
    <div className="jameiyah-light relative min-h-dvh overflow-x-hidden bg-[#f5f3ee] text-[#0b1f1b]">
      {/* ─────────────────────────── HERO (night) ─────────────────────────── */}
      <section className="jameiyah-on-dark relative overflow-hidden bg-[#03201b] text-white">
        <div aria-hidden className="pointer-events-none absolute inset-0">
          <div
            className="absolute inset-0 opacity-[0.55]"
            style={{
              backgroundImage:
                'linear-gradient(rgba(255,255,255,0.045) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.045) 1px, transparent 1px)',
              backgroundSize: '64px 64px',
              maskImage: 'radial-gradient(ellipse 80% 70% at 60% 30%, #000 30%, transparent 75%)',
              WebkitMaskImage: 'radial-gradient(ellipse 80% 70% at 60% 30%, #000 30%, transparent 75%)',
            }}
          />
          <div className="absolute -right-40 -top-40 h-[560px] w-[560px] rounded-full bg-[#D8A038]/20 blur-[120px]" />
          <div className="absolute -left-40 top-1/3 h-[520px] w-[520px] rounded-full bg-[#00705f]/30 blur-[120px]" />
          <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-[#03201b] to-transparent" />
        </div>

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

        <div className="relative z-10 mx-auto grid w-full max-w-6xl items-center gap-14 px-4 pb-16 pt-14 sm:px-6 lg:grid-cols-[minmax(0,1fr)_360px] lg:gap-10 lg:pb-24 lg:pt-16">
          <div className="max-w-2xl">
            <p className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3.5 py-1.5 text-[11px] font-semibold uppercase tracking-[0.22em] text-white/80 backdrop-blur">
              <span className="h-1.5 w-1.5 rounded-full bg-[#D8A038] shadow-[0_0_12px_#D8A038]" aria-hidden />
              {dict.brand.tagline}
            </p>
            <h1
              className={`${DISPLAY} mt-7 text-[44px] font-bold leading-[0.98] tracking-[-0.035em] text-white sm:text-6xl lg:text-[76px]`}
            >
              <SplitHeadline text={c.heroTitle} />
            </h1>
            <p className="mt-7 max-w-lg text-[17px] leading-relaxed text-white/70">{c.heroLead}</p>

            <div className="mt-9 flex w-full max-w-md flex-col gap-3 sm:flex-row sm:items-center">
              <Link href="/circles/new" className={GOLD_BTN}>
                {c.createCircle}
                <ArrowRight className="h-4 w-4" aria-hidden />
              </Link>
              <Link href="/circles?redeem=1" className={GHOST_DARK_BTN}>
                {c.joinWithCode}
              </Link>
            </div>
            <p className="mt-4 text-sm text-white/55">
              {c.newHere}{' '}
              <Link href="/welcome" className="-my-2.5 inline-block py-2.5 font-semibold text-[#D8A038] hover:underline">
                {dict.landing.startWithPhone}
              </Link>
              <span className="mx-2 text-white/25">·</span>
              {dict.landing.preferEmail}{' '}
              <Link href="/login" className="-my-2.5 inline-block py-2.5 font-semibold text-white hover:underline">
                {dict.common.signIn}
              </Link>
            </p>

            <ul className="mt-9 flex max-w-lg flex-wrap gap-2 text-[13px] text-white/80">
              {c.chips.map((item) => (
                <li key={item} className="inline-flex items-center gap-1.5 rounded-full border border-white/12 bg-white/[0.04] px-3 py-1.5">
                  <Check className="h-3.5 w-3.5 text-[#D8A038]" strokeWidth={3} aria-hidden />
                  {item}
                </li>
              ))}
            </ul>
          </div>

          <div className="pt-4 lg:pt-0">
            <PhoneAdvert ad={c.ad} mock={c.mock} tone="dark" />
          </div>
        </div>

        {/* Stats strip */}
        <div className="relative z-10 border-t border-white/10">
          <dl className="mx-auto grid max-w-6xl grid-cols-2 px-4 sm:px-6 md:grid-cols-4">
            {c.stats.map((s, i) => (
              <div
                key={s.label}
                className={`py-7 ${i % 2 === 1 ? 'pl-6' : ''} ${i > 0 ? 'md:border-l md:border-white/10 md:pl-6' : ''} ${
                  i === 1 ? 'border-l border-white/10' : ''
                } ${i === 3 ? 'border-l border-white/10' : ''}`}
              >
                <dt className={`${DISPLAY} text-3xl font-bold tracking-tight text-white`}>{s.value}</dt>
                <dd className="mt-1 text-[13px] leading-snug text-white/55">{s.label}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      {/* ─────────────────────────── MARQUEE (gold) ─────────────────────────── */}
      <div className="relative z-10 overflow-hidden bg-[#D8A038] py-4 text-[#1f1606]" aria-hidden>
        <div className="jm-marquee flex w-max items-center gap-8 whitespace-nowrap">
          {[...c.marquee, ...c.marquee].map((word, i) => (
            <span key={`${word}-${i}`} className={`${DISPLAY} flex items-center gap-8 text-[15px] font-bold uppercase tracking-[0.14em]`}>
              {word}
              <span className="text-[#1f1606]/40">✦</span>
            </span>
          ))}
        </div>
      </div>

      {/* ─────────────────────────── CIRCLES (bento) ─────────────────────────── */}
      <section id="circles" className="relative z-10 scroll-mt-24">
        <div className="mx-auto max-w-6xl px-4 py-24 sm:px-6">
          <div className="grid gap-6 md:grid-cols-[1fr_1fr] md:items-end">
            <div>
              <Eyebrow>{c.circlesEyebrow}</Eyebrow>
              <h2 className={`${DISPLAY} mt-5 text-4xl font-bold leading-[1.02] tracking-[-0.03em] sm:text-5xl`}>{c.circlesTitle}</h2>
            </div>
            <p className="max-w-md text-[16px] leading-relaxed text-[#4d5f59] md:justify-self-end">{c.circlesLead}</p>
          </div>

          <ul className="mt-14 grid gap-4 md:grid-cols-6">
            {c.circleTypes.map((item, i) => {
              const featured = i === 0;
              const giving = i === 3;
              return (
                <li
                  key={item.title}
                  className={`group relative flex min-h-[240px] flex-col justify-between overflow-hidden rounded-[28px] p-7 transition ${
                    featured
                      ? 'bg-[#004038] text-white md:col-span-4'
                      : giving
                        ? 'bg-gradient-to-br from-[#f3e2b8] to-[#e9cf8e] text-[#1f1606] md:col-span-4'
                        : 'border border-[#0b1f1b]/8 bg-white md:col-span-2'
                  }`}
                >
                  {featured ? (
                    <div aria-hidden className="absolute -right-16 -top-16 h-56 w-56 rounded-full border-[28px] border-[#D8A038]/25" />
                  ) : null}
                  <p className={`${DISPLAY} relative text-sm font-semibold ${featured ? 'text-[#D8A038]' : 'text-[#9a6c12]'}`}>
                    0{i + 1}
                  </p>
                  <div className="relative mt-10">
                    <h3 className={`${DISPLAY} text-2xl font-bold tracking-tight sm:text-[28px]`}>{item.title}</h3>
                    <p className={`mt-2 max-w-md text-[15px] leading-relaxed ${featured ? 'text-white/70' : giving ? 'text-[#3d2c0a]' : 'text-[#4d5f59]'}`}>
                      {item.body}
                    </p>
                    {giving ? (
                      <Link href="/sadaka" className="mt-4 inline-flex min-h-11 items-center gap-1.5 text-sm font-bold text-[#1f1606] hover:underline">
                        {c.openGiving.replace(' →', '')}
                        <ArrowUpRight className="h-4 w-4" aria-hidden />
                      </Link>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      </section>

      {/* ─────────────────────────── WHO (white) ─────────────────────────── */}
      <section className="relative z-10 border-y border-[#0b1f1b]/8 bg-white">
        <div className="mx-auto max-w-6xl px-4 py-24 sm:px-6">
          <Eyebrow>{c.whoEyebrow}</Eyebrow>
          <h2 className={`${DISPLAY} mt-5 max-w-2xl text-4xl font-bold leading-[1.02] tracking-[-0.03em] sm:text-5xl`}>{c.whoTitle}</h2>
          <div className="mt-14 grid gap-10 md:grid-cols-3">
            {c.who.map((item, i) => (
              <div key={item.title} className="border-t-2 border-[#0b1f1b] pt-6">
                <p className={`${DISPLAY} text-5xl font-bold tracking-tight text-[#004038]/15`}>0{i + 1}</p>
                <h3 className={`${DISPLAY} mt-3 text-xl font-bold tracking-tight`}>{item.title}</h3>
                <p className="mt-2 text-[15px] leading-relaxed text-[#4d5f59]">{item.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─────────────────────────── HOW (night) ─────────────────────────── */}
      <section id="how" className="relative z-10 scroll-mt-24 overflow-hidden bg-[#03201b] text-white">
        <div aria-hidden className="absolute -left-32 bottom-0 h-[420px] w-[420px] rounded-full bg-[#00705f]/25 blur-[110px]" />
        <div className="relative mx-auto max-w-6xl px-4 py-24 sm:px-6">
          <div className="grid gap-6 md:grid-cols-2 md:items-end">
            <div>
              <Eyebrow onDark>{c.howEyebrow}</Eyebrow>
              <h2 className={`${DISPLAY} mt-5 text-4xl font-bold leading-[1.02] tracking-[-0.03em] sm:text-5xl`}>{c.howTitle}</h2>
            </div>
            <p className="max-w-md text-[16px] leading-relaxed text-white/65 md:justify-self-end">{c.howLead}</p>
          </div>
          <ol className="mt-14 grid gap-4 md:grid-cols-3">
            {c.steps.map((item, i) => (
              <li key={item.title} className="relative rounded-[24px] border border-white/10 bg-white/[0.03] p-7 backdrop-blur">
                <span className={`${DISPLAY} flex h-11 w-11 items-center justify-center rounded-full bg-[#D8A038] text-[15px] font-bold text-[#1f1606]`}>
                  {i + 1}
                </span>
                <h3 className={`${DISPLAY} mt-8 text-xl font-bold tracking-tight`}>{item.title}</h3>
                <p className="mt-2 text-[15px] leading-relaxed text-white/65">{item.body}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* ─────────────────────────── SHARIAH (paper) ─────────────────────────── */}
      <section id="shariah" className="relative z-10 scroll-mt-24 bg-[#efe9dc]">
        <div className="mx-auto max-w-6xl px-4 py-24 sm:px-6">
          <div className="grid gap-12 lg:grid-cols-[1.1fr_1fr]">
            <div>
              <Eyebrow>{dict.landing.shariaEyebrow}</Eyebrow>
              <h2 className={`${DISPLAY} mt-5 text-4xl font-bold leading-[1.02] tracking-[-0.03em] text-[#004038] sm:text-5xl`}>
                {dict.landing.shariaTitle}
              </h2>
              <p className="mt-5 max-w-lg text-[16px] leading-relaxed text-[#4d5f59]">{dict.landing.shariaLead}</p>
              <p className="mt-8 max-w-lg text-xs leading-relaxed text-[#6b7a75]">
                {dict.landing.shariaDisclaimer}{' '}
                <Link href={'/shariah' as Route} className="-my-2.5 inline-block py-2.5 font-semibold text-[#004038] underline underline-offset-2">
                  {c.shariahLink}
                </Link>
                {c.shariahTail}
              </p>
            </div>
            <div className="divide-y divide-[#0b1f1b]/10 border-y border-[#0b1f1b]/10">
              {[
                { title: dict.landing.shariaNoRibaTitle, body: dict.landing.shariaNoRibaBody },
                { title: dict.landing.shariaMutualTitle, body: dict.landing.shariaMutualBody },
                { title: dict.landing.shariaGivingTitle, body: dict.landing.shariaGivingBody },
              ].map((item) => (
                <div key={item.title} className="flex gap-4 py-6">
                  <span className="mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#004038] text-[#D8A038]">
                    <Check className="h-3.5 w-3.5" strokeWidth={3} aria-hidden />
                  </span>
                  <div>
                    <h3 className={`${DISPLAY} text-lg font-bold tracking-tight`}>{item.title}</h3>
                    <p className="mt-1 text-[15px] leading-relaxed text-[#4d5f59]">{item.body}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ─────────────────────────── TRUST (white) ─────────────────────────── */}
      <section id="trust" className="relative z-10 scroll-mt-24 bg-white">
        <div className="mx-auto grid max-w-6xl gap-12 px-4 py-24 sm:px-6 lg:grid-cols-[0.9fr_1.3fr]">
          <div className="lg:sticky lg:top-24 lg:self-start">
            <Eyebrow>{c.trustEyebrow}</Eyebrow>
            <h2 className={`${DISPLAY} mt-5 text-4xl font-bold leading-[1.02] tracking-[-0.03em] sm:text-5xl`}>{c.trustTitle}</h2>
            <Link href="/pricing" className={`${INK_BTN} mt-8`}>
              {c.seePricing}
              <ArrowRight className="h-4 w-4" aria-hidden />
            </Link>
          </div>
          <dl className="divide-y divide-[#0b1f1b]/10 border-y border-[#0b1f1b]/10">
            {c.trust.map((item) => (
              <div key={item.q} className="py-7">
                <dt className={`${DISPLAY} text-xl font-bold tracking-tight`}>{item.q}</dt>
                <dd className="mt-2 text-[15px] leading-relaxed text-[#4d5f59]">{item.a}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      {/* ─────────────────────────── CTA ─────────────────────────── */}
      <section className="relative z-10 bg-white pb-24">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="jameiyah-on-dark relative overflow-hidden rounded-[32px] bg-[#03201b] px-7 py-14 text-white sm:px-14 sm:py-16">
            <div aria-hidden className="absolute -right-24 -top-24 h-80 w-80 rounded-full bg-[#D8A038]/25 blur-[90px]" />
            <div aria-hidden className="absolute -bottom-10 right-10 h-40 w-40 rounded-full border-[22px] border-[#D8A038]/20" />
            <div className="relative max-w-xl">
              <Eyebrow onDark>{c.ctaEyebrow}</Eyebrow>
              <h2 className={`${DISPLAY} mt-5 text-4xl font-bold leading-[1.02] tracking-[-0.03em] sm:text-5xl`}>{c.readyTitle}</h2>
              <p className="mt-4 text-[16px] leading-relaxed text-white/65">{c.readyLead}</p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <Link href="/welcome" className={GOLD_BTN}>
                  {dict.landing.startWithPhone}
                  <ArrowRight className="h-4 w-4" aria-hidden />
                </Link>
                <Link href="/register" className={GHOST_DARK_BTN}>
                  {dict.landing.createAccount}
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─────────────────────────── FOOTER (night) ─────────────────────────── */}
      <footer className="jameiyah-on-dark relative z-10 bg-[#021814] text-white/70">
        <div className="mx-auto flex max-w-6xl flex-col gap-10 px-4 py-14 sm:px-6 md:flex-row md:items-end md:justify-between">
          <div>
            <p className={`${DISPLAY} text-2xl font-bold tracking-tight text-white`}>{APP_NAME}</p>
            <p className="mt-1 text-sm">{dict.brand.tagline}</p>
            <p className="mt-3 text-xs text-white/45">jameiyah.com · Jameiyah Limited</p>
            <PesaraCredit className="mt-3" />
          </div>
          <nav className="flex flex-wrap gap-x-6 gap-y-1 text-sm font-medium text-white/80">
            <Link href="/pricing" className="inline-flex min-h-11 items-center hover:text-white">
              {c.footerPricing}
            </Link>
            <Link href="/sadaka" className="inline-flex min-h-11 items-center hover:text-white">
              {dict.common.sadaka}
            </Link>
            <Link href="/support" className="inline-flex min-h-11 items-center hover:text-white">
              {dict.common.support}
            </Link>
            <Link href="/login" className="inline-flex min-h-11 items-center hover:text-white">
              {dict.common.signIn}
            </Link>
            <Link href="/privacy" className="inline-flex min-h-11 items-center hover:text-white">
              {c.footerPrivacy}
            </Link>
            <Link href="/terms" className="inline-flex min-h-11 items-center hover:text-white">
              {c.footerTerms}
            </Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}
