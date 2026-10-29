import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { parseBulkPhoneLines } from './parse-bulk-phones.ts';

describe('parseBulkPhoneLines', () => {
  it('reads rows copied from Excel and skips the header row', () => {
    const rows = parseBulkPhoneLines(
      ['No.\tName\tPhone\tRole', '1\tAsha Rashid\t0721 437 888\tChair', '2\tFatuma Yusuf\t+254712345678\t'].join('\n'),
    );
    assert.deepEqual(
      rows.map((r) => [r.fullName, r.phone]),
      [
        ['Asha Rashid', '+254721437888'],
        ['Fatuma Yusuf', '+254712345678'],
      ],
    );
  });

  it('still reads "Name, phone" lines and bare numbers', () => {
    const rows = parseBulkPhoneLines('Zena Rashid, 0722000111\n0733000222');
    assert.deepEqual(
      rows.map((r) => [r.fullName, r.phone]),
      [
        ['Zena Rashid', '+254722000111'],
        [null, '+254733000222'],
      ],
    );
  });
});
