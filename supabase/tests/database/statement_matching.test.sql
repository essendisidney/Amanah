-- pgTAP: officers record a pasted bank statement against members' open contributions, never twice,
-- and save how members pay. Run with scripts/test-db.mjs. Everything rolls back.
BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SET LOCAL search_path = public, extensions;

SELECT plan(19);

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

-- Officer …51, members …52 and …53, outsider …54 (member of another circle).
INSERT INTO auth.users (id, email, raw_user_meta_data)
SELECT ('a0000000-0000-0000-0000-0000000000' || n)::uuid, 's' || n || '@test.local',
       json_build_object('full_name', 'Statement ' || n, 'phone', '+2547200000' || n)::jsonb
FROM generate_series(51, 54) n;

INSERT INTO public.jamiyas (id, name, slug, created_by, contribution_amount, max_members)
VALUES ('b0000000-0000-0000-0000-000000000051', 'Bank Chama', 'bank-chama',
        'a0000000-0000-0000-0000-000000000051', 1000, 20),
       ('b0000000-0000-0000-0000-000000000054', 'Other', 'other-chama',
        'a0000000-0000-0000-0000-000000000054', 1000, 20);
INSERT INTO public.members (id, jamiya_id, user_id, role, status, payout_position)
VALUES ('c0000000-0000-0000-0000-000000000052', 'b0000000-0000-0000-0000-000000000051',
        'a0000000-0000-0000-0000-000000000052', 'member', 'active', 2),
       ('c0000000-0000-0000-0000-000000000053', 'b0000000-0000-0000-0000-000000000051',
        'a0000000-0000-0000-0000-000000000053', 'member', 'active', 3);

INSERT INTO public.contributions (id, jamiya_id, member_id, cycle_number, amount, currency, due_date, status)
VALUES ('d0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000051',
        'c0000000-0000-0000-0000-000000000052', 1, 1000, 'KES', '2026-10-05', 'late'),
       ('d0000000-0000-0000-0000-000000000002', 'b0000000-0000-0000-0000-000000000051',
        'c0000000-0000-0000-0000-000000000052', 2, 1000, 'KES', '2026-11-05', 'pending');

-- ---------------------------------------------------------------------------
-- Recording a statement
-- ---------------------------------------------------------------------------
SELECT is(
  pg_temp.rpc('a0000000-0000-0000-0000-000000000052',
    $$SELECT public.record_statement_payments('b0000000-0000-0000-0000-000000000051',
      '[{"reference":"SKB1XY2Z3A","amount":1500,"member_id":"c0000000-0000-0000-0000-000000000052"}]')$$)->>'error',
  'FORBIDDEN', 'a member cannot record a statement');

SELECT is(
  pg_temp.rpc('a0000000-0000-0000-0000-000000000051',
    $$SELECT public.record_statement_payments('b0000000-0000-0000-0000-000000000051',
      '[{"reference":"skb1xy2z3a","paid_on":"2026-11-02","amount":1500,"member_id":"c0000000-0000-0000-0000-000000000052","details":"MPESA 0712 FATUMA"}]')$$)->>'recorded',
  '1', 'the officer records a 1,500 payment');
SELECT is((SELECT status::text FROM public.contributions WHERE id = 'd0000000-0000-0000-0000-000000000001'),
  'paid', 'the late October contribution is paid first');
SELECT is((SELECT amount_paid FROM public.contributions WHERE id = 'd0000000-0000-0000-0000-000000000002'),
  500::numeric, 'the rest goes to November');
SELECT is((SELECT status::text FROM public.contributions WHERE id = 'd0000000-0000-0000-0000-000000000002'),
  'partial', 'which is part paid');
SELECT is((SELECT count(*) FROM public.contribution_payments
           WHERE notes = 'Bank statement SKB1XY2Z3A' AND payment_method = 'external'),
  2::bigint, 'each contribution shows the statement reference');
SELECT is((SELECT paid_at::date FROM public.contributions WHERE id = 'd0000000-0000-0000-0000-000000000001'),
  '2026-11-02'::date, 'dated the day the bank received it');

SELECT is(
  pg_temp.rpc('a0000000-0000-0000-0000-000000000051',
    $$SELECT public.record_statement_payments('b0000000-0000-0000-0000-000000000051',
      '[{"reference":"SKB1XY2Z3A","amount":1500,"member_id":"c0000000-0000-0000-0000-000000000052"}]')$$)->>'duplicates',
  '1', 'pasting the same statement again is caught');
SELECT is((SELECT amount_paid FROM public.contributions WHERE id = 'd0000000-0000-0000-0000-000000000002'),
  500::numeric, 'and changes nothing');

