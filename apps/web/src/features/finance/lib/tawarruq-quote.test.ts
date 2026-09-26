import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { quoteTawarruq } from './tawarruq-quote.ts';

describe('quoteTawarruq', () => {
  it('gives the murabaha profit to Jameiyah', () => {
    const quote = quoteTawarruq({ cashAmount: 200_000, profitRateBps: 1000, tenorMonths: 12 });
    assert.ok(quote);
    assert.equal(quote.cashAmount, 200_000);
    assert.equal(quote.profitAmount, 20_000);
    assert.equal(quote.deferredAmount, 220_000);
    assert.equal(quote.installmentAmount, 18_333.33);
    assert.equal(quote.lastInstallmentAmount, 18_333.37);
    assert.equal(
      Math.round((quote.installmentAmount * 11 + quote.lastInstallmentAmount) * 100) / 100,
      220_000,
    );
  });

  it('rejects a quote that is not a real facility', () => {
    assert.equal(quoteTawarruq({ cashAmount: 500, profitRateBps: 1000, tenorMonths: 12 }), null);
    assert.equal(quoteTawarruq({ cashAmount: 200_000, profitRateBps: 200, tenorMonths: 12 }), null);
    assert.equal(quoteTawarruq({ cashAmount: 200_000, profitRateBps: 1000, tenorMonths: 5 }), null);
  });
});
