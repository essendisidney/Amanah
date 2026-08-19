import { isComplianceRole } from '@jamiya/auth';
import type { PlatformRole } from '@jamiya/types';
import { AppShell } from '@/components/app-shell';
import { signOutAction } from '@/features/auth';
import { NotificationRealtime } from '@/features/dashboard/components/notification-realtime';
import { getDictionary } from '@/i18n/get-dictionary';
import {
  getAuthUser,
  getUnreadNotificationCount,
  getUserProfile,
} from '@/lib/supabase/auth';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const [{ user }, { locale, dict }] = await Promise.all([getAuthUser(), getDictionary()]);

  let unread = 0;
  let showAdmin = false;

  if (user) {
    const [count, profile] = await Promise.all([
      getUnreadNotificationCount(user.id),
      getUserProfile(user.id),
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
