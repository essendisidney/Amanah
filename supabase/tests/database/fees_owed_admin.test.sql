-- pgTAP: admin tools for owed circle fees (overview, collect now, waive).
-- Run with scripts/test-db.mjs (or `supabase test db`). Everything rolls back.
BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SET LOCAL search_path = public, extensions;

SELECT plan(37);

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------
-- Run an admin RPC as a signed-in user (role authenticated, like the web app).
CREATE FUNCTION pg_temp.as_user(p_sub UUID) RETURNS VOID LANGUAGE sql AS $$
  SELECT set_config('request.jwt.claims',
    json_build_object('role', 'authenticated', 'sub', p_sub)::text, true)
$$;

CREATE FUNCTION pg_temp.overview(p_sub UUID, p_status TEXT DEFAULT 'owed')
RETURNS JSONB LANGUAGE plpgsql AS $$
DECLARE r JSONB;
BEGIN
  PERFORM pg_temp.as_user(p_sub);
  SET LOCAL ROLE authenticated;
  r := public.admin_fees_owed_overview(p_status);
  RESET ROLE;
  RETURN r;
END;
$$;

CREATE FUNCTION pg_temp.collect(p_sub UUID, p_user UUID)
RETURNS JSONB LANGUAGE plpgsql AS $$
DECLARE r JSONB;
BEGIN
  PERFORM pg_temp.as_user(p_sub);
  SET LOCAL ROLE authenticated;
  r := public.admin_collect_fees_owed(p_user);
  RESET ROLE;
  RETURN r;
END;
$$;

CREATE FUNCTION pg_temp.waive(p_sub UUID, p_fee UUID, p_reason TEXT)
RETURNS JSONB LANGUAGE plpgsql AS $$
DECLARE r JSONB;
BEGIN
  PERFORM pg_temp.as_user(p_sub);
  SET LOCAL ROLE authenticated;
  r := public.admin_waive_fee_owed(p_fee, p_reason);
  RESET ROLE;
  RETURN r;
END;
$$;

CREATE FUNCTION pg_temp.complete(p_intent UUID)
RETURNS JSONB LANGUAGE plpgsql AS $$
DECLARE r JSONB;
BEGIN
  PERFORM set_config('request.jwt.claims', '{"role":"service_role"}', true);
  SET LOCAL ROLE service_role;
  r := public.complete_payment_intent(p_intent);
  RESET ROLE;
  RETURN r;
END;
$$;

CREATE FUNCTION pg_temp.credit(p_amount NUMERIC)
RETURNS VOID LANGUAGE sql AS $$
  SELECT private.ledger_credit('a0000000-0000-0000-0000-000000000001', 'KES', p_amount,
    'payout', NULL, 'test-credit:' || gen_random_uuid(), NULL, '{}'::jsonb)
$$;

CREATE FUNCTION pg_temp.wallet()
RETURNS NUMERIC LANGUAGE sql AS $$
  SELECT coalesce((SELECT balance FROM public.wallets
    WHERE user_id = 'a0000000-0000-0000-0000-000000000001' AND currency = 'KES'), 0)
$$;

CREATE FUNCTION pg_temp.fee_status(p_cycle INT)
RETURNS TEXT LANGUAGE sql AS $$
  SELECT f.status FROM public.fees_owed f
  JOIN public.contributions c ON c.id = f.contribution_id
  WHERE c.cycle_number = p_cycle
$$;

CREATE FUNCTION pg_temp.fee_id(p_cycle INT)
RETURNS UUID LANGUAGE sql AS $$
  SELECT f.id FROM public.fees_owed f
  JOIN public.contributions c ON c.id = f.contribution_id
  WHERE c.cycle_number = p_cycle
$$;

-- ---------------------------------------------------------------------------
-- Fixtures: a member who owes two 50 fees; a platform admin
-- ---------------------------------------------------------------------------
INSERT INTO auth.users (id, email, raw_user_meta_data) VALUES
  ('a0000000-0000-0000-0000-000000000001', 'payer@test.local', '{"full_name":"Amina Payer","phone":"+254700000001"}'),
  ('a0000000-0000-0000-0000-000000000002', 'circle@test.local', '{"full_name":"Circle Admin"}'),
  ('a0000000-0000-0000-0000-000000000009', 'ops@test.local', '{"full_name":"Ops Admin"}');
UPDATE public.profiles SET platform_role = 'platform_admin'
WHERE id = 'a0000000-0000-0000-0000-000000000009';

INSERT INTO public.jamiyas (id, name, slug, created_by, contribution_amount, max_members, transaction_fee_amount)
VALUES ('b0000000-0000-0000-0000-000000000001', 'Sisters Circle', 'fees-admin-circle',
        'a0000000-0000-0000-0000-000000000002', 1000, 10, 50);
