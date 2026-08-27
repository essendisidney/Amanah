import { Suspense } from 'react';
import { requireAdminAccess } from '@/features/admin/lib/require-admin';
import { AdminNoticeFromQuery } from '@/features/admin/components/admin-notice-from-query';
import { AdminNav } from '@/features/admin/components/admin-nav';
import { AppPage } from '@/components/app-page';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const { profile, role } = await requireAdminAccess('compliance');

  return (
    <AppPage className="space-y-6">
      <header className="amanah-surface space-y-3 px-5 py-5">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">Admin</p>
            <h1 className="mt-1 font-[family-name:var(--font-display)] text-2xl font-semibold tracking-tight md:text-3xl">
              Clear the queue
            </h1>
          </div>
          <p className="text-xs text-muted-foreground sm:text-sm">
            {profile?.full_name ?? profile?.email ?? 'Admin'} ·{' '}
            <span className="capitalize">{role.replaceAll('_', ' ')}</span>
          </p>
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
