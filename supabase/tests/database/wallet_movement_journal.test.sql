-- pgTAP: every wallet movement reaches the journal, so wallets always equal account 2000.
-- Covers welfare, savings pockets, dividends, circle payouts and Qard.
-- Run with scripts/test-db.mjs (or `supabase test db`). Everything rolls back.
BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SET LOCAL search_path = public, extensions;

SELECT plan(43);

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------
-- Run an RPC as a signed-in user.
CREATE FUNCTION pg_temp.rpc(p_uid UUID, p_sql TEXT)
RETURNS JSONB LANGUAGE plpgsql AS $$
DECLARE r JSONB;
BEGIN
  PERFORM set_config('request.jwt.claims',
    json_build_object('role', 'authenticated', 'sub', p_uid)::text, true);
  SET LOCAL ROLE authenticated;
  EXECUTE p_sql INTO r;
  RESET ROLE;
  RETURN r;
END;
$$;

-- Run an RPC as the service role.
CREATE FUNCTION pg_temp.service(p_sql TEXT)
RETURNS JSONB LANGUAGE plpgsql AS $$
DECLARE r JSONB;
BEGIN
  PERFORM set_config('request.jwt.claims', '{"role":"service_role"}', true);
  SET LOCAL ROLE service_role;
  EXECUTE p_sql INTO r;
  RESET ROLE;
  RETURN r;
END;
$$;

-- Member wallets minus the journal's member wallet liability (2000). Should stay 0.
CREATE FUNCTION pg_temp.gap()
RETURNS NUMERIC LANGUAGE sql AS $$
  SELECT coalesce((SELECT sum(balance) FROM public.wallets WHERE currency = 'KES'), 0)
       - coalesce((
           SELECT sum(CASE WHEN l.side = 'credit' THEN l.amount ELSE -l.amount END)
           FROM public.journal_lines l
           JOIN public.ledger_accounts a ON a.id = l.ledger_account_id
           WHERE a.code = '2000' AND l.currency = 'KES'), 0)
$$;

-- Debit-positive balance of one account.
CREATE FUNCTION pg_temp.account(p_code TEXT)
RETURNS NUMERIC LANGUAGE sql AS $$
  SELECT coalesce(sum(CASE WHEN l.side = 'debit' THEN l.amount ELSE -l.amount END), 0)
  FROM public.journal_lines l
  JOIN public.ledger_accounts a ON a.id = l.ledger_account_id
  WHERE a.code = p_code
$$;

-- The wallet_movement entry for a transaction, as 'Dr <code> / Cr <code> <amount>'.
CREATE FUNCTION pg_temp.entry(p_tx UUID)
RETURNS TEXT LANGUAGE sql AS $$
  SELECT 'Dr ' || max(a.code) FILTER (WHERE l.side = 'debit')
      || ' / Cr ' || max(a.code) FILTER (WHERE l.side = 'credit')
      || ' ' || max(l.amount)::text
  FROM public.journal_entries e
  JOIN public.journal_lines l ON l.journal_entry_id = e.id
  JOIN public.ledger_accounts a ON a.id = l.ledger_account_id
  WHERE e.source_type = 'wallet_movement' AND e.source_id = p_tx::text
$$;

CREATE FUNCTION pg_temp.entries(p_tx UUID)
RETURNS BIGINT LANGUAGE sql AS $$
  SELECT count(*) FROM public.journal_entries
  WHERE source_type = 'wallet_movement' AND source_id = p_tx::text
$$;

-- The member's wallet transaction of a kind and amount (created_at is the same for every
-- row inside one test transaction, so it can't order them).
CREATE FUNCTION pg_temp.tx(p_kind TEXT, p_amount NUMERIC)
RETURNS UUID LANGUAGE sql AS $$
  SELECT id FROM public.transactions
  WHERE user_id = 'a0000000-0000-0000-0000-000000000001'
    AND metadata->>'kind' = p_kind AND amount = p_amount
$$;

-- ---------------------------------------------------------------------------
-- Fixtures: a member (…01), a circle admin (…02), a circle, a welfare fund
-- ---------------------------------------------------------------------------
INSERT INTO auth.users (id, email, raw_user_meta_data) VALUES
  ('a0000000-0000-0000-0000-000000000001', 'member@test.local', '{"full_name":"Member","phone":"+254700000001"}'),
  ('a0000000-0000-0000-0000-000000000002', 'officer@test.local', '{"full_name":"Circle Admin"}');

