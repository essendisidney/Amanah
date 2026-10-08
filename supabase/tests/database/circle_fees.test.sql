-- pgTAP: circle transaction fees are charged or recorded as owed, never skipped.
-- Run with scripts/test-db.mjs (or `supabase test db`). Everything rolls back.
BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SET LOCAL search_path = public, extensions;

SELECT plan(43);

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------
-- As the payment webhook (service role).
CREATE FUNCTION pg_temp.complete(p_intent UUID)
RETURNS JSONB LANGUAGE plpgsql AS $$
DECLARE r JSONB;
BEGIN
  PERFORM set_config('request.jwt.claims', '{"role":"service_role"}', true);
  SET LOCAL ROLE service_role;
  r := public.complete_payment_intent(p_intent);
  RESET ROLE;
  RETURN r;
END;
$$;

-- As the payer (the role the web app and mobile API use).
CREATE FUNCTION pg_temp.as_payer() RETURNS VOID LANGUAGE sql AS $$
  SELECT set_config('request.jwt.claims',
    '{"role":"authenticated","sub":"a0000000-0000-0000-0000-000000000001"}', true)
$$;

CREATE FUNCTION pg_temp.pay(p_contribution UUID)
RETURNS JSONB LANGUAGE plpgsql AS $$
DECLARE r JSONB;
BEGIN
  PERFORM pg_temp.as_payer();
  SET LOCAL ROLE authenticated;
  r := public.pay_contribution(p_contribution);
  RESET ROLE;
  RETURN r;
END;
$$;

CREATE FUNCTION pg_temp.web_fee(p_contribution UUID)
RETURNS JSONB LANGUAGE plpgsql AS $$
DECLARE r JSONB;
BEGIN
  PERFORM pg_temp.as_payer();
  SET LOCAL ROLE authenticated;
  r := public.charge_contribution_fee(p_contribution);
  RESET ROLE;
  RETURN r;
END;
$$;

CREATE FUNCTION pg_temp.withdraw(p_amount NUMERIC)
RETURNS JSONB LANGUAGE plpgsql AS $$
DECLARE r JSONB;
BEGIN
  PERFORM pg_temp.as_payer();
  SET LOCAL ROLE authenticated;
  r := public.request_withdrawal(p_amount, 'KES', 'mpesa', NULL, NULL, NULL, NULL);
  RESET ROLE;
  RETURN r;
END;
$$;

-- A wallet top-up through the normal M-Pesa path.
CREATE FUNCTION pg_temp.top_up(p_amount NUMERIC)
RETURNS JSONB LANGUAGE plpgsql AS $$
DECLARE v_id UUID;
BEGIN
  INSERT INTO public.payment_intents (user_id, provider, amount, currency, metadata)
  VALUES ('a0000000-0000-0000-0000-000000000001', 'mpesa', p_amount, 'KES', '{}')
  RETURNING id INTO v_id;
  RETURN pg_temp.complete(v_id);
END;
$$;

-- Money arriving by another route (e.g. a payout), which does not collect fees itself.
CREATE FUNCTION pg_temp.credit(p_amount NUMERIC)
RETURNS VOID LANGUAGE sql AS $$
  SELECT private.ledger_credit('a0000000-0000-0000-0000-000000000001', 'KES', p_amount,
    'payout', NULL, 'test-credit:' || gen_random_uuid(), NULL, '{}'::jsonb)
$$;

CREATE FUNCTION pg_temp.wallet()
RETURNS NUMERIC LANGUAGE sql AS $$
  SELECT coalesce((SELECT balance FROM public.wallets
    WHERE user_id = 'a0000000-0000-0000-0000-000000000001' AND currency = 'KES'), 0)
$$;

CREATE FUNCTION pg_temp.fee_debits(p_contribution UUID)
RETURNS BIGINT LANGUAGE sql AS $$
  SELECT count(*) FROM public.transactions
  WHERE reference = 'contrib_fee:' || p_contribution::text AND type = 'fee' AND status = 'completed'
$$;

CREATE FUNCTION pg_temp.owed(p_contribution UUID)
RETURNS TEXT LANGUAGE sql AS $$
  SELECT status || ' ' || amount::text FROM public.fees_owed WHERE contribution_id = p_contribution
$$;

-- ---------------------------------------------------------------------------
-- Fixtures: a circle with a 50 fee per fully paid contribution
-- ---------------------------------------------------------------------------
INSERT INTO auth.users (id, email, raw_user_meta_data) VALUES
  ('a0000000-0000-0000-0000-000000000001', 'payer@test.local', '{"full_name":"Payer","phone":"+254700000001"}'),
  ('a0000000-0000-0000-0000-000000000002', 'admin@test.local', '{"full_name":"Circle Admin"}');

INSERT INTO public.jamiyas (id, name, slug, created_by, contribution_amount, max_members, transaction_fee_amount)
VALUES ('b0000000-0000-0000-0000-000000000001', 'Fee Circle', 'fee-test-circle',
        'a0000000-0000-0000-0000-000000000002', 1000, 10, 50);
