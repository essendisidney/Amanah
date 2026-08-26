/** Money Fellows–style slot economics (facilitation fee / late rebate). Not interest. */

export type SlotEconomics = {
  position: number;
  band: 'early' | 'late';
  label: string;
  pct: number;
  amount: number;
};

export function slotBand(
  position: number,
  maxSlots: number,
): 'early' | 'late' {
  const mid = Math.max(1, Math.ceil(maxSlots / 2));
  return position <= mid ? 'early' : 'late';
}

export function describePayoutSlot(params: {
  position: number;
  maxSlots: number;
  contributionAmount: number;
  slotPricingEnabled?: boolean;
  earlySlotFeePct?: number;
  lateSlotRebatePct?: number;
}): SlotEconomics {
  const {
    position,
    maxSlots,
    contributionAmount,
    slotPricingEnabled = false,
    earlySlotFeePct = 0,
    lateSlotRebatePct = 0,
  } = params;
  const band = slotBand(position, maxSlots);
  if (!slotPricingEnabled) {
    return {
      position,
      band,
      label: band === 'early' ? 'Early payout' : 'Later payout',
      pct: 0,
      amount: 0,
    };
  }
  if (band === 'early') {
    const pct = earlySlotFeePct;
    return {
      position,
      band,
      label: pct > 0 ? `Early slot · ${pct}% facilitation fee` : 'Early payout',
      pct,
      amount: Math.round(((contributionAmount * pct) / 100) * 100) / 100,
    };
  }
  const pct = lateSlotRebatePct;
  return {
    position,
    band,
    label: pct > 0 ? `Late slot · ${pct}% rebate` : 'Later payout',
    pct,
    amount: Math.round(((contributionAmount * pct) / 100) * 100) / 100,
  };
}

export function availablePayoutSlots(
  maxSlots: number,
  taken: Array<number | null | undefined>,
): number[] {
  const takenSet = new Set(
    taken.filter((n): n is number => typeof n === 'number' && n >= 1),
  );
  const slots: number[] = [];
  for (let i = 1; i <= Math.max(1, maxSlots); i += 1) {
    if (!takenSet.has(i)) slots.push(i);
  }
  return slots;
}
