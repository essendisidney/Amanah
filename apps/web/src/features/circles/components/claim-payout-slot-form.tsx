'use client';

import { availablePayoutSlots, describePayoutSlot, formatCurrency } from '@jamiya/shared';
import { Button, Label } from '@jamiya/ui';
import { claimPayoutSlotAction } from '../actions/slot-actions';

export function ClaimPayoutSlotForm({
  jamiyaId,
  slug,
  maxSlots,
  takenPositions,
  contributionAmount,
  currency,
  slotPricingEnabled,
  earlySlotFeePct,
  lateSlotRebatePct,
  currentPosition,
}: {
  jamiyaId: string;
  slug: string;
  maxSlots: number;
  takenPositions: number[];
  contributionAmount: number;
  currency: string;
  slotPricingEnabled: boolean;
  earlySlotFeePct: number;
  lateSlotRebatePct: number;
  currentPosition: number | null;
}) {
  const open = availablePayoutSlots(maxSlots, takenPositions);

  if (open.length === 0 && currentPosition) {
    return (
      <p className="text-sm text-muted-foreground">
        Your payout slot is #{currentPosition}. Slots lock when the circle is activated.
      </p>
    );
  }

  return (
    <form action={claimPayoutSlotAction} className="space-y-3 rounded-xl border border-border bg-card p-4">
      <input type="hidden" name="jamiyaId" value={jamiyaId} />
      <input type="hidden" name="slug" value={slug} />
      <div>
        <h3 className="font-semibold text-foreground">Your payout slot</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          {currentPosition
            ? `Currently #${currentPosition}. Change before activation.`
            : 'Pick when you want to receive the pool.'}
        </p>
      </div>
      <div className="space-y-1">
        <Label htmlFor="claimSlot">Available slots</Label>
        <select
          id="claimSlot"
          name="payoutPosition"
          required
          defaultValue={currentPosition && open.includes(currentPosition) ? currentPosition : open[0]}
          className="flex h-11 w-full rounded-md border border-input bg-background px-3 text-sm"
        >
          {open.map((pos) => {
            const eco = describePayoutSlot({
              position: pos,
              maxSlots,
              contributionAmount,
              slotPricingEnabled,
              earlySlotFeePct,
              lateSlotRebatePct,
            });
            const money =
              eco.amount > 0 ? ` · ${formatCurrency(eco.amount, currency)}` : '';
            return (
              <option key={pos} value={pos}>
                #{pos} — {eco.label}
                {money}
              </option>
            );
          })}
        </select>
      </div>
      <Button type="submit" size="sm" className="min-h-11">
        Save payout slot
      </Button>
    </form>
  );
}
