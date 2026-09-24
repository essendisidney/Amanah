import { Suspense } from 'react';
import { requireAdminAccess } from '@/features/admin/lib/require-admin';
import { AdminNoticeFromQuery } from '@/features/admin/components/admin-notice-from-query';
import { AdminNav } from '@/features/admin/components/admin-nav';
import { AppPage } from '@/components/app-page';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const { profile, role } = await requireAdminAccess('compliance');

  return (
    <AppPage className="space-y-4">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:gap-6">
        <AdminNav />
        <div className="min-w-0 flex-1 space-y-4">
          <header className="amanah-surface px-4 py-3 sm:px-5">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-primary">
              Admin
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              {profile?.full_name ?? profile?.email ?? 'Admin'} ·{' '}
              <span className="capitalize">{role.replaceAll('_', ' ')}</span>
            </p>
          </header>
          <Suspense fallback={null}>
            <AdminNoticeFromQuery />
          </Suspense>
          {children}
        </div>
      </div>
    </AppPage>
  );
}
