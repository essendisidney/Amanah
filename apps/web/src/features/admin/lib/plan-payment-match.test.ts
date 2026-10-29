import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { findCircle, guessPlan, type BillingCircle, type BillingPlan } from './plan-payment-match.ts';

const plans: BillingPlan[] = [
  { id: 'free', name: 'Free', max_members: 5, price_kes: 0 },
  { id: 'starter', name: 'Starter', max_members: 10, price_kes: 450, price_quarterly_kes: 1300, price_annual_kes: 4500 },
  { id: 'growth', name: 'Growth', max_members: 20, price_kes: 700, price_quarterly_kes: 2000, price_annual_kes: 7000 },
];

const circles: BillingCircle[] = [
  { id: 'a', name: 'Family savings', billingRef: 'JM10001', members: 16, planId: 'growth', period: 'monthly', officerPhones: ['254721437888'] },
  { id: 'b', name: 'Table Banking 3', billingRef: 'JM10002', members: 7, planId: null, period: null, officerPhones: ['254721437888', '254718023493'] },
];

describe('findCircle', () => {
  it('finds the circle by its reference in the narration', () => {
    assert.equal(findCircle('MPESA/254700000000/JM10002/0900739901', null, circles)?.id, 'b');
    assert.equal(findCircle('payment jm 10001', null, circles)?.id, 'a');
  });

  it('falls back to the phone of an officer of exactly one circle', () => {
    assert.equal(findCircle('MPESA no ref', '254718023493', circles)?.id, 'b');
    assert.equal(findCircle('MPESA no ref', '254721437888', circles), null);
  });
});

describe('guessPlan', () => {
  it('takes the plan and period whose price equals the amount', () => {
    assert.deepEqual(guessPlan(1300, circles[1]!, plans), { planId: 'starter', period: 'quarterly' });
    assert.deepEqual(guessPlan(7000, circles[0]!, plans), { planId: 'growth', period: 'annual' });
  });

  it('otherwise keeps the circle on its own plan', () => {
    assert.deepEqual(guessPlan(500, circles[0]!, plans), { planId: 'growth', period: 'monthly' });
  });

  it('never suggests a plan too small for the circle', () => {
    assert.deepEqual(guessPlan(450, circles[0]!, plans), { planId: 'growth', period: 'monthly' });
  });
});
