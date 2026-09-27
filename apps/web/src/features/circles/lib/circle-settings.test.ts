import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { circleSettingsUpdate } from './circle-settings.ts';

const base = {
  name: 'RAFA Chama',
  contributionAmount: 100,
  frequencyDays: 30,
  maxMembers: 50,
  memberCount: 4,
};

describe('circleSettingsUpdate', () => {
  it('keeps a valid group setup', () => {
    const result = circleSettingsUpdate(base);
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.patch.name, 'RAFA Chama');
    assert.equal(result.patch.description, null);
    assert.equal(result.patch.contribution_amount, 100);
    assert.equal(result.patch.contribution_frequency_days, 30);
    assert.equal(result.patch.max_members, 50);
  });

  it('rejects a member limit below the people already in', () => {
    const result = circleSettingsUpdate({ ...base, maxMembers: 3, memberCount: 4 });
    assert.equal(result.ok, false);
  });

  it('rejects a zero contribution and a name that is too short', () => {
    assert.equal(circleSettingsUpdate({ ...base, contributionAmount: 0 }).ok, false);
    assert.equal(circleSettingsUpdate({ ...base, name: 'Ab' }).ok, false);
    assert.equal(circleSettingsUpdate({ ...base, frequencyDays: 0 }).ok, false);
    assert.equal(circleSettingsUpdate({ ...base, description: 'x'.repeat(1001) }).ok, false);
  });
});
