import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  contributionFillLabel,
  cycleProgressPhrase,
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
        currentCycle: 2,
        cycleCount: 9,
      }),
      /cycle 2\/9/,
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

  it('12 Stars Rafiki shape: open, current_cycle 0, cycle_count 9, 12 seats', () => {
    // Mirrors prod: contributions for cycles 1–9 exist; 12 payout_positions;
    // circle never activated → current_cycle stays 0. Do not invent progress from seats.
    const summary = memberHeroSummary({
      kind: 'rotating',
      status: 'open',
      memberCount: 12,
      maxMembers: 12,
      currentCycle: 0,
      cycleCount: 9,
    });
    assert.match(summary, /open/);
    assert.match(summary, /12\/12 members/);
    assert.match(summary, /not started · 9 rounds planned/);
    assert.doesNotMatch(summary, /cycle 0\/9/);
    assert.doesNotMatch(summary, /12 rounds/);
  });
});

describe('cycleProgressPhrase', () => {
  it('does not treat seat count as progress', () => {
    assert.equal(cycleProgressPhrase(0, 9), 'not started · 9 rounds planned');
    assert.equal(cycleProgressPhrase(3, 12), 'cycle 3/12');
  });
});

describe('merryGoRoundHeadline', () => {
  it('uses planned cycle_count, not slot list length alone', () => {
    // Regression: 12 assigned payout slots must not force "of 12" when cycle_count is 9.
    const h = merryGoRoundHeadline({
      currentCycle: 0,
      plannedCycles: 9,
      slotCount: 12,
    });
    assert.equal(h.total, 9);
    assert.equal(h.current, 0);
    assert.equal(h.started, false);
    assert.equal(h.label, 'Not started · 9 rounds planned');
  });

  it('shows Cycle N of M after activation', () => {
    const h = merryGoRoundHeadline({
      currentCycle: 1,
      plannedCycles: 12,
      slotCount: 12,
    });
    assert.equal(h.label, 'Cycle 1 of 12');
    assert.equal(h.started, true);
  });

  it('falls back to slotCount when plannedCycles missing', () => {
    const h = merryGoRoundHeadline({
      currentCycle: 2,
      plannedCycles: null,
      slotCount: 8,
    });
    assert.equal(h.total, 8);
    assert.equal(h.label, 'Cycle 2 of 8');
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
