import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { invitationJoinHref, ownInviteCode } from './invitation-join.ts';

const user = { id: 'ira', email: 'ira@jamiya.local' };

describe('invitationJoinHref', () => {
  it('opens the invite preview for a code', () => {
    assert.equal(invitationJoinHref('AB3K7M2Q'), '/invitations/AB3K7M2Q');
  });

  it('rejects a code that could change the path', () => {
    assert.equal(invitationJoinHref('../admin'), null);
    assert.equal(invitationJoinHref('a/b'), null);
    assert.equal(invitationJoinHref(''), null);
  });
});

describe('ownInviteCode', () => {
  it('uses this person\'s invite and not someone else\'s', () => {
    const rows = [
      {
        jamiya_id: 'circle',
        invite_code: 'OTHER111',
        invitee_user_id: 'bob',
        email: 'bob@jamiya.local',
      },
      {
        jamiya_id: 'circle',
        invite_code: 'IRA22222',
        invitee_user_id: 'ira',
        email: null,
      },
    ];
    assert.equal(ownInviteCode(rows, 'circle', user), 'IRA22222');
    assert.equal(ownInviteCode(rows, 'missing', user), null);
  });

  it('matches a reserved seat by email when the user id is not stored', () => {
    const rows = [
      {
        jamiya_id: 'circle',
        invite_code: 'MAIL3333',
        invitee_user_id: null,
        email: 'Ira@jamiya.local',
      },
    ];
    assert.equal(ownInviteCode(rows, 'circle', user), 'MAIL3333');
  });
});
