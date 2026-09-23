/**
 * Enrich in-app notifications with current entity status (history preserved).
 */

export type WithdrawalStatusRow = {
  id: string;
  status: string;
  error_message?: string | null;
};

export type PaymentIntentStatusRow = {
  id: string;
  status: string;
  settlement_status?: string | null;
  reconcile_status?: string | null;
  error_message?: string | null;
};

export type NotificationEnrichment = {
  /** Current lifecycle badge, e.g. failed / completed */
  currentStatus: string | null;
  /** Settlement vs reconcile when known */
  settlementStatus: string | null;
  reconcileStatus: string | null;
  /** Extra line under the original body */
  statusNote: string | null;
  hrefHint: string | null;
};

function asId(data: Record<string, unknown> | null | undefined, key: string): string | null {
  const v = data?.[key];
  return typeof v === 'string' && v.length > 8 ? v : null;
}

export function enrichNotification(input: {
  title: string;
  type: string;
  data: Record<string, unknown> | null;
  withdrawalsById: Map<string, WithdrawalStatusRow>;
  intentsById: Map<string, PaymentIntentStatusRow>;
}): NotificationEnrichment {
  const empty: NotificationEnrichment = {
    currentStatus: null,
    settlementStatus: null,
    reconcileStatus: null,
    statusNote: null,
    hrefHint: null,
  };

  const withdrawalId =
    asId(input.data, 'withdrawal_id') ??
    (input.title.toLowerCase().includes('withdrawal')
      ? asId(input.data, 'id')
      : null);

  if (withdrawalId) {
    const row = input.withdrawalsById.get(withdrawalId);
    if (!row) {
      return {
        ...empty,
        hrefHint: '/wallet',
      };
    }
    const status = row.status;
    let statusNote: string | null = null;
    if (status === 'failed') {
      statusNote = row.error_message
        ? `Current status: failed (${row.error_message}). This earlier update is kept for history.`
        : 'Current status: failed. This earlier update is kept for history.';
    } else if (status === 'completed' || status === 'paid') {
      statusNote = 'Current status: completed.';
    } else if (status === 'pending' || status === 'processing' || status === 'approved') {
      statusNote = `Current status: ${status.replaceAll('_', ' ')}.`;
    } else {
      statusNote = `Current status: ${status.replaceAll('_', ' ')}.`;
    }
    return {
      currentStatus: status,
      settlementStatus: null,
      reconcileStatus: null,
      statusNote,
      hrefHint: '/wallet',
    };
  }

  const intentId =
    asId(input.data, 'payment_intent_id') ?? asId(input.data, 'intent_id');
  if (intentId) {
    const row = input.intentsById.get(intentId);
    if (!row) return { ...empty, hrefHint: '/wallet' };
    const parts: string[] = [`Payment: ${row.status.replaceAll('_', ' ')}`];
    if (row.settlement_status) {
      parts.push(`settlement: ${row.settlement_status.replaceAll('_', ' ')}`);
    }
    if (row.reconcile_status) {
      parts.push(`reconcile: ${row.reconcile_status.replaceAll('_', ' ')}`);
    }
    if (row.error_message && row.status === 'failed') {
      parts.push(row.error_message);
    }
    return {
      currentStatus: row.status,
      settlementStatus: row.settlement_status ?? null,
      reconcileStatus: row.reconcile_status ?? null,
      statusNote: `Current: ${parts.join(' · ')}. Original notice kept for history.`,
      hrefHint: '/wallet',
    };
  }

  return empty;
}
