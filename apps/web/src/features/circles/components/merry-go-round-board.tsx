import { formatCurrency, formatDate } from '@jamiya/shared';
import { Button } from '@jamiya/ui';
import { StatusBadge } from '@/features/dashboard/components/dashboard-stats';
import { markMgrPotPaidAction } from '../actions/slot-actions';
import {
  contributionFillLabel,
  merryGoRoundHeadline,
  payoutScheduleLabel,
} from '../lib/circle-status-display';

export type MerryGoRoundSlot = {
  cycleNumber: number;
  payoutId: string | null;
  memberLabel: string;
  memberCode: string | null;
  payoutPosition: number | null;
  amount: number;
  currency: string;
  scheduledDate: string | null;
  payoutStatus: string | null;
  paidCount: number;
  unpaidCount: number;
  unpaidLabels: string[];
  hasAssignee?: boolean;
};

type Props = {
  circleName: string;
  contributionAmount: number;
  currency: string;
  currentCycle: number;
  plannedCycles?: number | null;
  slots: MerryGoRoundSlot[];
  slug?: string;
  canManage?: boolean;
};

/** Merry-go-round view: slots, who receives, who has / hasn't contributed. */
export function MerryGoRoundBoard({
  circleName,
  contributionAmount,
  currency,
  currentCycle,
  plannedCycles = null,
  slots,
  slug,
  canManage = false,
}: Props) {
  if (slots.length === 0) {
    return (
      <div className="amanah-surface space-y-2 px-5 py-5 text-sm text-muted-foreground">
        <p className="font-medium text-foreground">No merry-go-round slots yet</p>
        <p>
          Assign payout months under Members, then activate — each round shows here: who
          collects, and who still owes.
        </p>
      </div>
    );
  }

  const headline = merryGoRoundHeadline({
    currentCycle,
    plannedCycles,
    slotCount: slots.length,
  });

  return (
    <div className="space-y-4">
      <div className="amanah-surface border-accent/20 px-5 py-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-accent">Merry-go-round</p>
        <h2 className="mt-1 font-[family-name:var(--font-display)] text-xl font-semibold">
          {circleName}
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {formatCurrency(contributionAmount, currency)} each round · {headline.label}
        </p>
      </div>

      <ul className="amanah-surface divide-y divide-border/70 overflow-hidden p-0">
        {slots.map((slot) => {
          const isCurrent =
            slot.payoutStatus === 'scheduled' ||
            slot.payoutStatus === 'processing' ||
            (currentCycle > 0 && slot.cycleNumber === currentCycle);
          const received = slot.payoutStatus === 'paid';
          const scheduleLabel = payoutScheduleLabel({
            hasAssignee: slot.hasAssignee ?? slot.memberLabel !== 'Unclaimed',
            hasPayoutRecord: Boolean(slot.payoutId),
            payoutStatus: slot.payoutStatus,
          });
          const canMarkPot =
            canManage &&
            slug &&
            slot.payoutId &&
            !received &&
            (slot.payoutStatus === 'scheduled' || slot.payoutStatus === 'processing') &&
            slot.unpaidCount === 0 &&
            slot.paidCount > 0;

          return (
            <li
              key={slot.cycleNumber}
              className={[
                'flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-start sm:justify-between',
                isCurrent && !received ? 'bg-secondary/40' : '',
              ]
                .filter(Boolean)
                .join(' ')}
            >
              <div className="min-w-0 space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-medium text-foreground">
                    Slot {slot.payoutPosition ?? slot.cycleNumber} · {slot.memberLabel}
                  </p>
                  {slot.payoutStatus ? <StatusBadge status={slot.payoutStatus} /> : null}
                  {isCurrent && !received ? (
                    <span className="text-xs font-semibold text-primary">This round</span>
                  ) : null}
                </div>
                <p className="text-sm text-muted-foreground">
                  {slot.memberCode ? `${slot.memberCode} · ` : ''}
                  {scheduleLabel}
                  {slot.scheduledDate ? ` · ${formatDate(slot.scheduledDate)}` : ''}
                  {` · Pool ${formatCurrency(slot.amount, slot.currency)}`}
                </p>
                <p className="text-sm text-muted-foreground">
                  Contributions:{' '}
                  <span className="font-medium text-foreground">
                    {contributionFillLabel(slot.paidCount, slot.unpaidCount)}
                  </span>
                </p>
                {slot.unpaidLabels.length > 0 ? (
                  <p className="text-xs text-muted-foreground">
                    Still owing: {slot.unpaidLabels.join(', ')}
                  </p>
                ) : null}
              </div>
              <div className="flex shrink-0 flex-col items-stretch gap-2 sm:items-end sm:pt-1">
                {canMarkPot ? (
                  <form action={markMgrPotPaidAction}>
                    <input type="hidden" name="payoutId" value={slot.payoutId!} />
                    <input type="hidden" name="slug" value={slug} />
                    <Button type="submit" size="sm" className="min-h-11 w-full rounded-full sm:w-auto">
                      Mark pot paid
                    </Button>
                  </form>
                ) : (
                  <p className="text-sm font-semibold text-foreground">
                    {received ? 'Got pot' : scheduleLabel}
                  </p>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
