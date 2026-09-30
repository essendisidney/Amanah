'use client';

import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { Route } from 'next';
import { Search } from 'lucide-react';
import type { Dictionary } from '@/i18n/dictionaries';

export type QuickSearchCircle = { name: string; slug: string };

type Item = {
  title: string;
  href: Route;
  kind: 'circle' | 'page';
  keywords: string;
  pinned?: boolean;
};

function matches(item: Item, query: string) {
  const haystack = `${item.title} ${item.keywords}`.toLowerCase();
  return haystack.includes(query);
}

export function filterQuickSearch(items: Item[], query: string, limit = 8) {
  const q = query.trim().toLowerCase();
  const pool = q ? items.filter((item) => matches(item, q)) : items.filter((item) => item.pinned || item.kind === 'circle');
  return pool.slice(0, limit);
}

export function QuickSearch({
  circles,
  showAdmin,
  labels,
}: {
  circles: QuickSearchCircle[];
  showAdmin: boolean;
  labels: Dictionary['common'];
}) {
  const router = useRouter();
  const listId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');

  const items = useMemo<Item[]>(() => {
    const pages: Item[] = [
      { title: 'Pay', href: '/pay' as Route, kind: 'page', keywords: 'pay dues contribute lipa mpesa', pinned: true },
      {
        title: 'Add money',
        href: '/wallet?focus=top-up#top-up' as Route,
        kind: 'page',
        keywords: 'top up wallet money ongeza pesa mpesa',
        pinned: true,
      },
      { title: 'Circles', href: '/circles' as Route, kind: 'page', keywords: 'circles miduara chama', pinned: true },
      { title: 'Money', href: '/wallet' as Route, kind: 'page', keywords: 'wallet balance history pesa' },
      {
        title: 'Withdraw',
        href: '/wallet?focus=withdraw#withdraw' as Route,
        kind: 'page',
        keywords: 'withdraw send mpesa toa',
      },
      { title: 'Help', href: '/help' as Route, kind: 'page', keywords: 'help support msaada', pinned: true },
      { title: 'Activity', href: '/notifications' as Route, kind: 'page', keywords: 'activity notifications arifa' },
      { title: 'You', href: '/profile' as Route, kind: 'page', keywords: 'profile you account jina' },
      { title: 'Goals', href: '/finance/goals' as Route, kind: 'page', keywords: 'goals savings hajj' },
      { title: 'Qard', href: '/finance/qard' as Route, kind: 'page', keywords: 'qard loan mkopo' },
      { title: 'Tawarruq', href: '/finance/tawarruq' as Route, kind: 'page', keywords: 'tawarruq finance commodity murabaha' },
      { title: 'Sadaka', href: '/sadaka' as Route, kind: 'page', keywords: 'sadaka donate charity' },
      { title: 'Zakat', href: '/zakat' as Route, kind: 'page', keywords: 'zakat' },
    ];
    if (showAdmin) {
      pages.push(
        { title: 'Admin', href: '/admin' as Route, kind: 'page', keywords: 'admin desk' },
        { title: 'Support desk', href: '/admin/support' as Route, kind: 'page', keywords: 'support tickets' },
      );
    }
    const circleItems: Item[] = circles.map((circle) => ({
      title: circle.name,
      href: `/circles/${circle.slug}` as Route,
      kind: 'circle',
      keywords: `${circle.name} circle mduara`,
    }));
    return [...pages, ...circleItems];
  }, [circles, showAdmin]);

  const results = filterQuickSearch(items, query);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    const frame = window.requestAnimationFrame(() => inputRef.current?.focus());
    return () => {
      window.removeEventListener('keydown', onKey);
      window.cancelAnimationFrame(frame);
    };
  }, [open]);

  function close() {
    setOpen(false);
    setQuery('');
  }

  function go(href: Route) {
    close();
    router.push(href);
  }

  return (
    <>
      <button
        type="button"
        className="inline-flex h-11 w-11 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        aria-label={labels.search}
        onClick={() => setOpen(true)}
      >
        <Search className="h-5 w-5" strokeWidth={1.75} />
      </button>
      {open ? (
        <div className="fixed inset-0 z-[60] bg-background/80 p-4 pt-[max(1rem,env(safe-area-inset-top))] backdrop-blur-sm">
          <button type="button" className="absolute inset-0" aria-label={labels.search} onClick={close} />
          <div className="jameiyah-surface relative mx-auto w-full max-w-lg p-3">
            <form
              onSubmit={(event) => {
                event.preventDefault();
                const first = results[0];
                if (first) go(first.href);
              }}
            >
              <input
                ref={inputRef}
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder={labels.searchPlaceholder}
                aria-controls={listId}
                className="h-12 w-full rounded-md border border-input bg-background px-3 text-base text-foreground"
              />
            </form>
            {results.length === 0 ? (
              <p className="px-1 py-4 text-sm text-muted-foreground">{labels.searchEmpty}</p>
            ) : (
              <ul id={listId} className="mt-2 max-h-[60vh] divide-y divide-border/70 overflow-auto">
                {results.map((item) => (
                  <li key={`${item.kind}-${item.href}`}>
                    <button
                      type="button"
                      className="flex min-h-11 w-full items-center justify-between gap-3 px-1 py-2 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      onClick={() => go(item.href)}
                    >
                      <span className="truncate text-sm font-semibold text-foreground">{item.title}</span>
                      <span className="shrink-0 text-xs text-muted-foreground">
                        {item.kind === 'circle' ? labels.searchCircle : labels.searchPage}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      ) : null}
    </>
  );
}
