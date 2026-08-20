import { isComplianceRole } from '@jamiya/auth';
import type { PlatformRole } from '@jamiya/types';
import { AppShell } from '@/components/app-shell';
import { signOutAction } from '@/features/auth';
import { NotificationRealtime } from '@/features/dashboard/components/notification-realtime';
import { DEFAULT_LOCALE, type Locale } from '@/i18n/config';
import { dictionaries } from '@/i18n/dictionaries';
import { getDictionary } from '@/i18n/get-dictionary';
import {
  getAuthUser,
  getUnreadNotificationCount,
  getUserProfile,
} from '@/lib/supabase/auth';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  let user: Awaited<ReturnType<typeof getAuthUser>>['user'] = null;

  // Always resolve locale independently so auth hiccups never force English chrome.
  const { locale, dict } = await getDictionary().catch(() => ({
    locale: DEFAULT_LOCALE as Locale,
    dict: dictionaries[DEFAULT_LOCALE],
  }));

  try {
    const auth = await getAuthUser();
    user = auth.user;
  } catch {
    /* Keep shell usable if auth hiccups during a tab change. */
  }

  let unread = 0;
  let showAdmin = false;

  if (user) {
    const [count, profile] = await Promise.all([
      getUnreadNotificationCount(user.id).catch(() => 0),
      getUserProfile(user.id).catch(() => null),
    ]);
    unread = count;
    const role = (profile?.platform_role ?? 'member') as PlatformRole;
    showAdmin = isComplianceRole(role);
  }

  return (
    <>
      <AppShell
        unread={unread}
        showAdmin={showAdmin}
        signOutAction={signOutAction}
        locale={locale}
        dict={{ nav: dict.nav, common: dict.common }}
      >
        {children}
      </AppShell>
      {user ? <NotificationRealtime userId={user.id} /> : null}
    </>
  );
}
