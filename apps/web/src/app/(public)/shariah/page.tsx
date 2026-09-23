import Link from 'next/link';
import type { Route } from 'next';
import type { Metadata } from 'next';
import { ChevronRight } from 'lucide-react';
import { Button } from '@jamiya/ui';
import { JameiyahLogo } from '@/components/amanah-logo';
import { getDictionary } from '@/i18n/get-dictionary';
import { LanguageSwitcher } from '@/i18n/language-switcher';

export const metadata: Metadata = {
  title: 'Shariah on Jameiyah',
};

export default async function ShariahPage() {
  const { locale, dict } = await getDictionary();
  const s = dict.shariahPage;

  const pillars = [
    { title: s.allowTitle, body: s.allowBody },
    { title: s.avoidTitle, body: s.avoidBody },
    { title: s.feesTitle, body: s.feesBody },
    { title: s.boardTitle, body: s.boardBody },
  ];

  const links: Array<{ href: Route; title: string }> = [
    { href: '/zakat' as Route, title: s.linkZakat },
    { href: '/sadaka' as Route, title: s.linkSadaka },
    { href: '/finance/qard' as Route, title: s.linkQard },
    { href: '/help' as Route, title: s.linkHelp },
  ];

  return (
    <main className="amanah-ambient min-h-dvh bg-background">
      <div className="mx-auto max-w-3xl space-y-6 px-4 py-6 sm:px-6 sm:py-10">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <JameiyahLogo href={'/' as Route} size="md" tone="brand" />
          <div className="flex flex-wrap items-center gap-2">
            <Button asChild variant="outline" className="min-h-11">
              <Link href={'/dashboard' as Route}>{dict.common.home}</Link>
            </Button>
            <LanguageSwitcher locale={locale} label={dict.common.language} />
          </div>
        </header>

        <header className="space-y-2">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-primary">
            {s.eyebrow}
          </p>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
            {s.title}
          </h1>
          <p className="max-w-2xl text-sm text-muted-foreground sm:text-base">{s.lead}</p>
        </header>

        <section className="space-y-2.5">
          <h2 className="text-sm font-semibold text-foreground">{s.pillarsTitle}</h2>
          <ul className="amanah-surface divide-y divide-border/70">
            {pillars.map((item) => (
              <li key={item.title} className="space-y-1 px-4 py-4 sm:px-5">
                <p className="text-sm font-semibold text-foreground">{item.title}</p>
                <p className="text-sm text-muted-foreground">{item.body}</p>
              </li>
            ))}
          </ul>
        </section>

        <section className="space-y-2.5">
          <h2 className="text-sm font-semibold text-foreground">{s.disclaimerTitle}</h2>
          <div className="amanah-surface px-4 py-4 sm:px-5">
            <p className="text-sm text-muted-foreground">{s.disclaimerBody}</p>
          </div>
        </section>

        <section className="space-y-2.5">
          <h2 className="text-sm font-semibold text-foreground">{s.relatedTitle}</h2>
          <ul className="amanah-surface divide-y divide-border/70">
            {links.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className="flex min-h-11 items-center justify-between gap-3 px-4 py-3 text-sm font-semibold text-foreground transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 sm:px-5"
                >
                  <span>{item.title}</span>
                  <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                </Link>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </main>
  );
}
