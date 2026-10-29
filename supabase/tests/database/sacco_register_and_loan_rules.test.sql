-- pgTAP: the member register, a circle's loan rules (N × deposits, guarantors, guarantor cover,
-- two officers) and loans by how late they are. Run with scripts/test-db.mjs. Rolls back.
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

-- Officer …61 (creates the circle), members A …62, B …63, C …64.
INSERT INTO auth.users (id, email, raw_user_meta_data)
SELECT ('a0000000-0000-0000-0000-0000000000' || n)::uuid, 'k' || n || '@test.local',
       json_build_object('full_name', CASE n WHEN 61 THEN 'Sacco Officer' WHEN 62 THEN 'Sacco Amina'
                                             WHEN 63 THEN 'Sacco Bakari' ELSE 'Sacco Chebet' END,
                         'phone', '+2547300000' || n)::jsonb
FROM generate_series(61, 64) n;

INSERT INTO public.jamiyas (id, name, slug, created_by, contribution_amount, max_members)
VALUES ('b0000000-0000-0000-0000-000000000061', 'Test Sacco', 'test-sacco',
        'a0000000-0000-0000-0000-000000000061', 1000, 100);
INSERT INTO public.members (id, jamiya_id, user_id, role, status, payout_position, member_code)
VALUES ('c0000000-0000-0000-0000-000000000062', 'b0000000-0000-0000-0000-000000000061', 'a0000000-0000-0000-0000-000000000062', 'member', 'active', 2, 'S002'),
       ('c0000000-0000-0000-0000-000000000063', 'b0000000-0000-0000-0000-000000000061', 'a0000000-0000-0000-0000-000000000063', 'member', 'active', 3, 'S003'),
       ('c0000000-0000-0000-0000-000000000064', 'b0000000-0000-0000-0000-000000000061', 'a0000000-0000-0000-0000-000000000064', 'member', 'active', 4, 'S004');

-- Amina: 10,000 deposits in the cashbook + 5,000 shares. Bakari: 2,000 paid by bank statement.
INSERT INTO public.book_entries (jamiya_id, member_id, entry_type, amount, currency, effective_date, entered_by)
VALUES ('b0000000-0000-0000-0000-000000000061', 'c0000000-0000-0000-0000-000000000062', 'contribution', 10000, 'KES', CURRENT_DATE - 60, 'a0000000-0000-0000-0000-000000000061');
INSERT INTO public.circle_share_lots (jamiya_id, member_id, shares, unit_price, amount, currency, purchased_on, recorded_by)
VALUES ('b0000000-0000-0000-0000-000000000061', 'c0000000-0000-0000-0000-000000000062', 50, 100, 5000, 'KES', CURRENT_DATE - 60, 'a0000000-0000-0000-0000-000000000061');
INSERT INTO public.contributions (id, jamiya_id, member_id, cycle_number, amount, currency, due_date, status)
VALUES ('d0000000-0000-0000-0000-000000000061', 'b0000000-0000-0000-0000-000000000061', 'c0000000-0000-0000-0000-000000000063', 1, 2000, 'KES', CURRENT_DATE - 30, 'late'),
       ('d0000000-0000-0000-0000-000000000062', 'b0000000-0000-0000-0000-000000000061', 'c0000000-0000-0000-0000-000000000064', 1, 1000, 'KES', CURRENT_DATE - 10, 'late');
SELECT pg_temp.rpc('a0000000-0000-0000-0000-000000000061',
  $$SELECT public.record_statement_payments('b0000000-0000-0000-0000-000000000061',
    '[{"reference":"SKS1","amount":2000,"member_id":"c0000000-0000-0000-0000-000000000063"}]')$$);

-- ---------------------------------------------------------------------------
-- Each member's money and the register
-- ---------------------------------------------------------------------------
SELECT is((private.member_money('b0000000-0000-0000-0000-000000000061', 'c0000000-0000-0000-0000-000000000062')->>'deposits')::numeric,
  10000::numeric, 'cashbook savings are deposits');
SELECT is((private.member_money('b0000000-0000-0000-0000-000000000061', 'c0000000-0000-0000-0000-000000000062')->>'shares')::numeric,
  5000::numeric, 'shares are counted apart from deposits');
