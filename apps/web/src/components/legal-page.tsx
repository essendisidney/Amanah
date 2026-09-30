import Link from 'next/link';
import type { Route } from 'next';
import type { ReactNode } from 'react';
import { JameiyahLogo } from '@/components/jameiyah-logo';

export type LegalSection = { title: string; body: ReactNode };

export function LegalPage({
  title,
  updated,
  lead,
  sections,
}: {
  title: string;
  updated: string;
  lead: string;
  sections: LegalSection[];
}) {
  return (
    <main className="jameiyah-ambient min-h-dvh bg-background">
      <div className="mx-auto max-w-3xl space-y-6 px-4 py-6 sm:px-6 sm:py-10">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <JameiyahLogo href={'/' as Route} size="md" tone="brand" />
          <nav className="flex gap-4 text-sm font-medium text-primary">
            <Link href={'/privacy' as Route} className="hover:underline">Privacy</Link>
            <Link href={'/terms' as Route} className="hover:underline">Terms</Link>
          </nav>
        </header>

        <header className="space-y-2">
          <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
            {title}
          </h1>
          <p className="text-xs text-muted-foreground">Last updated {updated}</p>
          <p className="max-w-2xl text-sm text-muted-foreground sm:text-base">{lead}</p>
        </header>

        <div className="jameiyah-surface divide-y divide-border/70">
          {sections.map((s, i) => (
            <section key={s.title} className="space-y-2 px-4 py-4 sm:px-5">
              <h2 className="text-sm font-semibold text-foreground">
                {i + 1}. {s.title}
              </h2>
              <div className="space-y-2 text-sm leading-relaxed text-muted-foreground">
                {s.body}
              </div>
            </section>
          ))}
        </div>

        <p className="text-xs text-muted-foreground">
          Jameiyah Limited · Nairobi, Kenya ·{' '}
          <Link href={'/support' as Route} className="underline-offset-4 hover:underline">
            Contact us
          </Link>
        </p>
      </div>
    </main>
  );
}
