-- pgTAP: members opt in to a circle's fees before any fee is charged, and only up to what
-- they accepted. Run with scripts/test-db.mjs (or `supabase test db`). Everything rolls back.
BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SET LOCAL search_path = public, extensions;

SELECT plan(38);

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

CREATE FUNCTION pg_temp.wallet(p_uid UUID)
RETURNS NUMERIC LANGUAGE sql AS $$
  SELECT coalesce((SELECT balance FROM public.wallets WHERE user_id = p_uid AND currency = 'KES'), 0)
$$;

CREATE FUNCTION pg_temp.fee_paid(p_uid UUID, p_kind TEXT)
RETURNS NUMERIC LANGUAGE sql AS $$
  SELECT coalesce(sum(amount), 0) FROM public.transactions
  WHERE user_id = p_uid AND type = 'fee' AND metadata->>'kind' = p_kind AND status = 'completed'
$$;

CREATE FUNCTION pg_temp.version()
RETURNS INT LANGUAGE sql AS $$
  SELECT terms_version FROM public.jamiyas WHERE id = 'b0000000-0000-0000-0000-000000000001'
$$;

-- Pay one cycle's contribution (1,000) from the member's wallet.
CREATE FUNCTION pg_temp.pay(p_uid UUID, p_cycle INT)
RETURNS JSONB LANGUAGE sql AS $$
  SELECT pg_temp.rpc(p_uid, format(
    'SELECT public.pay_contribution(%L)',
    (SELECT c.id FROM public.contributions c JOIN public.members m ON m.id = c.member_id
     WHERE m.user_id = p_uid AND c.cycle_number = p_cycle)))
$$;

-- ---------------------------------------------------------------------------
-- Fixtures: a circle with a 500 join fee, a 50 per-contribution fee and a 10% early-slot fee
-- (100 on a 1,000 contribution); member A (…01, slot 2), member B (…03), officer (…02),
-- and C (…04), whom the officer adds directly. Everyone has 10,000 in their wallet.
-- ---------------------------------------------------------------------------
INSERT INTO auth.users (id, email, raw_user_meta_data) VALUES
  ('a0000000-0000-0000-0000-000000000001', 'a@test.local', '{"full_name":"Member A","phone":"+254700000001"}'),
  ('a0000000-0000-0000-0000-000000000002', 'officer@test.local', '{"full_name":"Officer"}'),
  ('a0000000-0000-0000-0000-000000000003', 'b@test.local', '{"full_name":"Member B","phone":"+254700000003"}'),
  ('a0000000-0000-0000-0000-000000000004', 'c@test.local', '{"full_name":"Member C","phone":"+254700000004"}'),
  ('a0000000-0000-0000-0000-000000000005', 'x@test.local', '{"full_name":"Outsider"}');

INSERT INTO public.jamiyas (id, name, slug, created_by, contribution_amount, max_members,
                            join_fee_amount, transaction_fee_amount, slot_pricing_enabled, early_slot_fee_pct)
VALUES ('b0000000-0000-0000-0000-000000000001', 'Consent Circle', 'consent-circle',
        'a0000000-0000-0000-0000-000000000002', 1000, 6, 500, 50, true, 10);

INSERT INTO public.members (id, jamiya_id, user_id, role, status, payout_position) VALUES
  ('c0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001',
   'a0000000-0000-0000-0000-000000000001', 'member', 'active', 2),
  ('c0000000-0000-0000-0000-000000000003', 'b0000000-0000-0000-0000-000000000001',
   'a0000000-0000-0000-0000-000000000003', 'member', 'active', 5);

INSERT INTO public.contributions (jamiya_id, member_id, cycle_number, amount, currency, due_date)
SELECT 'b0000000-0000-0000-0000-000000000001', m, n, 1000, 'KES', CURRENT_DATE
FROM unnest(ARRAY['c0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000003']::uuid[]) m,
     generate_series(1, 5) n;

SELECT private.ledger_credit(u, 'KES', 10000, 'payout', NULL, 'fixture:' || u, NULL, '{}'::jsonb)
FROM unnest(ARRAY['a0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000003',
                  'a0000000-0000-0000-0000-000000000004']::uuid[]) u;

-- ---------------------------------------------------------------------------
-- Before accepting: the terms are visible, and no fee is taken
-- ---------------------------------------------------------------------------
SELECT is(pg_temp.version(), 1, 'a new circle starts at terms version 1');
SELECT is(
  pg_temp.rpc('a0000000-0000-0000-0000-000000000001',
    $$SELECT public.get_circle_terms('b0000000-0000-0000-0000-000000000001')$$) #>> '{terms,join_fee_amount}',
  '500.00', 'a member sees the join fee');
