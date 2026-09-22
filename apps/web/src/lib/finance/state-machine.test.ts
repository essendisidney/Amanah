import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  assertIntentTransition,
  assertReconcileTransition,
  assertRefundTransition,
  assertSettlementLayerTransition,
  canTransitionIntent,
  IllegalFinanceTransitionError,
} from './state-machine.ts';
import { fromAmountMinor, toAmountMinor } from './money.ts';

describe('toAmountMinor', () => {
  it('converts KES major to cents', () => {
    assert.equal(toAmountMinor(100), 10000);
    assert.equal(toAmountMinor('50.50'), 5050);
  });

  it('rejects non-positive amounts', () => {
    assert.throws(() => toAmountMinor(0));
    assert.throws(() => toAmountMinor(-1));
  });
});

describe('fromAmountMinor', () => {
  it('round-trips', () => {
    assert.equal(fromAmountMinor(toAmountMinor(250)), 250);
  });
});

describe('intent transitions', () => {
  it('allows pending → processing → completed', () => {
    assertIntentTransition('pending', 'processing');
    assertIntentTransition('processing', 'completed');
    assert.equal(canTransitionIntent('completed', 'failed'), false);
  });

  it('blocks completed → pending', () => {
    assert.throws(
      () => assertIntentTransition('completed', 'pending'),
      IllegalFinanceTransitionError,
    );
  });
});

describe('settlement / reconcile / refund maps', () => {
  it('settled → disputed only', () => {
    assertSettlementLayerTransition('settled', 'disputed');
    assert.throws(() => assertSettlementLayerTransition('settled', 'unsettled'));
  });

  it('matched → exception', () => {
    assertReconcileTransition('matched', 'exception');
  });

  it('refund pending → processing → completed', () => {
    assertRefundTransition('pending', 'processing');
    assertRefundTransition('processing', 'completed');
    assert.throws(() => assertRefundTransition('completed', 'pending'));
  });
});
