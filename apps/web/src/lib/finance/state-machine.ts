/**
 * Controlled status transitions for the finance engine.
 * Illegal moves throw — callers must catch and treat as soft failures.
 */

export type IntentStatus =
  | 'pending'
  | 'processing'
  | 'completed'
  | 'failed'
  | 'cancelled'
  | 'expired';

export type SettlementLayerStatus = 'unsettled' | 'settled' | 'disputed' | 'waived';

export type ReconcileStatus = 'open' | 'matched' | 'exception' | 'manual';

export type SettlementRecordStatus = 'pending' | 'settled' | 'failed' | 'disputed';

export type RefundStatus =
  | 'pending'
  | 'processing'
  | 'completed'
  | 'failed'
  | 'cancelled';

const INTENT_TRANSITIONS: Record<IntentStatus, readonly IntentStatus[]> = {
  pending: ['processing', 'completed', 'failed', 'cancelled', 'expired'],
  processing: ['completed', 'failed', 'cancelled', 'expired'],
  completed: [],
  failed: [],
  cancelled: [],
  expired: [],
};

const SETTLEMENT_LAYER_TRANSITIONS: Record<
  SettlementLayerStatus,
  readonly SettlementLayerStatus[]
> = {
  unsettled: ['settled', 'disputed', 'waived'],
  settled: ['disputed'],
  disputed: ['settled', 'waived'],
  waived: [],
};

const RECONCILE_TRANSITIONS: Record<ReconcileStatus, readonly ReconcileStatus[]> = {
  open: ['matched', 'exception', 'manual'],
  exception: ['matched', 'manual', 'open'],
  manual: ['matched', 'exception'],
  matched: ['exception'],
};

const SETTLEMENT_RECORD_TRANSITIONS: Record<
  SettlementRecordStatus,
  readonly SettlementRecordStatus[]
> = {
  pending: ['settled', 'failed', 'disputed'],
  settled: ['disputed'],
  failed: [],
  disputed: ['settled'],
};

const REFUND_TRANSITIONS: Record<RefundStatus, readonly RefundStatus[]> = {
  pending: ['processing', 'cancelled', 'failed'],
  processing: ['completed', 'failed', 'cancelled'],
  completed: [],
  failed: [],
  cancelled: [],
};

export class IllegalFinanceTransitionError extends Error {
  constructor(
    public readonly layer: string,
    public readonly from: string,
    public readonly to: string,
  ) {
    super(`Illegal ${layer} transition: ${from} → ${to}`);
    this.name = 'IllegalFinanceTransitionError';
  }
}

function assertTransition<T extends string>(
  layer: string,
  map: Record<T, readonly T[]>,
  from: T,
  to: T,
): void {
  if (from === to) return;
  const allowed = map[from];
  if (!allowed?.includes(to)) {
    throw new IllegalFinanceTransitionError(layer, from, to);
  }
}

export function assertIntentTransition(from: IntentStatus, to: IntentStatus): void {
  assertTransition('intent.status', INTENT_TRANSITIONS, from, to);
}

export function assertSettlementLayerTransition(
  from: SettlementLayerStatus,
  to: SettlementLayerStatus,
): void {
  assertTransition('intent.settlement_status', SETTLEMENT_LAYER_TRANSITIONS, from, to);
}

export function assertReconcileTransition(
  from: ReconcileStatus,
  to: ReconcileStatus,
): void {
  assertTransition('intent.reconcile_status', RECONCILE_TRANSITIONS, from, to);
}

export function assertSettlementRecordTransition(
  from: SettlementRecordStatus,
  to: SettlementRecordStatus,
): void {
  assertTransition('settlements.status', SETTLEMENT_RECORD_TRANSITIONS, from, to);
}

export function assertRefundTransition(from: RefundStatus, to: RefundStatus): void {
  assertTransition('refunds.status', REFUND_TRANSITIONS, from, to);
}

export function canTransitionIntent(from: IntentStatus, to: IntentStatus): boolean {
  try {
    assertIntentTransition(from, to);
    return true;
  } catch {
    return false;
  }
}

export const FINANCE_STATUS_MAPS = {
  intent: INTENT_TRANSITIONS,
  settlementLayer: SETTLEMENT_LAYER_TRANSITIONS,
  reconcile: RECONCILE_TRANSITIONS,
  settlementRecord: SETTLEMENT_RECORD_TRANSITIONS,
  refund: REFUND_TRANSITIONS,
} as const;