INSERT INTO public.jamiyas (id, name, slug, created_by, contribution_amount, max_members)
VALUES ('b0000000-0000-0000-0000-000000000001', 'Ledger Circle', 'ledger-test-circle',
        'a0000000-0000-0000-0000-000000000002', 1000, 10);
INSERT INTO public.members (id, jamiya_id, user_id, role, status)
VALUES ('c0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001',
        'a0000000-0000-0000-0000-000000000001', 'member', 'active');
INSERT INTO public.contributions (id, jamiya_id, member_id, cycle_number, amount, currency, due_date)
VALUES ('d0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001',
        'c0000000-0000-0000-0000-000000000001', 1, 1000, 'KES', CURRENT_DATE);
INSERT INTO public.welfare_funds (id, jamiya_id, currency)
VALUES ('e0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', 'KES');

-- 10,000 into the member's wallet through the normal payment path.
INSERT INTO public.payment_intents (id, user_id, provider, amount, currency, metadata)
VALUES ('f0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001',
        'mpesa', 10000, 'KES', '{}');
SELECT pg_temp.service($$SELECT public.complete_payment_intent('f0000000-0000-0000-0000-000000000001')$$);

SELECT is(pg_temp.gap(), 0::numeric, 'baseline: wallets equal the journal after a top-up');

-- ---------------------------------------------------------------------------
-- Welfare
-- ---------------------------------------------------------------------------
SELECT is(
  pg_temp.rpc('a0000000-0000-0000-0000-000000000001',
    $$SELECT public.contribute_to_welfare('b0000000-0000-0000-0000-000000000001', 300)$$)->>'ok',
  'true', 'welfare contribution succeeds');
SELECT is(pg_temp.entry(pg_temp.tx('welfare_contribution', 300)), 'Dr 2000 / Cr 6000 300.00',
  'welfare contribution posts Dr 2000 / Cr 6000');
SELECT is(pg_temp.gap(), 0::numeric, 'welfare contribution keeps wallets equal to the journal');

SELECT is(
  pg_temp.rpc('a0000000-0000-0000-0000-000000000001',
    $$SELECT public.file_welfare_claim('b0000000-0000-0000-0000-000000000001', 'medical', 200, 'Hospital bill')$$)->>'ok',
  'true', 'welfare claim filed');
SELECT is(
  pg_temp.rpc('a0000000-0000-0000-0000-000000000002',
    $$SELECT public.decide_welfare_claim((SELECT id FROM public.welfare_claims LIMIT 1), true)$$)->>'status',
  'paid', 'welfare claim approved and paid');
SELECT is(pg_temp.entry(pg_temp.tx('welfare_claim', 200)), 'Dr 6000 / Cr 2000 200.00',
  'welfare claim posts Dr 6000 / Cr 2000');
SELECT is(pg_temp.account('6000'), -100::numeric, 'welfare clearing holds the fund balance (300 in, 200 out)');
SELECT is(pg_temp.gap(), 0::numeric, 'welfare claim keeps wallets equal to the journal');

-- ---------------------------------------------------------------------------
-- Savings pockets
-- ---------------------------------------------------------------------------
INSERT INTO public.savings_pockets (id, jamiya_id, member_id, category, currency)
VALUES ('e0000000-0000-0000-0000-000000000002', 'b0000000-0000-0000-0000-000000000001',
        'c0000000-0000-0000-0000-000000000001', 'regular', 'KES');

SELECT is(
  pg_temp.rpc('a0000000-0000-0000-0000-000000000001',
    $$SELECT public.move_savings_pocket('e0000000-0000-0000-0000-000000000002', 500, 'deposit')$$)->>'ok',
  'true', 'pocket deposit succeeds');
SELECT is(pg_temp.entry(pg_temp.tx('pocket_deposit', 500)), 'Dr 2000 / Cr 3000 500.00',
  'pocket deposit posts Dr 2000 / Cr 3000');
SELECT is(
  pg_temp.rpc('a0000000-0000-0000-0000-000000000001',
    $$SELECT public.move_savings_pocket('e0000000-0000-0000-0000-000000000002', 200, 'withdraw')$$)->>'ok',
  'true', 'pocket withdrawal succeeds');
SELECT is(pg_temp.entry(pg_temp.tx('pocket_withdraw', 200)), 'Dr 3000 / Cr 2000 200.00',
  'pocket withdrawal posts Dr 3000 / Cr 2000');
SELECT is(pg_temp.gap(), 0::numeric, 'pocket moves keep wallets equal to the journal');