INSERT INTO public.members (id, jamiya_id, user_id, role, status)
VALUES ('c0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001',
        'a0000000-0000-0000-0000-000000000001', 'member', 'active');

-- Members accepted their circle's terms; fees are only charged after that
-- (circle_terms_consent.test.sql covers members who have not).
INSERT INTO public.member_consents (user_id, jamiya_id, kind, version, terms)
SELECT m.user_id, j.id, 'circle_terms', j.terms_version, private.circle_terms(j)
FROM public.members m JOIN public.jamiyas j ON j.id = m.jamiya_id
WHERE m.status = 'active';
INSERT INTO public.contributions (id, jamiya_id, member_id, cycle_number, amount, currency, due_date)
SELECT ('d0000000-0000-0000-0000-00000000000' || n)::uuid, 'b0000000-0000-0000-0000-000000000001',
       'c0000000-0000-0000-0000-000000000001', n, 1000, 'KES', CURRENT_DATE
FROM generate_series(1, 6) n;

INSERT INTO public.payment_intents (id, user_id, provider, amount, currency, metadata) VALUES
  ('e0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'mpesa', 1000, 'KES',
   '{"kind":"contribution","contribution_id":"d0000000-0000-0000-0000-000000000001"}'),
  ('e0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000001', 'mpesa', 1050, 'KES',
   '{"kind":"contribution","contribution_id":"d0000000-0000-0000-0000-000000000002"}'),
  ('e0000000-0000-0000-0000-000000000005', 'a0000000-0000-0000-0000-000000000001', 'mpesa', 1000, 'KES',
   '{"kind":"contribution","contribution_id":"d0000000-0000-0000-0000-000000000005"}');

-- ---------------------------------------------------------------------------
-- M-Pesa contribution with an empty wallet: fee recorded as owed (was silently skipped)
-- ---------------------------------------------------------------------------
SELECT is(pg_temp.complete('e0000000-0000-0000-0000-000000000001')->>'status', 'paid',
  'M-Pesa: contribution paid');
SELECT is(pg_temp.fee_debits('d0000000-0000-0000-0000-000000000001'), 0::bigint,
  'M-Pesa, empty wallet: no fee debit');
SELECT is(pg_temp.owed('d0000000-0000-0000-0000-000000000001'), 'owed 50.00',
  'M-Pesa, empty wallet: 50 fee recorded as owed');
SELECT is(pg_temp.wallet(), 0.00, 'M-Pesa, empty wallet: wallet untouched');
SELECT is(
  (SELECT count(*) FROM public.notifications
   WHERE user_id = 'a0000000-0000-0000-0000-000000000001' AND title = 'Circle fee owed'
     AND data->>'contribution_id' = 'd0000000-0000-0000-0000-000000000001'),
  1::bigint,
  'member told the fee is owed'
);
SELECT is(pg_temp.complete('e0000000-0000-0000-0000-000000000001')->>'already_completed', 'true',
  'replayed webhook: no-op');
SELECT is((SELECT count(*) FROM public.fees_owed), 1::bigint, 'replayed webhook: still one owed fee');

-- ---------------------------------------------------------------------------
-- Collected from the next deposit that covers it
-- ---------------------------------------------------------------------------
SELECT is(pg_temp.top_up(30)->>'ok', 'true', 'top-up of 30');
SELECT is(pg_temp.owed('d0000000-0000-0000-0000-000000000001'), 'owed 50.00',
  '30 does not cover the fee: still owed');
SELECT is(pg_temp.wallet(), 30.00, 'nothing taken from 30');

SELECT is(pg_temp.top_up(100)->>'ok', 'true', 'top-up of 100');
SELECT is(pg_temp.owed('d0000000-0000-0000-0000-000000000001'), 'collected 50.00',
  'fee collected from the next deposit that covers it');
SELECT is(pg_temp.wallet(), 80.00, '130 in, 50 fee out');
SELECT is(pg_temp.fee_debits('d0000000-0000-0000-0000-000000000001'), 1::bigint,
  'exactly one fee debit');
SELECT is(
  (SELECT transaction_id FROM public.fees_owed WHERE contribution_id = 'd0000000-0000-0000-0000-000000000001'),
  (SELECT id FROM public.transactions WHERE reference = 'contrib_fee:d0000000-0000-0000-0000-000000000001'),
  'owed row linked to the fee transaction'
);
SELECT is(
  (SELECT count(*) FROM public.journal_entries
   WHERE source_type = 'fee_transaction' AND source_id = (
     SELECT id::text FROM public.transactions
     WHERE reference = 'contrib_fee:d0000000-0000-0000-0000-000000000001')),
  1::bigint,
  'collected fee booked as income'
);
SELECT is(pg_temp.top_up(100)->>'ok', 'true', 'another top-up');
SELECT is(pg_temp.fee_debits('d0000000-0000-0000-0000-000000000001'), 1::bigint,
  'a collected fee is not taken again');
