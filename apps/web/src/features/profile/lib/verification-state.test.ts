import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { resolveVerificationState } from './verification-state.ts';

describe('resolveVerificationState', () => {
  it('reports not_started when no docs and default kyc', () => {
    const v = resolveVerificationState({ kycStatus: 'not_started', docs: [] });
    assert.equal(v.state, 'not_started');
    assert.equal(v.setupComplete, false);
    assert.match(v.label, /not started/i);
  });

  it('does not treat document upload alone as KYC approved', () => {
    const v = resolveVerificationState({
      kycStatus: 'not_started',
      docs: [{ status: 'uploaded' }],
    });
    assert.equal(v.state, 'pending_review');
    assert.equal(v.setupComplete, false);
    assert.notEqual(v.label, 'KYC approved');
  });

  it('maps under_review and pending to pending_review', () => {
    assert.equal(
      resolveVerificationState({ kycStatus: 'under_review', docs: [] }).state,
      'pending_review',
    );
    assert.equal(
      resolveVerificationState({ kycStatus: 'pending', docs: [{ status: 'under_review' }] })
        .state,
      'pending_review',
    );
  });

  it('returns approved only for live approved KYC', () => {
    const v = resolveVerificationState({
      kycStatus: 'approved',
      docs: [{ status: 'approved' }],
      iprsProvider: 'http',
    });
    assert.equal(v.state, 'approved');
    assert.equal(v.setupComplete, true);
  });

  it('never presents simulated IPRS match as live approved', () => {
    const v = resolveVerificationState({
      kycStatus: 'approved',
      docs: [],
      iprsProvider: 'simulated',
      iprsStatus: 'matched',
    });
    assert.equal(v.state, 'simulated');
    assert.equal(v.setupComplete, false);
    assert.match(v.label, /demo/i);
  });

  it('surfaces rejected when kyc rejected', () => {
    const v = resolveVerificationState({
      kycStatus: 'rejected',
      docs: [{ status: 'rejected' }],
    });
    assert.equal(v.state, 'rejected');
  });
});