-- ---------------------------------------------------------------------------
-- Circle dividend
-- ---------------------------------------------------------------------------
INSERT INTO public.circle_bank_accounts (id, jamiya_id, name, currency, balance, is_active)
VALUES ('e0000000-0000-0000-0000-000000000003', 'b0000000-0000-0000-0000-000000000001',
        'Circle bank', 'KES', 5000, true);
INSERT INTO public.circle_dividends (id, jamiya_id, label, total_amount, currency, status)
VALUES ('e0000000-0000-0000-0000-000000000004', 'b0000000-0000-0000-0000-000000000001',
        '2026', 150, 'KES', 'allocated');
INSERT INTO public.circle_dividend_allocations (dividend_id, jamiya_id, member_id, amount, currency, status)
VALUES ('e0000000-0000-0000-0000-000000000004', 'b0000000-0000-0000-0000-000000000001',
        'c0000000-0000-0000-0000-000000000001', 150, 'KES', 'allocated');

SELECT is(
  (pg_temp.rpc('a0000000-0000-0000-0000-000000000002',
    $$SELECT public.pay_circle_dividend('e0000000-0000-0000-0000-000000000004',
                                        'e0000000-0000-0000-0000-000000000003')$$)->>'paid')::int,
  1, 'dividend paid to one member');
SELECT is(pg_temp.entry(pg_temp.tx('circle_dividend', 150)), 'Dr 3000 / Cr 2000 150.00',
  'dividend posts Dr 3000 / Cr 2000');
SELECT is(pg_temp.gap(), 0::numeric, 'dividend keeps wallets equal to the journal');

-- ---------------------------------------------------------------------------
-- Circle payout (settled to the wallet)
-- ---------------------------------------------------------------------------
INSERT INTO public.payouts (id, jamiya_id, member_id, cycle_number, amount, currency, status, scheduled_date)
VALUES ('e0000000-0000-0000-0000-000000000005', 'b0000000-0000-0000-0000-000000000001',
        'c0000000-0000-0000-0000-000000000001', 99, 700, 'KES', 'scheduled', CURRENT_DATE);

SELECT is(
  pg_temp.service($$SELECT public.service_settle_payout('e0000000-0000-0000-0000-000000000005')$$)->>'ok',
  'true', 'circle payout settled');
SELECT is(
  pg_temp.entry((SELECT transaction_id FROM public.payouts WHERE id = 'e0000000-0000-0000-0000-000000000005')),
  'Dr 3000 / Cr 2000 700.00', 'circle payout posts Dr 3000 / Cr 2000');
SELECT is(pg_temp.gap(), 0::numeric, 'circle payout keeps wallets equal to the journal');

-- ---------------------------------------------------------------------------
-- Qard Hassan: disbursement and repayment
-- ---------------------------------------------------------------------------
INSERT INTO public.qard_loans (id, jamiya_id, borrower_id, amount, currency, purpose, status, agreement_accepted_at)
VALUES ('e0000000-0000-0000-0000-000000000006', 'b0000000-0000-0000-0000-000000000001',
        'a0000000-0000-0000-0000-000000000001', 1000, 'KES', 'School fees', 'requested', NOW());

SELECT is(
  pg_temp.rpc('a0000000-0000-0000-0000-000000000002',
    $$SELECT public.decide_qard('e0000000-0000-0000-0000-000000000006', true)$$)->>'status',
  'active', 'qard approved and disbursed');
SELECT is(pg_temp.entry(pg_temp.tx('qard_disbursement', 1000)), 'Dr 4000 / Cr 2000 1000.00',
  'qard disbursement posts Dr 4000 / Cr 2000');
SELECT is(pg_temp.account('4000'), 1000::numeric, 'qard receivable shows the loan');
SELECT is(pg_temp.gap(), 0::numeric, 'qard disbursement keeps wallets equal to the journal');

SELECT is(
  pg_temp.rpc('a0000000-0000-0000-0000-000000000001',
    $$SELECT public.repay_qard('e0000000-0000-0000-0000-000000000006', 400)$$)->>'ok',
  'true', 'qard repayment succeeds');
SELECT is(pg_temp.entry(pg_temp.tx('qard_repayment', 400)), 'Dr 2000 / Cr 4100 400.00',
  'qard repayment posts the wallet side, Dr 2000 / Cr 4100');
SELECT is(pg_temp.account('4100'), 0::numeric, 'qard repayments clearing nets to zero');
SELECT is(pg_temp.account('4000'), 600::numeric, 'qard receivable drops by the repayment');
SELECT is(pg_temp.gap(), 0::numeric, 'qard repayment keeps wallets equal to the journal');

