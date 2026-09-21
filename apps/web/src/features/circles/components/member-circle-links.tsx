import Link from 'next/link';
import type { Route } from 'next';

type Props = {
  slug: string;
  hasDue: boolean;
  showGoals?: boolean;
};

type Item = {
  href: string;
  label: string;
  primary?: boolean;
  hash?: boolean;
};

/** Member-only shortcuts — no officer ops. */
export function MemberCircleLinks({ slug, hasDue, showGoals }: Props) {
  const items: Item[] = [
    ...(hasDue
      ? [
          {
            href: '#pay-due',
            label: 'Pay my due',
            primary: true as const,
            hash: true,
          },
        ]
      : []),
    {
      href: `/circles/${slug}/statement`,
      label: 'My 360',
    },
    {
      href: '#members',
      label: 'Members',
      hash: true,
    },
    {
      href: '/wallet',
      label: 'Money',
    },
    ...(showGoals
      ? [
          {
            href: '#goals',
            label: 'Goals',
            hash: true,
          },
        ]
      : []),
  ];

  return (
    <nav className="amanah-surface space-y-3 px-4 py-4 sm:px-5" aria-label="Member actions">
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
        For you
      </p>
      <ul className="grid gap-2 sm:grid-cols-2">
        {items.map((item) => {
          const className = item.primary
            ? 'flex min-h-11 items-center rounded-xl bg-primary px-3.5 py-2.5 text-sm font-semibold text-primary-foreground shadow-sm transition-transform active:scale-[0.99]'
            : 'flex min-h-11 items-center rounded-xl border border-border/70 bg-background/70 px-3.5 py-2.5 text-sm font-semibold text-foreground transition-colors hover:border-primary/30 hover:bg-secondary/50';
          return (
            <li key={item.label}>
              {item.hash ? (
                <a href={item.href} className={className}>
                  {item.label}
                </a>
              ) : (
                <Link href={item.href as Route} className={className}>
                  {item.label}
                </Link>
              )}
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
