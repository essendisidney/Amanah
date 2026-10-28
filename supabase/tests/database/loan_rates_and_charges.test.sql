-- pgTAP: Jameiyah sets the Tawarruq rate; late penalties and the Qard facilitation fee are
-- charged only as each member accepted them in the circle's terms.
-- Run with scripts/test-db.mjs (or `supabase test db`). Everything rolls back.
BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SET LOCAL search_path = public, extensions;

SELECT plan(24);

CREATE FUNCTION pg_temp.rpc(p_uid UUID, p_sql TEXT)
RETURNS JSONB LANGUAGE plpgsql AS $$
DECLARE r JSONB;
BEGIN
  PERFORM set_config('request.jwt.claims',
    json_build_object('role', 'authenticated', 'sub', p_uid)::text, true);
  SET LOCAL ROLE authenticated;
  EXECUTE p_sql INTO r;
  RESET ROLE;
  PERFORM set_config('request.jwt.claims', '{}', true);
  RETURN r;
END;
$$;

CREATE FUNCTION pg_temp.balance(p_uid UUID)
RETURNS NUMERIC LANGUAGE sql AS $$
  SELECT coalesce((SELECT balance FROM public.wallets WHERE user_id = p_uid AND currency = 'KES'), 0)
$$;

-- Officer (…40), members M1 (…41, accepts terms) and M2 (…42, does not), admin (…43).
INSERT INTO auth.users (id, email, raw_user_meta_data)
SELECT ('a0000000-0000-0000-0000-0000000000' || n)::uuid, 'u' || n || '@test.local',
       json_build_object('full_name', 'User ' || n, 'phone', '+2547000000' || n)::jsonb
FROM generate_series(40, 43) n;
UPDATE public.profiles SET platform_role = 'platform_admin' WHERE id = 'a0000000-0000-0000-0000-000000000043';

INSERT INTO public.jamiyas (id, name, slug, created_by, contribution_amount, max_members,
                            late_contribution_penalty, late_loan_penalty_fixed, late_loan_penalty_pct)
VALUES ('b0000000-0000-0000-0000-000000000004', 'Rules Circle', 'rules-circle',
        'a0000000-0000-0000-0000-000000000040', 1000, 8, 30, 50, 2);
INSERT INTO public.members (id, jamiya_id, user_id, role, status, payout_position)
SELECT ('c0000000-0000-0000-0000-0000000000' || n)::uuid, 'b0000000-0000-0000-0000-000000000004',
       ('a0000000-0000-0000-0000-0000000000' || n)::uuid, 'member', 'active', n - 39
FROM generate_series(41, 42) n;
SELECT pg_temp.rpc('a0000000-0000-0000-0000-000000000041', format(
  'SELECT public.accept_circle_terms(%L, %s)', 'b0000000-0000-0000-0000-000000000004',
  (SELECT terms_version FROM public.jamiyas WHERE id = 'b0000000-0000-0000-0000-000000000004')));

-- ---------------------------------------------------------------------------
-- Tawarruq: Jameiyah sets the rate
-- ---------------------------------------------------------------------------
SELECT is(pg_temp.rpc('a0000000-0000-0000-0000-000000000041', 'SELECT public.get_tawarruq_rates()')->'rates',
  '{"3": 350, "6": 650, "12": 1200, "24": 2200}'::jsonb, 'each term starts at Jameiyah''s published rate');
SELECT is(pg_temp.rpc('a0000000-0000-0000-0000-000000000041',
  $$SELECT public.set_tawarruq_rates('{"12": 500}'::jsonb)$$)->>'error', 'FORBIDDEN', 'a member cannot set the rate');
SELECT is(pg_temp.rpc('a0000000-0000-0000-0000-000000000043',
  $$SELECT public.set_tawarruq_rates('{"7": 500}'::jsonb)$$)->>'error', 'INVALID', 'only offered terms can be priced');
SELECT is(pg_temp.rpc('a0000000-0000-0000-0000-000000000043',
  $$SELECT public.set_tawarruq_rates('{"12": 0}'::jsonb)$$)->>'error', 'INVALID', 'a rate must be above zero');
