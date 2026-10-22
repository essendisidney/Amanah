#!/usr/bin/env node
/**
 * Concurrency stress test for the money paths, against the throwaway test database.
 *
 *   node scripts/test-db.mjs --keep no_such_test   # fresh database with every migration
 *   node scripts/stress/run.mjs [--seconds 60] [--clients 64]
 *
 * Seeds 300 funded members (seed.sql), fires races at the RPCs that move money with pgbench
 * (many connections at once, each call made as the member or the service role the way the
 * app makes it), then checks the books. Exits non-zero if an invariant breaks.
 * Never point this at production: it commits users and money.
 */
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const NAME = process.env.TEST_DB_CONTAINER ?? 'jameiyah-test-db';
const argv = process.argv.slice(2);
const opt = (name, dflt) => {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 ? Number(argv[i + 1]) : dflt;
};
const SECONDS = opt('seconds', 60);
const CLIENTS = opt('clients', 64);

function sh(cmd, args, input) {
  const r = spawnSync(cmd, args, { input, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  return { ok: r.status === 0, out: r.stdout ?? '', err: r.stderr ?? '' };
}

function psql(sql) {
  const r = sh(
    'docker',
    [
      'exec',
      '-i',
      NAME,
      'psql',
      '-U',
      'postgres',
      '-v',
      'ON_ERROR_STOP=1',
      '-q',
      '-At',
      '-F',
      '\t',
    ],
    sql,
  );
  if (!r.ok) throw new Error(r.err || r.out);
  return r.out.trim();
}

function rows(sql) {
  const out = psql(sql);
  return out ? out.split('\n').map((l) => l.split('\t')) : [];
}

function pgbench(name, script, { clients, transactions, seconds }) {
  const file = `/tmp/stress-${name}.sql`;
  const put = sh('docker', ['exec', '-i', NAME, 'sh', '-c', `cat > ${file}`], script);
  if (!put.ok) throw new Error(put.err);
  const args = [
    'exec',
    NAME,
    'pgbench',
    '-U',
    'postgres',
    '-n',
    '-f',
    file,
    '-c',
    String(clients),
    '-j',
    '4',
  ];
  args.push(...(seconds ? ['-T', String(seconds)] : ['-t', String(transactions)]));
  args.push('postgres');
  const r = sh('docker', args);
  const tps = /tps = ([\d.]+)/.exec(r.out)?.[1];
  const lat = /latency average = ([\d.]+) ms/.exec(r.out)?.[1];
  const failed = /number of failed transactions: (\d+)/.exec(r.out)?.[1];
  if (!r.ok || r.err.includes('aborted')) {
    console.log(
      `   pgbench reported problems:\n${(r.err || r.out).split('\n').slice(0, 8).join('\n')}`,
    );
  }
  return { tps: Number(tps ?? 0), latency: Number(lat ?? 0), failed: Number(failed ?? 0) };
}

function outcomes(scenario) {
  return rows(`
    SELECT outcome, count(*), round(percentile_cont(0.5) WITHIN GROUP (ORDER BY ms)::numeric, 1),
           round(percentile_cont(0.95) WITHIN GROUP (ORDER BY ms)::numeric, 1), round(max(ms), 1)
    FROM stress.results WHERE scenario LIKE '${scenario}%'
    GROUP BY 1 ORDER BY 2 DESC`);
}

const failures = [];
function check(label, pass, detail = '') {
  console.log(`   ${pass ? 'PASS' : 'FAIL'}  ${label}${detail ? `  (${detail})` : ''}`);
  if (!pass) failures.push(label);
}

function scenario(title, name, script, run, verify) {
  console.log(`\n== ${title}`);
  const t = pgbench(name, script, run);
  for (const [outcome, n, p50, p95, max] of outcomes(name)) {
    console.log(`   ${n.padStart(6)} × ${outcome}   p50 ${p50} ms · p95 ${p95} ms · max ${max} ms`);
  }
  console.log(`   ${t.tps.toFixed(0)} calls/s across ${run.clients} connections`);
  verify();
}

const UID = (n) => `a1000000-0000-0000-0000-${String(n).padStart(12, '0')}`;
const one = (sql) => psql(sql);

// ---------------------------------------------------------------------------
console.log('Seeding 300 members with 10,000 KES each…');
psql(`SET client_min_messages = error;\n${readFileSync(join(HERE, 'seed.sql'), 'utf8')}`);

// 1. Forty connections ask for the same member's money at once.
scenario(
  'Withdrawal race: 1,000 requests of 3,000 against one 10,000 wallet',
  'withdraw_race',
  `SELECT stress.call('withdraw_race', stress.uid(5), 'SELECT public.request_withdrawal(3000)');\n`,
  { clients: 40, transactions: 25 },
  () => {
    const [n, sum] = rows(`SELECT count(*), coalesce(sum(amount),0) FROM withdrawal_requests
      WHERE user_id = '${UID(5)}' AND status = 'pending'`)[0];
    check(
      'at most 3 withdrawals accepted (9,000 of 10,000)',
      Number(n) <= 3 && Number(sum) <= 10000,
      `${n} accepted, ${sum} reserved`,
    );
  },
);

// 2. The M-Pesa webhook delivered over and over, all at once.
scenario(
  'Webhook replay: 1,000 completions of 20 top-ups (500 each)',
  'webhook_replay',
  `\\set i random(1, 20)
SELECT stress.call('webhook_replay', NULL, format('SELECT public.complete_payment_intent(%L, %L)',
  ('e1000000-0000-0000-0000-' || lpad(:i::text, 12, '0'))::uuid, 'replay-' || :i));\n`,
  { clients: 40, transactions: 25 },
  () => {
    const bal = one(`SELECT balance FROM wallets WHERE user_id = '${UID(2)}'`);
    check(
      'each top-up credited exactly once (wallet 20,000)',
      Number(bal) === 20000,
      `wallet ${bal}`,
    );
  },
);

// 3. The same contributions paid from many tabs at once.
scenario(
  'Contribution race: 1,000 payments of the same 3 contributions',
  'pay_race',
  `\\set c random(1, 3)
SELECT stress.call('pay_race', stress.uid(6), format('SELECT public.pay_contribution(%L)',
  ('d1000000-0000-0000-' || lpad(:c::text, 4, '0') || '-000000000006')::uuid));\n`,
  { clients: 40, transactions: 25 },
  () => {
    const bal = one(`SELECT balance FROM wallets WHERE user_id = '${UID(6)}'`);
    const paid = one(
      `SELECT sum(amount_paid) FROM contributions WHERE member_id = 'c1000000-0000-0000-0000-000000000006'`,
    );
    check(
      'each contribution charged once (wallet 7,000, 3,000 paid)',
      Number(bal) === 7000 && Number(paid) === 3000,
      `wallet ${bal}, paid ${paid}`,
    );
  },
);

// 4. Everyone grabs the first 20 payout slots.
scenario(
  'Payout slot race: 1,000 claims by 299 members on slots 1–20',
  'slot_race',
  `\\set u random(2, 300)
\\set s random(1, 20)
SELECT stress.call('slot_race', stress.uid(:u), format('SELECT public.claim_payout_slot(%L, %s)',
  'b1000000-0000-0000-0000-000000000001', :s));\n`,
  { clients: 40, transactions: 25 },
  () => {
    const dup = one(`SELECT count(*) FROM (SELECT payout_position FROM members
      WHERE jamiya_id = 'b1000000-0000-0000-0000-000000000001' AND status = 'active' AND payout_position IS NOT NULL
      GROUP BY 1 HAVING count(*) > 1) d`);
    check('no payout slot held by two members', dup === '0', `${dup} doubled slots`);
  },
);

// 5. One loan repaid from many tabs at once.
scenario(
  'Loan repayment race: 1,000 repayments of 300 on a 1,000 qard loan',
  'repay_race',
  `SELECT stress.call('repay_race', stress.uid(4), 'SELECT public.repay_qard(''f1000000-0000-0000-0000-000000000001'', 300)');\n`,
  { clients: 40, transactions: 25 },
  () => {
    const [repaid, status] = rows(
      `SELECT amount_repaid, status FROM qard_loans WHERE id = 'f1000000-0000-0000-0000-000000000001'`,
    )[0];
    const bal = one(`SELECT balance FROM wallets WHERE user_id = '${UID(4)}'`);
    check('never repaid more than owed', Number(repaid) <= 1000, `repaid ${repaid}, ${status}`);
    check(
      'wallet matches what was repaid',
      Number(bal) === 10000 - Number(repaid),
      `wallet ${bal}`,
    );
  },
);

// 6. Reserve everything for a withdrawal, spend it elsewhere, then the admin pays out.
//    The app sends M-Pesa first and debits after (runWithdrawalDisbursement), so a debit that
//    fails here is money that already left Jameiyah.
scenario(
  'Reserve then spend: 50 members withdraw 10,000, then pay 3,000 of contributions',
  'reserve_spend',
  `\\set u random(7, 56)
SELECT stress.call('reserve_spend:withdraw', stress.uid(:u), 'SELECT public.request_withdrawal(10000)');
SELECT stress.call('reserve_spend:pay', stress.uid(:u), format('SELECT public.pay_contribution(%L)',
  ('d1000000-0000-0000-0001-' || lpad(:u::text, 12, '0'))::uuid));\n`,
  { clients: 50, transactions: 1 },
  () => {
    const payouts = rows(`SELECT id FROM withdrawal_requests WHERE status = 'pending'
      AND user_id IN (SELECT stress.uid(n) FROM generate_series(7, 56) n)`);
    for (const [id] of payouts) {
      psql(`SELECT stress.call('reserve_spend:payout', NULL,
        format('SELECT public.process_withdrawal(%L, true, %L, NULL)', '${id}', 'b2c-${id}'))`);
    }
    const lost = one(
      `SELECT count(*) FROM stress.results WHERE scenario = 'reserve_spend:payout' AND outcome = 'err:INSUFFICIENT_FUNDS'`,
    );
    const spent = one(
      `SELECT count(*) FROM stress.results WHERE scenario = 'reserve_spend:pay' AND outcome = 'ok'`,
    );
    for (const [outcome, n] of outcomes('reserve_spend:payout'))
      console.log(`   payout ${outcome}: ${n}`);
    check(
      'money reserved for a withdrawal cannot be spent elsewhere',
      spent === '0',
      `${spent} contributions paid from reserved money; ${lost} payouts would fail after M-Pesa sent the cash`,
    );
  },
);

// 7. Sustained mixed traffic across 244 other members.
scenario(
  `Mixed load: ${CLIENTS} connections for ${SECONDS}s (top-ups, withdrawals, payments, welfare, payouts)`,
  'mixed',
  `\\set u random(57, 300)
\\set op random(1, 100)
\\set c random(1, 3)
SELECT CASE
  WHEN :op <= 35 THEN stress.top_up('mixed:top_up', stress.uid(:u), 500)
  WHEN :op <= 55 THEN stress.call('mixed:withdraw', stress.uid(:u), 'SELECT public.request_withdrawal(200)')
  WHEN :op <= 80 THEN stress.call('mixed:pay', stress.uid(:u), format('SELECT public.pay_contribution(%L, 250)',
    ('d1000000-0000-0000-' || lpad(:c::text, 4, '0') || '-' || lpad(:u::text, 12, '0'))::uuid))
  WHEN :op <= 90 THEN stress.call('mixed:welfare', stress.uid(:u),
    'SELECT public.contribute_to_welfare(''b1000000-0000-0000-0000-000000000001'', 50)')
  ELSE stress.call('mixed:payout', NULL, format('SELECT public.process_withdrawal(%L, true, ''b2c'', NULL)',
    (SELECT id FROM public.withdrawal_requests WHERE status = 'pending' AND user_id = stress.uid(:u) LIMIT 1)))
END;\n`,
  { clients: CLIENTS, seconds: SECONDS },
  () => {},
);

// ---------------------------------------------------------------------------
console.log('\n== The books afterwards');
const snap = JSON.parse(
  one(`SELECT set_config('request.jwt.claims', '{"role":"service_role"}', false) IS NULL;
  SET ROLE service_role; SELECT public.finance_integrity_snapshot()::text;`)
    .split('\n')
    .pop(),
);
check(
  'wallets match the journal',
  Number(snap.wallet_vs_journal_delta_kes) === 0,
  `delta ${snap.wallet_vs_journal_delta_kes}`,
);
check(
  'every journal entry balances',
  snap.unbalanced_journal_entries === 0,
  `${snap.unbalanced_journal_entries} unbalanced`,
);
check(
  'every completed top-up and withdrawal is journalled',
  snap.completed_intents_missing_journal === 0 && snap.completed_withdrawals_missing_journal === 0,
);

const drift = one(`SELECT count(*) FROM wallets w WHERE w.balance <> coalesce((
  SELECT sum(CASE WHEN t.direction = 'credit' THEN t.amount ELSE -t.amount END)
  FROM transactions t WHERE t.wallet_id = w.id AND t.status = 'completed'), 0)`);
check('every wallet equals the sum of its transactions', drift === '0', `${drift} wallets drifted`);
const negative = one(`SELECT count(*) FROM wallets WHERE balance < 0 OR available_balance < 0`);
check('no negative wallet', negative === '0', `${negative} negative`);
const overReserved = one(`SELECT count(*) FROM wallets w WHERE w.available_balance < (
  SELECT coalesce(sum(amount), 0) FROM withdrawal_requests r
  WHERE r.user_id = w.user_id AND r.currency = w.currency AND r.status IN ('pending', 'processing'))`);
check(
  'open withdrawals are covered by the wallet',
  overReserved === '0',
  `${overReserved} wallets owe more than they hold`,
);
const overpaid = one(`SELECT count(*) FROM contributions c WHERE c.amount_paid > c.amount
  OR c.amount_paid <> coalesce((SELECT sum(t.amount) FROM transactions t
    WHERE t.type = 'contribution' AND t.status = 'completed' AND t.metadata->>'contribution_id' = c.id::text), 0)`);
check(
  'contributions: paid = what was debited, never more than due',
  overpaid === '0',
  `${overpaid} wrong`,
);
const welfare = rows(`SELECT f.balance, coalesce((SELECT sum(t.amount) FROM transactions t
  WHERE t.jamiya_id = f.jamiya_id AND t.metadata->>'kind' = 'welfare_contribution' AND t.status = 'completed'), 0)
  FROM welfare_funds f WHERE f.jamiya_id = 'b1000000-0000-0000-0000-000000000001'`)[0];
check(
  'welfare fund equals what members gave',
  Number(welfare[0]) === Number(welfare[1]),
  `fund ${welfare[0]}, debits ${welfare[1]}`,
);

const deadlocks = one(`SELECT count(*) FROM stress.results WHERE outcome LIKE 'exc:40P01%'`);
const crashes = rows(
  `SELECT outcome, count(*) FROM stress.results WHERE outcome LIKE 'exc:%' GROUP BY 1 ORDER BY 2 DESC`,
);
check('no deadlocks', deadlocks === '0', `${deadlocks} deadlocks`);
for (const [o, n] of crashes) console.log(`   raw database error ×${n}: ${o}`);

console.log(failures.length ? `\n${failures.length} check(s) failed.` : '\nAll checks passed.');
process.exit(failures.length ? 1 : 0);
