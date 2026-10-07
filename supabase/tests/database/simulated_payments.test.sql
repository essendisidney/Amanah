-- pgTAP: simulated payments are refused unless platform_settings.simulated_payments is on.
-- Run with scripts/test-db.mjs (or `supabase test db`). Everything rolls back.
BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SET LOCAL search_path = public, extensions;

SELECT plan(26);

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------
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
  SELECT coalesce((SELECT balance FROM public.wallets
    WHERE user_id = 'a0000000-0000-0000-0000-000000000001' AND currency = 'KES'), 0)
$$;

CREATE FUNCTION pg_temp.set_simulation(p_on BOOLEAN)
RETURNS VOID LANGUAGE sql AS $$
  UPDATE public.platform_settings SET value = jsonb_build_object('enabled', p_on)
  WHERE key = 'simulated_payments'
$$;

-- ---------------------------------------------------------------------------
-- Fixtures: a member (…01, with a phone) and a circle admin (…02)
-- ---------------------------------------------------------------------------
INSERT INTO auth.users (id, email, raw_user_meta_data) VALUES
  ('a0000000-0000-0000-0000-000000000001', 'member@test.local', '{"full_name":"Member","phone":"+254700000001"}'),
  ('a0000000-0000-0000-0000-000000000002', 'officer@test.local', '{"full_name":"Circle Admin"}');
UPDATE public.profiles SET phone = '+254700000001' WHERE id = 'a0000000-0000-0000-0000-000000000001';

INSERT INTO public.jamiyas (id, name, slug, created_by, contribution_amount, max_members)
VALUES ('b0000000-0000-0000-0000-000000000001', 'Sim Circle', 'sim-test-circle',
        'a0000000-0000-0000-0000-000000000002', 1000, 10);
INSERT INTO public.members (id, jamiya_id, user_id, role, status)
VALUES ('c0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001',
        'a0000000-0000-0000-0000-000000000001', 'member', 'active');

