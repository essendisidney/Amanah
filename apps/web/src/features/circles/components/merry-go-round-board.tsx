import { formatCurrency, formatDate } from '@jamiya/shared';
import { StatusBadge } from '@/features/dashboard/components/dashboard-stats';

export type MerryGoRoundSlot = {
  cycleNumber: number;
  memberLabel: string;
  memberCode: string | null;
  payoutPosition: number | null;
  amount: number;
  currency: string;
  scheduledDate: string | null;
  payoutStatus: string | null;
  /** Members who have paid this cycle's contribution */
  paidCount: number;
  /** Members still owing this cycle */
  unpaidCount: number;
  unpaidLabels: string[];
};

type Props = {
  circleName: string;
  contributionAmount: number;
  currency: string;
  currentCycle: number;
  slots: MerryGoRoundSlot[];
};

function payoutLabel(status: string | null): string {
  if (!status) return 'No slot yet';
  if (status === 'paid') return 'Received';
  if (status === 'scheduled' || status === 'processing') return 'Up next';
  return status.replaceAll('_', ' ');
}

/** Merry-go-round view: slots, who receives, who has / hasn't contributed. */
export function MerryGoRoundBoard({
  circleName,
  contributionAmount,
  currency,
  currentCycle,
  slots,
}: Props) {
  if (slots.length === 0) {
    return (
      <div className="amanah-surface space-y-2 px-5 py-5 text-sm text-muted-foreground">
        <p className="font-medium text-foreground">No merry-go-round slots yet</p>
        <p>
          After members claim payout months and the circle is activated, each round shows here —
          who collects, and who still owes their monthly contribution.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="amanah-surface border-accent/20 px-5 py-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-accent">Merry-go-round</p>
        <h2 className="mt-1 font-[family-name:var(--font-display)] text-xl font-semibold">
          {circleName}
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {formatCurrency(contributionAmount, currency)} each round · Cycle {currentCycle || 1} of{' '}
          {slots.length}
        </p>
      </div>

      <ul className="amanah-surface divide-y divide-border/70 overflow-hidden p-0">
        {slots.map((slot) => {
          const isCurrent =
            slot.payoutStatus === 'scheduled' ||
            slot.payoutStatus === 'processing' ||
            slot.cycleNumber === currentCycle;
          const received = slot.payoutStatus === 'paid';

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
                  {payoutLabel(slot.payoutStatus)}
                  {slot.scheduledDate ? ` · ${formatDate(slot.scheduledDate)}` : ''}
                  {` · Pool ${formatCurrency(slot.amount, slot.currency)}`}
                </p>
                <p className="text-sm text-muted-foreground">
                  Contributions:{' '}
                  <span className="font-medium text-foreground">{slot.paidCount} paid</span>
                  {slot.unpaidCount > 0 ? (
                    <>
                      {' '}
                      ·{' '}
                      <span className="font-medium text-foreground">
                        {slot.unpaidCount} not yet
                      </span>
                    </>
                  ) : (
                    <span className="text-foreground"> · All in</span>
                  )}
                </p>
                {slot.unpaidLabels.length > 0 ? (
                  <p className="text-xs text-muted-foreground">
                    Still owing: {slot.unpaidLabels.join(', ')}
                  </p>
                ) : null}
              </div>
              <p className="shrink-0 text-sm font-semibold text-foreground sm:pt-1">
                {received ? 'Got pot' : payoutLabel(slot.payoutStatus)}
              </p>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
