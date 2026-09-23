import Link from 'next/link';
import type { Route } from 'next';
import { CircleDollarSign, FileText, Target, Users } from 'lucide-react';
import { Button } from '@jamiya/ui';

type Props = {
  slug: string;
  hasDue: boolean;
  showGoals?: boolean;
};

/** Member shortcuts — primary pay anchors to #pay-due. */
export function MemberCircleLinks({ slug, hasDue, showGoals }: Props) {
  type Item = {
    href: string;
    label: string;
    hash?: boolean;
    icon: typeof FileText;
    primary?: boolean;
  };

  const items: Item[] = [
    ...(hasDue
      ? [
          {
            href: '#pay-due',
            label: 'Pay my due',
            hash: true as const,
            icon: CircleDollarSign,
            primary: true as const,
          },
        ]
      : []),
    {
      href: `/circles/${slug}/statement`,
      label: 'My statement',
      icon: FileText,
    },
    {
      href: '#members',
      label: 'Members',
      hash: true,
      icon: Users,
    },
    ...(showGoals
      ? [
          {
            href: '#goals',
            label: 'Goals',
            hash: true as const,
            icon: Target,
          },
        ]
      : []),
  ];

  return (
    <nav className="space-y-2.5" aria-label="Member actions">
      <h2 className="text-sm font-semibold text-foreground">For you</h2>
      <div className="grid gap-2 sm:grid-cols-2">
        {items.map((item) => {
          const Icon = item.icon;
          const content = (
            <>
              <Icon className="h-4 w-4" />
              <span className="truncate">{item.label}</span>
            </>
          );
          return item.hash ? (
            <Button
              key={item.label}
              asChild
              variant={item.primary ? 'default' : 'outline'}
              className="min-h-11 w-full justify-start px-3"
            >
              <a href={item.href}>{content}</a>
            </Button>
          ) : (
            <Button
              key={item.label}
              asChild
              variant={item.primary ? 'default' : 'outline'}
              className="min-h-11 w-full justify-start px-3"
            >
              <Link href={item.href as Route}>{content}</Link>
            </Button>
          );
        })}
      </div>
    </nav>
  );
}
