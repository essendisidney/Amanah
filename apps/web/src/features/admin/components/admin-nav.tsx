'use client';

import { useCallback, useEffect, useId, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Menu, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  ADMIN_NAV_GROUPS,
  adminGroupContainsPath,
  adminLinkActive,
  type AdminNavGroup,
} from '@/features/admin/lib/admin-nav-config';

function NavGroups({
  pathname,
  activeGroupId,
  idPrefix,
}: {
  pathname: string;
  activeGroupId: string;
  idPrefix: string;
}) {
  return (
    <div className="space-y-5">
      {ADMIN_NAV_GROUPS.map((group: AdminNavGroup) => {
        const groupActive = group.id === activeGroupId;
        return (
          <div key={group.id} className="min-w-0 space-y-1.5">
            <p
              id={`${idPrefix}-${group.id}-label`}
              className={cn(
                'px-1 text-[11px] font-semibold uppercase tracking-[0.12em]',
                groupActive ? 'text-primary' : 'text-muted-foreground',
              )}
            >
              {group.title}
            </p>
            <ul className="space-y-0.5" aria-labelledby={`${idPrefix}-${group.id}-label`}>
              {group.items.map((item) => {
                const active = adminLinkActive(pathname, item.href);
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      aria-current={active ? 'page' : undefined}
                      className={cn(
                        'flex min-h-10 items-center rounded-lg border border-transparent px-2.5 text-sm font-medium transition-colors',
                        active
                          ? 'border-primary/25 bg-primary text-primary-foreground'
                          : 'text-foreground hover:border-border hover:bg-muted/70',
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
    </div>
  );
}

/** Compact desktop sidebar + mobile drawer (closed by default). */
export function AdminNav() {
  const pathname = usePathname() || '';
  const activeGroupId =
    ADMIN_NAV_GROUPS.find((g) => adminGroupContainsPath(g, pathname))?.id ?? 'members';
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const previouslyFocused = useRef<HTMLElement | null>(null);

  const close = useCallback(() => {
    setOpen(false);
  }, []);

  const wasOpen = useRef(false);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!open) {
      if (wasOpen.current) {
        const target = previouslyFocused.current ?? triggerRef.current;
        previouslyFocused.current = null;
        wasOpen.current = false;
        queueMicrotask(() => target?.focus());
      }
      return;
    }

    wasOpen.current = true;
    previouslyFocused.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;

    const panel = panelRef.current;
    const focusables = panel?.querySelectorAll<HTMLElement>(
      'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])',
    );
    focusables?.[0]?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        close();
        return;
      }
      if (event.key !== 'Tab' || !panel || !focusables?.length) return;
      const list = Array.from(focusables);
      const first = list[0];
      const last = list[list.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', onKeyDown, true);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', onKeyDown, true);
      document.body.style.overflow = prevOverflow;
    };
  }, [open, close]);

  return (
    <>
      {/* Desktop sidebar */}
      <aside
        className="sticky top-20 hidden w-56 shrink-0 self-start lg:block"
        aria-label="Admin sections"
      >
        <nav className="amanah-surface max-h-[calc(100vh-6rem)] overflow-y-auto px-3 py-4">
          <NavGroups pathname={pathname} activeGroupId={activeGroupId} idPrefix="desk" />
        </nav>
      </aside>

      {/* Mobile / tablet trigger — content stays first */}
      <div className="lg:hidden">
        <button
          ref={triggerRef}
          type="button"
          className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-border bg-background px-3 text-sm font-semibold text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          aria-expanded={open}
          aria-controls={panelId}
          onClick={() => setOpen(true)}
        >
          <Menu className="h-4 w-4" aria-hidden />
          Admin menu
        </button>
      </div>

      {/* Mobile drawer */}
      {open ? (
        <div className="fixed inset-0 z-[60] lg:hidden" role="presentation">
          <button
            type="button"
            className="absolute inset-0 bg-foreground/40"
            aria-label="Close admin menu"
            onClick={close}
          />
          <div
            ref={panelRef}
            id={panelId}
            role="dialog"
            aria-modal="true"
            aria-label="Admin navigation"
            className="absolute inset-y-0 left-0 flex w-[min(20rem,88vw)] flex-col border-r border-border bg-background shadow-[0_8px_30px_rgba(17,24,39,0.12)]"
          >
            <div className="flex items-center justify-between gap-2 border-b border-border/70 px-3 py-3">
              <p className="text-sm font-semibold text-foreground">Admin menu</p>
              <button
                type="button"
                className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-border text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                aria-label="Close"
                onClick={close}
              >
                <X className="h-4 w-4" aria-hidden />
              </button>
            </div>
            <nav className="flex-1 overflow-y-auto px-3 py-4 pb-[calc(1.5rem+env(safe-area-inset-bottom))]">
              <NavGroups
                pathname={pathname}
                activeGroupId={activeGroupId}
                idPrefix="mobile"
              />
            </nav>
          </div>
        </div>
      ) : null}
    </>
  );
}
