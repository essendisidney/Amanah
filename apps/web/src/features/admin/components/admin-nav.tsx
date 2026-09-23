'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import {
  ADMIN_NAV_GROUPS,
  adminGroupContainsPath,
  adminLinkActive,
} from '@/features/admin/lib/admin-nav-config';

/** Grouped admin navigation — vertical sections, not crowded pills. */
export function AdminNav() {
  const pathname = usePathname() || '';
  const activeGroupId =
    ADMIN_NAV_GROUPS.find((g) => adminGroupContainsPath(g, pathname))?.id ?? 'members';

  return (
    <nav
      className="amanah-surface grid gap-4 px-3 py-3 sm:grid-cols-2 lg:grid-cols-4"
      aria-label="Admin navigation"
    >
      {ADMIN_NAV_GROUPS.map((group) => {
        const groupActive = group.id === activeGroupId;
        return (
          <div key={group.id} className="min-w-0 space-y-1.5">
            <p
              className={cn(
                'px-1 text-[11px] font-semibold uppercase tracking-[0.12em]',
                groupActive ? 'text-primary' : 'text-muted-foreground',
              )}
            >
              {group.title}
            </p>
            <ul className="space-y-0.5">
              {group.items.map((item) => {
                const active = adminLinkActive(pathname, item.href);
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      aria-current={active ? 'page' : undefined}
                      className={cn(
                        'flex min-h-9 items-center rounded-lg px-2.5 text-sm font-medium transition-colors',
                        active
                          ? 'bg-primary text-primary-foreground'
                          : 'text-foreground hover:bg-muted',
                      )}
                    >
                      {item.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        );
      })}
    </nav>
  );
}
