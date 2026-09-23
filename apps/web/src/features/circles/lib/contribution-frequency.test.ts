import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  contributionFrequencyHint,
  contributionFrequencyLabel,
} from './contribution-frequency.ts';
import { walletTopUpHref, walletWithdrawHref } from '../../wallet/lib/wallet-focus-href.ts';

describe('contributionFrequencyLabel', () => {
  it('labels fixed-day intervals, not calendar months', () => {
    assert.equal(contributionFrequencyLabel(7), 'Every 7 days');
    assert.equal(contributionFrequencyLabel(30), 'Every 30 days');
    assert.equal(contributionFrequencyLabel(14), 'Every 14 days');
    assert.doesNotMatch(contributionFrequencyLabel(30), /month/i);
    assert.match(contributionFrequencyHint(), /not the same as calendar months/i);
  });
});

describe('wallet focus hrefs', () => {
  it('always includes focus=top-up for add-money links', () => {
    assert.equal(walletTopUpHref(), '/wallet?focus=top-up#top-up');
    assert.match(walletTopUpHref({ amount: 500 }), /focus=top-up/);
    assert.match(walletTopUpHref({ amount: 500 }), /amount=500/);
    assert.equal(walletWithdrawHref(), '/wallet?focus=withdraw#withdraw');
  });
});
