import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { describeCircleTerms, type CircleTerms } from './circle-terms.ts';

const money = (n: number) => `KES ${n}`;

const none: CircleTerms = {
  version: 1,
  currency: 'KES',
  contribution_amount: '1000.00',
  join_fee_amount: '0.00',
  transaction_fee_amount: '0.00',
  early_slot_fee_pct: '0',
  early_slot_fee_amount: '0',
  late_contribution_penalty: '0.00',
  missed_contribution_penalty: '0.00',
  late_loan_penalty_fixed: '0.00',
  late_loan_penalty_pct: '0.00',
  auto_fine_enabled: false,
  payout_compliance_mode: 'block',
};

describe('describeCircleTerms', () => {
  it('lists nothing for a circle with no fees or penalties', () => {
    assert.deepEqual(describeCircleTerms(none, money), []);
  });

  it('lists every fee with when it is charged', () => {
    const lines = describeCircleTerms(
      {
        ...none,
        join_fee_amount: '500.00',
        transaction_fee_amount: '50.00',
        early_slot_fee_pct: '10.00',
        early_slot_fee_amount: '100.00',
      },
      money,
    );
    assert.deepEqual(lines, [
      { label: 'Join fee', value: 'KES 500, once, when you join' },
      { label: 'Contribution fee', value: 'KES 50 each time a contribution is fully paid' },
      {
        label: 'Early payout slot fee',
        value:
          'KES 100 (10% of a contribution), once, only if you take a slot in the first half of the payout order',
      },
    ]);
  });

  it('lists penalties and says when they come out of a payout', () => {
    const lines = describeCircleTerms(
      {
        ...none,
        late_contribution_penalty: 20,
        missed_contribution_penalty: 100,
        late_loan_penalty_fixed: 50,
        late_loan_penalty_pct: 2,
        payout_compliance_mode: 'deduct',
      },
      money,
    );
    assert.deepEqual(lines.map((l) => l.label), [
      'Late contribution penalty',
      'Missed contribution penalty',
      'Late loan repayment penalty',
      'At payout',
    ]);
    assert.equal(lines[2]!.value, 'KES 50 + 2% of the overdue amount');
  });

  it('does not mention payout deductions when there is nothing to deduct', () => {
    assert.deepEqual(describeCircleTerms({ ...none, payout_compliance_mode: 'deduct' }, money), []);
  });
});
