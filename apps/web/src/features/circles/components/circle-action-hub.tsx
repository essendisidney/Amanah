import Link from 'next/link';
import type { Route } from 'next';

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
};

/** Near-reach action hub: everything important for this circle in one glance. */
export function CircleActionHub({ groups }: Props) {
  const visible = groups.filter((g) => g.items.length > 0);
  if (visible.length === 0) return null;

  return (
    <nav className="amanah-surface space-y-5 px-4 py-5 sm:px-5" aria-label="Circle actions">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Quick actions
        </p>
        <p className="mt-1 text-sm text-muted-foreground">
          Contributions, merry-go-round, loans, savings — all from here.
        </p>
      </div>

      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {visible.map((group) => (
          <div key={group.title} className="space-y-2">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-foreground">
              {group.title}
            </h3>
            <ul className="space-y-1.5">
              {group.items.map((item) => (
                <li key={`${group.title}-${item.label}`}>
                  <Link
                    href={item.href}
                    className={
                      item.primary
                        ? 'flex min-h-11 flex-col justify-center rounded-xl bg-primary px-3.5 py-2.5 text-primary-foreground shadow-sm transition-transform active:scale-[0.99]'
                        : 'flex min-h-11 flex-col justify-center rounded-xl border border-border/70 bg-background/70 px-3.5 py-2.5 transition-colors hover:border-primary/30 hover:bg-secondary/50'
                    }
                  >
                    <span
                      className={
                        item.primary
                          ? 'text-sm font-semibold'
                          : 'text-sm font-semibold text-foreground'
                      }
                    >
                      {item.label}
                    </span>
                    {item.hint ? (
                      <span
                        className={
                          item.primary
                            ? 'mt-0.5 text-xs text-primary-foreground/80'
                            : 'mt-0.5 text-xs text-muted-foreground'
                        }
                      >
                        {item.hint}
                      </span>
                    ) : null}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </nav>
  );
}
