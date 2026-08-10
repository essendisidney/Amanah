import Link from 'next/link';
import type { Route } from 'next';
import { APP_NAME } from '@jamiya/shared';
import { createClient } from '@/lib/supabase/server';

export default async function PublicSadakaLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <div className="min-h-dvh bg-[linear-gradient(180deg,#fbfcfa_0%,#eef5f0_100%)]">
      <header className="sticky top-0 z-40 border-b border-border/70 bg-card/85 backdrop-blur">
        <div className="mx-auto flex h-14 w-full max-w-6xl items-center justify-between gap-3 px-6">
          <div className="flex min-w-0 items-center gap-4">
            <Link
              href={(user ? '/dashboard' : '/') as Route}
              className="font-[family-name:var(--font-display)] text-lg font-semibold text-primary"
            >
              {APP_NAME}
            </Link>
            <nav className="flex items-center gap-1 overflow-x-auto text-sm" aria-label="Sadaka">
              <Link
                href={'/sadaka' as Route}
                className="whitespace-nowrap rounded-md px-2 py-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                Active campaigns
              </Link>
              <Link
                href={'/sadaka/new' as Route}
                className="whitespace-nowrap rounded-md px-2 py-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                Start campaign
              </Link>
              <Link
                href={'/sadaka/my' as Route}
                className="whitespace-nowrap rounded-md px-2 py-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                My campaigns
              </Link>
              <Link
                href={'/sadaka/adopt' as Route}
                className="whitespace-nowrap rounded-md px-2 py-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                Adopt
              </Link>
            </nav>
          </div>
          {user ? (
            <Link
              href={'/dashboard' as Route}
              className="shrink-0 rounded-md border border-border px-3 py-1.5 text-sm"
            >
              Dashboard
            </Link>
          ) : (
            <Link
              href={'/login?next=/sadaka' as Route}
              className="shrink-0 rounded-md border border-border px-3 py-1.5 text-sm"
            >
              Sign in
            </Link>
          )}
        </div>
      </header>
      {children}
    </div>
  );
}
