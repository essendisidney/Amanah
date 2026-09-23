import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  contributionFillLabel,
  emptyScheduleMessage,
  memberHeroSummary,
  merryGoRoundHeadline,
  payoutScheduleLabel,
} from './circle-status-display.ts';

describe('memberHeroSummary', () => {
  it('includes cycle only for rotating circles', () => {
    assert.match(
      memberHeroSummary({
        kind: 'rotating',
        status: 'active',
        memberCount: 5,
        maxMembers: 12,
        currentCycle: 0,
        cycleCount: 9,
      }),
      /cycle 0\/9/,
    );
    assert.equal(
      memberHeroSummary({
        kind: 'share_dividend',
        status: 'active',
        memberCount: 5,
        maxMembers: 50,
        currentCycle: 1,
        cycleCount: 12,
      }).includes('cycle'),
      false,
    );
  });
});

describe('merryGoRoundHeadline', () => {
  it('uses planned cycle_count, not slot list length alone', () => {
    const h = merryGoRoundHeadline({
      currentCycle: 0,
      plannedCycles: 9,
      slotCount: 12,
    });
    assert.equal(h.total, 9);
    assert.equal(h.current, 0);
    assert.equal(h.label, 'Cycle 0 of 9');
  });
});

describe('payoutScheduleLabel', () => {
  it('distinguishes unassigned, awaiting schedule, and paid', () => {
    assert.equal(
      payoutScheduleLabel({
        hasAssignee: false,
        hasPayoutRecord: false,
        payoutStatus: null,
      }),
      'Unassigned',
    );
    assert.equal(
      payoutScheduleLabel({
        hasAssignee: true,
        hasPayoutRecord: false,
        payoutStatus: null,
      }),
      'Awaiting schedule',
    );
    assert.equal(
      payoutScheduleLabel({
        hasAssignee: true,
        hasPayoutRecord: true,
        payoutStatus: 'paid',
      }),
      'Received',
    );
  });
});

describe('contributionFillLabel', () => {
  it('does not say All in when nothing is recorded', () => {
    assert.match(contributionFillLabel(0, 0), /no dues/i);
    assert.match(contributionFillLabel(3, 0), /all in/i);
    assert.equal(contributionFillLabel(0, 4), '0 paid · 4 not yet');
  });
});

describe('emptyScheduleMessage', () => {
  it('does not tell officers to activate when already active', () => {
    const msg = emptyScheduleMessage({
      circleStatus: 'active',
      canActivate: false,
      canManageOps: true,
      memberCount: 8,
      kind: 'share_dividend',
    });
    assert.match(msg.title, /no contribution schedule/i);
    assert.doesNotMatch(msg.body, /activate the circle when/i);
  });
});
