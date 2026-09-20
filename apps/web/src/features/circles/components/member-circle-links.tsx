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
  hint: string;
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
            hint: 'Your open contribution',
            primary: true as const,
            hash: true,
          },
        ]
      : []),
    {
      href: `/circles/${slug}/statement`,
      label: 'My statement',
      hint: 'What you paid and what you owe',
    },
    {
      href: '#members',
      label: 'Members',
      hint: 'Who is in this circle',
      hash: true,
    },
    {
      href: '/wallet',
      label: 'Wallet',
      hint: 'Top up and pay',
    },
    ...(showGoals
      ? [
          {
            href: '#goals',
            label: 'Goals',
            hint: 'Shared savings targets',
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
            ? 'flex min-h-11 flex-col justify-center rounded-xl bg-primary px-3.5 py-2.5 text-primary-foreground shadow-sm transition-transform active:scale-[0.99]'
            : 'flex min-h-11 flex-col justify-center rounded-xl border border-border/70 bg-background/70 px-3.5 py-2.5 transition-colors hover:border-primary/30 hover:bg-secondary/50';
          return (
            <li key={item.label}>
              {item.hash ? (
                <a href={item.href} className={className}>
                  <span className="text-sm font-semibold">{item.label}</span>
                  <span
                    className={
                      item.primary
                        ? 'mt-0.5 text-xs text-primary-foreground/80'
                        : 'mt-0.5 text-xs text-muted-foreground'
                    }
                  >
                    {item.hint}
                  </span>
                </a>
              ) : (
                <Link href={item.href as Route} className={className}>
                  <span className="text-sm font-semibold">{item.label}</span>
                  <span className="mt-0.5 text-xs text-muted-foreground">{item.hint}</span>
                </Link>
              )}
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
