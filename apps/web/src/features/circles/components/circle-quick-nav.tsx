import Link from 'next/link';
import type { Route } from 'next';
import { Button } from '@jamiya/ui';

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
    <nav className="amanah-surface space-y-3 px-4 py-4 sm:px-5" aria-label="Circle shortcuts">
      <div className="flex flex-wrap gap-2">
        {primary.map((item) => (
          <Button
            key={item.label}
            asChild
            variant={item.primary ? 'default' : 'outline'}
            className="min-h-11"
          >
            <Link href={item.href}>{item.label}</Link>
          </Button>
        ))}
      </div>
      {secondary.length > 0 ? (
        <ul className="divide-y divide-border/70 border-t border-border/70">
          {secondary.map((item) => (
            <li key={item.label}>
              <Link
                href={item.href}
                className="flex min-h-11 items-center px-1 text-sm font-semibold text-foreground transition-colors hover:text-primary"
              >
                {item.label}
              </Link>
            </li>
          ))}
        </ul>
      ) : null}
    </nav>
  );
}
