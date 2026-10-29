import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { matchMember, parseStatement, type StatementMember } from './statement-match.ts';

const members: StatementMember[] = [
  { id: 'asha', name: 'Asha Rashid', phone: '+254721437888' },
  { id: 'fatuma', name: 'Fatuma Yusuf', phone: '0712345678' },
  { id: 'zena', name: 'Zena Rashid', phone: '254733000222' },
];

describe('parseStatement', () => {
  it('reads an M-Pesa statement with a header, keeping only money in', () => {
    const lines = parseStatement(
      [
        'Receipt No.\tCompletion Time\tDetails\tTransaction Status\tPaid In\tWithdrawn\tBalance',
        'SKB1XY2Z3A\t2026-11-02 09:14:00\tFunds received from 0712345678 - FATUMA YUSUF\tCompleted\t2,000.00\t\t12,000.00',
        'SKB1XY2Z3B\t2026-11-02 10:00:00\tPay Bill to 342342\tCompleted\t\t500.00\t11,500.00',
      ].join('\n'),
    );
    assert.equal(lines.length, 1);
    assert.equal(lines[0]!.reference, 'SKB1XY2Z3A');
    assert.equal(lines[0]!.amount, 2000);
    assert.equal(lines[0]!.date, '2026-11-02');
    assert.equal(lines[0]!.phone, '254712345678');
  });

  it('reads a bank statement CSV with Credit and Debit columns', () => {
    const lines = parseStatement(
      [
        'Date,Narration,Debit,Credit,Balance',
        '03/11/2026,"MPESA C2B 2547******888 ASHA RASHID SKC4AB5CD6","","1,500.00","13,500.00"',
        '04/11/2026,"LEDGER FEE","50.00","","13,450.00"',
      ].join('\n'),
    );
    assert.equal(lines.length, 1);
    assert.equal(lines[0]!.amount, 1500);
    assert.equal(lines[0]!.date, '2026-11-03');
    assert.equal(lines[0]!.reference, 'SKC4AB5CD6');
    assert.equal(lines[0]!.phoneTail, '888');
  });

  it('reads loose lines without a header', () => {
    const [line] = parseStatement('5-Nov-2026 SKD7EF8GH9 Zena Rashid 0733 000 222 KES 1,000');
    assert.equal(line!.amount, 1000);
    assert.equal(line!.date, '2026-11-05');
    assert.equal(line!.phone, '254733000222');
  });

  it('gives a line without a code a stable reference so it is never recorded twice', () => {
    const a = parseStatement('02/11/2026\tCash deposit Asha\t700');
    const b = parseStatement('02/11/2026\tCash deposit Asha\t700');
    assert.equal(a[0]!.reference, b[0]!.reference);
    assert.match(a[0]!.reference, /^LINE-/);
  });
});

describe('matchMember', () => {
  it('matches by full phone, then masked phone, then name', () => {
    const [byPhone] = parseStatement('SKB1XY2Z3A 0712345678 FATUMA YUSUF 2,000');
    assert.deepEqual(matchMember(byPhone!, members), { memberId: 'fatuma', how: 'phone' });

    const [byTail] = parseStatement('SKC4AB5CD6 2547******888 ASHA RASHID 1,500');
    assert.deepEqual(matchMember(byTail!, members), { memberId: 'asha', how: 'phone_tail' });

    const [byName] = parseStatement('Cash deposit by ZENA RASHID 1000');
    assert.deepEqual(matchMember(byName!, members), { memberId: 'zena', how: 'name' });
  });

  it('leaves it to the officer when two members could match', () => {
    const [line] = parseStatement('Cash deposit RASHID 1000');
    assert.deepEqual(matchMember(line!, members), { memberId: null, how: null });
  });
});