SELECT is(
  pg_temp.rpc('a0000000-0000-0000-0000-000000000001',
    $$SELECT public.get_circle_terms('b0000000-0000-0000-0000-000000000001')$$) #>> '{terms,early_slot_fee_amount}',
  '100.00', 'and the early-slot fee as an amount');
SELECT is(
  pg_temp.rpc('a0000000-0000-0000-0000-000000000001',
    $$SELECT public.get_circle_terms('b0000000-0000-0000-0000-000000000001')$$)->>'needs_acceptance',
  'true', 'and is asked to accept them');
SELECT is(
  pg_temp.rpc('a0000000-0000-0000-0000-000000000005',
    $$SELECT public.get_circle_terms('b0000000-0000-0000-0000-000000000001')$$)->>'error',
  'FORBIDDEN', 'an outsider cannot read them');

SELECT is(
  pg_temp.rpc('a0000000-0000-0000-0000-000000000001',
    $$SELECT public.charge_join_fee('b0000000-0000-0000-0000-000000000001')$$)->>'reason',
  'TERMS_NOT_ACCEPTED', 'no join fee before accepting');
SELECT is(
  pg_temp.rpc('a0000000-0000-0000-0000-000000000001',
    $$SELECT public.charge_early_slot_fee('b0000000-0000-0000-0000-000000000001')$$)->>'reason',
  'TERMS_NOT_ACCEPTED', 'no early-slot fee before accepting');
SELECT is(pg_temp.pay('a0000000-0000-0000-0000-000000000001', 1)->>'status', 'paid',
  'member A pays cycle 1 before accepting');
SELECT is((SELECT count(*) FROM public.fees_owed WHERE user_id = 'a0000000-0000-0000-0000-000000000001'),
  0::bigint, 'and nothing is recorded as owed');
SELECT is(pg_temp.wallet('a0000000-0000-0000-0000-000000000001'), 9000::numeric,
  'only the contribution left the wallet');

-- ---------------------------------------------------------------------------
-- Accepting
-- ---------------------------------------------------------------------------
SELECT is(
  pg_temp.rpc('a0000000-0000-0000-0000-000000000001',
    $$SELECT public.accept_circle_terms('b0000000-0000-0000-0000-000000000001', 7)$$)->>'error',
  'TERMS_CHANGED', 'accepting a version you were not shown is refused');
SELECT is(
  pg_temp.rpc('a0000000-0000-0000-0000-000000000005',
    $$SELECT public.accept_circle_terms('b0000000-0000-0000-0000-000000000001', 1)$$)->>'error',
  'NOT_A_MEMBER', 'an outsider cannot accept');
SELECT is(
  pg_temp.rpc('a0000000-0000-0000-0000-000000000001',
    $$SELECT public.accept_circle_terms('b0000000-0000-0000-0000-000000000001', 1)$$)->>'ok',
  'true', 'member A accepts version 1');
SELECT is(
  (SELECT terms->>'join_fee_amount' FROM public.member_consents
   WHERE user_id = 'a0000000-0000-0000-0000-000000000001'),
  '500.00', 'the consent keeps a copy of the terms accepted');
SELECT is(
  (SELECT count(*) FROM public.audit_logs WHERE metadata->>'event' = 'circle.terms_accepted'),
  1::bigint, 'and is audit-logged');
SELECT is(
  pg_temp.rpc('a0000000-0000-0000-0000-000000000001',
    $$SELECT public.accept_circle_terms('b0000000-0000-0000-0000-000000000001', 1)$$)->>'ok',
  'true', 'accepting twice is harmless');
SELECT is((SELECT count(*) FROM public.member_consents), 1::bigint, 'and keeps one record');

SELECT is(
  (pg_temp.rpc('a0000000-0000-0000-0000-000000000001',
    $$SELECT public.charge_join_fee('b0000000-0000-0000-0000-000000000001')$$)->>'fee')::numeric,
  500::numeric, 'after accepting, the join fee is charged');
SELECT is(
  (pg_temp.rpc('a0000000-0000-0000-0000-000000000001',
    $$SELECT public.charge_early_slot_fee('b0000000-0000-0000-0000-000000000001')$$)->>'fee')::numeric,
  100::numeric, 'and the early-slot fee for slot 2');
SELECT is(pg_temp.pay('a0000000-0000-0000-0000-000000000001', 2)->>'status', 'paid',
  'A pays cycle 2');
SELECT is(pg_temp.fee_paid('a0000000-0000-0000-0000-000000000001', 'contribution_fee'), 50::numeric,
  'and is charged the per-contribution fee of 50');
