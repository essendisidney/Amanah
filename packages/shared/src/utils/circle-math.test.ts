import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  availablePayoutSlots,
  describePayoutSlot,
  slotBand,
} from './slot-economics.ts';
import {
  mgrCyclePot,
  remainingDue,
  slotFeeAmount,
  wasPaidOnTime,
} from './circle-math.ts';

describe('mgrCyclePot', () => {
  it('multiplies members × contribution', () => {
    assert.equal(mgrCyclePot(10, 500), 5000);
    assert.equal(mgrCyclePot(16, 1000), 16000);
  });

  it('floors member count and never goes negative', () => {
    assert.equal(mgrCyclePot(2.9, 100), 200);
    assert.equal(mgrCyclePot(-1, 100), 0);
  });
});

describe('remainingDue', () => {
  it('handles partial and overpay', () => {
    assert.equal(remainingDue(500, 0), 500);
    assert.equal(remainingDue(500, 200), 300);
    assert.equal(remainingDue(500, 500), 0);
    assert.equal(remainingDue(500, 600), 0);
  });
});

describe('wasPaidOnTime', () => {
  it('compares calendar dates only', () => {
    assert.equal(wasPaidOnTime('2026-09-19', '2026-09-19'), true);
    assert.equal(wasPaidOnTime('2026-09-18', '2026-09-19'), true);
    assert.equal(wasPaidOnTime('2026-09-20', '2026-09-19'), false);
  });
});

describe('slot economics', () => {
  it('splits early/late around midpoint', () => {
    assert.equal(slotBand(1, 10), 'early');
    assert.equal(slotBand(5, 10), 'early');
    assert.equal(slotBand(6, 10), 'late');
  });

  it('computes facilitation fee when pricing enabled', () => {
    const early = describePayoutSlot({
      position: 1,
      maxSlots: 10,
      contributionAmount: 1000,
      slotPricingEnabled: true,
      earlySlotFeePct: 5,
      lateSlotRebatePct: 3,
    });
    assert.equal(early.band, 'early');
    assert.equal(early.amount, 50);
    assert.equal(slotFeeAmount(1000, 5), 50);

    const late = describePayoutSlot({
      position: 8,
      maxSlots: 10,
      contributionAmount: 1000,
      slotPricingEnabled: true,
      earlySlotFeePct: 5,
      lateSlotRebatePct: 3,
    });
    assert.equal(late.band, 'late');
    assert.equal(late.amount, 30);
  });

  it('lists open payout slots', () => {
    assert.deepEqual(availablePayoutSlots(5, [1, 3, null]), [2, 4, 5]);
  });
});
