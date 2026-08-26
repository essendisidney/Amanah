'use client';

import Link from 'next/link';
import type { Route } from 'next';
import { useMemo, useState } from 'react';
import { formatCurrency } from '@jamiya/shared';
import { Input, Label } from '@jamiya/ui';
import { booksHref } from '@/features/circles/lib/member-books-view';
import type { HomeMember } from '@/features/circles/components/member-books-home';

type SortKey = 'name-asc' | 'name-desc' | 'missing-first' | 'savings-desc';

type Props = {
  slug: string;
  currency: string;
  members: HomeMember[];
};

function isIncomplete(m: HomeMember) {
  return m.shareAmount <= 0 || m.savings <= 0;
}

export function MemberBooksMemberList({ slug, currency, members }: Props) {
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<SortKey>('name-asc');

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    let rows = members;
    if (q) {
      rows = rows.filter((m) => m.label.toLowerCase().includes(q));
    }
    rows = [...rows].sort((a, b) => {
      switch (sort) {
        case 'name-desc':
          return b.label.localeCompare(a.label);
        case 'missing-first': {
          const aMiss = isIncomplete(a) ? 0 : 1;
          const bMiss = isIncomplete(b) ? 0 : 1;
          if (aMiss !== bMiss) return aMiss - bMiss;
          return a.label.localeCompare(b.label);
        }
        case 'savings-desc':
          return b.savings - a.savings || a.label.localeCompare(b.label);
        default:
          return a.label.localeCompare(b.label);
      }
    });
    return rows;
  }, [members, query, sort]);

  if (members.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No members yet. Add people on the circle page first.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="flex-1 space-y-1">
          <Label htmlFor="memberSearch">Find member</Label>
          <Input
            id="memberSearch"
            type="search"
            placeholder="Type a name…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="min-h-11"
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="memberSort">Sort</Label>
          <select
            id="memberSort"
            value={sort}
            onChange={(e) => setSort(e.target.value as SortKey)}
            className="flex min-h-11 w-full min-w-[12rem] rounded-md border border-input bg-background px-3 text-sm sm:w-auto"
          >
            <option value="name-asc">Name A → Z</option>
            <option value="name-desc">Name Z → A</option>
            <option value="missing-first">Missing payments first</option>
            <option value="savings-desc">Most savings</option>
          </select>
        </div>
      </div>

      <ul className="divide-y divide-border rounded-xl border border-border bg-card">
        {filtered.map((m) => (
          <li key={m.id} className="px-4 py-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-base font-medium text-foreground">{m.label}</p>
                <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm">
                  <span>
                    <span className="text-muted-foreground">Shares </span>
                    {formatCurrency(m.shareAmount, currency)}
                  </span>
                  <span>
                    <span className="text-muted-foreground">Savings </span>
                    {formatCurrency(m.savings, currency)}
                  </span>
                  <span>
                    <span className="text-muted-foreground">Loan </span>
                    {formatCurrency(m.loanOut, currency)}
                  </span>
                  {isIncomplete(m) ? (
                    <span className="text-xs font-medium text-amber-700 dark:text-amber-400">
                      Needs data
                    </span>
                  ) : null}
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <Link
                  href={booksHref(slug, 'member', m.id) as Route}
                  className="inline-flex min-h-10 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90"
                >
                  Enter payments
                </Link>
                <Link
                  href={booksHref(slug, 'member', m.id) as Route}
                  className="inline-flex min-h-10 items-center rounded-md border border-border px-4 text-sm font-medium hover:bg-muted/50"
                >
                  View record
                </Link>
              </div>
            </div>
          </li>
        ))}
      </ul>

      {filtered.length === 0 ? (
        <p className="text-sm text-muted-foreground">No members match “{query.trim()}”.</p>
      ) : null}
    </div>
  );
}