SELECT is(
  (pg_temp.rpc('a0000000-0000-0000-0000-000000000051',
    $$SELECT public.record_statement_payments('b0000000-0000-0000-0000-000000000051',
      '[{"reference":"SKC4AB5CD6","amount":800,"member_id":"c0000000-0000-0000-0000-000000000052"}]')$$)->'results'->0->>'unallocated')::numeric,
  300::numeric, 'money beyond what is owed is kept as unallocated');
SELECT is((SELECT status::text FROM public.contributions WHERE id = 'd0000000-0000-0000-0000-000000000002'),
  'paid', 'after November is paid in full');

SELECT is(
  (pg_temp.rpc('a0000000-0000-0000-0000-000000000051',
    $$SELECT public.record_statement_payments('b0000000-0000-0000-0000-000000000051',
      '[{"reference":"SKD7EF8GH9","amount":500,"member_id":"c0000000-0000-0000-0000-000000000053"}]')$$)->'results'->0->>'unallocated')::numeric,
  500::numeric, 'a member with nothing due keeps the whole payment unallocated');

SELECT is(
  pg_temp.rpc('a0000000-0000-0000-0000-000000000051',
    $$SELECT public.record_statement_payments('b0000000-0000-0000-0000-000000000051',
      '[{"reference":"SKE1","amount":500,"member_id":"c0000000-0000-0000-0000-000000000099"}]')$$)->'results'->0->>'status',
  'not_a_member', 'only members of this circle');

-- ---------------------------------------------------------------------------
-- How to pay
-- ---------------------------------------------------------------------------
SELECT is(
  pg_temp.rpc('a0000000-0000-0000-0000-000000000052',
    $$SELECT public.set_circle_payment_details('b0000000-0000-0000-0000-000000000051', '342342', '0015', 'DIB Bank', NULL)$$)->>'error',
  'FORBIDDEN', 'a member cannot change how to pay');
SELECT is(
  pg_temp.rpc('a0000000-0000-0000-0000-000000000051',
    $$SELECT public.set_circle_payment_details('b0000000-0000-0000-0000-000000000051', ' 342342 ', '001517100104602', 'DIB Bank', 'Pay between the 1st and 5th')$$)->'payment_details',
  '{"paybill": "342342", "account": "001517100104602", "bank": "DIB Bank", "note": "Pay between the 1st and 5th"}'::jsonb,
  'the officer saves the paybill, account, bank and note');
SELECT is(
  (pg_temp.rpc('a0000000-0000-0000-0000-000000000051',
    $$SELECT public.set_circle_payment_details('b0000000-0000-0000-0000-000000000051', '', '', '', '')$$)->'payment_details'),
  'null'::jsonb, 'clearing every field removes them');

-- ---------------------------------------------------------------------------
-- Two circles sharing one bank account
-- ---------------------------------------------------------------------------
INSERT INTO public.jamiyas (id, name, slug, created_by, contribution_amount, max_members)
VALUES ('b0000000-0000-0000-0000-000000000055', 'Bank Chama Two', 'bank-chama-two',
        'a0000000-0000-0000-0000-000000000051', 1000, 20);
INSERT INTO public.members (id, jamiya_id, user_id, role, status, payout_position)
VALUES ('c0000000-0000-0000-0000-000000000055', 'b0000000-0000-0000-0000-000000000055',
        'a0000000-0000-0000-0000-000000000052', 'member', 'active', 2);
SELECT pg_temp.rpc('a0000000-0000-0000-0000-000000000051',
  $$SELECT public.set_circle_payment_details('b0000000-0000-0000-0000-000000000051', '342342', '001517100104602', 'DIB Bank', NULL)$$);
SELECT pg_temp.rpc('a0000000-0000-0000-0000-000000000051',
  $$SELECT public.set_circle_payment_details('b0000000-0000-0000-0000-000000000055', '342342', '001517100104602', 'DIB Bank', NULL)$$);

SELECT is(
  pg_temp.rpc('a0000000-0000-0000-0000-000000000051',
    $$SELECT public.record_statement_payments('b0000000-0000-0000-0000-000000000055',
      '[{"reference":"SKB1XY2Z3A","amount":1500,"member_id":"c0000000-0000-0000-0000-000000000055"}]')$$)->>'duplicates',
  '1', 'a payment already recorded in a circle sharing the account is not recorded again');
SELECT is(
  pg_temp.rpc('a0000000-0000-0000-0000-000000000051',
    $$SELECT public.circle_statement_refs('b0000000-0000-0000-0000-000000000055')$$)->'refs'->0->>'circle',
  'Bank Chama', 'the matching page can say which circle has it');
SELECT is(
  pg_temp.rpc('a0000000-0000-0000-0000-000000000051',
    $$SELECT public.record_statement_payments('b0000000-0000-0000-0000-000000000055',
      '[{"reference":"SKZ9NEW001","amount":500,"member_id":"c0000000-0000-0000-0000-000000000055"}]')$$)->>'recorded',
  '1', 'new payments in the second circle are recorded as usual');

SELECT * FROM finish();
ROLLBACK;
