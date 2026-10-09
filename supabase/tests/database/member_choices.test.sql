-- pgTAP: members opt in and out of optional things (notifications, sponsorships, circle plan
-- auto-renew), and every choice is recorded.
-- Run with scripts/test-db.mjs (or `supabase test db`). Everything rolls back.
BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SET LOCAL search_path = public, extensions;

SELECT plan(33);

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

CREATE FUNCTION pg_temp.outbox(p_uid UUID, p_channel TEXT)
RETURNS BIGINT LANGUAGE sql AS $$
  SELECT count(*) FROM public.notification_outbox
  WHERE user_id = p_uid AND channel = p_channel::public.notification_channel
$$;

-- Officer (…20), member (…21), outsider (…22).
INSERT INTO auth.users (id, email, raw_user_meta_data)
SELECT ('a0000000-0000-0000-0000-0000000000' || n)::uuid, 'u' || n || '@test.local',
       json_build_object('full_name', 'User ' || n, 'phone', '+2547000000' || n)::jsonb
FROM generate_series(20, 22) n;

INSERT INTO public.jamiyas (id, name, slug, created_by, contribution_amount, max_members)
VALUES ('b0000000-0000-0000-0000-000000000002', 'Choice Circle', 'choice-circle',
        'a0000000-0000-0000-0000-000000000020', 1000, 8);
INSERT INTO public.members (id, jamiya_id, user_id, role, status, payout_position)
VALUES ('c0000000-0000-0000-0000-000000000021', 'b0000000-0000-0000-0000-000000000002',
        'a0000000-0000-0000-0000-000000000021', 'member', 'active', 2);

-- ---------------------------------------------------------------------------
-- Notification preferences
-- ---------------------------------------------------------------------------
SELECT pg_temp.service($$SELECT public.enqueue_user_reminder('a0000000-0000-0000-0000-000000000021',
  'contribution_due', 'Due', 'Pay soon', 'contrib:x:1', '{"contribution_id":"00000000-0000-0000-0000-000000000001"}')$$);
SELECT is(pg_temp.outbox('a0000000-0000-0000-0000-000000000021', 'sms'), 1::bigint,
  'reminders go by SMS by default');

SELECT is(
  pg_temp.rpc('a0000000-0000-0000-0000-000000000021',
    $$SELECT public.set_notification_preference('reminders', 'sms', false)$$)->>'ok',
  'true', 'the member turns off SMS reminders');
SELECT is(
  pg_temp.rpc('a0000000-0000-0000-0000-000000000021',
    $$SELECT public.set_notification_preference('receipts', 'sms', false)$$)->>'error',
  'INVALID_CHOICE', 'essential messages cannot be turned off');
SELECT is(
  pg_temp.rpc('a0000000-0000-0000-0000-000000000021',
    $$SELECT public.set_notification_preference('reminders', 'in_app', false)$$)->>'error',
  'INVALID_CHOICE', 'nor can the in-app inbox');

SELECT pg_temp.service($$SELECT public.enqueue_user_reminder('a0000000-0000-0000-0000-000000000021',
  'contribution_due', 'Due', 'Pay soon', 'contrib:x:2', '{"contribution_id":"00000000-0000-0000-0000-000000000001"}')$$);
SELECT is(pg_temp.outbox('a0000000-0000-0000-0000-000000000021', 'sms'), 1::bigint,
  'no new SMS reminder after opting out');
SELECT is(pg_temp.outbox('a0000000-0000-0000-0000-000000000021', 'whatsapp'), 2::bigint,
  'WhatsApp reminders still go');
SELECT is((SELECT count(*) FROM public.notifications
           WHERE user_id = 'a0000000-0000-0000-0000-000000000021' AND type = 'contribution_due'),
  2::bigint, 'and every reminder still lands in the in-app inbox');

SELECT pg_temp.service($$SELECT public.enqueue_user_reminder('a0000000-0000-0000-0000-000000000021',
  'payout_scheduled', 'Payout', 'Tomorrow', 'payout:x:1', '{"payout_id":"00000000-0000-0000-0000-000000000002"}')$$);
SELECT is(pg_temp.outbox('a0000000-0000-0000-0000-000000000021', 'sms'), 2::bigint,
  'payout heads-ups are a separate choice and still go by SMS');

