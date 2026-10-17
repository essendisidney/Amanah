-- pgTAP: circle minutes and resolutions; leaving a circle and handing shares to another member.
-- Run with scripts/test-db.mjs (or `supabase test db`). Everything rolls back.
BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SET LOCAL search_path = public, extensions;

SELECT plan(37);

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

-- Count rows a user can see.
CREATE FUNCTION pg_temp.visible(p_uid UUID, p_sql TEXT)
RETURNS BIGINT LANGUAGE plpgsql AS $$
DECLARE r BIGINT;
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

-- Admin/creator (…50), secretary (…51), members M1 (…52), M2 (…53), M3 (…54).
INSERT INTO auth.users (id, email, raw_user_meta_data)
SELECT ('a0000000-0000-0000-0000-0000000000' || n)::uuid, 'u' || n || '@test.local',
       json_build_object('full_name', 'User ' || n, 'phone', '+2547000000' || n)::jsonb
FROM generate_series(50, 54) n;

INSERT INTO public.jamiyas (id, name, slug, created_by, contribution_amount, max_members)
VALUES ('b0000000-0000-0000-0000-000000000005', 'Records Circle', 'records-circle',
        'a0000000-0000-0000-0000-000000000050', 1000, 8);
INSERT INTO public.members (id, jamiya_id, user_id, role, status, payout_position)
SELECT ('c0000000-0000-0000-0000-0000000000' || n)::uuid, 'b0000000-0000-0000-0000-000000000005',
       ('a0000000-0000-0000-0000-0000000000' || n)::uuid,
       CASE WHEN n = 51 THEN 'secretary' ELSE 'member' END::membership_role, 'active', n - 49
FROM generate_series(51, 54) n;

-- ---------------------------------------------------------------------------
-- Minutes and resolutions
-- ---------------------------------------------------------------------------
SELECT is(pg_temp.rpc('a0000000-0000-0000-0000-000000000052', $$SELECT public.save_circle_record(
  'b0000000-0000-0000-0000-000000000005', 'minutes', 'March meeting', 'We met.')$$)->>'error',
  'FORBIDDEN', 'an ordinary member cannot write the minutes');

CREATE TEMP TABLE rec AS
SELECT (pg_temp.rpc('a0000000-0000-0000-0000-000000000051', $$SELECT public.save_circle_record(
  'b0000000-0000-0000-0000-000000000005', 'minutes', 'March meeting',
  'Present: all. Agreed to buy land.')$$)->>'record_id')::uuid AS id;
SELECT ok((SELECT id FROM rec) IS NOT NULL, 'the secretary writes the minutes as a draft');
SELECT is(pg_temp.visible('a0000000-0000-0000-0000-000000000052', 'SELECT count(*) FROM public.circle_records'),
  0::bigint, 'members do not see drafts');
SELECT is(pg_temp.rpc('a0000000-0000-0000-0000-000000000051', $$SELECT public.save_circle_record(
  'b0000000-0000-0000-0000-000000000005', 'resolution', 'Bad file', '', NULL, NULL,
  'b0000000-0000-0000-0000-000000000099/x.pdf', 'x.pdf', 'application/pdf')$$)->>'error',
  'INVALID', 'a file must sit in the circle''s own folder');
SELECT is(pg_temp.rpc('a0000000-0000-0000-0000-000000000051', format(
  'SELECT public.publish_circle_record(%L)', (SELECT id FROM rec)))->>'ok', 'true', 'the secretary publishes it');
SELECT is(pg_temp.visible('a0000000-0000-0000-0000-000000000052', 'SELECT count(*) FROM public.circle_records'),
  1::bigint, 'members now read it');
SELECT is((SELECT count(*) FROM public.notifications WHERE user_id = 'a0000000-0000-0000-0000-000000000053'
           AND data->>'kind' = 'circle_record'), 1::bigint, 'and are told');
SELECT is(pg_temp.rpc('a0000000-0000-0000-0000-000000000051', format(
  'SELECT public.delete_circle_record(%L)', (SELECT id FROM rec)))->>'error', 'ALREADY_PUBLISHED',
  'published records cannot be deleted');
SELECT is(pg_temp.rpc('a0000000-0000-0000-0000-000000000051', format(
  'SELECT public.save_circle_record(%L, %L, %L, %L, NULL, NULL, NULL, NULL, NULL, %L)',
  'b0000000-0000-0000-0000-000000000005', 'minutes', 'Changed', 'Changed', (SELECT id FROM rec)))->>'error',
  'ALREADY_PUBLISHED', 'or edited');
CREATE TEMP TABLE draft AS
SELECT (pg_temp.rpc('a0000000-0000-0000-0000-000000000051', $$SELECT public.save_circle_record(
  'b0000000-0000-0000-0000-000000000005', 'resolution', 'Half-written', '')$$)->>'record_id')::uuid AS id;
