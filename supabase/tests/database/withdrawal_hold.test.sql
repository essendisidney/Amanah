-- pgTAP: a withdrawal on hold cannot be paid, failed or cancelled until the hold is released.
-- Run with scripts/test-db.mjs (or `supabase test db`). Everything rolls back.
BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SET LOCAL search_path = public, extensions;

SELECT plan(22);

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

CREATE FUNCTION pg_temp.status()
RETURNS TEXT LANGUAGE sql AS $$
  SELECT status::text FROM public.withdrawal_requests WHERE id = 'e0000000-0000-0000-0000-000000000001'
$$;

CREATE FUNCTION pg_temp.wallet()
RETURNS NUMERIC LANGUAGE sql AS $$
  SELECT balance FROM public.wallets WHERE user_id = 'a0000000-0000-0000-0000-000000000001'
$$;

-- ---------------------------------------------------------------------------
-- Fixtures: a member (…01) with 6,000 and a pending 6,000 withdrawal; a platform admin (…02)
-- ---------------------------------------------------------------------------
INSERT INTO auth.users (id, email, raw_user_meta_data) VALUES
  ('a0000000-0000-0000-0000-000000000001', 'member@test.local', '{"full_name":"Member","phone":"+254700000001"}'),
  ('a0000000-0000-0000-0000-000000000002', 'admin@test.local', '{"full_name":"Platform Admin"}');
UPDATE public.profiles SET platform_role = 'platform_admin'
WHERE id = 'a0000000-0000-0000-0000-000000000002';

SELECT private.ledger_credit('a0000000-0000-0000-0000-000000000001', 'KES', 6000,
  'payout', NULL, 'fixture', NULL, '{}'::jsonb);

INSERT INTO public.withdrawal_requests (id, user_id, amount, currency, status, destination_type, destination_phone)
VALUES ('e0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001',
        6000, 'KES', 'pending', 'mpesa', '+254700000001');

-- ---------------------------------------------------------------------------
-- Placing a hold
-- ---------------------------------------------------------------------------
SELECT is(
  pg_temp.rpc('a0000000-0000-0000-0000-000000000001',
    $$SELECT public.admin_hold_withdrawal('e0000000-0000-0000-0000-000000000001', 'Funded by a simulated top-up')$$)->>'error',
  'FORBIDDEN', 'a member cannot place a hold');
SELECT throws_ok(
  $$ SET LOCAL ROLE anon; SELECT public.admin_hold_withdrawal('e0000000-0000-0000-0000-000000000001', 'x x x'); $$,
  '42501', NULL, 'anonymous users cannot call it');
RESET ROLE;
SELECT is(
  pg_temp.rpc('a0000000-0000-0000-0000-000000000002',
    $$SELECT public.admin_hold_withdrawal('e0000000-0000-0000-0000-000000000001', ' ')$$)->>'error',
  'REASON_REQUIRED', 'a hold needs a reason');
SELECT is(
  pg_temp.rpc('a0000000-0000-0000-0000-000000000002',
    $$SELECT public.admin_hold_withdrawal('e0000000-0000-0000-0000-000000000001', 'Funded by a simulated top-up')$$)->>'ok',
  'true', 'a platform admin places the hold');
SELECT is(
  (SELECT metadata #>> '{hold,reason}' FROM public.withdrawal_requests
   WHERE id = 'e0000000-0000-0000-0000-000000000001'),
  'Funded by a simulated top-up', 'the hold records its reason');
SELECT is(
  (SELECT count(*) FROM public.audit_logs WHERE metadata->>'event' = 'finance.withdrawal_hold'),
  1::bigint, 'and is audit-logged');
SELECT is(
  pg_temp.rpc('a0000000-0000-0000-0000-000000000002',
    $$SELECT public.admin_hold_withdrawal('e0000000-0000-0000-0000-000000000001', 'again')$$)->>'idempotent',
  'true', 'holding twice is a no-op');

-- ---------------------------------------------------------------------------
-- Nothing moves while held
-- ---------------------------------------------------------------------------
SELECT throws_ok(
  $$ SELECT pg_temp.service($q$SELECT public.process_withdrawal('e0000000-0000-0000-0000-000000000001', true, 'UBX123')$q$) $$,
  'P0001', 'WITHDRAWAL_ON_HOLD', 'it cannot be paid');
SELECT is(pg_temp.wallet(), 6000::numeric, 'and the wallet is not debited');
SELECT is(pg_temp.status(), 'pending', 'it stays pending');

SELECT throws_ok(
  $$ SELECT pg_temp.service($q$SELECT public.process_withdrawal('e0000000-0000-0000-0000-000000000001', false)$q$) $$,
  'P0001', 'WITHDRAWAL_ON_HOLD', 'it cannot be cancelled (that would free the money for a new request)');
SELECT throws_ok(
  $$ UPDATE public.withdrawal_requests SET status = 'processing', provider_reference = 'conv-1'
     WHERE id = 'e0000000-0000-0000-0000-000000000001' $$,
  'P0001', 'WITHDRAWAL_ON_HOLD', 'it cannot be marked as sent to a provider');
SELECT throws_ok(
  $$ UPDATE public.withdrawal_requests SET status = 'failed'
     WHERE id = 'e0000000-0000-0000-0000-000000000001' $$,
  'P0001', 'WITHDRAWAL_ON_HOLD', 'it cannot be failed');
SELECT lives_ok(
  $$ UPDATE public.withdrawal_requests SET metadata = metadata || '{"dual_approved": true}'
     WHERE id = 'e0000000-0000-0000-0000-000000000001' $$,
  'an approval can still be recorded in metadata');
SELECT ok(
  (SELECT metadata ? 'hold' FROM public.withdrawal_requests WHERE id = 'e0000000-0000-0000-0000-000000000001'),
  'and the hold survives it');

SELECT is(
  (SELECT available FROM (SELECT private.wallet_spendable('a0000000-0000-0000-0000-000000000001', 'KES') AS available) s),
  0::numeric, 'the held amount stays reserved, so it cannot be requested again');

-- ---------------------------------------------------------------------------
-- Releasing
-- ---------------------------------------------------------------------------
SELECT is(
  pg_temp.rpc('a0000000-0000-0000-0000-000000000001',
    $$SELECT public.admin_release_withdrawal('e0000000-0000-0000-0000-000000000001', 'Checked, fine')$$)->>'error',
  'FORBIDDEN', 'a member cannot release a hold');
SELECT is(
  pg_temp.service($$SELECT public.admin_release_withdrawal('e0000000-0000-0000-0000-000000000001', 'Checked with Paystack')$$)->>'ok',
  'true', 'the service role releases it');
SELECT is(
  (SELECT metadata #>> '{hold_released,hold,reason}' FROM public.withdrawal_requests
   WHERE id = 'e0000000-0000-0000-0000-000000000001'),
  'Funded by a simulated top-up', 'the released hold is kept for the record');
SELECT is(
  pg_temp.service($q$SELECT public.process_withdrawal('e0000000-0000-0000-0000-000000000001', true, 'UBX123')$q$)->>'ok',
  'true', 'once released it can be processed');
SELECT is(pg_temp.wallet(), 0::numeric, 'and the wallet is debited');

SELECT is(
  pg_temp.service($$SELECT public.admin_hold_withdrawal('e0000000-0000-0000-0000-000000000001', 'Too late')$$)->>'error',
  'NOT_HOLDABLE', 'a completed withdrawal cannot be put on hold');

SELECT * FROM finish();
ROLLBACK;
