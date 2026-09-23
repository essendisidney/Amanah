import { Suspense } from 'react';
import { requireAdminAccess } from '@/features/admin/lib/require-admin';
import { AdminNoticeFromQuery } from '@/features/admin/components/admin-notice-from-query';
import { AdminNav } from '@/features/admin/components/admin-nav';
import { AppPage } from '@/components/app-page';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const { profile, role } = await requireAdminAccess('compliance');

  return (
    <AppPage className="space-y-6">
      <header className="amanah-surface space-y-3 px-4 py-4 sm:px-5">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-primary">
              Admin
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              {profile?.full_name ?? profile?.email ?? 'Admin'} ·{' '}
              <span className="capitalize">{role.replaceAll('_', ' ')}</span>
            </p>
          </div>
        </div>
        <AdminNav />
      </header>
      <Suspense fallback={null}>
        <AdminNoticeFromQuery />
      </Suspense>
      {children}
    </AppPage>
  );
}
