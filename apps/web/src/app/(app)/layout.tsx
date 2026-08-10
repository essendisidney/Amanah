import Link from 'next/link';
import type { Route } from 'next';
import { APP_NAME } from '@jamiya/shared';
import { isComplianceRole } from '@jamiya/auth';
import type { PlatformRole } from '@jamiya/types';
import { Button } from '@jamiya/ui';
import { signOutAction } from '@/features/auth';
import { NotificationRealtime } from '@/features/dashboard/components/notification-realtime';
import { createClient } from '@/lib/supabase/server';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let unread = 0;
  let showAdmin = false;

  if (user) {
    const [{ count }, { data: profile }] = await Promise.all([
      supabase
        .from('notifications')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .is('read_at', null),
      supabase.from('profiles').select('platform_role').eq('id', user.id).maybeSingle(),
    ]);
    unread = count ?? 0;
    const role = ((profile as unknown as { platform_role?: PlatformRole } | null)
      ?.platform_role ?? 'member') as PlatformRole;
    showAdmin = isComplianceRole(role);
  }

  const navItems: Array<{ href: Route; label: string }> = [
    { href: '/dashboard' as Route, label: 'Dashboard' },
    { href: '/circles' as Route, label: 'My circles' },
    { href: '/finance' as Route, label: 'Finance' },
    { href: '/sadaka' as Route, label: 'Sadaka' },
    { href: '/support' as Route, label: 'Support' },
    { href: '/notifications' as Route, label: 'Notifications' },
    { href: '/wallet' as Route, label: 'Wallet' },
    { href: '/profile' as Route, label: 'Profile' },
  ];

  if (showAdmin) {
    navItems.push({ href: '/admin' as Route, label: 'Admin' });
  }

  return (
    <div className="min-h-dvh bg-[linear-gradient(180deg,#fbfcfa_0%,#eef5f0_100%)]">
      <header className="sticky top-0 z-40 border-b border-border/70 bg-card/85 backdrop-blur">
        <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between gap-4 px-6">
          <div className="flex items-center gap-8">
            <Link
              href={'/dashboard' as Route}
              className="font-[family-name:var(--font-display)] text-xl font-semibold text-primary"
            >
              {APP_NAME}
            </Link>
            <nav className="hidden items-center gap-1 md:flex" aria-label="Primary">
              {navItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                >
                  {item.label}
                  {item.label === 'Notifications' && unread > 0 ? (
                    <span className="ml-2 inline-flex min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-[10px] font-semibold text-primary-foreground">
                      {unread > 9 ? '9+' : unread}
                    </span>
                  ) : null}
                </Link>
              ))}
            </nav>
          </div>
          <form action={signOutAction}>
            <Button type="submit" variant="outline" size="sm">
              Sign out
            </Button>
          </form>
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl px-6 py-8 md:py-10">{children}</main>
      {user ? <NotificationRealtime userId={user.id} /> : null}
    </div>
  );
}