INSERT INTO public.notification_outbox (user_id, channel, recipient, body, metadata)
VALUES ('a0000000-0000-0000-0000-000000000021', 'sms', '+254700000021', 'Overdue',
        '{"collection_case_id":"00000000-0000-0000-0000-000000000003"}');
INSERT INTO public.notification_outbox (user_id, channel, recipient, body, metadata)
VALUES ('a0000000-0000-0000-0000-000000000021', 'sms', '+254700000021', 'Receipt', '{"kind":"receipt"}');
SELECT is(pg_temp.outbox('a0000000-0000-0000-0000-000000000021', 'sms'), 4::bigint,
  'collections notices and receipts are always sent');

SELECT is(
  pg_temp.rpc('a0000000-0000-0000-0000-000000000021',
    $$SELECT public.set_notification_preference('reminders', 'sms', false)$$)->>'unchanged',
  'true', 'choosing the same again changes nothing');
SELECT is(
  pg_temp.rpc('a0000000-0000-0000-0000-000000000021',
    $$SELECT public.set_notification_preference('reminders', 'sms', true)$$)->>'ok',
  'true', 'the member turns SMS reminders back on');
SELECT pg_temp.service($$SELECT public.enqueue_user_reminder('a0000000-0000-0000-0000-000000000021',
  'contribution_due', 'Due', 'Pay soon', 'contrib:x:3', '{"contribution_id":"00000000-0000-0000-0000-000000000001"}')$$);
SELECT is(pg_temp.outbox('a0000000-0000-0000-0000-000000000021', 'sms'), 5::bigint,
  'and they arrive again');