SELECT is(pg_temp.rpc('a0000000-0000-0000-0000-000000000051', format(
  'SELECT public.delete_circle_record(%L)', (SELECT id FROM draft)))->>'ok', 'true', 'a draft can be discarded');
SELECT is(pg_temp.visible('a0000000-0000-0000-0000-000000000051', 'SELECT count(*) FROM public.circle_records'),
  1::bigint, 'and disappears, leaving only the published minutes');
SELECT is(pg_temp.rpc('a0000000-0000-0000-0000-000000000051', format(
  'SELECT public.publish_circle_record(%L)', (SELECT id FROM draft)))->>'error', 'NOT_FOUND',
  'a discarded draft cannot be published');
SELECT throws_ok(
  $$ SELECT pg_temp.visible('a0000000-0000-0000-0000-000000000051',
       'WITH x AS (INSERT INTO public.circle_records (jamiya_id, kind, title) VALUES
        (''b0000000-0000-0000-0000-000000000005'', ''minutes'', ''Direct'') RETURNING 1) SELECT count(*) FROM x') $$,
  '42501', NULL, 'records change only through the functions');
SELECT is(private.circle_record_folder('b0000000-0000-0000-0000-000000000005/r/minutes.pdf'),
  'b0000000-0000-0000-0000-000000000005'::uuid, 'a file''s circle is its first folder');
SELECT is(private.circle_record_folder('../etc/passwd'), NULL::uuid, 'anything else belongs to no circle');

-- ---------------------------------------------------------------------------
-- Leaving, with shares handed to another member
-- ---------------------------------------------------------------------------
INSERT INTO public.circle_share_lots (jamiya_id, member_id, shares, unit_price, amount, currency)
VALUES ('b0000000-0000-0000-0000-000000000005', 'c0000000-0000-0000-0000-000000000052', 10, 100, 1000, 'KES'),
       ('b0000000-0000-0000-0000-000000000005', 'c0000000-0000-0000-0000-000000000052', 5, 100, 500, 'KES'),
       ('b0000000-0000-0000-0000-000000000005', 'c0000000-0000-0000-0000-000000000053', 2, 100, 200, 'KES');
INSERT INTO public.contributions (jamiya_id, member_id, cycle_number, amount, currency, due_date)
VALUES ('b0000000-0000-0000-0000-000000000005', 'c0000000-0000-0000-0000-000000000052', 9, 1000, 'KES', CURRENT_DATE + 30);
INSERT INTO public.payouts (id, jamiya_id, member_id, cycle_number, amount, currency, status, scheduled_date)
VALUES ('e0000000-0000-0000-0000-000000000005', 'b0000000-0000-0000-0000-000000000005',
        'c0000000-0000-0000-0000-000000000052', 9, 5000, 'KES', 'scheduled', CURRENT_DATE + 30);

SELECT is(pg_temp.rpc('a0000000-0000-0000-0000-000000000052', $$SELECT public.my_circle_exit_check(
  'b0000000-0000-0000-0000-000000000005')$$)->>'shares', '15.0000', 'the page shows the 15 shares to hand over');
SELECT is(pg_temp.rpc('a0000000-0000-0000-0000-000000000050', $$SELECT public.my_circle_exit_check(
  'b0000000-0000-0000-0000-000000000005')$$)->>'blocker', 'LAST_ADMIN', 'and why someone cannot leave yet');
SELECT is(pg_temp.rpc('a0000000-0000-0000-0000-000000000052', $$SELECT public.request_circle_exit(
  'b0000000-0000-0000-0000-000000000005', NULL, 'Moving town')$$)->>'error',
  'SHARES_NEED_RECIPIENT', 'a member with shares must name who takes them');

INSERT INTO public.qard_loans (id, jamiya_id, borrower_id, amount, currency, purpose, status)
VALUES ('d0000000-0000-0000-0000-000000000052', 'b0000000-0000-0000-0000-000000000005',
        'a0000000-0000-0000-0000-000000000052', 1000, 'KES', 'Open loan', 'active');
SELECT is(pg_temp.rpc('a0000000-0000-0000-0000-000000000052', $$SELECT public.request_circle_exit(
  'b0000000-0000-0000-0000-000000000005', 'c0000000-0000-0000-0000-000000000053', 'Moving town')$$)->>'error',
  'OPEN_LOAN', 'nobody leaves with a loan open');
UPDATE public.qard_loans SET status = 'repaid', amount_repaid = amount WHERE id = 'd0000000-0000-0000-0000-000000000052';

