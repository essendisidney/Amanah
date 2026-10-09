import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { describeChoice, sponsorshipStatusLabel, type ChoiceEvent } from './my-choices.ts';

const at = '2026-10-09T10:00:00Z';
const event = (e: Partial<ChoiceEvent>): ChoiceEvent => ({
  subject: 'notifications',
  subject_id: null,
  choice: 'opted_out',
  detail: {},
  created_at: at,
  ...e,
});

describe('describeChoice', () => {
  it('describes notification opt-outs and opt-ins', () => {
    assert.equal(
      describeChoice(event({ detail: { category: 'reminders', channel: 'sms' } })),
      'Turned off SMS contribution reminders',
    );
    assert.equal(
      describeChoice(event({ choice: 'opted_in', detail: { category: 'payout_alerts', channel: 'whatsapp' } })),
      'Turned on WhatsApp payout heads-up',
    );
  });

  it('describes sponsorship and plan choices', () => {
    assert.equal(describeChoice(event({ subject: 'sponsorship', choice: 'paused' })), 'Paused a sponsorship');
    assert.equal(describeChoice(event({ subject: 'sponsorship', choice: 'stopped' })), 'Stopped a sponsorship');
    assert.equal(
      describeChoice(event({ subject: 'circle_plan', choice: 'auto_renew_off' })),
      'Turned off circle plan auto-renew',
    );
  });

  it('describes accepted terms and fee votes with the circle name', () => {
    assert.equal(
      describeChoice(event({ subject: 'circle_terms', choice: 'accepted', detail: { name: 'Umoja', version: 3 } })),
      'Accepted Umoja’s fees and terms (version 3)',
    );
    assert.equal(
      describeChoice(event({ subject: 'fee_vote', choice: 'voted_no', detail: { name: 'Umoja' } })),
      'Voted no on a fee change in Umoja',
    );
  });
});

describe('sponsorshipStatusLabel', () => {
  it('calls a cancelled sponsorship stopped', () => {
    assert.equal(sponsorshipStatusLabel('cancelled'), 'Stopped');
  });
});
