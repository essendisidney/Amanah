-- pgTAP: circles pay Jameiyah by bank or M-Pesa; an admin records the payments from Jameiyah's
-- statement, plans switch on or extend, short payments wait for the rest, and each payment is
-- booked as circle plan income. Run with scripts/test-db.mjs. Everything rolls back.
BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SET LOCAL search_path = public, extensions;

SELECT plan(20);

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

-- Officer …61 (circle A), officer …62 (circle B), admin …63, member …64.
INSERT INTO auth.users (id, email, raw_user_meta_data)
SELECT ('a0000000-0000-0000-0000-0000000000' || n)::uuid, 'j' || n || '@test.local',
       json_build_object('full_name', 'Pay ' || n, 'phone', '+2547300000' || n)::jsonb
FROM generate_series(61, 64) n;
UPDATE public.profiles SET platform_role = 'platform_admin' WHERE id = 'a0000000-0000-0000-0000-000000000063';

INSERT INTO public.jamiyas (id, name, slug, created_by, contribution_amount, max_members)
VALUES ('b0000000-0000-0000-0000-000000000061', 'Pay A', 'pay-a', 'a0000000-0000-0000-0000-000000000061', 1000, 60),
       ('b0000000-0000-0000-0000-000000000062', 'Pay B', 'pay-b', 'a0000000-0000-0000-0000-000000000062', 1000, 60);
INSERT INTO public.members (jamiya_id, user_id, role, status, payout_position)
VALUES ('b0000000-0000-0000-0000-000000000061', 'a0000000-0000-0000-0000-000000000064', 'member', 'active', 2);

SELECT matches((SELECT billing_ref FROM public.jamiyas WHERE id = 'b0000000-0000-0000-0000-000000000061'),
  '^JM[0-9]{5,}$', 'every circle has a payment reference');
SELECT isnt((SELECT billing_ref FROM public.jamiyas WHERE id = 'b0000000-0000-0000-0000-000000000061'),
  (SELECT billing_ref FROM public.jamiyas WHERE id = 'b0000000-0000-0000-0000-000000000062'),
  'and no two circles share one');

-- Where to pay
SELECT is(
  pg_temp.rpc('a0000000-0000-0000-0000-000000000064',
    $$SELECT public.jameiyah_payment_details('b0000000-0000-0000-0000-000000000061')$$)->>'error',
  'FORBIDDEN', 'a member does not see the billing page');
SELECT is(
  pg_temp.rpc('a0000000-0000-0000-0000-000000000061',
    $$SELECT public.jameiyah_payment_details('b0000000-0000-0000-0000-000000000061')$$)->'details'->>'account',
  '0900739901', 'an officer sees Jameiyah''s bank account');
SELECT is(
  pg_temp.rpc('a0000000-0000-0000-0000-000000000061',
    $$SELECT public.admin_set_jameiyah_payment_details('x', 'x', 'x', 'x', 'x', 'x')$$)->>'error',
  'FORBIDDEN', 'only an admin changes the payment details');
SELECT is(
  pg_temp.rpc('a0000000-0000-0000-0000-000000000063',
    $$SELECT public.admin_set_jameiyah_payment_details('JAMEIYAH DIGITAL LIMITED', 'Gulf African Bank',
      'Jomo Kenyatta Avenue, Mombasa', '0900739901', '985050', '711920#{ref}')$$)->'details'->>'mpesa_account',
  '711920#{ref}', 'the admin adds the M-Pesa paybill and account');

-- Recording payments
SELECT is(
  pg_temp.rpc('a0000000-0000-0000-0000-000000000061',
    $$SELECT public.admin_record_plan_payments('[{"reference":"GAB1","amount":450,"jamiya_id":"b0000000-0000-0000-0000-000000000061","plan_id":"starter","period":"monthly"}]')$$)->>'error',
  'FORBIDDEN', 'an officer cannot record payments to Jameiyah');

SELECT is(
  pg_temp.rpc('a0000000-0000-0000-0000-000000000063',
    $$SELECT public.admin_record_plan_payments('[{"reference":"gab1","paid_on":"2026-11-01","amount":450,"jamiya_id":"b0000000-0000-0000-0000-000000000061","plan_id":"starter","period":"monthly"}]')$$)->>'activated',
  '1', 'a full payment switches the plan on');
