import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { taifaRejection } from './sms.ts';

// Replies as documented on Taifa's v2 API page and as returned in a live test.
describe('taifaRejection', () => {
  it('accepts status 1000', () => {
    assert.equal(
      taifaRejection(
        '[{"status_code":"1000","status_desc":"Success","message_id":"8841203","mobile_number":"254707556633"}]',
      ),
      null,
    );
  });

  it('reports the reason Taifa gives', () => {
    assert.equal(
      taifaRejection(
        '[{"status_code":"1001","status_desc":"Invalid short code","message_id":"0","mobile_number":"254722210711"}]',
      ),
      'Taifa 1001: Invalid short code',
    );
  });

  it('reports a non-JSON reply', () => {
    assert.match(taifaRejection('<html>404 Not Found</html>') ?? '', /^Bad response from Taifa/);
  });
});