INSERT INTO public.members (id, jamiya_id, user_id, role, status)
VALUES ('c0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001',
        'a0000000-0000-0000-0000-000000000001', 'member', 'active');
INSERT INTO public.contributions (id, jamiya_id, member_id, cycle_number, amount, currency, due_date)
SELECT ('d0000000-0000-0000-0000-00000000000' || n)::uuid, 'b0000000-0000-0000-0000-000000000001',
       'c0000000-0000-0000-0000-000000000001', n, 1000, 'KES', CURRENT_DATE
FROM generate_series(1, 2) n;
INSERT INTO public.payment_intents (id, user_id, provider, amount, currency, metadata)
SELECT ('e0000000-0000-0000-0000-00000000000' || n)::uuid, 'a0000000-0000-0000-0000-000000000001',
       'mpesa', 1000, 'KES',
       json_build_object('kind', 'contribution',
         'contribution_id', 'd0000000-0000-0000-0000-00000000000' || n)::jsonb
FROM generate_series(1, 2) n;

-- Exact M-Pesa payments with an empty wallet: both fees owed.
SELECT pg_temp.complete('e0000000-0000-0000-0000-000000000001');
SELECT pg_temp.complete('e0000000-0000-0000-0000-000000000002');
SELECT is((SELECT count(*) FROM public.fees_owed WHERE status = 'owed'), 2::bigint, 'setup: two fees owed');

-- ---------------------------------------------------------------------------
-- Only platform admins
-- ---------------------------------------------------------------------------
SELECT is(pg_temp.overview('a0000000-0000-0000-0000-000000000001')->>'error', 'FORBIDDEN',
  'a member cannot see the overview');
SELECT is(pg_temp.overview('a0000000-0000-0000-0000-000000000002')->>'error', 'FORBIDDEN',
  'a circle admin cannot see the overview');
SELECT is(pg_temp.collect('a0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001')->>'error',
  'FORBIDDEN', 'a member cannot trigger collection');
SELECT is(pg_temp.waive('a0000000-0000-0000-0000-000000000001', pg_temp.fee_id(1), 'please')->>'error',
  'FORBIDDEN', 'a member cannot waive their own fee');
SELECT is(pg_temp.fee_status(1), 'owed', 'refused waive changes nothing');
SELECT throws_ok(
  $$ SET LOCAL ROLE anon; SELECT public.admin_fees_owed_overview('owed'); $$,
  '42501', NULL, 'anon cannot execute the overview'
);
RESET ROLE;

-- ---------------------------------------------------------------------------
-- Overview
-- ---------------------------------------------------------------------------
CREATE TEMP TABLE o1 AS SELECT pg_temp.overview('a0000000-0000-0000-0000-000000000009') AS r;
SELECT is((SELECT r->>'ok' FROM o1), 'true', 'admin: overview ok');
SELECT is((SELECT (r->'summary'->>'owed_count')::int FROM o1), 2, 'summary: 2 owed');
SELECT is((SELECT (r->'summary'->>'owed_total')::numeric FROM o1), 100.00, 'summary: 100 owed');
SELECT is((SELECT (r->'summary'->>'owed_members')::int FROM o1), 1, 'summary: 1 member owes');
SELECT isnt((SELECT r->'summary'->>'oldest_owed_at' FROM o1), NULL, 'summary: oldest owed date');
SELECT is((SELECT jsonb_array_length(r->'rows') FROM o1), 2, 'two rows');
SELECT results_eq(
  $$ SELECT x->>'full_name', x->>'phone', x->>'jamiya_name', (x->>'cycle_number')::int, (x->>'amount')::numeric, x->>'status'
     FROM o1, jsonb_array_elements(r->'rows') x ORDER BY (x->>'cycle_number')::int $$,
  $$ VALUES ('Amina Payer', '+254700000001', 'Sisters Circle', 1, 50.00::numeric, 'owed'),
            ('Amina Payer', '+254700000001', 'Sisters Circle', 2, 50.00::numeric, 'owed') $$,
  'rows show member, phone, circle, cycle, amount'
);
SELECT is(pg_temp.overview('a0000000-0000-0000-0000-000000000009', 'nonsense')->>'error', 'INVALID_STATUS',
  'unknown status filter rejected');

-- ---------------------------------------------------------------------------
-- Waive
-- ---------------------------------------------------------------------------
SELECT is(pg_temp.waive('a0000000-0000-0000-0000-000000000009', pg_temp.fee_id(1), '  ')->>'error',
  'REASON_REQUIRED', 'waiving needs a reason');
