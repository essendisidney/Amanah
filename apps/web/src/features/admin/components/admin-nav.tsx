'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { cn } from '@/lib/utils';
import {
  ADMIN_NAV_GROUPS,
  adminGroupContainsPath,
  adminLinkActive,
} from '@/features/admin/lib/admin-nav-config';

export function AdminNav() {
  const pathname = usePathname() || '';
  const activeGroupId = useMemo(
    () => ADMIN_NAV_GROUPS.find((g) => adminGroupContainsPath(g, pathname))?.id ?? 'members',
    [pathname],
  );
  const [openGroupId, setOpenGroupId] = useState(activeGroupId);

  useEffect(() => {
    setOpenGroupId(activeGroupId);
  }, [activeGroupId]);

  const openGroup =
    ADMIN_NAV_GROUPS.find((g) => g.id === openGroupId) ?? ADMIN_NAV_GROUPS[0]!;

  return (
    <div className="space-y-3">
      <nav
        className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [-ms-overflow-style:none] [scrollbar-width:none] sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0 [&::-webkit-scrollbar]:hidden"
        aria-label="Admin sections"
      >
        {ADMIN_NAV_GROUPS.map((group) => {
          const active = group.id === activeGroupId;
          const open = group.id === openGroupId;
          return (
            <button
              key={group.id}
              type="button"
              onClick={() => setOpenGroupId(group.id)}
              className={cn(
                'inline-flex min-h-11 shrink-0 items-center rounded-xl px-3.5 text-sm font-semibold transition-colors',
                open || active
                  ? 'bg-primary text-primary-foreground'
                  : 'border border-border bg-card text-foreground hover:bg-muted',
              )}
              aria-pressed={open}
            >
              {group.title}
            </button>
          );
        })}
      </nav>

      <div className="space-y-1.5">
        <p className="px-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
          {openGroup.title}
        </p>
        <nav
          className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [-ms-overflow-style:none] [scrollbar-width:none] sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0 [&::-webkit-scrollbar]:hidden"
          aria-label={openGroup.title}
        >
          {openGroup.items.map((item) => {
            const active = adminLinkActive(pathname, item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'inline-flex min-h-11 shrink-0 items-center rounded-xl border px-3.5 text-sm font-medium',
                  active
                    ? 'border-primary/40 bg-primary/10 text-primary'
                    : 'border-border bg-card text-muted-foreground hover:bg-muted hover:text-foreground',
                )}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
      </div>
    </div>
  );
}
