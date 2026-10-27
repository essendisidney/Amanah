import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { friendlyError } from './friendly-error.ts';

describe('friendlyError', () => {
  it('passes our own sentences through', () => {
    assert.equal(friendlyError('Enter a valid amount.'), 'Enter a valid amount.');
  });

  it('turns a bare code into words', () => {
    assert.equal(
      friendlyError('GOAL_NOT_FOUND'),
      'That did not go through (goal not found). Please try again, or ask your circle officer.',
    );
  });

  it('hides database internals', () => {
    const shown = friendlyError(
      'duplicate key value violates unique constraint "members_jamiya_user_unique_idx"',
    );
    assert.doesNotMatch(shown, /duplicate|constraint|members_/);
    assert.match(shown, /try again/);
    assert.doesNotMatch(friendlyError('function public.x(uuid) does not exist'), /function/);
  });

  it('hides storage and PostgREST internals', () => {
    for (const raw of [
      'new row violates row-level security policy',
      'Could not find the function public.x(p_id) in the schema cache',
      'The resource already exists',
      'The object exceeded the maximum allowed size',
    ]) {
      assert.match(friendlyError(raw), /^We could not complete that just now/);
    }
  });

  it('hides payment provider status lines', () => {
    assert.doesNotMatch(friendlyError('Paystack initialize HTTP 400'), /Paystack|HTTP/);
  });

  it('never returns an empty message', () => {
    assert.equal(friendlyError(''), 'That did not go through. Please try again.');
    assert.equal(friendlyError(null), 'That did not go through. Please try again.');
  });
});
