import Link from 'next/link';
import type { Route } from 'next';
import type { Metadata } from 'next';
import { ChevronRight } from 'lucide-react';
import { Button } from '@jamiya/ui';
import { getDictionary } from '@/i18n/get-dictionary';
import { ZakatCalculator } from './zakat-calculator';

export const metadata: Metadata = {
  title: 'Zakat calculator',
};

export default async function ZakatPage() {
  const { dict } = await getDictionary();

  return (
    <main className="jameiyah-ambient min-h-dvh bg-background">
      <div className="mx-auto max-w-3xl space-y-6 px-4 py-6 sm:px-6 sm:py-10">

        <header className="space-y-2">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-primary">
            Estimate only
          </p>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
            Zakat calculator
          </h1>
          <p className="max-w-2xl text-sm text-muted-foreground sm:text-base">
            2.5% of qualifying wealth after liabilities. Ask a scholar for your case.
          </p>
        </header>

        <ZakatCalculator />

        <section className="space-y-2.5">
          <h2 className="text-sm font-semibold text-foreground">Related</h2>
          <ul className="jameiyah-surface divide-y divide-border/70">
            <li>
              <Link
                href={'/shariah' as Route}
                className="flex min-h-11 items-center justify-between gap-3 px-4 py-3 text-sm font-semibold text-foreground transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 sm:px-5"
              >
                <span>Shariah stance</span>
                <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
              </Link>
            </li>
            <li>
              <Link
                href={'/sadaka' as Route}
                className="flex min-h-11 items-center justify-between gap-3 px-4 py-3 text-sm font-semibold text-foreground transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 sm:px-5"
              >
                <span>{dict.common.sadaka} campaigns</span>
                <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
              </Link>
            </li>
            <li>
              <Link
                href={'/support' as Route}
                className="flex min-h-11 items-center justify-between gap-3 px-4 py-3 text-sm font-semibold text-foreground transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 sm:px-5"
              >
                <span>{dict.support.title}</span>
                <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
              </Link>
            </li>
            <li>
              <Link
                href={'/help' as Route}
                className="flex min-h-11 items-center justify-between gap-3 px-4 py-3 text-sm font-semibold text-foreground transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 sm:px-5"
              >
                <span>{dict.help.title}</span>
                <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
              </Link>
            </li>
          </ul>
        </section>
      </div>
    </main>
  );
}
