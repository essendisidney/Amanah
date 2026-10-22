-- pgTAP: money set aside for an open withdrawal cannot be spent on anything else, and a payout
-- slot lost to a simultaneous claim is reported as taken.
-- Run with scripts/test-db.mjs (or `supabase test db`). Everything rolls back.
-- The races themselves are exercised by scripts/stress/run.mjs.
BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SET LOCAL search_path = public, extensions;

SELECT plan(14);

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------
CREATE FUNCTION pg_temp.as_member(p_sql TEXT)
RETURNS JSONB LANGUAGE plpgsql AS $$
DECLARE r JSONB;
BEGIN
  PERFORM set_config('request.jwt.claims',
    '{"role":"authenticated","sub":"a0000000-0000-0000-0000-000000000001"}', true);
  SET LOCAL ROLE authenticated;
  EXECUTE p_sql INTO r;
  RESET ROLE;
  RETURN r;
END;
$$;

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

CREATE FUNCTION pg_temp.wallet()
RETURNS NUMERIC LANGUAGE sql AS $$
  SELECT balance FROM public.wallets WHERE user_id = 'a0000000-0000-0000-0000-000000000001'
$$;

CREATE FUNCTION pg_temp.withdraw(p_amount NUMERIC)
RETURNS JSONB LANGUAGE sql AS $$
  SELECT pg_temp.as_member(format('SELECT public.request_withdrawal(%s)', p_amount))
$$;

CREATE FUNCTION pg_temp.pay(p_cycle INT)
RETURNS JSONB LANGUAGE sql AS $$
  SELECT pg_temp.as_member(format('SELECT public.pay_contribution(%L)',
    ('d0000000-0000-0000-0000-00000000000' || p_cycle)::uuid))
$$;

CREATE FUNCTION pg_temp.payout(p_withdrawal UUID)
RETURNS JSONB LANGUAGE sql AS $$
  SELECT pg_temp.service(format('SELECT public.process_withdrawal(%L, true, %L, NULL)',
    p_withdrawal, 'b2c-test'))
$$;

-- ---------------------------------------------------------------------------
-- Fixtures: a member with 5,000 in a circle with 1,000 contributions and a welfare fund
-- ---------------------------------------------------------------------------
INSERT INTO auth.users (id, email, raw_user_meta_data) VALUES
  ('a0000000-0000-0000-0000-000000000001', 'member@test.local', '{"full_name":"Member","phone":"+254700000001"}'),
  ('a0000000-0000-0000-0000-000000000002', 'other@test.local', '{"full_name":"Other","phone":"+254700000002"}');

SELECT private.ledger_credit('a0000000-0000-0000-0000-000000000001', 'KES', 5000,
  'payout', NULL, 'fixture', NULL, '{}'::jsonb);

INSERT INTO public.jamiyas (id, name, slug, created_by, contribution_amount, max_members, status)
VALUES ('b0000000-0000-0000-0000-000000000001', 'Reserve Circle', 'reserve-test-circle',
        'a0000000-0000-0000-0000-000000000002', 1000, 10, 'open');
INSERT INTO public.members (id, jamiya_id, user_id, role, status)
VALUES ('c0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001',
        'a0000000-0000-0000-0000-000000000001', 'member', 'active');
INSERT INTO public.contributions (id, jamiya_id, member_id, cycle_number, amount, currency, due_date)
SELECT ('d0000000-0000-0000-0000-00000000000' || n)::uuid, 'b0000000-0000-0000-0000-000000000001',
       'c0000000-0000-0000-0000-000000000001', n, 1000, 'KES', CURRENT_DATE
FROM generate_series(1, 3) n;
INSERT INTO public.welfare_funds (jamiya_id) VALUES ('b0000000-0000-0000-0000-000000000001');

-- ---------------------------------------------------------------------------
-- Reserved money cannot be spent elsewhere
-- ---------------------------------------------------------------------------
CREATE TEMP TABLE w AS SELECT (pg_temp.withdraw(4500)->>'withdrawal_id')::uuid AS id;
SELECT ok((SELECT id FROM w) IS NOT NULL, 'a withdrawal of 4,500 is accepted');

SELECT is(pg_temp.pay(1)->>'error', 'INSUFFICIENT_FUNDS',
  'a 1,000 contribution cannot use money set aside for the withdrawal');
SELECT is(pg_temp.as_member($$SELECT public.contribute_to_welfare('b0000000-0000-0000-0000-000000000001', 600)$$)->>'ok',
  'false', 'nor can a welfare gift');
SELECT is(pg_temp.as_member($$SELECT public.contribute_to_welfare('b0000000-0000-0000-0000-000000000001', 500)$$)->>'ok',
  'true', 'the 500 not set aside can still be given');
SELECT is(pg_temp.wallet(), 4500.00::numeric, 'only the free 500 left the wallet');

SELECT is(pg_temp.payout((SELECT id FROM w))->>'status', 'completed',
  'the payout still debits the money set aside for it');
SELECT is(pg_temp.wallet(), 0.00::numeric, 'and the wallet is empty, not short');

-- ---------------------------------------------------------------------------
-- Several withdrawals: each payout uses its own reservation
-- ---------------------------------------------------------------------------
SELECT private.ledger_credit('a0000000-0000-0000-0000-000000000001', 'KES', 5000,
  'payout', NULL, 'fixture-2', NULL, '{}'::jsonb);
CREATE TEMP TABLE w2 AS
  SELECT (pg_temp.withdraw(2000)->>'withdrawal_id')::uuid AS a,
         (pg_temp.withdraw(2000)->>'withdrawal_id')::uuid AS b;
SELECT is(pg_temp.withdraw(2000)->>'error', 'INSUFFICIENT_FUNDS',
  'a third 2,000 withdrawal does not fit in what is left');
SELECT is(pg_temp.pay(1)->>'ok', 'true', 'the free 1,000 pays a contribution');
SELECT is(pg_temp.pay(2)->>'error', 'INSUFFICIENT_FUNDS', 'but not a second');
SELECT is(pg_temp.payout((SELECT a FROM w2))->>'status', 'completed', 'first payout completes');
SELECT is(pg_temp.payout((SELECT b FROM w2))->>'status', 'completed', 'second payout completes');

-- ---------------------------------------------------------------------------
-- A cancelled withdrawal frees its money
-- ---------------------------------------------------------------------------
SELECT private.ledger_credit('a0000000-0000-0000-0000-000000000001', 'KES', 1000,
  'payout', NULL, 'fixture-3', NULL, '{}'::jsonb);
CREATE TEMP TABLE w3 AS SELECT (pg_temp.withdraw(1000)->>'withdrawal_id')::uuid AS id;
SELECT pg_temp.service(format('SELECT public.process_withdrawal(%L, false, NULL, %L)',
  (SELECT id FROM w3), 'Cancelled by member'));
SELECT is(pg_temp.pay(2)->>'ok', 'true', 'once the withdrawal is cancelled the money can be spent');
SELECT is(pg_temp.wallet(), 0.00::numeric, 'and the books end at zero');

SELECT * FROM finish();
ROLLBACK;