SELECT is(pg_temp.rpc('a0000000-0000-0000-0000-000000000043',
  $$SELECT public.set_tawarruq_rates('{"3": 500, "6": 800, "12": 1300, "24": 2000}'::jsonb)$$)->>'ok',
  'true', 'an admin sets a rate for each term');
SELECT is(pg_temp.rpc('a0000000-0000-0000-0000-000000000041', 'SELECT public.get_tawarruq_rates()')->'rates'->>'12',
  '1300', 'the form sees the new 12-month rate');
SELECT is(pg_temp.rpc('a0000000-0000-0000-0000-000000000041',
  $$SELECT public.submit_jameiyah_tawarruq(10000, 'School fees', NULL, 500, 12, true)$$)->>'error',
  'RATE_CHANGED', 'an applicant cannot pick a lower rate');
SELECT ok(pg_temp.rpc('a0000000-0000-0000-0000-000000000041',
  $$SELECT public.submit_jameiyah_tawarruq(10000, 'School fees', NULL, 1300, 12, true)$$)->>'error'
    NOT IN ('RATE_CHANGED', 'INVALID'), 'the published rate is accepted');
SELECT ok(pg_temp.rpc('a0000000-0000-0000-0000-000000000041',
  $$SELECT public.submit_jameiyah_tawarruq(10000, 'School fees', NULL, NULL, 12, true)$$)->>'error'
    NOT IN ('RATE_CHANGED', 'INVALID'), 'or no rate at all: Jameiyah''s applies');

-- ---------------------------------------------------------------------------
-- Late penalties: only what the member accepted
-- ---------------------------------------------------------------------------
INSERT INTO public.contributions (jamiya_id, member_id, cycle_number, amount, currency, due_date, status)
SELECT 'b0000000-0000-0000-0000-000000000004', ('c0000000-0000-0000-0000-0000000000' || n)::uuid,
       1, 1000, 'KES', CURRENT_DATE - 10, 'late'
FROM generate_series(41, 42) n;
SELECT is(public.assess_contribution_penalties('b0000000-0000-0000-0000-000000000004')->>'assessed', '1',
  'one late contribution penalty is assessed');
SELECT is((SELECT amount FROM public.penalties WHERE kind = 'late_contribution'
           AND user_id = 'a0000000-0000-0000-0000-000000000041'), 30.00::numeric,
  'to the member who accepted the 30 penalty');
SELECT is((SELECT count(*) FROM public.penalties WHERE user_id = 'a0000000-0000-0000-0000-000000000042'),
  0::bigint, 'not to the member who never accepted the terms');

INSERT INTO public.qard_loans (id, jamiya_id, borrower_id, amount, currency, purpose, status, due_date)
VALUES ('d0000000-0000-0000-0000-000000000041', 'b0000000-0000-0000-0000-000000000004',
        'a0000000-0000-0000-0000-000000000041', 1000, 'KES', 'Overdue loan', 'active', CURRENT_DATE - 1),
       ('d0000000-0000-0000-0000-000000000042', 'b0000000-0000-0000-0000-000000000004',
        'a0000000-0000-0000-0000-000000000042', 1000, 'KES', 'Overdue loan', 'active', CURRENT_DATE - 1);
SELECT is(public.assess_loan_penalties('b0000000-0000-0000-0000-000000000004')->>'assessed', '1',
  'one late loan penalty is assessed');
SELECT is((SELECT amount FROM public.penalties WHERE kind = 'late_loan'
           AND qard_loan_id = 'd0000000-0000-0000-0000-000000000041'), 70.00::numeric,
  'to the member who accepted it: 50 + 2% of 1,000');

-- ---------------------------------------------------------------------------
-- Qard facilitation fee: a flat amount, only once accepted
-- ---------------------------------------------------------------------------
UPDATE public.qard_loans SET status = 'repaid', amount_repaid = amount
WHERE jamiya_id = 'b0000000-0000-0000-0000-000000000004';
DELETE FROM public.penalties WHERE jamiya_id = 'b0000000-0000-0000-0000-000000000004';
UPDATE public.contributions SET status = 'paid', amount_paid = amount
WHERE jamiya_id = 'b0000000-0000-0000-0000-000000000004';

