import Link from 'next/link';
import { APP_NAME } from '@jamiya/shared';
import { Button } from '@jamiya/ui';
import { getDictionary } from '@/i18n/get-dictionary';
import { LanguageSwitcher } from '@/i18n/language-switcher';

export default async function LandingPage() {
  const { locale, dict } = await getDictionary();

  return (
    <div className="relative min-h-dvh overflow-hidden">
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

      <header className="relative z-10 mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-6">
        <span className="font-[family-name:var(--font-display)] text-2xl font-semibold tracking-tight text-primary">
          {APP_NAME}
        </span>
        <nav className="flex items-center gap-3">
          <LanguageSwitcher locale={locale} label={dict.common.language} />
          <Button variant="ghost" asChild>
            <Link href="/sadaka">{dict.common.sadaka}</Link>
          </Button>
          <Button variant="ghost" asChild>
            <Link href="/phone">{dict.common.signIn}</Link>
          </Button>
          <Button asChild>
            <Link href="/phone">{dict.common.getStarted}</Link>
          </Button>
        </nav>
      </header>

      <main className="relative z-10 mx-auto flex min-h-[calc(100dvh-5.5rem)] w-full max-w-6xl flex-col justify-center px-6 pb-24 pt-8">
        <p className="mb-4 text-sm font-medium uppercase tracking-[0.2em] text-accent">
          {dict.brand.tagline}
        </p>
        <h1 className="max-w-3xl font-[family-name:var(--font-display)] text-5xl font-semibold leading-[1.08] tracking-tight text-foreground md:text-7xl">
          {APP_NAME}
        </h1>
        <p className="mt-6 max-w-xl text-lg leading-relaxed text-muted-foreground md:text-xl">
          {dict.brand.description}
        </p>
        <div className="mt-10 flex flex-wrap items-center gap-4">
          <Button size="lg" asChild>
            <Link href="/phone">{dict.landing.startWithPhone}</Link>
          </Button>
          <Button size="lg" variant="outline" asChild>
            <Link href="/phone">{dict.landing.joinCircle}</Link>
          </Button>
        </div>
        <p className="mt-4 text-sm text-muted-foreground">
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
