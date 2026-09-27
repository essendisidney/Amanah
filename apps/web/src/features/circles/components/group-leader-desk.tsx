import Link from 'next/link';
import type { Route } from 'next';
import { Button } from '@jamiya/ui';
import { updateCircleSettingsAction } from '@/features/circles/actions/circle-settings-actions';

type Tool = { href: string; label: string; hint: string };

type Props = {
  jamiyaId: string;
  slug: string;
  name: string;
  contributionAmount: number;
  frequencyDays: number;
  maxMembers: number;
  memberCount: number;
  description?: string | null;
  kind: 'share_dividend' | 'rotating' | 'savings' | 'other';
};

function toolsFor(slug: string, kind: Props['kind']): Tool[] {
  const payments =
    kind === 'share_dividend'
      ? { href: `/circles/${slug}/books`, label: 'Record payments', hint: 'Enter what each member paid' }
      : kind === 'rotating'
        ? { href: `/circles/${slug}#monthly-payments`, label: 'Record rounds', hint: 'Mark what each member paid' }
        : { href: `/circles/${slug}#monthly-payments`, label: 'Record savings', hint: 'Enter each member’s payment' };

  const items: Tool[] = [
    payments,
    { href: `/circles/${slug}#invite-people`, label: 'Add people', hint: 'Invite or create accounts' },
    { href: `/circles/${slug}#members`, label: 'Members & roles', hint: 'Change role or remove someone' },
    { href: `/circles/${slug}/treasury`, label: 'Treasury', hint: 'Cash, fines, and bank accounts' },
    { href: `/circles/${slug}/arrears`, label: 'Arrears', hint: 'Who is behind' },
    { href: `/circles/${slug}/invoices`, label: 'Invoices', hint: 'Send contribution requests' },
    { href: `/circles/${slug}/officer`, label: 'Approvals', hint: 'Loans, grace, and payout checks' },
    { href: `/circles/${slug}/community`, label: 'Meetings', hint: 'Meetings and chat' },
    { href: `/circles/${slug}/report`, label: 'Report', hint: 'Print the group report' },
    { href: `/circles/${slug}/next-of-kin`, label: 'Next of kin', hint: 'Emergency contacts' },
    { href: `/circles/${slug}/registration`, label: 'Registration', hint: 'Group documents' },
    { href: `/circles/${slug}/elections`, label: 'Elections', hint: 'Choose officers' },
    { href: `/circles/${slug}/audit`, label: 'Audit', hint: 'What leaders changed' },
  ];

  if (kind === 'share_dividend') {
    items.splice(4, 0, {
      href: `/circles/${slug}/shares`,
      label: 'Shares',
      hint: 'Share capital and dividends',
    });
    items.push({
      href: `/circles/${slug}/journal`,
      label: 'Journal',
      hint: 'Cashbook lines',
    });
  }

  return items;
}

export function GroupLeaderDesk({
  jamiyaId,
  slug,
  name,
  contributionAmount,
  frequencyDays,
  maxMembers,
  memberCount,
  description,
  kind,
}: Props) {
  const tools = toolsFor(slug, kind);

  return (
    <section className="space-y-4">
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-primary">
          Group leaders
        </p>
        <h2 className="mt-1 text-base font-semibold tracking-tight text-foreground sm:text-lg">
          Run this group
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Record payments, add people, and change the contribution. Admin, chair, treasurer, and secretary can use these.
        </p>
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        {tools.map((tool) => (
          <Button key={tool.label} asChild variant="outline" className="min-h-11 h-auto justify-start px-3 py-2">
            {tool.href.startsWith('#') || tool.href.includes('#') ? (
              <a href={tool.href}>
                <span className="flex flex-col items-start text-left">
                  <span>{tool.label}</span>
                  <span className="text-xs font-normal text-muted-foreground">{tool.hint}</span>
                </span>
              </a>
            ) : (
              <Link href={tool.href as Route}>
                <span className="flex flex-col items-start text-left">
                  <span>{tool.label}</span>
                  <span className="text-xs font-normal text-muted-foreground">{tool.hint}</span>
                </span>
              </Link>
            )}
          </Button>
        ))}
      </div>
      <form action={updateCircleSettingsAction} className="amanah-surface space-y-3 px-4 py-4 sm:px-5">
        <h3 className="text-sm font-semibold text-foreground">Group settings</h3>
        <input type="hidden" name="jamiyaId" value={jamiyaId} />
        <input type="hidden" name="slug" value={slug} />
        <input type="hidden" name="memberCount" value={String(memberCount)} />
        <label className="block text-xs text-muted-foreground">
          Group name
          <input
            name="name"
            required
            minLength={3}
            maxLength={80}
            defaultValue={name}
            className="mt-1 block h-11 w-full rounded-md border border-input bg-background px-3 text-base text-foreground sm:h-10 sm:text-sm"
          />
        </label>
        <label className="block text-xs text-muted-foreground">
          Description
          <textarea
            name="description"
            maxLength={1000}
            rows={2}
            defaultValue={description ?? ''}
            className="mt-1 block w-full rounded-md border border-input bg-background px-3 py-2 text-base text-foreground sm:text-sm"
          />
        </label>
        <div className="grid gap-3 sm:grid-cols-3">
          <label className="block text-xs text-muted-foreground">
            Contribution
            <input
              name="contributionAmount"
              type="number"
              min="1"
              step="0.01"
              required
              defaultValue={String(contributionAmount)}
              className="mt-1 block h-11 w-full rounded-md border border-input bg-background px-3 text-base text-foreground sm:h-10 sm:text-sm"
            />
          </label>
          <label className="block text-xs text-muted-foreground">
            Every (days)
            <input
              name="frequencyDays"
              type="number"
              min="1"
              max="365"
              required
              defaultValue={String(frequencyDays)}
              className="mt-1 block h-11 w-full rounded-md border border-input bg-background px-3 text-base text-foreground sm:h-10 sm:text-sm"
            />
          </label>
          <label className="block text-xs text-muted-foreground">
            Member limit
            <input
              name="maxMembers"
              type="number"
              min={Math.max(memberCount, 2)}
              max="50"
              required
              defaultValue={String(maxMembers)}
              className="mt-1 block h-11 w-full rounded-md border border-input bg-background px-3 text-base text-foreground sm:h-10 sm:text-sm"
            />
          </label>
        </div>
        <Button type="submit" className="min-h-11 w-full sm:w-auto">
          Save group settings
        </Button>
      </form>
    </section>
  );
}
