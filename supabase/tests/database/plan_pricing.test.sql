-- pgTAP: circle plans follow the final price list — periods, the Enterprise per-member price,
-- the free trial, renewals that follow the circle's size, reminders, the grace period and the
-- launch discount. Run with scripts/test-db.mjs. Everything rolls back.
BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SET LOCAL search_path = public, extensions;

SELECT plan(46);

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

CREATE FUNCTION pg_temp.renew()
RETURNS JSONB LANGUAGE plpgsql AS $$
DECLARE r JSONB;
BEGIN
  PERFORM set_config('request.jwt.claims', '{"role":"service_role"}', true);
  SET LOCAL ROLE service_role;
  r := public.process_circle_subscription_renewals();
  RESET ROLE;
  RETURN r;
END;
$$;

CREATE FUNCTION pg_temp.balance(p_uid UUID)
RETURNS NUMERIC LANGUAGE sql AS $$
  SELECT balance FROM public.wallets WHERE user_id = p_uid AND currency = 'KES'
$$;

CREATE FUNCTION pg_temp.sub(p_jamiya UUID)
RETURNS public.circle_subscriptions LANGUAGE sql AS $$
  SELECT * FROM public.circle_subscriptions WHERE jamiya_id = p_jamiya
$$;

-- Officers …31 (circle A), …32 (circle B), …33 (circle C); member …34.
INSERT INTO auth.users (id, email, raw_user_meta_data)
SELECT ('a0000000-0000-0000-0000-0000000000' || n)::uuid, 'p' || n || '@test.local',
       json_build_object('full_name', 'Plan ' || n, 'phone', '+2547100000' || n)::jsonb
FROM generate_series(31, 34) n;

INSERT INTO public.jamiyas (id, name, slug, created_by, contribution_amount, max_members)
VALUES ('b0000000-0000-0000-0000-000000000031', 'Plan A', 'plan-a', 'a0000000-0000-0000-0000-000000000031', 1000, 60),
       ('b0000000-0000-0000-0000-000000000032', 'Plan B', 'plan-b', 'a0000000-0000-0000-0000-000000000032', 1000, 60),
       ('b0000000-0000-0000-0000-000000000033', 'Plan C', 'plan-c', 'a0000000-0000-0000-0000-000000000033', 1000, 60);
INSERT INTO public.members (jamiya_id, user_id, role, status, payout_position)
VALUES ('b0000000-0000-0000-0000-000000000031', 'a0000000-0000-0000-0000-000000000034', 'member', 'active', 2);

SELECT private.ledger_credit(('a0000000-0000-0000-0000-0000000000' || n)::uuid, 'KES', 50000, 'payout',
  NULL, 'fixture-plan-' || n, NULL, '{}'::jsonb)
FROM generate_series(31, 33) n;

-- ---------------------------------------------------------------------------
-- Price list
-- ---------------------------------------------------------------------------
SELECT is(private.circle_plan_list_price('starter', 8, 'monthly'), 450::numeric, 'Starter: KES 450 a month');
SELECT is(private.circle_plan_list_price('starter', 8, 'quarterly'), 1300::numeric, 'KES 1,300 a quarter');
SELECT is(private.circle_plan_list_price('starter', 8, 'annual'), 4500::numeric, 'KES 4,500 a year');
SELECT is(private.circle_plan_list_price('growth', 20, 'monthly'), 700::numeric, 'Growth: KES 700');
SELECT is(private.circle_plan_list_price('pro', 35, 'annual'), 10000::numeric, 'Pro: KES 10,000 a year');
SELECT is(private.circle_plan_list_price('enterprise', 35, 'monthly'), 1000::numeric, 'Enterprise at 35 members: KES 1,000');
SELECT is(private.circle_plan_list_price('enterprise', 50, 'monthly'), 1450::numeric, 'at 50 members: + KES 30 each above 35');
SELECT is(private.circle_plan_list_price('enterprise', 50, 'quarterly'), 4133::numeric, 'a quarter is 3 months less 5%');
SELECT is(private.circle_plan_list_price('enterprise', 50, 'annual'), 14500::numeric, 'a year is 10 months');
SELECT is(private.circle_plan_list_price('enterprise', 400, 'monthly'), 5000::numeric, 'capped at KES 5,000 a month');
SELECT is((SELECT max_members FROM public.platform_plans WHERE id = 'free'), 5, 'Free is for up to 5 members');