INSERT INTO public.payment_intents (id, user_id, provider, amount, currency, metadata) VALUES
  ('f0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'intasend', 500, 'KES', '{}'),
  ('f0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000001', 'intasend', 200, 'KES', '{}');

-- ---------------------------------------------------------------------------
-- The switch: off by default, and members cannot turn it on
-- ---------------------------------------------------------------------------
SELECT is(
  (SELECT value FROM public.platform_settings WHERE key = 'simulated_payments'),
  '{"enabled": false}'::jsonb, 'simulated payments are off by default');
SELECT is(private.simulated_payments_allowed(), false, 'the helper reads it as off');

SELECT pg_temp.rpc('a0000000-0000-0000-0000-000000000001', $$
  WITH u AS (UPDATE public.platform_settings SET value = '{"enabled": true}'
             WHERE key = 'simulated_payments' RETURNING 1)
  SELECT to_jsonb(count(*)) FROM u $$);
SELECT is(private.simulated_payments_allowed(), false, 'a member cannot switch it on');
SELECT ok(
  NOT has_function_privilege('authenticated', 'private.simulated_payments_allowed()', 'EXECUTE'),
  'members cannot call the helper');

-- ---------------------------------------------------------------------------
-- Collections
-- ---------------------------------------------------------------------------
SELECT throws_ok(
  $$ SELECT pg_temp.rpc('a0000000-0000-0000-0000-000000000001',
       'SELECT public.create_payment_intent(500, ''KES'', NULL, ''simulated'')') $$,
  'P0001', 'SIMULATED_PAYMENTS_DISABLED',
  'a member cannot create a simulated payment');

-- What payments-mpesa used to do without Daraja secrets.
SELECT throws_ok(
  $$ SELECT pg_temp.service($q$SELECT public.complete_payment_intent(
       'f0000000-0000-0000-0000-000000000001', 'mpesa-sim:f0000000-0000-0000-0000-000000000001',
       NULL, '{"source":"mpesa_fallback_simulated"}')$q$) $$,
  'P0001', 'SIMULATED_PAYMENTS_DISABLED',
  'the M-Pesa simulated fallback cannot complete a payment');
SELECT is(pg_temp.wallet(), 0::numeric, 'and nothing reaches the wallet');
SELECT is((SELECT status::text FROM public.payment_intents WHERE id = 'f0000000-0000-0000-0000-000000000001'),
  'pending', 'the payment stays pending');

SELECT throws_ok(
  $$ SELECT pg_temp.service($q$SELECT public.complete_payment_intent(
       'f0000000-0000-0000-0000-000000000002', 'ref-1', NULL, '{"source":"simulated_adapter"}')$q$) $$,
  'P0001', 'SIMULATED_PAYMENTS_DISABLED',
  'the web simulated adapter cannot complete a payment');

SELECT is(
  pg_temp.service($q$SELECT public.complete_payment_intent(
    'f0000000-0000-0000-0000-000000000001', 'QK7ABC123', NULL, '{"source":"intasend_webhook"}')$q$)->>'ok',
  'true', 'a real provider confirmation still completes');
SELECT is(pg_temp.wallet(), 500::numeric, 'and credits the wallet');

-- ---------------------------------------------------------------------------
-- Wallet movements and withdrawals marked as simulated
-- ---------------------------------------------------------------------------
SELECT throws_ok(
  $$ SELECT private.ledger_credit('a0000000-0000-0000-0000-000000000001', 'KES', 100,
       'wallet_top_up', NULL, 'top_up', NULL, '{"source":"simulated"}') $$,
  'P0001', 'SIMULATED_PAYMENTS_DISABLED',
  'a simulated wallet credit is refused');
SELECT throws_ok(
  $$ SELECT private.ledger_debit('a0000000-0000-0000-0000-000000000001', 'KES', 100,
       'wallet_withdrawal', NULL, 'sim-b2c:x', NULL, '{"simulated":true}') $$,
  'P0001', 'SIMULATED_PAYMENTS_DISABLED',
  'a simulated wallet debit is refused');
SELECT is(pg_temp.wallet(), 500::numeric, 'the wallet is unchanged');

INSERT INTO public.withdrawal_requests (id, user_id, amount, currency, status, destination_type, destination_phone)
VALUES ('e0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001',
        100, 'KES', 'pending', 'mpesa', '+254700000001');
SELECT throws_ok(
  $$ UPDATE public.withdrawal_requests SET status = 'completed', provider_reference = 'sim-b2c:e1'
     WHERE id = 'e0000000-0000-0000-0000-000000000001' $$,
  'P0001', 'SIMULATED_PAYMENTS_DISABLED',
  'a withdrawal cannot be marked paid by a simulated B2C');
SELECT lives_ok(
  $$ UPDATE public.withdrawal_requests SET status = 'completed', provider_reference = 'UBX12345'
     WHERE id = 'e0000000-0000-0000-0000-000000000001' $$,
  'a real B2C reference still completes it');

-- Circle payout cashed out to M-Pesa with auto-simulate (an officer can ask for it directly).
INSERT INTO public.payouts (id, jamiya_id, member_id, cycle_number, amount, currency, status, scheduled_date)
VALUES ('e0000000-0000-0000-0000-000000000002', 'b0000000-0000-0000-0000-000000000001',
        'c0000000-0000-0000-0000-000000000001', 99, 300, 'KES', 'scheduled', CURRENT_DATE);
SELECT is(
  pg_temp.rpc('a0000000-0000-0000-0000-000000000002',
    $$SELECT public.settle_payout_to_mpesa('e0000000-0000-0000-0000-000000000002', NULL, true)$$)
    #>> '{process,ok}',
  'false', 'a simulated payout cashout does not go through');
SELECT is(pg_temp.wallet(), 800::numeric, 'the payout stays in the member''s wallet (500 + 300)');
SELECT is(
  (SELECT status::text FROM public.withdrawal_requests
   WHERE metadata->>'payout_id' = 'e0000000-0000-0000-0000-000000000002'),
  'failed', 'and the cashout is marked failed, not paid');

-- ---------------------------------------------------------------------------
-- History is left alone
-- ---------------------------------------------------------------------------
SELECT pg_temp.set_simulation(true);
SELECT private.ledger_credit('a0000000-0000-0000-0000-000000000001', 'KES', 10,
  'wallet_top_up', NULL, 'top_up', 'old-sim', '{"source":"simulated"}');
SELECT pg_temp.set_simulation(false);
SELECT lives_ok(
  $$ UPDATE public.transactions SET metadata = metadata || '{"note":"reviewed"}'
     WHERE idempotency_key = 'old-sim' $$,
  'an old simulated transaction can still be annotated');

-- ---------------------------------------------------------------------------
-- Switched on (local development)
-- ---------------------------------------------------------------------------
SELECT pg_temp.set_simulation(true);
SELECT is(private.simulated_payments_allowed(), true, 'the switch turns simulation on');
SELECT is(
  pg_temp.rpc('a0000000-0000-0000-0000-000000000001',
    $$SELECT public.create_payment_intent(250, 'KES', NULL, 'simulated')$$)->>'ok',
  'true', 'a simulated payment can be created');
SELECT is(
  pg_temp.service($q$SELECT public.complete_payment_intent(
    'f0000000-0000-0000-0000-000000000002', 'mpesa-sim:f0000000-0000-0000-0000-000000000002',
    NULL, '{"source":"mpesa_fallback_simulated"}')$q$)->>'ok',
  'true', 'the M-Pesa simulated fallback completes');
SELECT is(pg_temp.wallet(), 1010::numeric, 'and credits the wallet (800 + 10 + 200)');

SELECT pg_temp.set_simulation(false);
DELETE FROM public.platform_settings WHERE key = 'simulated_payments';
SELECT is(private.simulated_payments_allowed(), false, 'a missing setting means off');
SELECT throws_ok(
  $$ SELECT private.ledger_credit('a0000000-0000-0000-0000-000000000001', 'KES', 5,
       'wallet_top_up', NULL, 'top_up', NULL, '{"source":"simulated"}') $$,
  'P0001', 'SIMULATED_PAYMENTS_DISABLED',
  'and simulated money is refused');

SELECT * FROM finish();
ROLLBACK;