UPDATE public.jamiyas SET qard_fee_amount = 100 WHERE id = 'b0000000-0000-0000-0000-000000000004';
SELECT is((SELECT (private.circle_terms(j)->>'qard_fee_amount')::numeric FROM public.jamiyas j
           WHERE id = 'b0000000-0000-0000-0000-000000000004'), 100::numeric,
  'the loan fee is one of the circle''s terms');

INSERT INTO public.qard_loans (id, jamiya_id, borrower_id, amount, currency, purpose, status, agreement_accepted_at)
VALUES ('d0000000-0000-0000-0000-000000000043', 'b0000000-0000-0000-0000-000000000004',
        'a0000000-0000-0000-0000-000000000041', 1000, 'KES', 'Before accepting the fee', 'requested', NOW());
SELECT is((pg_temp.rpc('a0000000-0000-0000-0000-000000000040',
  $$SELECT public.decide_qard('d0000000-0000-0000-0000-000000000043', true)$$)->>'fee')::numeric, 0::numeric,
  'no fee while the member has not accepted it');
SELECT is(pg_temp.balance('a0000000-0000-0000-0000-000000000041'), 1000::numeric, 'they receive the full 1,000');

SELECT pg_temp.rpc('a0000000-0000-0000-0000-000000000041', format(
  'SELECT public.accept_circle_terms(%L, %s)', 'b0000000-0000-0000-0000-000000000004',
  (SELECT terms_version FROM public.jamiyas WHERE id = 'b0000000-0000-0000-0000-000000000004')));
UPDATE public.qard_loans SET status = 'repaid', amount_repaid = amount WHERE id = 'd0000000-0000-0000-0000-000000000043';
INSERT INTO public.qard_loans (id, jamiya_id, borrower_id, amount, currency, purpose, status, agreement_accepted_at)
VALUES ('d0000000-0000-0000-0000-000000000044', 'b0000000-0000-0000-0000-000000000004',
        'a0000000-0000-0000-0000-000000000041', 1000, 'KES', 'After accepting the fee', 'requested', NOW());
SELECT is((pg_temp.rpc('a0000000-0000-0000-0000-000000000040',
  $$SELECT public.decide_qard('d0000000-0000-0000-0000-000000000044', true)$$)->>'fee')::numeric, 100::numeric,
  'once accepted, the 100 fee is taken at approval');
SELECT is(pg_temp.balance('a0000000-0000-0000-0000-000000000041'), 1900::numeric, '1,000 + 1,000 - 100');
SELECT is((SELECT fee_amount FROM public.qard_loans WHERE id = 'd0000000-0000-0000-0000-000000000044'),
  100.00::numeric, 'the loan records its fee');
SELECT is((SELECT amount FROM public.qard_loans WHERE id = 'd0000000-0000-0000-0000-000000000044'),
  1000.00::numeric, 'and the amount to repay stays 1,000: no interest');

SELECT throws_ok(
  $$ SELECT pg_temp.rpc('a0000000-0000-0000-0000-000000000040',
       'UPDATE public.jamiyas SET qard_fee_amount = 200
        WHERE id = ''b0000000-0000-0000-0000-000000000004'' RETURNING to_jsonb(id)') $$,
  'P0001', 'TERMS_INCREASE_NEEDS_VOTE', 'raising the loan fee needs a members'' vote');
SELECT is(pg_temp.rpc('a0000000-0000-0000-0000-000000000040', format(
  'SELECT public.propose_circle_terms_change(%L, %L::jsonb, %L)',
  'b0000000-0000-0000-0000-000000000004', '{"qard_fee_amount": 200}', 'Bank charges went up'))->>'ok',
  'true', 'which officers can propose');
SELECT is(pg_temp.rpc('a0000000-0000-0000-0000-000000000040', format(
  'SELECT public.propose_circle_terms_change(%L, %L::jsonb, %L)',
  'b0000000-0000-0000-0000-000000000004', '{"qard_fee_amount": -5}', 'Negative'))->>'error',
  'INVALID_CHANGE', 'a negative fee is refused');

SELECT * FROM finish();
ROLLBACK;