SELECT throws_ok(
  $$ SELECT pg_temp.rpc('a0000000-0000-0000-0000-000000000021',
       'INSERT INTO public.notification_preferences (user_id, category, channel, enabled)
        VALUES (''a0000000-0000-0000-0000-000000000022'', ''reminders'', ''sms'', false)
        RETURNING to_jsonb(user_id)') $$,
  '42501', NULL, 'preferences change only through the RPC');

-- ---------------------------------------------------------------------------
-- Sponsorships
-- ---------------------------------------------------------------------------
INSERT INTO public.sadaka_institutions (id, name, type, contact_person)
VALUES ('f1000000-0000-0000-0000-000000000002', 'Choice Orphanage', 'orphanage', 'Contact');
INSERT INTO public.adoption_profiles (id, institution_id, slug, title, description, suggested_monthly_amount)
VALUES ('f2000000-0000-0000-0000-000000000002', 'f1000000-0000-0000-0000-000000000002',
        'choice-child', 'Amina', 'Profile', 1500);
INSERT INTO public.sponsorships (id, adoption_profile_id, sponsor_user_id, monthly_amount, next_charge_date)
VALUES ('f3000000-0000-0000-0000-000000000002', 'f2000000-0000-0000-0000-000000000002',
        'a0000000-0000-0000-0000-000000000021', 1500, CURRENT_DATE - 40);

SELECT is(
  pg_temp.rpc('a0000000-0000-0000-0000-000000000022',
    $$SELECT public.set_sponsorship_status('f3000000-0000-0000-0000-000000000002', 'paused')$$)->>'error',
  'NOT_FOUND', 'someone else cannot pause my sponsorship');
SELECT is(
  pg_temp.rpc('a0000000-0000-0000-0000-000000000021',
    $$SELECT public.set_sponsorship_status('f3000000-0000-0000-0000-000000000002', 'paused')$$)->>'ok',
  'true', 'the sponsor pauses it');
SELECT is(pg_temp.service('SELECT public.queue_due_sponsorship_charges(50)')->>'queued', '0',
  'a paused sponsorship is not charged');
SELECT is(
  pg_temp.rpc('a0000000-0000-0000-0000-000000000021',
    $$SELECT public.set_sponsorship_status('f3000000-0000-0000-0000-000000000002', 'active')$$)->>'ok',
  'true', 'and resumes it');
SELECT is((SELECT next_charge_date FROM public.sponsorships WHERE id = 'f3000000-0000-0000-0000-000000000002'),
  CURRENT_DATE, 'resuming does not back-charge the paused time');
SELECT is(
  pg_temp.rpc('a0000000-0000-0000-0000-000000000021',
    $$SELECT public.set_sponsorship_status('f3000000-0000-0000-0000-000000000002', 'cancelled')$$)->>'ok',
  'true', 'then stops it');
SELECT is(
  pg_temp.rpc('a0000000-0000-0000-0000-000000000021',
    $$SELECT public.set_sponsorship_status('f3000000-0000-0000-0000-000000000002', 'active')$$)->>'error',
  'SPONSORSHIP_ENDED', 'a stopped sponsorship cannot be restarted');

-- ---------------------------------------------------------------------------
-- Circle plan auto-renew
-- ---------------------------------------------------------------------------
SELECT private.ledger_credit('a0000000-0000-0000-0000-000000000020', 'KES', 5000, 'payout', NULL,
  'fixture-plan', NULL, '{}'::jsonb);
SELECT is(
  pg_temp.rpc('a0000000-0000-0000-0000-000000000020',
    $$SELECT public.set_circle_plan('b0000000-0000-0000-0000-000000000002', 'starter')$$)->>'ok',
  'true', 'the officer buys the Starter plan');
SELECT is(
  pg_temp.rpc('a0000000-0000-0000-0000-000000000021',
    $$SELECT public.set_circle_plan_auto_renew('b0000000-0000-0000-0000-000000000002', false)$$)->>'error',
  'FORBIDDEN', 'a member cannot change auto-renew');
SELECT is(
  pg_temp.rpc('a0000000-0000-0000-0000-000000000020',
    $$SELECT public.set_circle_plan_auto_renew('b0000000-0000-0000-0000-000000000002', false)$$)->>'ok',
  'true', 'the officer turns auto-renew off');
SELECT is(
  pg_temp.rpc('a0000000-0000-0000-0000-000000000020',
    $$SELECT public.get_circle_plan('b0000000-0000-0000-0000-000000000002')$$)->>'auto_renew',
  'false', 'get_circle_plan shows it');

UPDATE public.circle_subscriptions SET renews_at = NOW() - INTERVAL '1 minute'
WHERE jamiya_id = 'b0000000-0000-0000-0000-000000000002';
SELECT is(pg_temp.service('SELECT public.process_circle_subscription_renewals()')->>'ended', '1',
  'at the end of the period the plan ends');
SELECT is((SELECT status FROM public.circle_subscriptions WHERE jamiya_id = 'b0000000-0000-0000-0000-000000000002'),
  'cancelled', 'and is cancelled');
SELECT is((SELECT balance FROM public.wallets WHERE user_id = 'a0000000-0000-0000-0000-000000000020' AND currency = 'KES'),
  4000::numeric, 'without charging the officer again');

-- ---------------------------------------------------------------------------
-- My choices
-- ---------------------------------------------------------------------------
SELECT is(
  jsonb_array_length(pg_temp.rpc('a0000000-0000-0000-0000-000000000021', 'SELECT public.get_my_choices()')->'notifications'),
  8, 'two categories by four channels');
SELECT is(
  (SELECT count(*) FROM jsonb_array_elements(
     pg_temp.rpc('a0000000-0000-0000-0000-000000000021', 'SELECT public.get_my_choices()')->'notifications') x
   WHERE NOT (x->>'enabled')::boolean),
  0::bigint, 'everything is on again after re-opting in');
SELECT is(
  pg_temp.rpc('a0000000-0000-0000-0000-000000000021', 'SELECT public.get_my_choices()')->'sponsorships'->0->>'status',
  'cancelled', 'the sponsorship shows as stopped');
SELECT is(
  pg_temp.rpc('a0000000-0000-0000-0000-000000000021', 'SELECT public.get_my_choices()')->'circle_terms'->0->>'name',
  'Choice Circle', 'the member''s circles are listed with their terms');
SELECT is(
  (SELECT array_agg(x->>'choice' ORDER BY x->>'choice') FROM jsonb_array_elements(
     pg_temp.rpc('a0000000-0000-0000-0000-000000000021', 'SELECT public.get_my_choices()')->'history') x),
  ARRAY['opted_in', 'opted_out', 'paused', 'resumed', 'stopped'],
  'every choice, both ways, is in the history');
SELECT is(
  pg_temp.rpc('a0000000-0000-0000-0000-000000000020', 'SELECT public.get_my_choices()')->'history'->0->>'choice',
  'auto_renew_off', 'the officer''s auto-renew choice is in their history');

SELECT * FROM finish();
ROLLBACK;