SELECT is(pg_temp.rpc('a0000000-0000-0000-0000-000000000052', $$SELECT public.request_circle_exit(
  'b0000000-0000-0000-0000-000000000005', 'c0000000-0000-0000-0000-000000000052', 'Moving town')$$)->>'error',
  'INVALID_RECIPIENT', 'nor hands shares to themselves');

CREATE TEMP TABLE ex AS
SELECT pg_temp.rpc('a0000000-0000-0000-0000-000000000052', $$SELECT public.request_circle_exit(
  'b0000000-0000-0000-0000-000000000005', 'c0000000-0000-0000-0000-000000000053', 'Moving town')$$) AS r;
SELECT is((SELECT r->>'status' FROM ex), 'awaiting_recipient', 'M1 asks to leave and hand their shares to M2');
SELECT is(pg_temp.rpc('a0000000-0000-0000-0000-000000000052', $$SELECT public.request_circle_exit(
  'b0000000-0000-0000-0000-000000000005', 'c0000000-0000-0000-0000-000000000053', 'Again')$$)->>'error',
  'ALREADY_REQUESTED', 'one request at a time');
SELECT is(pg_temp.rpc('a0000000-0000-0000-0000-000000000050', format(
  'SELECT public.decide_circle_exit(%L, true)', (SELECT r->>'exit_request_id' FROM ex)))->>'error',
  'NOT_AWAITING', 'officers wait for M2 to agree');
SELECT is(pg_temp.rpc('a0000000-0000-0000-0000-000000000054', format(
  'SELECT public.respond_share_transfer(%L, true)', (SELECT r->>'exit_request_id' FROM ex)))->>'error',
  'NOT_FOUND', 'only the named member can agree');
SELECT is(pg_temp.rpc('a0000000-0000-0000-0000-000000000053', format(
  'SELECT public.respond_share_transfer(%L, true)', (SELECT r->>'exit_request_id' FROM ex)))->>'status',
  'awaiting_approval', 'M2 agrees');
SELECT is(pg_temp.rpc('a0000000-0000-0000-0000-000000000052', format(
  'SELECT public.decide_circle_exit(%L, true)', (SELECT r->>'exit_request_id' FROM ex)))->>'error',
  'NOT_FOUND', 'a member cannot approve their own exit');
SELECT is(pg_temp.rpc('a0000000-0000-0000-0000-000000000050', format(
  'SELECT public.decide_circle_exit(%L, true)', (SELECT r->>'exit_request_id' FROM ex)))->>'status',
  'approved', 'an officer approves');

SELECT is((SELECT status::text FROM public.members WHERE id = 'c0000000-0000-0000-0000-000000000052'),
  'left', 'M1 has left');
SELECT is((SELECT coalesce(sum(shares), 0) FROM public.circle_share_lots WHERE member_id = 'c0000000-0000-0000-0000-000000000052'),
  0::numeric, 'and holds no shares');
SELECT is((SELECT sum(shares) FROM public.circle_share_lots WHERE member_id = 'c0000000-0000-0000-0000-000000000053'),
  17::numeric, 'M2 holds their own 2 plus M1''s 15');
SELECT is((SELECT sum(amount) FROM public.circle_share_lots WHERE member_id = 'c0000000-0000-0000-0000-000000000053'),
  1700::numeric, 'worth 1,700');
SELECT is((SELECT count(*) FROM public.circle_share_transfers WHERE from_member_id = 'c0000000-0000-0000-0000-000000000052'),
  2::bigint, 'each moved lot is recorded');
SELECT is((SELECT status::text FROM public.contributions WHERE member_id = 'c0000000-0000-0000-0000-000000000052'),
  'waived', 'M1''s future contribution is waived');
SELECT is((SELECT status::text FROM public.payouts WHERE id = 'e0000000-0000-0000-0000-000000000005'),
  'cancelled', 'and their scheduled payout cancelled');
SELECT is((pg_temp.rpc('a0000000-0000-0000-0000-000000000050', $$SELECT public.allocate_circle_dividend(
  'b0000000-0000-0000-0000-000000000005', 'Year end', 1700)$$)->>'allocations')::int, 1,
  'a dividend now goes to M2 alone');

SELECT is(pg_temp.rpc('a0000000-0000-0000-0000-000000000054', $$SELECT public.request_circle_exit(
  'b0000000-0000-0000-0000-000000000005')$$)->>'status', 'awaiting_approval',
  'a member without shares just asks officers');
SELECT is(pg_temp.rpc('a0000000-0000-0000-0000-000000000050', $$SELECT public.request_circle_exit(
  'b0000000-0000-0000-0000-000000000005')$$)->>'error', 'LAST_ADMIN',
  'the last admin must hand over the role first');

SELECT * FROM finish();
ROLLBACK;
