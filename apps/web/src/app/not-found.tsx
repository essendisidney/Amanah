import type { Metadata, Route } from 'next';
import Link from 'next/link';
import { Button } from '@jamiya/ui';
import { SiteFooter, SiteHeaderBand } from '@/components/site-chrome';

export const metadata: Metadata = {
  title: 'Page not found',
  robots: { index: false },
};

export default function NotFound() {
  return (
    <div className="jameiyah-light jameiyah-premium text-foreground flex min-h-dvh flex-col bg-[#f5f3ee]">
      <SiteHeaderBand />
      <main className="mx-auto flex w-full max-w-xl flex-1 flex-col justify-center px-4 py-16 sm:px-6">
        <p className="text-primary text-sm font-semibold uppercase tracking-[0.16em]">404</p>
        <h1 className="mt-3 font-[family-name:var(--font-display)] text-3xl font-semibold sm:text-4xl">
          We could not find that page
        </h1>
        <p className="text-muted-foreground mt-3">
          The link may be old, or the page may have moved. Your circles and money are safe; nothing
          has changed there.
        </p>
        <p className="text-muted-foreground mt-1 text-sm" lang="sw">
          Ukurasa huu haupatikani. Miduara yako na pesa zako ziko salama.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Button asChild className="min-h-11">
            <Link href={'/dashboard' as Route}>Go to your home</Link>
          </Button>
          <Button asChild variant="outline" className="min-h-11">
            <Link href="/">Jameiyah homepage</Link>
          </Button>
          <Button asChild variant="ghost" className="min-h-11">
            <Link href={'/help' as Route}>Get help</Link>
          </Button>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
