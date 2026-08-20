import { Suspense } from 'react';
import { requireAdminAccess } from '@/features/admin/lib/require-admin';
import { AdminNoticeFromQuery } from '@/features/admin/components/admin-notice-from-query';
import { AdminNav } from '@/features/admin/components/admin-nav';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const { profile, role } = await requireAdminAccess('compliance');

  return (
    <div className="space-y-5 pb-4">
      <header className="space-y-3 border-b border-border/70 pb-4">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-accent">Admin</p>
            <h1 className="mt-1 text-2xl font-bold tracking-tight md:text-3xl">Clear the queue</h1>
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
    </div>
  );
}