SELECT is(pg_temp.wallet(), 180.00, 'wallet +100');

-- ---------------------------------------------------------------------------
-- When the wallet covers it, the fee is charged straight away
-- ---------------------------------------------------------------------------
SELECT is(pg_temp.complete('e0000000-0000-0000-0000-000000000002')->>'status', 'paid',
  'M-Pesa 1050 for a 1000 contribution');
SELECT is(pg_temp.fee_debits('d0000000-0000-0000-0000-000000000002'), 1::bigint, 'fee charged at once');
SELECT is(pg_temp.owed('d0000000-0000-0000-0000-000000000002'), NULL, 'nothing owed');
SELECT is(pg_temp.wallet(), 180.00, '1050 in, 1000 contribution, 50 fee');

-- ---------------------------------------------------------------------------
-- Wallet payments (mobile API / pay_contribution): fee now charged
-- ---------------------------------------------------------------------------
SELECT is(pg_temp.top_up(870)->>'ok', 'true', 'top-up to 1050');
SELECT is(pg_temp.pay('d0000000-0000-0000-0000-000000000003')->>'status', 'paid',
  'wallet payment: contribution paid');
SELECT is(pg_temp.fee_debits('d0000000-0000-0000-0000-000000000003'), 1::bigint,
  'wallet payment: fee charged without a separate call');
SELECT is(pg_temp.wallet(), 0.00, 'wallet payment: 1050 - 1000 - 50');
SELECT is(pg_temp.web_fee('d0000000-0000-0000-0000-000000000003')->>'already', 'true',
  'web app''s follow-up fee call: already charged');
SELECT is(pg_temp.fee_debits('d0000000-0000-0000-0000-000000000003'), 1::bigint,
  'web app''s follow-up fee call: no second charge');

SELECT is(pg_temp.web_fee('d0000000-0000-0000-0000-000000000004')->>'fee_status', 'not_due',
  'fee call on an unpaid contribution: not due');
SELECT is(pg_temp.owed('d0000000-0000-0000-0000-000000000004'), NULL,
  'fee call on an unpaid contribution: nothing recorded');

-- Wallet covers the contribution but not the fee.
SELECT pg_temp.credit(1000);
SELECT is(pg_temp.pay('d0000000-0000-0000-0000-000000000004')->>'status', 'paid',
  'wallet payment with exactly 1000: paid');
SELECT is(pg_temp.owed('d0000000-0000-0000-0000-000000000004'), 'owed 50.00',
  'wallet payment with exactly 1000: fee owed');
SELECT is(pg_temp.wallet(), 0.00, 'wallet payment with exactly 1000: wallet at 0');

-- ---------------------------------------------------------------------------
-- Owed fees come out before a withdrawal
-- ---------------------------------------------------------------------------
SELECT pg_temp.credit(500);
SELECT is(
  pg_temp.withdraw(500)->>'error',
  'INSUFFICIENT_FUNDS',
  'withdrawing the full 500 is refused: 50 of it is owed in fees'
);
SELECT is(pg_temp.owed('d0000000-0000-0000-0000-000000000004'), 'collected 50.00',
  'owed fee collected when the withdrawal was requested');
SELECT is(pg_temp.wallet(), 450.00, 'wallet 500 - 50 fee');
SELECT is(pg_temp.withdraw(450)->>'ok', 'true', 'withdrawing the rest works');

-- ---------------------------------------------------------------------------
-- Money held for a pending withdrawal is not used for fees
-- ---------------------------------------------------------------------------
SELECT is(pg_temp.complete('e0000000-0000-0000-0000-000000000005')->>'status', 'paid',
  'M-Pesa contribution while 450 is held for a withdrawal');
SELECT is(pg_temp.owed('d0000000-0000-0000-0000-000000000005'), 'owed 50.00',
  'fee owed rather than taken from the held 450');
SELECT is(pg_temp.wallet(), 450.00, 'held money untouched');

-- ---------------------------------------------------------------------------
-- Every fully paid contribution in the fee circle has its fee charged or owed
-- ---------------------------------------------------------------------------
SELECT is(
  (SELECT count(*) FROM public.contributions c
   WHERE c.jamiya_id = 'b0000000-0000-0000-0000-000000000001' AND c.status = 'paid'
     AND pg_temp.fee_debits(c.id) = 0
     AND NOT EXISTS (SELECT 1 FROM public.fees_owed f WHERE f.contribution_id = c.id AND f.status = 'owed')),
  0::bigint,
  'no paid contribution without its fee charged or owed'
);
SELECT is(
  (SELECT count(*) FROM public.contributions c
   WHERE c.jamiya_id = 'b0000000-0000-0000-0000-000000000001'
     AND pg_temp.fee_debits(c.id) > 1),
  0::bigint,
  'no contribution charged twice'
);

SELECT * FROM finish();
ROLLBACK;
