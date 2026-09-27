import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { payReturnPath } from './pay-return.ts';

describe('payReturnPath', () => {
  it('keeps a payment started on Pay on Pay', () => {
    assert.equal(payReturnPath('/pay'), '/pay');
    assert.equal(payReturnPath('  /pay  '), '/pay');
  });

  it('sends every other destination back to the circle', () => {
    assert.equal(payReturnPath(null), null);
    assert.equal(payReturnPath(''), null);
    assert.equal(payReturnPath('/dashboard'), null);
    assert.equal(payReturnPath('/circles/nairobi-sisters-circle'), null);
    assert.equal(payReturnPath('/pay?next=/admin'), null);
    assert.equal(payReturnPath('//evil.example'), null);
    assert.equal(payReturnPath('https://evil.example/pay'), null);
  });
});