SELECT is(pg_temp.waive('a0000000-0000-0000-0000-000000000009', pg_temp.fee_id(1), 'Member was charged twice by M-Pesa')->>'ok',
  'true', 'admin waives the cycle 1 fee');
SELECT results_eq(
  $$ SELECT status, waived_by::text, waive_reason, waived_at IS NOT NULL
     FROM public.fees_owed WHERE id = pg_temp.fee_id(1) $$,
  $$ VALUES ('waived', 'a0000000-0000-0000-0000-000000000009', 'Member was charged twice by M-Pesa', true) $$,
  'waive records who, why and when'
);
SELECT is(
  (SELECT count(*) FROM public.audit_logs
   WHERE entity_type = 'fees_owed' AND entity_id = pg_temp.fee_id(1)
     AND actor_id = 'a0000000-0000-0000-0000-000000000009'
     AND metadata->>'event' = 'finance.fee_waived'),
  1::bigint,
  'waive is audit-logged'
);
SELECT is(
  (SELECT count(*) FROM public.notifications
   WHERE user_id = 'a0000000-0000-0000-0000-000000000001' AND title = 'Circle fee waived'),
  1::bigint,
  'member told the fee was waived'
);
SELECT is(pg_temp.waive('a0000000-0000-0000-0000-000000000009', pg_temp.fee_id(1), 'again')->>'idempotent',
  'true', 'waiving twice is a no-op');
SELECT is(
  (SELECT count(*) FROM public.notifications
   WHERE user_id = 'a0000000-0000-0000-0000-000000000001' AND title = 'Circle fee waived'),
  1::bigint,
  'no second waived notification'
);

-- ---------------------------------------------------------------------------
-- Collect now
-- ---------------------------------------------------------------------------
SELECT pg_temp.credit(30);
SELECT is(
  pg_temp.collect('a0000000-0000-0000-0000-000000000009', 'a0000000-0000-0000-0000-000000000001'),
  '{"ok": true, "collected": 0, "still_owed": 1}'::jsonb,
  'collect with 30 in the wallet: nothing collected, one still owed'
);
SELECT is(pg_temp.wallet(), 30.00, 'wallet untouched');

SELECT pg_temp.credit(100);
SELECT is(
  pg_temp.collect('a0000000-0000-0000-0000-000000000009', 'a0000000-0000-0000-0000-000000000001'),
  '{"ok": true, "collected": 1, "still_owed": 0}'::jsonb,
  'collect with 130: the cycle 2 fee is collected'
);
SELECT is(pg_temp.fee_status(2), 'collected', 'cycle 2 fee collected');
SELECT is(pg_temp.fee_status(1), 'waived', 'waived fee stays waived');
SELECT is(pg_temp.wallet(), 80.00, 'only the owed fee was taken (130 - 50)');
SELECT is(
  (SELECT count(*) FROM public.transactions WHERE type = 'fee'
   AND reference = 'contrib_fee:d0000000-0000-0000-0000-000000000001'),
  0::bigint,
  'the waived fee was never charged'
);
SELECT is(
  (SELECT count(*) FROM public.audit_logs
   WHERE entity_type = 'fees_owed' AND metadata->>'event' = 'finance.fees_owed_collect'),
  2::bigint,
  'each collect is audit-logged'
);
SELECT is(pg_temp.waive('a0000000-0000-0000-0000-000000000009', pg_temp.fee_id(2), 'too late')->>'error',
  'NOT_OWED', 'a collected fee cannot be waived');

-- ---------------------------------------------------------------------------
-- Overview after
-- ---------------------------------------------------------------------------
CREATE TEMP TABLE o2 AS SELECT pg_temp.overview('a0000000-0000-0000-0000-000000000009') AS r;
SELECT is((SELECT (r->'summary'->>'owed_count')::int FROM o2), 0, 'summary: nothing owed now');
SELECT is((SELECT (r->'summary'->>'collected_30d_total')::numeric FROM o2), 50.00, 'summary: 50 collected in 30 days');
SELECT is((SELECT (r->'summary'->>'waived_total')::numeric FROM o2), 50.00, 'summary: 50 waived');
SELECT is((SELECT jsonb_array_length(r->'rows') FROM o2), 0, 'owed list now empty');
SELECT is(
  (SELECT x->>'waive_reason' FROM jsonb_array_elements(
     pg_temp.overview('a0000000-0000-0000-0000-000000000009', 'waived')->'rows') x),
  'Member was charged twice by M-Pesa',
  'waived list shows the reason'
);
SELECT is(jsonb_array_length(pg_temp.overview('a0000000-0000-0000-0000-000000000009', 'all')->'rows'), 2,
  'all list shows both');

SELECT * FROM finish();
ROLLBACK;