SELECT is((private.member_money('b0000000-0000-0000-0000-000000000061', 'c0000000-0000-0000-0000-000000000063')->>'deposits')::numeric,
  2000::numeric, 'a payment matched from a bank statement is a deposit');

SELECT is(pg_temp.rpc('a0000000-0000-0000-0000-000000000062',
  $$SELECT public.circle_member_register('b0000000-0000-0000-0000-000000000061')$$)->>'error',
  'FORBIDDEN', 'members cannot see the register');
SELECT is((pg_temp.rpc('a0000000-0000-0000-0000-000000000061',
  $$SELECT public.circle_member_register('b0000000-0000-0000-0000-000000000061')$$)->>'total')::int,
  4, 'the officer sees every member');
SELECT is((pg_temp.rpc('a0000000-0000-0000-0000-000000000061',
  $$SELECT public.circle_member_register('b0000000-0000-0000-0000-000000000061')$$)->'totals'->>'deposits')::numeric,
  12000::numeric, 'with the circle''s total deposits');
SELECT is((pg_temp.rpc('a0000000-0000-0000-0000-000000000061',
  $$SELECT public.circle_member_register('b0000000-0000-0000-0000-000000000061')$$)->'totals'->>'arrears')::numeric,
  1000::numeric, 'and what is overdue');
SELECT is(pg_temp.rpc('a0000000-0000-0000-0000-000000000061',
  $$SELECT public.circle_member_register('b0000000-0000-0000-0000-000000000061', 'S003')$$)->'rows'->0->>'name',
  'Sacco Bakari', 'search by member number');
SELECT is(jsonb_array_length(pg_temp.rpc('a0000000-0000-0000-0000-000000000061',
  $$SELECT public.circle_member_register('b0000000-0000-0000-0000-000000000061', NULL, 2, 2)$$)->'rows'),
  2, 'and page through it');

-- ---------------------------------------------------------------------------
-- Loan rules
-- ---------------------------------------------------------------------------
SELECT is(pg_temp.rpc('a0000000-0000-0000-0000-000000000062',
  $$SELECT public.set_circle_loan_policy('b0000000-0000-0000-0000-000000000061', 3, 1, true, 2)$$)->>'error',
  'FORBIDDEN', 'a member cannot set loan rules');
SELECT is(pg_temp.rpc('a0000000-0000-0000-0000-000000000061',
  $$SELECT public.set_circle_loan_policy('b0000000-0000-0000-0000-000000000061', 30, 1, true, 2)$$)->>'error',
  'INVALID', 'the multiplier stays within 10');
SELECT is(pg_temp.rpc('a0000000-0000-0000-0000-000000000061',
  $$SELECT public.set_circle_loan_policy('b0000000-0000-0000-0000-000000000061', 3, 1, true, 2)$$)->>'ok',
  'true', 'the officer sets 3 × deposits, one guarantor, guarantor cover and two approvals');

SELECT is(private.member_borrowing_limit('b0000000-0000-0000-0000-000000000061', 'c0000000-0000-0000-0000-000000000062'),
  30000::numeric, 'Amina may borrow 3 × her 10,000 deposits');
SELECT is((pg_temp.rpc('a0000000-0000-0000-0000-000000000062',
  $$SELECT public.qard_cap_for_jamiya('b0000000-0000-0000-0000-000000000061')$$)->>'personal_room')::numeric,
  30000::numeric, 'and the loan form uses that limit');

-- Bakari asks for 5,000 with Amina as guarantor; Chebet asks for 1,000 with nobody.
INSERT INTO public.qard_loans (id, jamiya_id, borrower_id, amount, currency, purpose, installment_count, agreement_accepted_at)
VALUES ('e0000000-0000-0000-0000-000000000063', 'b0000000-0000-0000-0000-000000000061', 'a0000000-0000-0000-0000-000000000063', 5000, 'KES', 'Stock for the shop', 3, NOW()),
       ('e0000000-0000-0000-0000-000000000064', 'b0000000-0000-0000-0000-000000000061', 'a0000000-0000-0000-0000-000000000064', 1000, 'KES', 'School fees', 2, NOW());
