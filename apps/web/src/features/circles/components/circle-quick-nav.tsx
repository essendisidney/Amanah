import Link from 'next/link';
import type { Route } from 'next';

export type CircleNavItem = {
  href: Route;
  label: string;
  primary?: boolean;
};

type Props = {
  primary: CircleNavItem[];
  secondary: CircleNavItem[];
};

export function CircleQuickNav({ primary, secondary }: Props) {
  return (
    <nav className="amanah-surface space-y-4 px-4 py-4 sm:px-5" aria-label="Circle shortcuts">
      <div className="flex flex-wrap gap-2">
        {primary.map((item) => (
          <Link
            key={item.label}
            href={item.href}
            className={
              item.primary
                ? 'inline-flex min-h-10 items-center rounded-full bg-primary px-4 text-sm font-semibold text-primary-foreground shadow-sm transition-transform active:scale-[0.98]'
                : 'amanah-glass-pill inline-flex min-h-10 items-center rounded-full px-4 text-sm font-semibold text-primary'
            }
          >
            {item.label}
          </Link>
        ))}
      </div>
      {secondary.length > 0 ? (
        <div className="flex flex-wrap gap-x-1 gap-y-2 border-t border-border/50 pt-3">
          {secondary.map((item) => (
            <Link
              key={item.label}
              href={item.href}
              className="inline-flex min-h-9 items-center rounded-full px-3 text-sm font-medium text-muted-foreground transition-colors hover:bg-secondary/60 hover:text-foreground"
            >
              {item.label}
            </Link>
          ))}
        </div>
      ) : null}
    </nav>
  );
}
