/**
 * Human-readable finance ops labels (payment vs settlement vs reconcile preserved).
 */

export const FINANCE_ACTION_LABELS = {
  match: {
    button: 'Mark matched',
    title:
      'Reconcile: treat provider evidence as matched to this payment. Does not change wallet balance.',
  },
  manual: {
    button: 'Close as manual',
    title:
      'Reconcile: close the exception after manual review without auto-match. Keep notes in audit.',
  },
  waive: {
    button: 'Waive exception',
    title:
      'Reconcile: clear the exception as waived (accepted discrepancy). Use sparingly and document why.',
  },
  mirror: {
    button: 'Create settlement row',
    title:
      'Settlement: insert a settlement ledger row mirroring this completed payment for bank ops.',
  },
  backfillJournal: {
    button: 'Post missing journal',
    title:
      'Integrity: post the double-entry journal that should have been written when the payment completed.',
  },
  backfillSettlement: {
    button: 'Backfill settlements',
    title: 'Integrity: create missing settlement rows for completed payments in batch.',
  },
  backfillWithdrawal: {
    button: 'Backfill withdrawal journals',
    title: 'Integrity: post missing journals for completed withdrawals.',
  },
} as const;

export function financeStatusLabel(status: string): string {
  const key = status.trim().toLowerCase();
  const map: Record<string, string> = {
    pending: 'Pending',
    processing: 'Processing',
    completed: 'Completed',
    failed: 'Failed',
    cancelled: 'Cancelled',
    expired: 'Expired',
    matched: 'Matched',
    exception: 'Exception',
    open: 'Open',
    manual: 'Manual',
    waived: 'Waived',
    unsettled: 'Unsettled',
    settled: 'Settled',
    disputed: 'Disputed',
    refunded: 'Refunded',
  };
  return map[key] ?? status.replaceAll('_', ' ');
}
