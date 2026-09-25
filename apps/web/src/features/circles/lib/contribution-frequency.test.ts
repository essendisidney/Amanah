import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  addFrequencyDays,
  contributionFrequencyHint,
  contributionFrequencyLabel,
  formatCycleDueLabel,
  parseUtcDateOnly,
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

describe('formatCycleDueLabel', () => {
  it('keeps two rounds in the same calendar month distinct', () => {
    const start = parseUtcDateOnly('2026-10-02');
    const labels = [0, 1, 2, 3, 4, 5].map((index) =>
      formatCycleDueLabel(addFrequencyDays(start, index, 30)),
    );
    assert.deepEqual(labels, ['2 Oct 26', '1 Nov 26', '1 Dec 26', '31 Dec 26', '30 Jan 27', '1 Mar 27']);
    assert.notEqual(labels[2], labels[3]);
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
