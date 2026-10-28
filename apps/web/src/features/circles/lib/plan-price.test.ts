import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { planListPrice } from './plan-price.ts';

const starter = { price_kes: 450, price_quarterly_kes: 1300, price_annual_kes: 4500 };
const enterprise = {
  price_kes: '1000.00',
  included_members: 35,
  per_member_kes: '30.00',
  price_cap_kes: '5000.00',
};

describe('planListPrice', () => {
  it('uses the fixed quarterly and yearly prices of the banded plans', () => {
    assert.equal(planListPrice(starter, 8, 'monthly'), 450);
    assert.equal(planListPrice(starter, 8, 'quarterly'), 1300);
    assert.equal(planListPrice(starter, 8, 'annual'), 4500);
  });

  it('adds KES 30 a member above 35 on Enterprise, capped at KES 5,000 a month', () => {
    assert.equal(planListPrice(enterprise, 35, 'monthly'), 1000);
    assert.equal(planListPrice(enterprise, 50, 'monthly'), 1450);
    assert.equal(planListPrice(enterprise, 50, 'quarterly'), 4133);
    assert.equal(planListPrice(enterprise, 50, 'annual'), 14500);
    assert.equal(planListPrice(enterprise, 400, 'monthly'), 5000);
  });
});