-- ---------------------------------------------------------------------------
-- Paths journaled elsewhere, or unknown, are left alone
-- ---------------------------------------------------------------------------
SELECT is(
  pg_temp.rpc('a0000000-0000-0000-0000-000000000001',
    $$SELECT public.pay_contribution('d0000000-0000-0000-0000-000000000001')$$)->>'ok',
  'true', 'dues paid from the wallet');
SELECT is(
  pg_temp.entries((SELECT id FROM public.transactions
    WHERE idempotency_key LIKE 'pay_contribution:d0000000-0000-0000-0000-000000000001%')),
  0::bigint, 'dues payment is not double-posted as a wallet movement');
SELECT is(pg_temp.gap(), 0::numeric, 'dues payment keeps wallets equal to the journal');

SELECT is(
  private.post_journal_for_wallet_movement(private.ledger_credit(
    'a0000000-0000-0000-0000-000000000001', 'KES', 5, 'payout', NULL, 'mystery', NULL, '{}'::jsonb)),
  NULL, 'a payout with no kind and no payout is not guessed at');

-- ---------------------------------------------------------------------------
-- Idempotency, status updates, direction
-- ---------------------------------------------------------------------------
SELECT is(
  private.post_journal_for_wallet_movement(pg_temp.tx('welfare_contribution', 300)),
  (SELECT id FROM public.journal_entries WHERE source_type = 'wallet_movement'
     AND source_id = pg_temp.tx('welfare_contribution', 300)::text),
  'posting again returns the existing entry');
SELECT is(pg_temp.entries(pg_temp.tx('welfare_contribution', 300)), 1::bigint,
  'and does not add a second one');

INSERT INTO public.transactions (id, wallet_id, user_id, jamiya_id, type, status, amount, currency, direction, metadata)
SELECT 'e0000000-0000-0000-0000-000000000007', w.id, w.user_id, 'b0000000-0000-0000-0000-000000000001',
       'contribution', 'pending', 50, 'KES', 'debit', '{"kind":"welfare_contribution"}'
FROM public.wallets w WHERE w.user_id = 'a0000000-0000-0000-0000-000000000001';
SELECT is(pg_temp.entries('e0000000-0000-0000-0000-000000000007'), 0::bigint,
  'a pending movement is not posted');
UPDATE public.transactions SET status = 'completed' WHERE id = 'e0000000-0000-0000-0000-000000000007';
SELECT is(pg_temp.entry('e0000000-0000-0000-0000-000000000007'), 'Dr 2000 / Cr 6000 50.00',
  'it is posted when it completes');

INSERT INTO public.transactions (id, wallet_id, user_id, type, status, amount, currency, direction, metadata)
SELECT 'e0000000-0000-0000-0000-000000000008', w.id, w.user_id,
       'contribution', 'completed', 50, 'KES', 'credit', '{"kind":"pocket_deposit"}'
FROM public.wallets w WHERE w.user_id = 'a0000000-0000-0000-0000-000000000001';
SELECT is(pg_temp.entries('e0000000-0000-0000-0000-000000000008'), 0::bigint,
  'a kind in the wrong direction is not posted');

-- Backfill: a movement written while the trigger was off is picked up by the function.
ALTER TABLE public.transactions DISABLE TRIGGER wallet_movement_journal;
SELECT pg_temp.rpc('a0000000-0000-0000-0000-000000000001',
  $$SELECT public.contribute_to_welfare('b0000000-0000-0000-0000-000000000001', 25)$$);
ALTER TABLE public.transactions ENABLE TRIGGER wallet_movement_journal;
SELECT is(pg_temp.entries(pg_temp.tx('welfare_contribution', 25)), 0::bigint,
  'with the trigger off, nothing is posted');
SELECT isnt(private.post_journal_for_wallet_movement(pg_temp.tx('welfare_contribution', 25)), NULL,
  'the backfill function posts it afterwards');
SELECT is(pg_temp.entry(pg_temp.tx('welfare_contribution', 25)), 'Dr 2000 / Cr 6000 25.00',
  'with the right accounts');

-- ---------------------------------------------------------------------------
-- Not callable by members
-- ---------------------------------------------------------------------------
SELECT ok(
  NOT has_function_privilege('authenticated', 'private.post_journal_for_wallet_movement(uuid)', 'EXECUTE'),
  'members cannot post journals directly');
SELECT ok(
  NOT has_function_privilege('anon', 'private.post_journal_for_wallet_movement(uuid)', 'EXECUTE'),
  'anonymous users cannot post journals directly');

SELECT * FROM finish();
ROLLBACK;
