import { Suspense } from 'react';
import Link from 'next/link';
import type { Route } from 'next';
import { requireAdminAccess } from '@/features/admin/lib/require-admin';
import { AdminNoticeFromQuery } from '@/features/admin/components/admin-notice-from-query';

const links: Array<{ href: Route; label: string }> = [
  { href: '/admin' as Route, label: 'Overview' },
  { href: '/admin/users' as Route, label: 'Users' },
  { href: '/admin/circles' as Route, label: 'Circles' },
  { href: '/admin/transactions' as Route, label: 'Transactions' },
  { href: '/admin/kyc' as Route, label: 'KYC' },
  { href: '/admin/disputes' as Route, label: 'Disputes' },
  { href: '/admin/withdrawals' as Route, label: 'Withdrawals' },
  { href: '/admin/tawarruq' as Route, label: 'Tawarruq' },
  { href: '/admin/sadaka' as Route, label: 'Sadaka' },
  { href: '/admin/risk' as Route, label: 'Risk' },
  { href: '/admin/collections' as Route, label: 'Collections' },
  { href: '/admin/playbooks' as Route, label: 'Playbooks' },
  { href: '/admin/observability' as Route, label: 'Observability' },
  { href: '/admin/audit' as Route, label: 'Audit logs' },
];

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const { profile, role } = await requireAdminAccess('compliance');

  return (
    <div className="space-y-6 pb-4">
      <div className="space-y-4 border-b border-border/70 pb-5">
        <div>
          <p className="text-sm font-medium uppercase tracking-[0.16em] text-accent">
            Administration
          </p>
          <h1 className="mt-2 font-[family-name:var(--font-display)] text-3xl font-semibold tracking-tight">
            Platform console
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Signed in as {profile?.full_name ?? profile?.email ?? 'Admin'} ·{' '}
            <span className="capitalize">{role.replaceAll('_', ' ')}</span>
          </p>
        </div>
        <nav
          className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [-ms-overflow-style:none] [scrollbar-width:none] sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0 [&::-webkit-scrollbar]:hidden"
          aria-label="Admin"
        >
          {links.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="inline-flex min-h-11 shrink-0 items-center rounded-xl border border-border bg-card px-3.5 text-sm font-medium text-foreground hover:bg-muted"
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </div>
      <Suspense fallback={null}>
        <AdminNoticeFromQuery />
      </Suspense>
      {children}
    </div>
  );
}
