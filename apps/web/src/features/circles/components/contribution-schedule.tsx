import { formatCurrency, formatDate } from '@jamiya/shared';
import { Button, Input, Label } from '@jamiya/ui';
import { CalendarClock } from 'lucide-react';
import { setCircleScheduleAction } from '../actions/ledger-actions';

/** Plain words for how often a circle contributes. */
export function everyLabel(days: number): string {
  if (days === 7) return 'every week';
  if (days === 14) return 'every 2 weeks';
  if (days >= 28 && days <= 31) return 'every month';
  return `every ${days} days`;
}

/**
 * Open-ended savings / share circles: when the next round is due, or a note that no
 * dates are set yet. Officers get a link to change it.
 */
export function ScheduleSummary({
  nextRoundDue,
  amount,
  currency,
  everyDays,
  scheduleOn,
  canManage,
}: {
  /** Due date of the round on the calendar (or about to be), if any. */
  nextRoundDue: string | null;
  amount: number;
  currency: string;
  everyDays: number;
  scheduleOn: boolean;
  canManage: boolean;
}) {
  return (
    <div className="flex items-start gap-3 border-b border-border/70 px-5 py-4">
      <span className="mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
        <CalendarClock className="h-4.5 w-4.5" />
      </span>
      <div className="min-w-0 flex-1 text-sm">
        {scheduleOn && nextRoundDue ? (
          <>
            <p className="font-semibold text-foreground">
              Next contribution: {formatDate(nextRoundDue)}
            </p>
            <p className="mt-0.5 text-muted-foreground">
              <span className="jm-amount">{formatCurrency(amount, currency)}</span> {everyLabel(everyDays)}.
              You can pay early or pay more; it counts toward your shares.
            </p>
          </>
        ) : (
          <>
            <p className="font-semibold text-foreground">No contribution dates set yet</p>
            <p className="mt-0.5 text-muted-foreground">
              {canManage
                ? 'Set the day members contribute and the app will add each round and remind everyone.'
                : 'Your circle officers have not set the contribution day yet. You can still pay in any time.'}
            </p>
          </>
        )}
        {canManage ? (
          <a href="#contribution-dates" className="mt-1.5 inline-block text-sm font-medium text-primary hover:underline">
            {scheduleOn ? 'Change dates' : 'Set contribution dates'}
          </a>
        ) : null}
      </div>
    </div>
  );
}

/** Officer form: next due date, amount, how often. */
export function ScheduleForm({
  jamiyaId,
  slug,
  defaultDue,
  amount,
  currency,
  everyDays,
  scheduleOn,
}: {
  jamiyaId: string;
  slug: string;
  defaultDue: string;
  amount: number;
  currency: string;
  everyDays: number;
  scheduleOn: boolean;
}) {
  const today = new Date().toISOString().slice(0, 10);
  const freq = [7, 14, 30].includes(everyDays) ? everyDays : 30;
  return (
    <section id="contribution-dates" className="jameiyah-surface scroll-mt-24 space-y-4 px-5 py-5">
      <div>
        <h3 className="text-base font-semibold text-foreground">Contribution dates</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Pick the next day members pay and how often. Each round is added to everyone&apos;s
          calendar a cycle ahead, and members get reminders before it is due.
        </p>
      </div>
      <form action={setCircleScheduleAction} className="grid gap-3 sm:grid-cols-3">
        <input type="hidden" name="jamiyaId" value={jamiyaId} />
        <input type="hidden" name="slug" value={slug} />
        <div className="space-y-1.5">
          <Label htmlFor="sched-next">Next due date</Label>
          <Input id="sched-next" name="nextDue" type="date" min={today} defaultValue={defaultDue} required className="min-h-11" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="sched-amount">Amount per member ({currency})</Label>
          <Input id="sched-amount" name="amount" type="number" min={1} step="any" defaultValue={amount} required className="min-h-11" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="sched-every">How often</Label>
          <select
            id="sched-every"
            name="everyDays"
            defaultValue={String(freq)}
            className="block h-11 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground"
          >
            <option value="7">Every week</option>
            <option value="14">Every 2 weeks</option>
            <option value="30">Every month</option>
          </select>
        </div>
        <div className="flex flex-wrap items-center gap-3 sm:col-span-3">
          <Button type="submit" className="min-h-11">
            {scheduleOn ? 'Save dates' : 'Set dates'}
          </Button>
          {scheduleOn ? (
            <Button type="submit" name="mode" value="off" variant="ghost" formNoValidate className="min-h-11 text-muted-foreground">
              Turn off dates
            </Button>
          ) : null}
        </div>
      </form>
    </section>
  );
}
