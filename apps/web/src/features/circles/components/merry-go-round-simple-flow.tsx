import { Button } from '@jamiya/ui';

type Props = {
  jamiyaId: string;
  canManage: boolean;
  memberCount: number;
  circleActive: boolean;
  hasOpenDue: boolean;
};

export function MerryGoRoundSimpleFlow({
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
          body: memberCount < 2 ? 'Invite the group. You need at least two members.' : 'Everyone is in. Add more anytime.',
          href: '#invite-people',
          label: 'Add people',
          done: memberCount >= 2,
        },
        {
          n: '2',
          title: 'Start the round',
          body: circleActive
            ? 'Slots are live. Change one under Members before that pot is paid.'
            : 'Assign each person a payout slot under Members, then start the circle.',
          href: '#members',
          label: 'Assign slots',
          done: circleActive,
        },
        {
          n: '3',
          title: 'Record this round',
          body: 'Mark who paid. Empty means they did not contribute.',
          href: '#monthly-payments',
          label: 'Enter payments',
          done: false,
        },
      ]
    : [
        {
          n: '1',
          title: hasOpenDue ? 'Pay this round' : 'Your turn',
          body: hasOpenDue
            ? 'Your contribution is due. Pay from your balance, or give cash to the treasurer.'
            : 'See who gets the pot and when you pay.',
          href: hasOpenDue ? '#pay-due' : '#merry-go-round',
          label: hasOpenDue ? 'Pay now' : 'See the round',
          done: !hasOpenDue,
        },
      ];

  return (
    <section className="amanah-surface space-y-4 px-5 py-5 sm:px-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-primary">Merry-go-round</p>
        <h2 className="mt-1 font-[family-name:var(--font-display)] text-xl font-semibold">
          {canManage ? 'Three steps. That is the whole job.' : 'Pay in. Take the pot when it is your turn.'}
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
              {step.done ? ' · done' : ''}
            </p>
            <p className="mt-1 text-sm font-semibold text-foreground">{step.title}</p>
            <p className="mt-1 flex-1 text-sm text-muted-foreground">{step.body}</p>
            <Button asChild size="sm" className="mt-3 min-h-11 w-fit rounded-full">
              <a href={step.href}>{step.label}</a>
            </Button>
          </li>
        ))}
      </ol>
    </section>
  );
}