-- ---------------------------------------------------------------------------
-- Buying a plan
-- ---------------------------------------------------------------------------
SELECT is(
  pg_temp.rpc('a0000000-0000-0000-0000-000000000034',
    $$SELECT public.set_circle_plan('b0000000-0000-0000-0000-000000000031', 'starter', 'annual')$$)->>'error',
  'FORBIDDEN', 'a member cannot buy a plan');
SELECT is(
  pg_temp.rpc('a0000000-0000-0000-0000-000000000031',
    $$SELECT public.set_circle_plan('b0000000-0000-0000-0000-000000000031', 'starter', 'weekly')$$)->>'error',
  'INVALID_PERIOD', 'only monthly, quarterly or annual');
SELECT is(
  pg_temp.rpc('a0000000-0000-0000-0000-000000000031',
    $$SELECT public.set_circle_plan('b0000000-0000-0000-0000-000000000031', 'starter', 'annual')$$)->>'charged',
  '4500', 'the officer pays for a year of Starter');
SELECT is(pg_temp.balance('a0000000-0000-0000-0000-000000000031'), 45500::numeric, 'from their wallet');
SELECT ok((pg_temp.sub('b0000000-0000-0000-0000-000000000031')).renews_at > NOW() + INTERVAL '364 days',
  'paid for a year');
SELECT is(
  pg_temp.rpc('a0000000-0000-0000-0000-000000000031',
    $$SELECT public.set_circle_plan('b0000000-0000-0000-0000-000000000031', 'growth', 'annual')$$)->>'credit',
  '4500', 'moving up straight away credits the unused part of the year');
SELECT is(pg_temp.balance('a0000000-0000-0000-0000-000000000031'), 43000::numeric, 'so only the difference is charged');
SELECT is(
  pg_temp.rpc('a0000000-0000-0000-0000-000000000031',
    $$SELECT public.set_circle_plan('b0000000-0000-0000-0000-000000000031', 'free')$$)->>'scheduled',
  'true', 'moving to Free waits for the end of the paid year');
SELECT is((pg_temp.sub('b0000000-0000-0000-0000-000000000031')).plan_id, 'growth', 'Growth stays on until then');
SELECT is((pg_temp.sub('b0000000-0000-0000-0000-000000000031')).auto_renew, false, 'and will not renew');

UPDATE public.jamiyas SET member_count = 12 WHERE id = 'b0000000-0000-0000-0000-000000000032';
SELECT is(
  pg_temp.rpc('a0000000-0000-0000-0000-000000000032',
    $$SELECT public.set_circle_plan('b0000000-0000-0000-0000-000000000032', 'starter')$$)->>'error',
  'MEMBER_LIMIT', 'a 12-member circle cannot take Starter');

-- ---------------------------------------------------------------------------
-- Free trial
-- ---------------------------------------------------------------------------
SELECT is(
  pg_temp.rpc('a0000000-0000-0000-0000-000000000032',
    $$SELECT public.circle_plan_quotes('b0000000-0000-0000-0000-000000000032')$$)->>'trial_available',
  'true', 'a new circle can try a plan for free');
SELECT is(
  pg_temp.rpc('a0000000-0000-0000-0000-000000000032',
    $$SELECT public.start_circle_plan_trial('b0000000-0000-0000-0000-000000000032', 'growth')$$)->>'price_after_trial',
  '700', 'the trial shows the price that would follow');
SELECT is((pg_temp.sub('b0000000-0000-0000-0000-000000000032')).status, 'trial', 'the circle is on a trial');
SELECT is(pg_temp.balance('a0000000-0000-0000-0000-000000000032'), 50000::numeric, 'nothing is charged');
SELECT is(
  pg_temp.rpc('a0000000-0000-0000-0000-000000000032',
    $$SELECT public.start_circle_plan_trial('b0000000-0000-0000-0000-000000000032', 'pro')$$)->>'error',
  'TRIAL_USED', 'one trial per circle');

UPDATE public.circle_subscriptions SET renews_at = NOW() + INTERVAL '2 days', trial_ends_at = NOW() + INTERVAL '2 days'
WHERE jamiya_id = 'b0000000-0000-0000-0000-000000000032';
SELECT is(pg_temp.renew()->>'reminded', '1', 'officers are reminded before the trial ends');
SELECT ok(EXISTS (SELECT 1 FROM public.notifications
  WHERE user_id = 'a0000000-0000-0000-0000-000000000032' AND title = 'Free trial ending soon'), 'with a notice');
SELECT is(pg_temp.renew()->>'reminded', '0', 'only once');

