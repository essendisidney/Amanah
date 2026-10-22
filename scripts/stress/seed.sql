-- Stress-test fixtures. Loaded into the throwaway test database (scripts/test-db.mjs --keep),
-- never into production: it commits users, wallets and money.
--
--   users  a1000000-…-000000000001 … 000000000300   each topped up 10,000 KES through M-Pesa
--   circle b1000000-…-000000000001   rotating, open (slots claimable), 300 members, 1,000 a cycle
--   contributions: 3 cycles a member;  welfare fund;  a 1,000 qard loan for user 4
--   intents for user 2: 20 created-but-unpaid top-ups of 500 (the webhook-replay race)
SET client_min_messages = warning;
BEGIN;

DROP SCHEMA IF EXISTS stress CASCADE;
CREATE SCHEMA stress;

CREATE TABLE stress.results (
  id BIGSERIAL PRIMARY KEY,
  scenario TEXT NOT NULL,
  outcome TEXT NOT NULL,
  ms NUMERIC NOT NULL,
  at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);

CREATE FUNCTION stress.uid(n INT) RETURNS UUID LANGUAGE sql IMMUTABLE AS $$
  SELECT ('a1000000-0000-0000-0000-' || lpad(n::text, 12, '0'))::uuid
$$;

-- Run one RPC as a signed-in member (p_uid) or as the service role (p_uid NULL), the way
-- PostgREST does, and record how it went. Errors are recorded instead of aborting the client.
CREATE FUNCTION stress.call(p_scenario TEXT, p_uid UUID, p_sql TEXT)
RETURNS VOID LANGUAGE plpgsql AS $$
DECLARE
  r JSONB;
  v_out TEXT;
  t0 TIMESTAMPTZ := clock_timestamp();
BEGIN
  BEGIN
    IF p_uid IS NULL THEN
      PERFORM set_config('request.jwt.claims', '{"role":"service_role"}', true);
      SET LOCAL ROLE service_role;
    ELSE
      PERFORM set_config('request.jwt.claims',
        json_build_object('role', 'authenticated', 'sub', p_uid)::text, true);
      SET LOCAL ROLE authenticated;
    END IF;
    EXECUTE p_sql INTO r;
    v_out := CASE
      WHEN r IS NULL THEN 'ok'
      WHEN jsonb_typeof(r) = 'object' AND r ? 'error' AND r->>'error' IS NOT NULL THEN 'err:' || (r->>'error')
      WHEN jsonb_typeof(r) = 'object' AND (r->>'ok') = 'false' THEN 'err:?'
      ELSE 'ok' END;
  EXCEPTION WHEN OTHERS THEN
    v_out := 'exc:' || SQLSTATE || ':' || left(SQLERRM, 70);
  END;
  RESET ROLE;
  INSERT INTO stress.results (scenario, outcome, ms)
  VALUES (p_scenario, v_out, round(extract(epoch FROM clock_timestamp() - t0)::numeric * 1000, 2));
END;
$$;

-- A top-up the normal way: the app creates the intent, the M-Pesa webhook completes it.
CREATE FUNCTION stress.top_up(p_scenario TEXT, p_user UUID, p_amount NUMERIC)
RETURNS VOID LANGUAGE plpgsql AS $$
DECLARE v_id UUID;
BEGIN
  INSERT INTO public.payment_intents (user_id, provider, amount, currency, metadata)
  VALUES (p_user, 'mpesa', p_amount, 'KES', '{}') RETURNING id INTO v_id;
  PERFORM stress.call(p_scenario, NULL,
    format('SELECT public.complete_payment_intent(%L, %L)', v_id, 'stress-' || v_id));
END;
$$;

-- ---------------------------------------------------------------------------
-- People and money
-- ---------------------------------------------------------------------------
INSERT INTO auth.users (id, email, raw_user_meta_data)
SELECT stress.uid(n), 'stress' || n || '@test.local',
       json_build_object('full_name', 'Stress ' || n, 'phone', '+2547' || lpad(n::text, 8, '0'))
FROM generate_series(1, 300) n;

SELECT count(*) FROM (SELECT stress.top_up('seed', stress.uid(n), 10000) FROM generate_series(1, 300) n) t;

-- ---------------------------------------------------------------------------
-- A rotating circle everyone belongs to
-- ---------------------------------------------------------------------------
INSERT INTO public.jamiyas (id, name, slug, created_by, contribution_amount, max_members, status)
VALUES ('b1000000-0000-0000-0000-000000000001', 'Stress Circle', 'stress-circle',
        stress.uid(1), 1000, 300, 'open');

-- Creating the circle already made user 1 a member; add the other 299 and give every member a
-- predictable id: c1000000-…-<member n>.
INSERT INTO public.members (id, jamiya_id, user_id, role, status)
SELECT ('c1000000-0000-0000-0000-' || lpad(n::text, 12, '0'))::uuid,
       'b1000000-0000-0000-0000-000000000001', stress.uid(n), 'member', 'active'
FROM generate_series(2, 300) n;
UPDATE public.members SET id = 'c1000000-0000-0000-0000-000000000001', role = 'circle_admin', status = 'active'
WHERE jamiya_id = 'b1000000-0000-0000-0000-000000000001' AND user_id = stress.uid(1);

INSERT INTO public.member_consents (user_id, jamiya_id, kind, version, terms)
SELECT m.user_id, j.id, 'circle_terms', j.terms_version, private.circle_terms(j)
FROM public.members m JOIN public.jamiyas j ON j.id = m.jamiya_id
WHERE j.id = 'b1000000-0000-0000-0000-000000000001';

-- Contribution ids: d1000000-0000-0000-<cycle 4 digits>-<member 12 digits>
INSERT INTO public.contributions (id, jamiya_id, member_id, cycle_number, amount, currency, due_date)
SELECT ('d1000000-0000-0000-' || lpad(c::text, 4, '0') || '-' || lpad(n::text, 12, '0'))::uuid,
       'b1000000-0000-0000-0000-000000000001',
       ('c1000000-0000-0000-0000-' || lpad(n::text, 12, '0'))::uuid,
       c, 1000, 'KES', CURRENT_DATE
FROM generate_series(1, 300) n, generate_series(1, 3) c;

INSERT INTO public.welfare_funds (jamiya_id) VALUES ('b1000000-0000-0000-0000-000000000001');

INSERT INTO public.qard_loans (id, jamiya_id, borrower_id, amount, purpose, status)
VALUES ('f1000000-0000-0000-0000-000000000001', 'b1000000-0000-0000-0000-000000000001',
        stress.uid(4), 1000, 'stress test', 'active');

-- Twenty unpaid 500 top-ups for user 2; the webhook-replay scenario completes them many times.
INSERT INTO public.payment_intents (id, user_id, provider, amount, currency, metadata)
SELECT ('e1000000-0000-0000-0000-' || lpad(n::text, 12, '0'))::uuid, stress.uid(2), 'mpesa', 500, 'KES', '{}'
FROM generate_series(1, 20) n;

DELETE FROM stress.results;
COMMIT;
SET client_min_messages = error;
ANALYZE public.wallets, public.transactions, public.contributions, public.members, public.withdrawal_requests, public.payment_intents;
