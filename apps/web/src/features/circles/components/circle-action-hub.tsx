import Link from 'next/link';
import type { Route } from 'next';
import { ChevronRight } from 'lucide-react';

export type CircleHubLink = {
  href: Route;
  label: string;
  hint?: string;
  primary?: boolean;
};

export type CircleHubGroup = {
  title: string;
  items: CircleHubLink[];
};

type Props = {
  groups: CircleHubGroup[];
  /** rotating | share_dividend | savings */
  challengeKind?: string | null;
};

/** Officer/member hub — Money/Pay list DNA, not text-pill clusters. */
export function CircleActionHub({ groups }: Props) {
  const visible = groups.filter((g) => g.items.length > 0);
  if (visible.length === 0) return null;

  return (
    <nav className="space-y-5" aria-label="Circle actions">
      <p className="text-sm font-semibold text-foreground">Quick actions</p>

      <div className="grid gap-5 lg:grid-cols-2">
        {visible.map((group) => (
          <section key={group.title} className="space-y-2.5">
            <h3 className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
              {group.title}
            </h3>
            <ul className="amanah-surface divide-y divide-border/70">
              {group.items.map((item) => (
                <li key={`${group.title}-${item.label}`}>
                  <Link
                    href={item.href}
                    className={
                      item.primary
                        ? 'flex min-h-11 items-center justify-between gap-3 bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground transition-colors first:rounded-t-[inherit] last:rounded-b-[inherit] hover:brightness-[1.03] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2'
                        : 'flex min-h-11 items-center justify-between gap-3 px-4 py-3 text-sm font-semibold text-foreground transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2'
                    }
                  >
                    <span className="min-w-0">
                      <span className="block truncate">{item.label}</span>
                      {item.hint ? (
                        <span
                          className={
                            item.primary
                              ? 'block truncate text-xs font-normal text-primary-foreground/80'
                              : 'block truncate text-xs font-normal text-muted-foreground'
                          }
                        >
                          {item.hint}
                        </span>
                      ) : null}
                    </span>
                    <ChevronRight className="h-4 w-4 shrink-0 opacity-70" strokeWidth={1.5} />
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </nav>
  );
}