UPDATE public.circle_subscriptions SET renews_at = NOW() - INTERVAL '1 minute'
WHERE jamiya_id = 'b0000000-0000-0000-0000-000000000032';
SELECT is(pg_temp.renew()->>'trials_ended', '1', 'a trial without auto-pay ends');
SELECT is((pg_temp.sub('b0000000-0000-0000-0000-000000000032')).plan_id, 'free', 'the circle is back on Free');
SELECT is(pg_temp.balance('a0000000-0000-0000-0000-000000000032'), 50000::numeric, 'still nothing charged');

-- A trial with auto-pay on turns into a paid plan.
SELECT is(
  pg_temp.rpc('a0000000-0000-0000-0000-000000000033',
    $$SELECT public.start_circle_plan_trial('b0000000-0000-0000-0000-000000000033', 'starter', 'quarterly')$$)->>'ok',
  'true', 'another circle starts a quarterly trial');
SELECT is(
  pg_temp.rpc('a0000000-0000-0000-0000-000000000033',
    $$SELECT public.set_circle_plan_auto_renew('b0000000-0000-0000-0000-000000000033', true)$$)->>'ok',
  'true', 'and its officer turns auto-pay on');
UPDATE public.circle_subscriptions SET renews_at = NOW() - INTERVAL '1 minute'
WHERE jamiya_id = 'b0000000-0000-0000-0000-000000000033';
SELECT is(pg_temp.renew()->>'renewed', '1', 'when the trial ends the plan is paid');
SELECT is(pg_temp.balance('a0000000-0000-0000-0000-000000000033'), 48700::numeric, 'KES 1,300 for the quarter');

-- ---------------------------------------------------------------------------
-- Renewals follow the circle's size
-- ---------------------------------------------------------------------------
UPDATE public.jamiyas SET member_count = 15 WHERE id = 'b0000000-0000-0000-0000-000000000033';
UPDATE public.circle_subscriptions SET renews_at = NOW() - INTERVAL '1 minute'
WHERE jamiya_id = 'b0000000-0000-0000-0000-000000000033';
SELECT is(pg_temp.renew()->>'renewed', '1', 'a circle that outgrew Starter still renews');
SELECT is((pg_temp.sub('b0000000-0000-0000-0000-000000000033')).plan_id, 'growth', 'on Growth, the smallest plan that fits');
SELECT is(pg_temp.balance('a0000000-0000-0000-0000-000000000033'), 46700::numeric, 'at the Growth quarterly price');

-- ---------------------------------------------------------------------------
-- Grace period
-- ---------------------------------------------------------------------------
UPDATE public.wallets SET balance = 0, available_balance = 0
WHERE user_id = 'a0000000-0000-0000-0000-000000000033' AND currency = 'KES';
UPDATE public.circle_subscriptions SET renews_at = NOW() - INTERVAL '3 minutes'
WHERE jamiya_id = 'b0000000-0000-0000-0000-000000000033';
SELECT is(pg_temp.renew()->>'past_due', '1', 'an empty wallet leaves the plan past due');
UPDATE public.circle_subscriptions SET renews_at = NOW() - INTERVAL '8 days'
WHERE jamiya_id = 'b0000000-0000-0000-0000-000000000033';
SELECT is(pg_temp.renew()->>'ended', '1', 'after 7 days unpaid the plan ends');
SELECT is(
  pg_temp.rpc('a0000000-0000-0000-0000-000000000033',
    $$SELECT public.get_circle_plan('b0000000-0000-0000-0000-000000000033')$$)->>'plan_id',
  'free', 'and the circle reads as Free');

-- ---------------------------------------------------------------------------
-- Launch discount on the first year
-- ---------------------------------------------------------------------------
INSERT INTO public.platform_settings (key, value)
VALUES ('circle_plan_launch_discount', jsonb_build_object('pct', 20, 'until', (CURRENT_DATE + 30)::text))
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;
SELECT is(
  pg_temp.rpc('a0000000-0000-0000-0000-000000000032',
    $$SELECT public.set_circle_plan('b0000000-0000-0000-0000-000000000032', 'growth', 'annual')$$)->>'charged',
  '5600', 'the first year is 20% off when the launch discount is on');
SELECT is((private.circle_plan_charge('b0000000-0000-0000-0000-000000000032', 'growth', 'annual'))->>'price',
  '7000', 'but only once');

-- Tawarruq rates
SELECT is((SELECT value FROM public.platform_settings WHERE key = 'tawarruq_profit_bps'),
  '{"3": 350, "6": 650, "12": 1200, "24": 2200}'::jsonb, 'Tawarruq uses the final per-term rates');

SELECT * FROM finish();
ROLLBACK;