SELECT pg_temp.pay('a0000000-0000-0000-0000-000000000003', 1);
SELECT is(pg_temp.fee_paid('a0000000-0000-0000-0000-000000000003', 'contribution_fee'), 0::numeric,
  'member B, who has not accepted, still pays no fee');

-- ---------------------------------------------------------------------------
-- Officers change the terms
-- ---------------------------------------------------------------------------
UPDATE public.jamiyas SET name = 'Consent Circle (renamed)' WHERE id = 'b0000000-0000-0000-0000-000000000001';
SELECT is(pg_temp.version(), 1, 'a change that is not about money keeps the version');

UPDATE public.jamiyas SET transaction_fee_amount = 80 WHERE id = 'b0000000-0000-0000-0000-000000000001';
SELECT is(pg_temp.version(), 2, 'raising a fee makes a new version');
SELECT is(
  pg_temp.rpc('a0000000-0000-0000-0000-000000000001',
    $$SELECT public.get_circle_terms('b0000000-0000-0000-0000-000000000001')$$)->>'needs_acceptance',
  'true', 'members are asked to accept again');
SELECT is(pg_temp.pay('a0000000-0000-0000-0000-000000000001', 3)->>'status', 'paid',
  'A pays cycle 3 without re-accepting');
SELECT is(pg_temp.fee_paid('a0000000-0000-0000-0000-000000000001', 'contribution_fee'), 100::numeric,
  'and is still charged the 50 they accepted, not the new 80');

UPDATE public.jamiyas SET transaction_fee_amount = 30 WHERE id = 'b0000000-0000-0000-0000-000000000001';
SELECT is(pg_temp.version(), 3, 'lowering a fee also makes a new version');
SELECT is(pg_temp.pay('a0000000-0000-0000-0000-000000000001', 4)->>'status', 'paid',
  'A pays cycle 4');
SELECT is(pg_temp.fee_paid('a0000000-0000-0000-0000-000000000001', 'contribution_fee'), 130::numeric,
  'and the lower fee of 30 applies at once');

-- ---------------------------------------------------------------------------
-- An officer adding a member directly no longer charges them
-- ---------------------------------------------------------------------------
SELECT is(
  pg_temp.rpc('a0000000-0000-0000-0000-000000000002',
    $$SELECT public.admin_add_circle_member('b0000000-0000-0000-0000-000000000001',
                                            'a0000000-0000-0000-0000-000000000004')$$)->>'ok',
  'true', 'the officer adds member C');
SELECT is(pg_temp.fee_paid('a0000000-0000-0000-0000-000000000004', 'join_fee'), 0::numeric,
  'and C pays no join fee they never saw');
SELECT ok(
  (SELECT body LIKE '%review and accept its terms%' FROM public.notifications
   WHERE user_id = 'a0000000-0000-0000-0000-000000000004' AND title = 'Added to circle'),
  'C is told to review and accept the terms');
SELECT is(
  pg_temp.rpc('a0000000-0000-0000-0000-000000000004',
    format('SELECT public.accept_circle_terms(%L, %s)', 'b0000000-0000-0000-0000-000000000001', pg_temp.version()))->>'ok',
  'true', 'C accepts the current terms');
SELECT is(
  (pg_temp.rpc('a0000000-0000-0000-0000-000000000004',
    $$SELECT public.charge_join_fee('b0000000-0000-0000-0000-000000000001')$$)->>'fee')::numeric,
  500::numeric, 'and only then pays the join fee');

-- ---------------------------------------------------------------------------
-- Invitation preview, and who can see consents
-- ---------------------------------------------------------------------------
INSERT INTO public.invitations (jamiya_id, invited_by, phone, token_hash, expires_at)
VALUES ('b0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000002',
        '+254700000005', 'hash-consent-test', NOW() + INTERVAL '7 days');
SELECT is(
  pg_temp.rpc('a0000000-0000-0000-0000-000000000005',
    $$SELECT public.preview_invitation_terms('hash-consent-test')$$) #>> '{terms,transaction_fee_amount}',
  '30.00', 'an invitee sees the fees before joining');

SELECT is(
  pg_temp.rpc('a0000000-0000-0000-0000-000000000003',
    $$SELECT to_jsonb(count(*)) FROM public.member_consents$$)::text,
  '0', 'a member cannot see other members'' consents');
SELECT throws_ok(
  $$ SELECT pg_temp.rpc('a0000000-0000-0000-0000-000000000003',
       'INSERT INTO public.member_consents (user_id, jamiya_id, version, terms)
        VALUES (''a0000000-0000-0000-0000-000000000003'', ''b0000000-0000-0000-0000-000000000001'', 3, ''{}'')
        RETURNING to_jsonb(id)') $$,
  '42501', NULL, 'and cannot write a consent directly');

SELECT * FROM finish();
ROLLBACK;
