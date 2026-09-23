import type { Route } from 'next';

export type AdminNavLink = { href: Route; label: string };

export type AdminNavGroup = {
  id: string;
  title: string;
  items: AdminNavLink[];
};

/** Grouped admin navigation — keep in sync with architecture map when possible. */
export const ADMIN_NAV_GROUPS: AdminNavGroup[] = [
  {
    id: 'members',
    title: 'Members & circles',
    items: [
      { href: '/admin' as Route, label: 'Inbox' },
      { href: '/admin/users' as Route, label: 'Users' },
      { href: '/admin/circles' as Route, label: 'Circles' },
      { href: '/admin/kyc' as Route, label: 'KYC' },
      { href: '/admin/support' as Route, label: 'Support' },
    ],
  },
  {
    id: 'payments',
    title: 'Payments & finance',
    items: [
      { href: '/admin/finance' as Route, label: 'Finance' },
      { href: '/admin/finance/reconcile' as Route, label: 'Reconcile' },
      { href: '/admin/finance/journal' as Route, label: 'Journal' },
      { href: '/admin/finance/accounts' as Route, label: 'Accounts' },
      { href: '/admin/finance/settlements' as Route, label: 'Settlements' },
      { href: '/admin/finance/integrity' as Route, label: 'Integrity' },
      { href: '/admin/finance/refunds' as Route, label: 'Refunds' },
      { href: '/admin/transactions' as Route, label: 'Transactions' },
      { href: '/admin/withdrawals' as Route, label: 'Money out' },
    ],
  },
  {
    id: 'compliance',
    title: 'Compliance & approvals',
    items: [
      { href: '/admin/disputes' as Route, label: 'Disputes' },
      { href: '/admin/sadaka' as Route, label: 'Sadaka' },
      { href: '/admin/tawarruq' as Route, label: 'Tawarruq' },
      { href: '/admin/finance/approvals' as Route, label: 'Approvals' },
      { href: '/admin/collections' as Route, label: 'Collections' },
      { href: '/admin/risk' as Route, label: 'Risk' },
    ],
  },
  {
    id: 'system',
    title: 'System & diagnostics',
    items: [
      { href: '/admin/observability' as Route, label: 'Health' },
      { href: '/admin/audit' as Route, label: 'Audit' },
      { href: '/admin/insights' as Route, label: 'Insights' },
      { href: '/admin/playbooks' as Route, label: 'Playbooks' },
      { href: '/admin/architecture' as Route, label: 'Architecture' },
    ],
  },
];

export function adminLinkActive(pathname: string, href: string) {
  if (href === '/admin') return pathname === '/admin';
  if (href === '/admin/finance') {
    return pathname === '/admin/finance' || pathname.startsWith('/admin/finance/intents');
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function adminGroupContainsPath(group: AdminNavGroup, pathname: string) {
  return group.items.some((item) => adminLinkActive(pathname, item.href));
}
