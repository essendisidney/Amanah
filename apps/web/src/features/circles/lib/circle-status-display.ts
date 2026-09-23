/**
 * Circle progress / merry-go-round display helpers (pure).
 * Keep UI labels aligned with stored cycle_count, payouts, and contributions.
 *
 * Glossary (do not conflate):
 * - cycle_count / plannedCycles — planned contribution periods (may differ from seat count)
 * - current_cycle — progress cursor (0 until activate_jamiya; then advanced on settled payouts)
 * - payout_position / payout slot — which member receives the pot in that turn
 * - cycle_number — period index on contribution/payout rows
 * - "round" — UI synonym for a cycle/period (no DB column)
 */

export type CircleKind = 'rotating' | 'savings' | 'share_dividend' | 'other';

/** Compact progress phrase for hero + dashboard (rotating circles). */
export function cycleProgressPhrase(currentCycle: number, plannedCycles: number): string {
  if (currentCycle <= 0) {
    return `not started · ${plannedCycles} rounds planned`;
  }
  const current = Math.min(Math.max(currentCycle, 1), plannedCycles);
  return `cycle ${current}/${plannedCycles}`;
}

export function memberHeroSummary(input: {
  kind: CircleKind;
  status: string;
  memberCount: number;
  maxMembers: number;
  currentCycle: number;
  cycleCount: number | null;
}): string {
  const members = `${input.memberCount}/${input.maxMembers} members`;
  const status = input.status.replaceAll('_', ' ');

  if (input.kind === 'rotating') {
    const total =
      input.cycleCount != null && input.cycleCount > 0
        ? input.cycleCount
        : null;
    if (total != null) {
      return `${status} · ${members} · ${cycleProgressPhrase(input.currentCycle, total)}`;
    }
    return `${status} · ${members}`;
  }

  // Savings / table banking: cycle_count is optional planning, not a pot turn index.
  return `${status} · ${members}`;
}

export function merryGoRoundHeadline(input: {
  currentCycle: number;
  plannedCycles: number | null;
  slotCount: number;
}): { current: number; total: number; started: boolean; label: string } {
  const planned =
    input.plannedCycles != null && input.plannedCycles > 0
      ? input.plannedCycles
      : input.slotCount > 0
        ? input.slotCount
        : 1;
  const started = input.currentCycle > 0;
  const current = Math.min(Math.max(input.currentCycle, 0), planned);
  // Prefer 0 when not started (current_cycle 0) rather than forcing 1.
  const displayCurrent = started ? Math.max(current, 1) : 0;
  // Seat count can exceed plannedCycles (decoupled config / mid-import). Total stays planned.
  return {
    current: displayCurrent,
    total: planned,
    started,
    label: started
      ? `Cycle ${displayCurrent} of ${planned}`
      : `Not started · ${planned} rounds planned`,
  };
}

export type PayoutSlotDisplay = {
  /** Member assigned to this slot position */
  hasAssignee: boolean;
  /** Payout row exists in schedule */
  hasPayoutRecord: boolean;
  payoutStatus: string | null;
};

/** Human label for pot receipt / schedule — not membership slot assignment. */
export function payoutScheduleLabel(slot: PayoutSlotDisplay): string {
  if (slot.payoutStatus === 'paid') return 'Received';
  if (slot.payoutStatus === 'scheduled' || slot.payoutStatus === 'processing') {
    return 'Up next';
  }
  if (slot.payoutStatus) {
    return slot.payoutStatus.replaceAll('_', ' ');
  }
  if (!slot.hasAssignee) return 'Unassigned';
  if (!slot.hasPayoutRecord) return 'Awaiting schedule';
  return 'Awaiting schedule';
}

/** Contribution completeness for a cycle — never "All in" when nobody has paid. */
export function contributionFillLabel(paidCount: number, unpaidCount: number): string {
  if (paidCount === 0 && unpaidCount === 0) {
    return 'No dues recorded for this round yet';
  }
  if (unpaidCount === 0 && paidCount > 0) {
    return `${paidCount} paid · All in`;
  }
  if (paidCount === 0) {
    return `0 paid · ${unpaidCount} not yet`;
  }
  return `${paidCount} paid · ${unpaidCount} not yet`;
}

export function emptyScheduleMessage(input: {
  circleStatus: string;
  canActivate: boolean;
  canManageOps: boolean;
  memberCount: number;
  kind: CircleKind;
}): { title: string; body: string } {
  const active = input.circleStatus === 'active' || input.circleStatus === 'paused';

  if (active) {
    return {
      title: 'No contribution schedule found',
      body:
        input.kind === 'share_dividend'
          ? 'This circle is active, but no contribution rows exist yet. An officer can regenerate the schedule from the officer desk, or record the first month manually.'
          : 'This circle is active, but no dues are on the calendar yet. Ask an officer to check activation records or add the first month.',
    };
  }

  if (input.canActivate) {
    return {
      title: 'No schedule yet — activate to generate it',
      body: 'Use Activate to build contribution dates for this circle.',
    };
  }

  if (input.canManageOps && input.memberCount < 2) {
    return {
      title: 'Invite at least one more person first',
      body: 'You need two or more members before activation creates the calendar.',
    };
  }

  if (input.canManageOps) {
    return {
      title: 'Schedule appears after activation',
      body: 'Activate the circle when members are ready.',
    };
  }

  return {
    title: 'Waiting on the circle officer',
    body: 'Contribution dates show here after the circle is activated.',
  };
}
