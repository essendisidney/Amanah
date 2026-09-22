import Link from 'next/link';
import type { Route } from 'next';
import { Button } from '@jamiya/ui';

type Props = {
  jamiyaId: string;
  canManage: boolean;
  memberCount: number;
  circleActive: boolean;
  hasOpenDue: boolean;
};

export function MerryGoRoundSimpleFlow({
  jamiyaId,
  canManage,
  memberCount,
  circleActive,
  hasOpenDue,
}: Props) {
  const steps = canManage
    ? [
        {
          n: '1',
          title: 'Add people',
          href: '#invite-people',
          label: 'Add people',
          done: memberCount >= 2,
        },
        {
          n: '2',
          title: 'Start the round',
          href: '#members',
          label: 'Assign slots',
          done: circleActive,
        },
        {
          n: '3',
          title: 'Record this month',
          href: '#monthly-payments',
          label: 'Enter payments',
          done: false,
        },
        {
          n: '4',
          title: 'Member loan',
          href: `/finance/qard?jamiyaId=${jamiyaId}` as Route,
          label: 'Open loans',
          done: false,
        },
      ]
    : [
        {
          n: '1',
          title: hasOpenDue ? 'Pay this month' : 'Your turn',
          href: hasOpenDue ? '#pay-due' : '#merry-go-round',
          label: hasOpenDue ? 'Pay now' : 'See the round',
          done: !hasOpenDue,
        },
        {
          n: '2',
          title: 'Ask for a loan',
          href: `/finance/qard?jamiyaId=${jamiyaId}` as Route,
          label: 'Ask for a loan',
          done: false,
        },
      ];

  const nextUndone = steps.find((s) => !s.done);

  return (
    <section className="amanah-surface space-y-4 px-5 py-5 sm:px-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-primary">Merry-go-round</p>
        <h2 className="mt-1 font-[family-name:var(--font-display)] text-xl font-semibold">
          {canManage ? 'Officer steps' : 'Your steps'}
        </h2>
      </div>
      <ol className="grid gap-3 sm:grid-cols-2">
        {steps.map((step) => (
          <li
            key={step.n}
            className="flex flex-col rounded-xl border border-border/70 bg-background/60 px-4 py-3"
          >
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Step {step.n}
              {step.done ? ' · done' : nextUndone?.n === step.n ? ' · next' : ''}
            </p>
            <p className="mt-1 text-sm font-semibold text-foreground">{step.title}</p>
            <Button asChild size="sm" className="mt-3 min-h-11 w-fit rounded-full">
              {step.href.startsWith('#') ? (
                <a href={step.href}>{step.label}</a>
              ) : (
                <Link href={step.href}>{step.label}</Link>
              )}
            </Button>
          </li>
        ))}
      </ol>
    </section>
  );
}
