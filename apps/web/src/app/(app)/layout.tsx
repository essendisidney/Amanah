import { isComplianceRole } from '@jamiya/auth';
import type { PlatformRole } from '@jamiya/types';
import { AppShell } from '@/components/app-shell';
import { signOutAction } from '@/features/auth';
import { NotificationRealtime } from '@/features/dashboard/components/notification-realtime';
import { getDictionary } from '@/i18n/get-dictionary';
import { createClient } from '@/lib/supabase/server';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { locale, dict } = await getDictionary();

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

  return (
    <>
      <AppShell
        unread={unread}
        showAdmin={showAdmin}
        signOutAction={signOutAction}
        locale={locale}
        dict={dict}
      >
        {children}
      </AppShell>
      {user ? <NotificationRealtime userId={user.id} /> : null}
    </>
  );
}
