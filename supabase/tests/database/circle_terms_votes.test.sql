-- pgTAP: raising a circle's fees or penalties needs a members' vote; payout deductions and
-- savings-pocket deposits need the member's own consent.
-- Run with scripts/test-db.mjs (or `supabase test db`). Everything rolls back.
BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SET LOCAL search_path = public, extensions;

SELECT plan(45);

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
  PERFORM set_config('request.jwt.claims', '{}', true);
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
  PERFORM set_config('request.jwt.claims', '{}', true);
  RETURN r;
END;
$$;

-- Officer (…10), members M1–M4 (…11–…14). Every timestamp is the same inside one test
-- transaction, so the proposals made are recorded in order here.
CREATE TEMP TABLE proposals_made (n SERIAL PRIMARY KEY, id UUID NOT NULL);

CREATE FUNCTION pg_temp.propose(p_changes JSONB, p_reason TEXT DEFAULT 'Costs went up this year')
RETURNS JSONB LANGUAGE plpgsql AS $$
DECLARE r JSONB;
BEGIN
  r := pg_temp.rpc('a0000000-0000-0000-0000-000000000010', format(
    'SELECT public.propose_circle_terms_change(%L, %L::jsonb, %L)',
    'b0000000-0000-0000-0000-000000000001', p_changes, p_reason));
  IF (r->>'ok')::boolean THEN
    INSERT INTO proposals_made (id) VALUES ((r->>'proposal_id')::uuid);
  END IF;
  RETURN r;
END;
$$;

CREATE FUNCTION pg_temp.vote(p_uid UUID, p_proposal UUID, p_yes BOOLEAN)
RETURNS JSONB LANGUAGE sql AS $$
  SELECT pg_temp.rpc(p_uid, format('SELECT public.cast_circle_terms_vote(%L, %L::boolean)', p_proposal, p_yes))
$$;

-- The most recent proposal made in this test.
CREATE FUNCTION pg_temp.live()
RETURNS public.circle_terms_proposals LANGUAGE sql AS $$
  SELECT p.* FROM public.circle_terms_proposals p
  WHERE p.id = (SELECT id FROM proposals_made ORDER BY n DESC LIMIT 1)
$$;

CREATE FUNCTION pg_temp.circle()
RETURNS public.jamiyas LANGUAGE sql AS $$
  SELECT * FROM public.jamiyas WHERE id = 'b0000000-0000-0000-0000-000000000001'
$$;

-- ---------------------------------------------------------------------------
-- Fixtures: a circle with a 50 contribution fee; officer + 4 members who all accepted v1
-- ---------------------------------------------------------------------------
INSERT INTO auth.users (id, email, raw_user_meta_data)
SELECT ('a0000000-0000-0000-0000-0000000000' || n)::uuid, 'u' || n || '@test.local',
       json_build_object('full_name', 'User ' || n, 'phone', '+2547000000' || n)::jsonb
FROM generate_series(10, 15) n;

INSERT INTO public.jamiyas (id, name, slug, created_by, contribution_amount, max_members, transaction_fee_amount)
VALUES ('b0000000-0000-0000-0000-000000000001', 'Vote Circle', 'vote-circle',
        'a0000000-0000-0000-0000-000000000010', 1000, 8, 50);

INSERT INTO public.members (id, jamiya_id, user_id, role, status, payout_position)
SELECT ('c0000000-0000-0000-0000-0000000000' || n)::uuid, 'b0000000-0000-0000-0000-000000000001',
       ('a0000000-0000-0000-0000-0000000000' || n)::uuid, 'member', 'active', n - 9
FROM generate_series(11, 14) n;

INSERT INTO public.member_consents (user_id, jamiya_id, kind, version, terms)
SELECT m.user_id, j.id, 'circle_terms', j.terms_version, private.circle_terms(j)
FROM public.members m JOIN public.jamiyas j ON j.id = m.jamiya_id
WHERE m.status = 'active';

