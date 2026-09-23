import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { enrichNotification } from './notification-enrichment.ts';

describe('enrichNotification', () => {
  it('shows failed current status on a pending withdrawal notice', () => {
    const withdrawalId = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
    const withdrawals = new Map([
      [
        withdrawalId,
        { id: withdrawalId, status: 'failed', error_message: 'INSUFFICIENT_FUNDS' },
      ],
    ]);
    const out = enrichNotification({
      title: 'Withdrawal requested',
      type: 'system',
      data: { withdrawal_id: withdrawalId },
      withdrawalsById: withdrawals,
      intentsById: new Map(),
    });
    assert.equal(out.currentStatus, 'failed');
    assert.match(out.statusNote ?? '', /failed/i);
    assert.match(out.statusNote ?? '', /history/i);
  });

  it('separates payment, settlement, and reconcile on intents', () => {
    const intentId = 'b2c3d4e5-f6a7-8901-bcde-f12345678901';
    const intents = new Map([
      [
        intentId,
        {
          id: intentId,
          status: 'completed',
          settlement_status: 'settled',
          reconcile_status: 'matched',
        },
      ],
    ]);
    const out = enrichNotification({
      title: 'Payment update',
      type: 'payment',
      data: { payment_intent_id: intentId },
      withdrawalsById: new Map(),
      intentsById: intents,
    });
    assert.equal(out.currentStatus, 'completed');
    assert.equal(out.settlementStatus, 'settled');
    assert.equal(out.reconcileStatus, 'matched');
    assert.match(out.statusNote ?? '', /settlement/i);
  });
});