INSERT INTO public.qard_guarantees (loan_id, jamiya_id, borrower_id, guarantor_user_id, status)
VALUES ('e0000000-0000-0000-0000-000000000063', 'b0000000-0000-0000-0000-000000000061', 'a0000000-0000-0000-0000-000000000063', 'a0000000-0000-0000-0000-000000000062', 'accepted');

SELECT is(pg_temp.rpc('a0000000-0000-0000-0000-000000000061',
  $$SELECT public.decide_qard('e0000000-0000-0000-0000-000000000064', true)$$)->>'error',
  'GUARANTORS_REQUIRED', 'a loan without the required guarantor is refused');

SELECT ok(pg_temp.rpc('a0000000-0000-0000-0000-000000000061',
  $$SELECT public.propose_decide_qard('e0000000-0000-0000-0000-000000000063', true)$$)->>'ok' = 'true'
  AND (SELECT status FROM public.qard_loans WHERE id = 'e0000000-0000-0000-0000-000000000063') = 'requested',
  'with two approvals required, one officer''s approval is not enough');
SELECT is((SELECT count(*) FROM public.dual_approval_requests
           WHERE kind = 'qard_decide' AND entity_id = 'e0000000-0000-0000-0000-000000000063' AND status = 'pending'),
  1::bigint, 'it waits for a second officer');

SELECT is(pg_temp.rpc('a0000000-0000-0000-0000-000000000061',
  $$SELECT public.decide_qard('e0000000-0000-0000-0000-000000000063', true)$$)->>'status',
  'active', 'Amina''s free deposits cover the 3,000 Bakari''s own deposits do not');
SELECT is(private.member_guarantee_exposure('b0000000-0000-0000-0000-000000000061', 'a0000000-0000-0000-0000-000000000062'),
  3000::numeric, 'Amina now has 3,000 pledged');
SELECT is(private.member_free_deposits('b0000000-0000-0000-0000-000000000061', 'c0000000-0000-0000-0000-000000000062'),
  7000::numeric, 'leaving her 7,000 free to guarantee others');

-- Chebet asks again with Bakari, whose deposits are all behind his own loan.
UPDATE public.qard_loans SET purpose = 'School fees again' WHERE id = 'e0000000-0000-0000-0000-000000000064';
INSERT INTO public.qard_guarantees (loan_id, jamiya_id, borrower_id, guarantor_user_id, status)
VALUES ('e0000000-0000-0000-0000-000000000064', 'b0000000-0000-0000-0000-000000000061', 'a0000000-0000-0000-0000-000000000064', 'a0000000-0000-0000-0000-000000000063', 'accepted');
SELECT is(pg_temp.rpc('a0000000-0000-0000-0000-000000000061',
  $$SELECT public.decide_qard('e0000000-0000-0000-0000-000000000064', true)$$)->>'error',
  'GUARANTEE_COVER_SHORT', 'a guarantor with no free deposits cannot cover a loan');

-- ---------------------------------------------------------------------------
-- Loans by how late they are
-- ---------------------------------------------------------------------------
UPDATE public.qard_loans SET due_date = CURRENT_DATE - 45 WHERE id = 'e0000000-0000-0000-0000-000000000063';
SELECT is(pg_temp.rpc('a0000000-0000-0000-0000-000000000061',
  $$SELECT public.circle_loan_aging('b0000000-0000-0000-0000-000000000061')$$)->'loans'->0->>'bucket',
  '31_60', 'a loan 45 days past due is in the 31–60 day group');
SELECT is((pg_temp.rpc('a0000000-0000-0000-0000-000000000061',
  $$SELECT public.circle_loan_aging('b0000000-0000-0000-0000-000000000061')$$)->>'at_risk')::numeric,
  5000::numeric, 'and counts as at risk');
SELECT is(pg_temp.rpc('a0000000-0000-0000-0000-000000000062',
  $$SELECT public.circle_loan_aging('b0000000-0000-0000-0000-000000000061')$$)->>'error',
  'FORBIDDEN', 'only officers see the loan list');

SELECT * FROM finish();
ROLLBACK;