SELECT is((SELECT plan_id || ':' || status || ':' || billing_period FROM public.circle_subscriptions
           WHERE jamiya_id = 'b0000000-0000-0000-0000-000000000061'),
  'starter:active:monthly', 'the circle is on Starter, monthly');
SELECT ok((SELECT renews_at BETWEEN NOW() + INTERVAL '27 days' AND NOW() + INTERVAL '32 days'
           FROM public.circle_subscriptions WHERE jamiya_id = 'b0000000-0000-0000-0000-000000000061'),
  'paid for a month');
SELECT is((SELECT sum(jl.amount) FROM public.journal_lines jl
           JOIN public.journal_entries je ON je.id = jl.journal_entry_id
           JOIN public.ledger_accounts la ON la.id = jl.ledger_account_id
           WHERE je.source_type = 'plan_bank_payment' AND la.code = '2110' AND jl.side = 'credit'),
  450::numeric, 'booked as circle plan income');
SELECT is((pg_temp.rpc('a0000000-0000-0000-0000-000000000063',
    $$SELECT public.admin_revenue_summary(CURRENT_DATE - 1, CURRENT_DATE + 1)$$)->>'total')::numeric,
  450::numeric, 'and shows in Admin → Revenue');

SELECT is(
  pg_temp.rpc('a0000000-0000-0000-0000-000000000063',
    $$SELECT public.admin_record_plan_payments('[{"reference":"GAB1","amount":450,"jamiya_id":"b0000000-0000-0000-0000-000000000061","plan_id":"starter","period":"monthly"}]')$$)->>'duplicates',
  '1', 'the same payment is never recorded twice');

-- Paying again before the month ends adds a month from where it ends.
SELECT pg_temp.rpc('a0000000-0000-0000-0000-000000000063',
  $$SELECT public.admin_record_plan_payments('[{"reference":"GAB2","amount":450,"jamiya_id":"b0000000-0000-0000-0000-000000000061","plan_id":"starter","period":"monthly"}]')$$);
SELECT ok((SELECT renews_at > NOW() + INTERVAL '55 days'
           FROM public.circle_subscriptions WHERE jamiya_id = 'b0000000-0000-0000-0000-000000000061'),
  'paying early extends the plan instead of restarting it');

-- Short payments wait for the rest.
SELECT is(
  pg_temp.rpc('a0000000-0000-0000-0000-000000000063',
    $$SELECT public.admin_record_plan_payments('[{"reference":"GAB3","amount":800,"jamiya_id":"b0000000-0000-0000-0000-000000000062","plan_id":"starter","period":"quarterly"}]')$$)->'results'->0->>'status',
  'held', 'part of a quarter is held');
SELECT is(coalesce((SELECT plan_id FROM public.circle_subscriptions WHERE jamiya_id = 'b0000000-0000-0000-0000-000000000062'), 'free'),
  'free', 'and the plan is not on yet');
SELECT is(
  (pg_temp.rpc('a0000000-0000-0000-0000-000000000062',
    $$SELECT public.jameiyah_payment_details('b0000000-0000-0000-0000-000000000062')$$)->>'held')::numeric,
  800::numeric, 'the officer sees what is held');
SELECT is(
  pg_temp.rpc('a0000000-0000-0000-0000-000000000063',
    $$SELECT public.admin_record_plan_payments('[{"reference":"GAB4","amount":500,"jamiya_id":"b0000000-0000-0000-0000-000000000062","plan_id":"starter","period":"quarterly"}]')$$)->'results'->0->>'status',
  'applied', 'the rest switches the plan on');
SELECT is((SELECT count(*) FROM public.platform_plan_payments
           WHERE jamiya_id = 'b0000000-0000-0000-0000-000000000062' AND status = 'held'),
  0::bigint, 'nothing is left held');
SELECT is(
  pg_temp.rpc('a0000000-0000-0000-0000-000000000062',
    $$SELECT public.circle_plan_quotes('b0000000-0000-0000-0000-000000000062')$$)->>'trial_available',
  'false', 'a circle that has paid by bank no longer gets a free trial');

SELECT * FROM finish();
ROLLBACK;
