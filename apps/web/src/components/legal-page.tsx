import Link from 'next/link';
import type { Route } from 'next';
import type { ReactNode } from 'react';

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
    <main className="min-h-dvh">
      <div className="mx-auto max-w-3xl space-y-8 px-4 py-12 sm:px-6 sm:py-16">
        <header className="space-y-3">
          <nav className="flex gap-4 text-xs font-semibold uppercase tracking-[0.22em] text-accent" aria-label="Legal">
            <Link href={'/privacy' as Route} className="inline-flex min-h-10 items-center hover:underline">
              Privacy
            </Link>
            <Link href={'/terms' as Route} className="inline-flex min-h-10 items-center hover:underline">
              Terms
            </Link>
          </nav>
          <h1 className="text-4xl font-bold tracking-tight text-foreground sm:text-5xl">{title}</h1>
          <p className="text-xs text-muted-foreground">Last updated {updated}</p>
          <p className="max-w-2xl text-[15px] leading-relaxed text-muted-foreground sm:text-base">{lead}</p>
        </header>

        <div className="jameiyah-surface divide-y divide-border/70">
          {sections.map((s, i) => (
            <section key={s.title} className="space-y-2 px-5 py-5 sm:px-7">
              <h2 className="text-base font-bold text-foreground">
                {i + 1}. {s.title}
              </h2>
              <div className="space-y-2 text-sm leading-relaxed text-muted-foreground">{s.body}</div>
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
