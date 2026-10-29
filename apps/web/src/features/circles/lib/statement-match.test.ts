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

  it('reads money out from the same statements', () => {
    const mpesa = parseStatement(
      [
        'Receipt No.\tCompletion Time\tDetails\tTransaction Status\tPaid In\tWithdrawn\tBalance',
        'SKB1XY2Z3A\t2026-11-02 09:14:00\tFunds received from 0712345678 - FATUMA YUSUF\tCompleted\t2,000.00\t\t12,000.00',
        'SKB1XY2Z3B\t2026-11-02 10:00:00\tCustomer Transfer to 0733000222 - ZENA RASHID\tCompleted\t\t-500.00\t11,500.00',
      ].join('\n'),
      'out',
    );
    assert.deepEqual(
      mpesa.map((l) => [l.reference, l.amount, l.phone]),
      [['SKB1XY2Z3B', 500, '254733000222']],
    );
    const csv = parseStatement(
      ['Date,Narration,Debit,Credit,Balance', '04/11/2026,"LEDGER FEE","50.00","","13,450.00"'].join('\n'),
      'out',
    );
    assert.equal(csv[0]!.amount, 50);
    const loose = parseStatement('5-Nov-2026 SKD7EF8GH9 sent to Zena Rashid 0733 000 222 -1,000.00', 'out');
    assert.equal(loose[0]!.amount, 1000);
    assert.equal(parseStatement('5-Nov-2026 SKD7EF8GH9 sent to Zena -1,000.00').length, 0);
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

describe('DIB statement copied from the PDF', () => {
  // Same layout as a real DIB "Statement of Account", with made-up people and numbers.
  const dib = [
    'Transaction Ref Transaction Type and Description Value Date Debits Credits Balance',
    ' 01/10/2026 Balance Brought Forward 01/10/2026 0.00 0.00 6.58',
    ' 01/10/2026 001MPSI262740012',
    'Mobile To Account Transfer  ',
    'UJ1L080G7M/254712345678/Fatuma ',
    'Yusuf/001517100104602      ',
    '01/10/2026 0.00 2,000.00 2,006.58',
    ' 01/10/2026 001MPSO262740515',
    'Account To Mobile Transfer  MPESA',
    '254721437888     ',
    '01/10/2026 500.00 0.00 1,506.58',
    ' 12/10/2026 001MPSI262850526',
    'Mobile To Account Transfer  ',
    'UJALE9VMER/0733000222/ZENA ',
    'RASHID/001517100104602',
    '10/10/2026 0.00 1,000.00 2,506.58',
  ].join('\n');

  it('reads each payment in, skipping payments out and the opening balance', () => {
    const lines = parseStatement(dib);
    assert.deepEqual(
      lines.map((l) => [l.date, l.amount, l.reference, l.phone]),
      [
        ['2026-10-01', 2000, '001MPSI262740012', '254712345678'],
        ['2026-10-10', 1000, '001MPSI262850526', '254733000222'],
      ],
    );
  });

  it('reads each payment out with the payee phone', () => {
    const lines = parseStatement(dib, 'out');
    assert.deepEqual(
      lines.map((l) => [l.date, l.amount, l.reference, l.phone]),
      [['2026-10-01', 500, '001MPSO262740515', '254721437888']],
    );
    assert.equal(matchMember(lines[0]!, members).memberId, 'asha');
  });

  it('matches the payers to members', () => {
    const lines = parseStatement(dib);
    assert.deepEqual(
      lines.map((l) => matchMember(l, members).memberId),
      ['fatuma', 'zena'],
    );
  });
});