-- ---------------------------------------------------------------------------
-- Officers cannot raise fees on their own; they can lower them
-- ---------------------------------------------------------------------------
SELECT throws_ok(
  $$ SELECT pg_temp.rpc('a0000000-0000-0000-0000-000000000010',
       'UPDATE public.jamiyas SET transaction_fee_amount = 80
        WHERE id = ''b0000000-0000-0000-0000-000000000001'' RETURNING to_jsonb(id)') $$,
  'P0001', 'TERMS_INCREASE_NEEDS_VOTE', 'an officer cannot raise a fee directly');
SELECT throws_ok(
  $$ SELECT pg_temp.rpc('a0000000-0000-0000-0000-000000000010',
       'SELECT public.set_circle_auto_fine(''b0000000-0000-0000-0000-000000000001'', true, 3)') $$,
  'P0001', 'TERMS_INCREASE_NEEDS_VOTE', 'or switch on auto-fines');
SELECT throws_ok(
  $$ SELECT pg_temp.rpc('a0000000-0000-0000-0000-000000000010',
       'UPDATE public.jamiyas SET payout_compliance_mode = ''deduct''
        WHERE id = ''b0000000-0000-0000-0000-000000000001'' RETURNING to_jsonb(id)') $$,
  'P0001', 'TERMS_INCREASE_NEEDS_VOTE', 'or start deducting from payouts');
SELECT lives_ok(
  $$ SELECT pg_temp.rpc('a0000000-0000-0000-0000-000000000010',
       'UPDATE public.jamiyas SET transaction_fee_amount = 40
        WHERE id = ''b0000000-0000-0000-0000-000000000001'' RETURNING to_jsonb(id)') $$,
  'but can lower one without a vote');
SELECT is((pg_temp.circle()).transaction_fee_amount, 40.00::numeric, 'the fee is now 40');

-- A circle still being set up (no other member has accepted terms) needs no vote.
INSERT INTO public.jamiyas (id, name, slug, created_by, contribution_amount, max_members)
VALUES ('b0000000-0000-0000-0000-000000000009', 'New Circle', 'new-circle',
        'a0000000-0000-0000-0000-000000000010', 1000, 8);
SELECT lives_ok(
  $$ SELECT pg_temp.rpc('a0000000-0000-0000-0000-000000000010',
       'UPDATE public.jamiyas SET late_contribution_penalty = 100
        WHERE id = ''b0000000-0000-0000-0000-000000000009'' RETURNING to_jsonb(id)') $$,
  'an officer sets penalties directly on a circle nobody else has joined');
SELECT is(
  pg_temp.rpc('a0000000-0000-0000-0000-000000000010', format(
    'SELECT public.propose_circle_terms_change(%L, %L::jsonb, %L)',
    'b0000000-0000-0000-0000-000000000009', '{"transaction_fee_amount": 60}', 'Setting up fees'))->>'error',
  'NO_VOTE_NEEDED', 'so a proposal there is not needed');

-- ---------------------------------------------------------------------------
-- Proposing
-- ---------------------------------------------------------------------------
SELECT is(
  pg_temp.rpc('a0000000-0000-0000-0000-000000000011', format(
    'SELECT public.propose_circle_terms_change(%L, %L::jsonb, %L)',
    'b0000000-0000-0000-0000-000000000001', '{"transaction_fee_amount": 60}', 'I want more'))->>'error',
  'FORBIDDEN', 'a member cannot propose');
SELECT is(pg_temp.propose('{"transaction_fee_amount": 60}', ' ')->>'error', 'REASON_REQUIRED',
  'a proposal needs a reason');
SELECT is(pg_temp.propose('{"name": "Hacked"}')->>'error', 'INVALID_CHANGE',
  'only fee and penalty terms can be proposed');
SELECT is(pg_temp.propose('{"transaction_fee_amount": -5}')->>'error', 'INVALID_CHANGE',
  'negative amounts are refused');
SELECT is(pg_temp.propose('{"transaction_fee_amount": 30}')->>'error', 'NO_VOTE_NEEDED',
  'a cut needs no vote');

SELECT is(pg_temp.propose('{"transaction_fee_amount": 60, "late_contribution_penalty": 100}')->>'ok',
  'true', 'the officer proposes raising the fee to 60 and adding a 100 late penalty');
SELECT is((pg_temp.live()).eligible_voters, 5, 'the officer and 4 members can vote');
SELECT is(
  (SELECT count(*) FROM public.notifications WHERE data->>'kind' = 'circle_terms_vote'),
  5::bigint, 'and each is told to vote');
SELECT is(pg_temp.propose('{"join_fee_amount": 100}')->>'error', 'PROPOSAL_IN_PROGRESS',
  'one proposal at a time');

-- Someone who joins after the proposal cannot vote on it.
INSERT INTO public.members (jamiya_id, user_id, role, status, payout_position, joined_at)
VALUES ('b0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000015',
        'member', 'active', 6, NOW() + INTERVAL '1 minute');
SELECT is(pg_temp.vote('a0000000-0000-0000-0000-000000000015', (pg_temp.live()).id, true)->>'error',
  'NOT_ELIGIBLE', 'a member who joined later cannot vote');

-- ---------------------------------------------------------------------------
-- Voting
-- ---------------------------------------------------------------------------
SELECT is(pg_temp.vote('a0000000-0000-0000-0000-000000000011', (pg_temp.live()).id, true)->>'status',
  'open', 'M1 votes yes; still open');
SELECT is(pg_temp.vote('a0000000-0000-0000-0000-000000000011', (pg_temp.live()).id, false)->>'status',
  'open', 'M1 changes to no');
SELECT is(((pg_temp.live()).yes_votes, (pg_temp.live()).no_votes)::text, '(0,1)',
  'a changed vote counts once');
SELECT is(
  pg_temp.rpc('a0000000-0000-0000-0000-000000000012',
    $$SELECT to_jsonb(count(*)) FROM public.circle_terms_votes$$)::text,
  '0', 'ballots are private');

SELECT pg_temp.vote('a0000000-0000-0000-0000-000000000012', (pg_temp.live()).id, true);
SELECT pg_temp.vote('a0000000-0000-0000-0000-000000000013', (pg_temp.live()).id, true);
SELECT is(pg_temp.vote('a0000000-0000-0000-0000-000000000010', (pg_temp.live()).id, true)->>'status',
  'passed', '3 yes to 1 no with one vote left: passed early');
SELECT ok((pg_temp.live()).effective_at > NOW() + INTERVAL '6 days',
  'it takes effect after a 7-day notice period');
SELECT is(
  (SELECT count(*) FROM public.notifications WHERE data->>'kind' = 'circle_terms_vote_result'),
  6::bigint, 'every member hears the result');
SELECT is(pg_temp.vote('a0000000-0000-0000-0000-000000000014', (pg_temp.live()).id, true)->>'error',
  'VOTING_CLOSED', 'no votes after it is decided');

SELECT is(
  (pg_temp.rpc('a0000000-0000-0000-0000-000000000011',
    $$SELECT public.refresh_circle_terms_proposals('b0000000-0000-0000-0000-000000000001')$$)->>'applied')::int,
  0, 'nothing changes during the notice period');
SELECT is((pg_temp.circle()).transaction_fee_amount, 40.00::numeric, 'the fee is still 40');

-- The notice period ends.
UPDATE public.circle_terms_proposals SET effective_at = NOW() - INTERVAL '1 second'
WHERE id = (pg_temp.live()).id;
SELECT is(
  (pg_temp.rpc('a0000000-0000-0000-0000-000000000011',
    $$SELECT public.refresh_circle_terms_proposals('b0000000-0000-0000-0000-000000000001')$$)->>'applied')::int,
  1, 'then the change is applied');
SELECT is(((pg_temp.circle()).transaction_fee_amount, (pg_temp.circle()).late_contribution_penalty)::text,
  '(60.00,100.00)', 'with the new fee and penalty');
SELECT is((pg_temp.live()).status, 'applied', 'and the proposal is marked applied');
SELECT is(private.agreed_circle_fee('a0000000-0000-0000-0000-000000000011',
  'b0000000-0000-0000-0000-000000000001', 'transaction_fee_amount'), 50::numeric,
  'M1, who voted no, keeps the 50 they accepted until they accept the new terms');

-- ---------------------------------------------------------------------------
-- Rejected, lapsed and cancelled proposals
-- ---------------------------------------------------------------------------
SELECT pg_temp.propose('{"join_fee_amount": 100}');
SELECT pg_temp.vote('a0000000-0000-0000-0000-000000000010', (pg_temp.live()).id, true);
SELECT pg_temp.vote('a0000000-0000-0000-0000-000000000011', (pg_temp.live()).id, false);
SELECT pg_temp.vote('a0000000-0000-0000-0000-000000000012', (pg_temp.live()).id, false);
SELECT is(pg_temp.vote('a0000000-0000-0000-0000-000000000013', (pg_temp.live()).id, false)->>'status',
  'rejected', '1 yes to 3 no: rejected early');
SELECT is((pg_temp.circle()).join_fee_amount, 0.00::numeric, 'and nothing changes');

SELECT pg_temp.propose('{"join_fee_amount": 100}');
SELECT pg_temp.vote('a0000000-0000-0000-0000-000000000010', (pg_temp.live()).id, true);
UPDATE public.circle_terms_proposals SET voting_closes_at = NOW() - INTERVAL '1 second'
WHERE id = (pg_temp.live()).id;
SELECT is(pg_temp.service($$SELECT public.process_circle_terms_proposals()$$)->>'decided', '1',
  'the scheduled job closes voting that ran out');
SELECT is((pg_temp.live()).status, 'rejected', 'one vote of five misses the quorum of 3');

SELECT pg_temp.propose('{"join_fee_amount": 100}');
SELECT is(
  pg_temp.rpc('a0000000-0000-0000-0000-000000000011',
    format('SELECT public.cancel_circle_terms_proposal(%L)', (pg_temp.live()).id))->>'error',
  'FORBIDDEN', 'a member cannot cancel a proposal');
SELECT is(
  pg_temp.rpc('a0000000-0000-0000-0000-000000000010',
    format('SELECT public.cancel_circle_terms_proposal(%L)', (pg_temp.live()).id))->>'ok',
  'true', 'an officer can');
SELECT is(
  jsonb_array_length(pg_temp.rpc('a0000000-0000-0000-0000-000000000011',
    $$SELECT public.get_circle_terms_proposals('b0000000-0000-0000-0000-000000000001')$$)->'proposals'),
  4, 'members see the circle''s recent proposals');
SELECT throws_ok(
  $$ SELECT pg_temp.rpc('a0000000-0000-0000-0000-000000000010', 'SELECT public.process_circle_terms_proposals()') $$,
  '42501', NULL, 'only the scheduled job runs the all-circles sweep');

-- ---------------------------------------------------------------------------
-- Payout deductions need the member's consent
-- ---------------------------------------------------------------------------
-- Operator switches the circle to 'deduct' (outside the app, so no vote).
UPDATE public.jamiyas SET payout_compliance_mode = 'deduct' WHERE id = 'b0000000-0000-0000-0000-000000000001';
INSERT INTO public.penalties (jamiya_id, member_id, user_id, kind, amount, status)
VALUES ('b0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000014',
        'a0000000-0000-0000-0000-000000000014', 'ad_hoc', 200, 'open');
INSERT INTO public.payouts (id, jamiya_id, member_id, cycle_number, amount, currency, status, scheduled_date)
VALUES ('e0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001',
        'c0000000-0000-0000-0000-000000000014', 99, 1000, 'KES', 'scheduled', CURRENT_DATE);

SELECT is(
  pg_temp.rpc('a0000000-0000-0000-0000-000000000010',
    $$SELECT public.settle_payout('e0000000-0000-0000-0000-000000000001')$$)->>'error',
  'MEMBER_NONCOMPLIANT', 'a member who never agreed to deductions has the payout held, not cut');
SELECT is((SELECT status FROM public.penalties WHERE member_id = 'c0000000-0000-0000-0000-000000000014'),
  'open', 'and the penalty is not taken');

SELECT pg_temp.rpc('a0000000-0000-0000-0000-000000000014',
  format('SELECT public.accept_circle_terms(%L, %s)', 'b0000000-0000-0000-0000-000000000001',
         (pg_temp.circle()).terms_version));
SELECT is(
  pg_temp.rpc('a0000000-0000-0000-0000-000000000010',
    $$SELECT public.settle_payout('e0000000-0000-0000-0000-000000000001')$$)->>'ok',
  'true', 'once they accept terms that include deductions, the payout is settled');
SELECT is((SELECT (metadata->>'deducted')::numeric FROM public.transactions
           WHERE reference = 'payout:e0000000-0000-0000-0000-000000000001'),
  200::numeric, 'less the 200 penalty');

-- ---------------------------------------------------------------------------
-- Only the member moves their own money into a savings pocket
-- ---------------------------------------------------------------------------
SELECT private.ledger_credit('a0000000-0000-0000-0000-000000000011', 'KES', 1000, 'payout', NULL,
  'fixture-pocket', NULL, '{}'::jsonb);
INSERT INTO public.savings_pockets (id, jamiya_id, member_id, category, currency)
VALUES ('e0000000-0000-0000-0000-000000000002', 'b0000000-0000-0000-0000-000000000001',
        'c0000000-0000-0000-0000-000000000011', 'regular', 'KES');
SELECT is(
  pg_temp.rpc('a0000000-0000-0000-0000-000000000010',
    $$SELECT public.move_savings_pocket('e0000000-0000-0000-0000-000000000002', 300, 'deposit')$$)->>'error',
  'OWNER_ONLY', 'an officer cannot move a member''s wallet money into a pocket');
SELECT is(
  pg_temp.rpc('a0000000-0000-0000-0000-000000000011',
    $$SELECT public.move_savings_pocket('e0000000-0000-0000-0000-000000000002', 300, 'deposit')$$)->>'ok',
  'true', 'the member can');

SELECT * FROM finish();
ROLLBACK;
