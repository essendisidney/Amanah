-- pgTAP: public.complete_payment_intent
-- Run with scripts/test-db.sh (or `supabase test db`). Everything rolls back.
BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SET LOCAL search_path = public, extensions;

SELECT plan(113);

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

-- Calls complete_payment_intent the way a caller would: JWT claims for
-- auth.role()/auth.uid(), and the matching database role for grants.
CREATE FUNCTION pg_temp.complete(
  p_intent UUID,
  p_ref TEXT DEFAULT NULL,
  p_claim_role TEXT DEFAULT 'service_role',
  p_sub UUID DEFAULT NULL,
  p_db_role TEXT DEFAULT NULL
) RETURNS JSONB LANGUAGE plpgsql AS $$
DECLARE
  r JSONB;
BEGIN
  PERFORM set_config(
    'request.jwt.claims',
    json_build_object('role', p_claim_role, 'sub', p_sub)::text,
    true
  );
  EXECUTE format('SET LOCAL ROLE %I', coalesce(p_db_role, p_claim_role));
  r := public.complete_payment_intent(p_intent, p_ref);
  RESET ROLE;
  PERFORM set_config('request.jwt.claims', '', true);
  RETURN r;
END;
$$;

CREATE FUNCTION pg_temp.wallet(p_user UUID, p_currency TEXT DEFAULT 'KES')
RETURNS NUMERIC LANGUAGE sql AS $$
  SELECT coalesce(
    (SELECT balance FROM public.wallets WHERE user_id = p_user AND currency = p_currency),
    0
  )
$$;

CREATE FUNCTION pg_temp.tx_count(p_user UUID)
RETURNS BIGINT LANGUAGE sql AS $$
  SELECT count(*) FROM public.transactions WHERE user_id = p_user
$$;

-- '<debit code>/<credit code> <amount> <domain>' for the intent's journal entry
-- of the given source type ('payment_intent' is the receipt itself).
CREATE FUNCTION pg_temp.journal(p_intent UUID, p_source_type TEXT DEFAULT 'payment_intent')
RETURNS TEXT LANGUAGE sql AS $$
  SELECT string_agg(x, '; ')
  FROM (
    SELECT
      d.code || '/' || c.code || ' ' || dl.amount::text || ' ' || e.domain AS x
    FROM public.journal_entries e
    JOIN public.journal_lines dl ON dl.journal_entry_id = e.id AND dl.side = 'debit'
    JOIN public.journal_lines cl ON cl.journal_entry_id = e.id AND cl.side = 'credit'
    JOIN public.ledger_accounts d ON d.id = dl.ledger_account_id
    JOIN public.ledger_accounts c ON c.id = cl.ledger_account_id
    WHERE e.source_type = p_source_type AND e.source_id = p_intent::text
  ) s
$$;

-- Net credit to 2000 member wallet liability in the journal for one user.
CREATE FUNCTION pg_temp.wallet_liability(p_user UUID)
RETURNS NUMERIC LANGUAGE sql AS $$
  SELECT coalesce(sum(CASE WHEN l.side = 'credit' THEN l.amount ELSE -l.amount END), 0)
  FROM public.journal_lines l
  JOIN public.journal_entries e ON e.id = l.journal_entry_id
  JOIN public.ledger_accounts a ON a.id = l.ledger_account_id
  WHERE a.code = '2000' AND e.user_id = p_user
$$;

-- ---------------------------------------------------------------------------
-- Fixtures
-- ---------------------------------------------------------------------------
-- a…01 payer, a…02 circle admin, a…03 someone else
INSERT INTO auth.users (id, email, raw_user_meta_data) VALUES
  ('a0000000-0000-0000-0000-000000000001', 'payer@test.local', '{"full_name":"Payer"}'),
  ('a0000000-0000-0000-0000-000000000002', 'admin@test.local', '{"full_name":"Circle Admin"}'),
  ('a0000000-0000-0000-0000-000000000003', 'other@test.local', '{"full_name":"Other"}');

-- b…01 has no fee; b…02 charges 50 per fully paid contribution.
-- Creating a circle adds its creator as the active circle_admin.
INSERT INTO public.jamiyas (id, name, slug, created_by, contribution_amount, max_members, transaction_fee_amount) VALUES
  ('b0000000-0000-0000-0000-000000000001', 'Test Circle', 'cpi-test-circle',
   'a0000000-0000-0000-0000-000000000002', 1000, 10, 0),
  ('b0000000-0000-0000-0000-000000000002', 'Fee Circle', 'cpi-fee-circle',
   'a0000000-0000-0000-0000-000000000002', 1000, 10, 50);

INSERT INTO public.members (id, jamiya_id, user_id, role, status) VALUES
  ('c0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001',
   'a0000000-0000-0000-0000-000000000001', 'member', 'active'),
  ('c0000000-0000-0000-0000-000000000002', 'b0000000-0000-0000-0000-000000000002',
   'a0000000-0000-0000-0000-000000000001', 'member', 'active');

INSERT INTO public.contributions (id, jamiya_id, member_id, cycle_number, amount, currency, due_date, status, amount_paid) VALUES
  -- d…01 full payment, d…02 partial then rest, d…03 overpaid, d…05 already paid, d…06 USD
  ('d0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001',
   'c0000000-0000-0000-0000-000000000001', 1, 1000, 'KES', CURRENT_DATE, 'pending', 0),
  ('d0000000-0000-0000-0000-000000000002', 'b0000000-0000-0000-0000-000000000001',
   'c0000000-0000-0000-0000-000000000001', 2, 1000, 'KES', CURRENT_DATE, 'pending', 0),
  ('d0000000-0000-0000-0000-000000000003', 'b0000000-0000-0000-0000-000000000001',
   'c0000000-0000-0000-0000-000000000001', 3, 1000, 'KES', CURRENT_DATE, 'pending', 0),
  ('d0000000-0000-0000-0000-000000000005', 'b0000000-0000-0000-0000-000000000001',
   'c0000000-0000-0000-0000-000000000001', 5, 1000, 'KES', CURRENT_DATE, 'paid', 1000),
  ('d0000000-0000-0000-0000-000000000006', 'b0000000-0000-0000-0000-000000000001',
   'c0000000-0000-0000-0000-000000000001', 6, 1000, 'USD', CURRENT_DATE, 'pending', 0),
  -- d…04 is in the fee circle
  ('d0000000-0000-0000-0000-000000000004', 'b0000000-0000-0000-0000-000000000002',
   'c0000000-0000-0000-0000-000000000002', 1, 1000, 'KES', CURRENT_DATE, 'pending', 0);

INSERT INTO public.charity_campaigns (id, slug, title, summary, goal_amount, status, fee_mode, fee_bps) VALUES
  ('f0000000-0000-0000-0000-000000000001', 'cpi-addon', 'Water Well', 'Addon fee', 100000, 'live', 'donation_addon', 250),
  ('f0000000-0000-0000-0000-000000000002', 'cpi-deduct', 'School Fund', 'Deduct fee', 100000, 'live', 'donation_deduct', 250),
  ('f0000000-0000-0000-0000-000000000003', 'cpi-paused', 'Paused Fund', 'Not live', 100000, 'paused', 'donation_addon', 250);

INSERT INTO public.sadaka_institutions (id, name, type, contact_person)
VALUES ('f1000000-0000-0000-0000-000000000001', 'Test Orphanage', 'orphanage', 'Contact');
INSERT INTO public.adoption_profiles (id, institution_id, slug, title, description, suggested_monthly_amount)
VALUES ('f2000000-0000-0000-0000-000000000001', 'f1000000-0000-0000-0000-000000000001',
        'cpi-child', 'Child', 'Profile', 2000);
INSERT INTO public.sponsorships (id, adoption_profile_id, sponsor_user_id, monthly_amount, next_charge_date)
VALUES ('f3000000-0000-0000-0000-000000000001', 'f2000000-0000-0000-0000-000000000001',
        'a0000000-0000-0000-0000-000000000001', 2000, CURRENT_DATE);
INSERT INTO public.sponsorship_charges (id, sponsorship_id, amount, status)
VALUES ('f4000000-0000-0000-0000-000000000001', 'f3000000-0000-0000-0000-000000000001', 2000, 'pending');

-- Payment intents (e…). Payer unless noted; mpesa unless noted.
INSERT INTO public.payment_intents (id, user_id, provider, status, amount, currency, phone, metadata) VALUES
  -- wallet top-ups
  ('e0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'mpesa', 'pending', 500, 'KES', NULL, '{}'),
  ('e0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000001', 'mpesa', 'processing', 200, 'KES', NULL, '{"kind":"wallet_top_up"}'),
  ('e0000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000001', 'mpesa', 'failed', 100, 'KES', NULL, '{}'),
  ('e0000000-0000-0000-0000-000000000004', 'a0000000-0000-0000-0000-000000000001', 'mpesa', 'cancelled', 100, 'KES', NULL, '{}'),
  ('e0000000-0000-0000-0000-000000000005', 'a0000000-0000-0000-0000-000000000001', 'mpesa', 'expired', 100, 'KES', NULL, '{}'),
  ('e0000000-0000-0000-0000-000000000006', 'a0000000-0000-0000-0000-000000000001', 'simulated', 'pending', 300, 'KES', NULL, '{}'),
  -- contributions
  ('e0000000-0000-0000-0000-000000000010', 'a0000000-0000-0000-0000-000000000001', 'mpesa', 'pending', 1000, 'KES', NULL,
   '{"kind":"contribution","contribution_id":"d0000000-0000-0000-0000-000000000001"}'),
  ('e0000000-0000-0000-0000-000000000011', 'a0000000-0000-0000-0000-000000000001', 'mpesa', 'pending', 400, 'KES', NULL,
   '{"kind":"contribution","contribution_id":"d0000000-0000-0000-0000-000000000002"}'),
  ('e0000000-0000-0000-0000-000000000012', 'a0000000-0000-0000-0000-000000000001', 'mpesa', 'pending', 600, 'KES', NULL,
   '{"kind":"contribution","contribution_id":"d0000000-0000-0000-0000-000000000002"}'),
  ('e0000000-0000-0000-0000-000000000013', 'a0000000-0000-0000-0000-000000000001', 'mpesa', 'pending', 1500, 'KES', NULL,
   '{"kind":"contribution","contribution_id":"d0000000-0000-0000-0000-000000000003"}'),
  ('e0000000-0000-0000-0000-000000000014', 'a0000000-0000-0000-0000-000000000001', 'mpesa', 'pending', 1050, 'KES', NULL,
   '{"kind":"contribution","contribution_id":"d0000000-0000-0000-0000-000000000004"}'),
  ('e0000000-0000-0000-0000-000000000015', 'a0000000-0000-0000-0000-000000000001', 'mpesa', 'pending', 1000, 'KES', NULL,
   '{"kind":"contribution","contribution_id":"d0000000-0000-0000-0000-000000000005"}'),
  ('e0000000-0000-0000-0000-000000000016', 'a0000000-0000-0000-0000-000000000001', 'mpesa', 'pending', 1000, 'KES', NULL,
   '{"kind":"contribution","contribution_id":"d0000000-0000-0000-0000-000000000006"}'),
  ('e0000000-0000-0000-0000-000000000017', 'a0000000-0000-0000-0000-000000000003', 'mpesa', 'pending', 1000, 'KES', NULL,
   '{"kind":"contribution","contribution_id":"d0000000-0000-0000-0000-000000000003"}'),
  ('e0000000-0000-0000-0000-000000000018', 'a0000000-0000-0000-0000-000000000001', 'mpesa', 'pending', 1000, 'KES', NULL,
   '{"kind":"contribution"}'),
  -- sadaka
  ('e0000000-0000-0000-0000-000000000020', 'a0000000-0000-0000-0000-000000000001', 'mpesa', 'pending', 1000, 'KES', '+254700000001',
   '{"kind":"sadaka","campaign_id":"f0000000-0000-0000-0000-000000000001","donor_name":"Payer"}'),
  ('e0000000-0000-0000-0000-000000000021', 'a0000000-0000-0000-0000-000000000001', 'mpesa', 'pending', 1000, 'KES', NULL,
   '{"kind":"sadaka","campaign_id":"f0000000-0000-0000-0000-000000000002","is_anonymous":true}'),
  ('e0000000-0000-0000-0000-000000000022', 'a0000000-0000-0000-0000-000000000001', 'mpesa', 'pending', 1000, 'KES', NULL,
   '{"kind":"sadaka","campaign_id":"f0000000-0000-0000-0000-000000000003"}'),
  ('e0000000-0000-0000-0000-000000000023', 'a0000000-0000-0000-0000-000000000001', 'mpesa', 'pending', 1000, 'KES', NULL,
   '{"kind":"sadaka"}'),
  -- platform tip
  ('e0000000-0000-0000-0000-000000000030', 'a0000000-0000-0000-0000-000000000001', 'mpesa', 'pending', 50, 'KES', '+254700000001',
   '{"kind":"platform_tip"}'),
  -- sponsorship
  ('e0000000-0000-0000-0000-000000000040', 'a0000000-0000-0000-0000-000000000001', 'mpesa', 'pending', 2000, 'KES', NULL,
   '{"kind":"sponsorship","charge_id":"f4000000-0000-0000-0000-000000000001","sponsorship_id":"f3000000-0000-0000-0000-000000000001"}');

-- ---------------------------------------------------------------------------
-- Who may call it
-- ---------------------------------------------------------------------------
SELECT throws_ok(
  $$ SELECT pg_temp.complete('e0000000-0000-0000-0000-000000000001', NULL, 'anon') $$,
  '42501', NULL,
  'anon cannot execute complete_payment_intent'
);
SELECT throws_ok(
  $$ SELECT pg_temp.complete('e0000000-0000-0000-0000-000000000006', NULL, 'authenticated',
                             'a0000000-0000-0000-0000-000000000001') $$,
  '42501', NULL,
  'authenticated users cannot execute it either (service role only since the 2026-09-30 lockdown)'
);

-- Defence in depth: the body re-checks auth.role() even when the grant lets a call through.
SELECT is(
  pg_temp.complete('e0000000-0000-0000-0000-000000000001', NULL, 'anon', NULL, 'postgres'),
  '{"ok": false, "error": "FORBIDDEN"}'::jsonb,
  'anon claims are refused inside the function'
);
SELECT is(
  pg_temp.complete('e0000000-0000-0000-0000-000000000001', NULL, 'authenticated',
                   'a0000000-0000-0000-0000-000000000001', 'postgres'),
  '{"ok": false, "error": "FORBIDDEN"}'::jsonb,
  'a member cannot self-confirm a real (mpesa) payment'
);
SELECT is(
  pg_temp.complete('e0000000-0000-0000-0000-000000000006', NULL, 'authenticated',
                   'a0000000-0000-0000-0000-000000000003', 'postgres'),
  '{"ok": false, "error": "FORBIDDEN"}'::jsonb,
  'a member cannot confirm someone else''s simulated payment'
);
SELECT is(pg_temp.wallet('a0000000-0000-0000-0000-000000000001'), 0.00, 'refused calls credit nothing');
SELECT is(
  (SELECT status::text FROM public.payment_intents WHERE id = 'e0000000-0000-0000-0000-000000000001'),
  'pending',
  'refused calls leave the intent pending'
);

SELECT is(
  pg_temp.complete('e0000000-0000-0000-0000-000000000006', NULL, 'authenticated',
                   'a0000000-0000-0000-0000-000000000001', 'postgres')->>'ok',
  'true',
  'a member may confirm their own simulated payment'
);
SELECT is(pg_temp.wallet('a0000000-0000-0000-0000-000000000001'), 300.00, 'simulated top-up credits the wallet');

-- ---------------------------------------------------------------------------
-- Intents that cannot be completed
-- ---------------------------------------------------------------------------
SELECT is(
  pg_temp.complete('e9999999-0000-0000-0000-000000000000'),
  '{"ok": false, "error": "NOT_FOUND"}'::jsonb,
  'unknown intent → NOT_FOUND'
);
SELECT is(pg_temp.complete('e0000000-0000-0000-0000-000000000003')->>'error', 'NOT_COMPLETABLE', 'failed intent → NOT_COMPLETABLE');
SELECT is(pg_temp.complete('e0000000-0000-0000-0000-000000000004')->>'error', 'NOT_COMPLETABLE', 'cancelled intent → NOT_COMPLETABLE');
SELECT is(pg_temp.complete('e0000000-0000-0000-0000-000000000005')->>'error', 'NOT_COMPLETABLE', 'expired intent → NOT_COMPLETABLE');
SELECT is(
  (SELECT count(*) FROM public.payment_intents
   WHERE id IN ('e0000000-0000-0000-0000-000000000003', 'e0000000-0000-0000-0000-000000000004',
                'e0000000-0000-0000-0000-000000000005')
     AND status::text IN ('failed', 'cancelled', 'expired')),
  3::bigint,
  'terminal intents keep their status'
);
SELECT is(pg_temp.wallet('a0000000-0000-0000-0000-000000000001'), 300.00, 'terminal intents credit nothing');

-- ---------------------------------------------------------------------------
-- Wallet top-up (no kind)
-- ---------------------------------------------------------------------------
CREATE TEMP TABLE r_topup AS
  SELECT pg_temp.complete('e0000000-0000-0000-0000-000000000001', 'MPESA-ABC123') AS r;

SELECT is((SELECT r->>'ok' FROM r_topup), 'true', 'top-up: ok');
SELECT is(pg_temp.wallet('a0000000-0000-0000-0000-000000000001'), 800.00, 'top-up: wallet +500');
SELECT is(
  (SELECT available_balance FROM public.wallets
   WHERE user_id = 'a0000000-0000-0000-0000-000000000001' AND currency = 'KES'),
  800.00,
  'top-up: available balance +500'
);
SELECT results_eq(
  $$ SELECT status::text, transaction_id::text, settlement_status, reconcile_status,
            provider_reference, completed_at IS NOT NULL
     FROM public.payment_intents WHERE id = 'e0000000-0000-0000-0000-000000000001' $$,
  $$ SELECT 'completed', (SELECT r->>'transaction_id' FROM r_topup), 'unsettled', 'open',
            'MPESA-ABC123', true $$,
  'top-up: intent completed, linked to its transaction, open for reconcile'
);
SELECT results_eq(
  $$ SELECT type::text, direction::text, amount, status::text, reference, idempotency_key
     FROM public.transactions WHERE id = (SELECT (r->>'transaction_id')::uuid FROM r_topup) $$,
  $$ VALUES ('wallet_top_up', 'credit', 500.00::numeric, 'completed', 'MPESA-ABC123',
             'payment_intent:e0000000-0000-0000-0000-000000000001') $$,
  'top-up: one completed credit transaction keyed on the intent'
);
SELECT is(pg_temp.journal('e0000000-0000-0000-0000-000000000001'), '1000/2000 500.00 OPERATING',
  'top-up: journal Dr PSP clearing / Cr wallet liability');
SELECT is(
  (SELECT count(*) FROM public.notifications
   WHERE user_id = 'a0000000-0000-0000-0000-000000000001' AND title = 'Wallet topped up'
     AND data->>'payment_intent_id' = 'e0000000-0000-0000-0000-000000000001'),
  1::bigint,
  'top-up: payer notified'
);

-- Explicit kind + no provider reference: falls back to payment_intent:<id>.
SELECT is(pg_temp.complete('e0000000-0000-0000-0000-000000000002')->>'ok', 'true', 'processing intent completes');
SELECT is(
  (SELECT reference FROM public.transactions
   WHERE idempotency_key = 'payment_intent:e0000000-0000-0000-0000-000000000002'),
  'payment_intent:e0000000-0000-0000-0000-000000000002',
  'no provider reference → transaction reference is payment_intent:<id>'
);
SELECT is(
  (SELECT provider_reference FROM public.payment_intents WHERE id = 'e0000000-0000-0000-0000-000000000002'),
  NULL,
  'no provider reference → intent provider_reference stays NULL'
);
SELECT is(pg_temp.wallet('a0000000-0000-0000-0000-000000000001'), 1000.00, 'second top-up: wallet +200');

-- Idempotency: webhook + poll both arriving must not double-credit.
SELECT is(
  pg_temp.complete('e0000000-0000-0000-0000-000000000001', 'MPESA-ABC123'),
  jsonb_build_object('ok', true, 'already_completed', true,
                     'transaction_id', (SELECT r->>'transaction_id' FROM r_topup)),
  'repeat call: already_completed with the original transaction'
);
SELECT is(
  pg_temp.complete('e0000000-0000-0000-0000-000000000001', 'DIFFERENT-REF')->>'already_completed',
  'true',
  'repeat call with another reference is still a no-op'
);
SELECT is(pg_temp.wallet('a0000000-0000-0000-0000-000000000001'), 1000.00, 'repeat calls: wallet unchanged');
SELECT is(
  (SELECT count(*) FROM public.transactions
   WHERE idempotency_key = 'payment_intent:e0000000-0000-0000-0000-000000000001'),
  1::bigint,
  'repeat calls: still one transaction'
);
SELECT is(
  (SELECT count(*) FROM public.journal_entries
   WHERE source_type = 'payment_intent' AND source_id = 'e0000000-0000-0000-0000-000000000001'),
  1::bigint,
  'repeat calls: still one journal entry'
);
SELECT is(
  (SELECT provider_reference FROM public.payment_intents WHERE id = 'e0000000-0000-0000-0000-000000000001'),
  'MPESA-ABC123',
  'repeat calls: provider reference not overwritten'
);

-- ---------------------------------------------------------------------------
-- Contributions
-- ---------------------------------------------------------------------------
-- Guards first, while wallet = 1000.
SELECT is(pg_temp.complete('e0000000-0000-0000-0000-000000000018')->>'error', 'CONTRIBUTION_REQUIRED',
  'contribution intent without contribution_id → CONTRIBUTION_REQUIRED');
SELECT is(pg_temp.complete('e0000000-0000-0000-0000-000000000015')->>'error', 'NOT_PAYABLE',
  'already-paid contribution → NOT_PAYABLE');
SELECT is(pg_temp.complete('e0000000-0000-0000-0000-000000000016')->>'error', 'CURRENCY_MISMATCH',
  'USD contribution paid in KES → CURRENCY_MISMATCH');
SELECT is(pg_temp.complete('e0000000-0000-0000-0000-000000000017')->>'error', 'FORBIDDEN',
  'paying someone else''s contribution → FORBIDDEN');
SELECT is(
  (SELECT count(*) FROM public.payment_intents
   WHERE id IN ('e0000000-0000-0000-0000-000000000015', 'e0000000-0000-0000-0000-000000000016',
                'e0000000-0000-0000-0000-000000000017', 'e0000000-0000-0000-0000-000000000018')
     AND status = 'pending'),
  4::bigint,
  'rejected contribution intents stay pending'
);
SELECT is(pg_temp.wallet('a0000000-0000-0000-0000-000000000001'), 1000.00, 'rejected contribution intents move no money');
SELECT is(pg_temp.wallet('a0000000-0000-0000-0000-000000000003'), 0.00, 'the other user was not credited');

-- Full payment.
CREATE TEMP TABLE r_full AS SELECT pg_temp.complete('e0000000-0000-0000-0000-000000000010', 'MPESA-C1') AS r;
SELECT is((SELECT r->>'ok' FROM r_full), 'true', 'full contribution: ok');
SELECT is((SELECT r->>'status' FROM r_full), 'paid', 'full contribution: reports paid');
SELECT results_eq(
  $$ SELECT status::text, amount_paid, paid_at IS NOT NULL, transaction_id::text
     FROM public.contributions WHERE id = 'd0000000-0000-0000-0000-000000000001' $$,
  $$ SELECT 'paid', 1000.00::numeric, true, (SELECT r->>'debit_transaction_id' FROM r_full) $$,
  'full contribution: row marked paid and linked to the debit'
);
SELECT is(pg_temp.wallet('a0000000-0000-0000-0000-000000000001'), 1000.00,
  'full contribution: money passes through the wallet (credit then debit)');
SELECT results_eq(
  $$ SELECT type::text, direction::text, amount
     FROM public.transactions
     WHERE id IN ((SELECT (r->>'transaction_id')::uuid FROM r_full),
                  (SELECT (r->>'debit_transaction_id')::uuid FROM r_full))
     ORDER BY direction $$,
  $$ VALUES ('wallet_top_up', 'credit', 1000.00::numeric), ('contribution', 'debit', 1000.00::numeric) $$,
  'full contribution: one credit and one contribution debit'
);
SELECT is(
  (SELECT jamiya_id FROM public.transactions WHERE id = (SELECT (r->>'debit_transaction_id')::uuid FROM r_full)),
  'b0000000-0000-0000-0000-000000000001'::uuid,
  'full contribution: debit tagged with the circle'
);
SELECT results_eq(
  $$ SELECT amount, payment_method, transaction_id::text FROM public.contribution_payments
     WHERE contribution_id = 'd0000000-0000-0000-0000-000000000001' $$,
  $$ SELECT 1000.00::numeric, 'external', (SELECT r->>'debit_transaction_id' FROM r_full) $$,
  'full contribution: one contribution_payments row'
);
SELECT is(pg_temp.journal('e0000000-0000-0000-0000-000000000010'), '1000/3000 1000.00 CONTRIBUTIONS',
  'full contribution: journal Dr PSP clearing / Cr dues clearing');
SELECT is(
  (SELECT jamiya_id FROM public.journal_entries
   WHERE source_type = 'payment_intent' AND source_id = 'e0000000-0000-0000-0000-000000000010'),
  'b0000000-0000-0000-0000-000000000001'::uuid,
  'full contribution: journal entry tagged with the circle'
);
SELECT results_eq(
  $$ SELECT amount, member_id::text FROM public.book_entries
     WHERE entry_type = 'contribution'
       AND metadata->>'payment_intent_id' = 'e0000000-0000-0000-0000-000000000010' $$,
  $$ VALUES (1000.00::numeric, 'c0000000-0000-0000-0000-000000000001') $$,
  'full contribution: exactly one cashbook entry (function + trigger both bridge)'
);
SELECT is(
  (SELECT metadata->>'contribution_status' FROM public.payment_intents WHERE id = 'e0000000-0000-0000-0000-000000000010'),
  'paid',
  'full contribution: intent metadata records the outcome'
);
SELECT is(
  (SELECT count(*) FROM public.notifications
   WHERE user_id = 'a0000000-0000-0000-0000-000000000002' AND type = 'contribution_received'
     AND data->>'contribution_id' = 'd0000000-0000-0000-0000-000000000001'),
  1::bigint,
  'full contribution: circle admin notified'
);
SELECT is(
  (SELECT count(*) FROM public.notifications
   WHERE user_id = 'a0000000-0000-0000-0000-000000000001' AND title = 'Contribution paid'
     AND data->>'contribution_id' = 'd0000000-0000-0000-0000-000000000001'),
  1::bigint,
  'full contribution: payer notified'
);

-- Replaying a completed contribution does nothing.
SELECT is(pg_temp.complete('e0000000-0000-0000-0000-000000000010', 'MPESA-C1')->>'already_completed', 'true',
  'contribution replay: already_completed');
SELECT is(
  (SELECT count(*) FROM public.contribution_payments WHERE contribution_id = 'd0000000-0000-0000-0000-000000000001'),
  1::bigint,
  'contribution replay: no second payment row'
);
SELECT is(
  (SELECT count(*) FROM public.book_entries
   WHERE metadata->>'payment_intent_id' = 'e0000000-0000-0000-0000-000000000010'),
  1::bigint,
  'contribution replay: no second cashbook entry'
);
SELECT is(
  (SELECT amount_paid FROM public.contributions WHERE id = 'd0000000-0000-0000-0000-000000000001'),
  1000.00,
  'contribution replay: amount_paid unchanged'
);

-- Partial, then the rest.
SELECT is(pg_temp.complete('e0000000-0000-0000-0000-000000000011')->>'status', 'partial', 'partial contribution: reports partial');
SELECT results_eq(
  $$ SELECT status::text, amount_paid, paid_at IS NULL FROM public.contributions
     WHERE id = 'd0000000-0000-0000-0000-000000000002' $$,
  $$ VALUES ('partial', 400.00::numeric, true) $$,
  'partial contribution: 400 of 1000, not marked paid'
);
SELECT is(
  (SELECT count(*) FROM public.notifications
   WHERE user_id = 'a0000000-0000-0000-0000-000000000001' AND title = 'Partial contribution paid'
     AND data->>'contribution_id' = 'd0000000-0000-0000-0000-000000000002'),
  1::bigint,
  'partial contribution: payer told it was partial'
);
SELECT is(pg_temp.complete('e0000000-0000-0000-0000-000000000012')->>'status', 'paid', 'second instalment: reports paid');
SELECT results_eq(
  $$ SELECT status::text, amount_paid, paid_at IS NOT NULL FROM public.contributions
     WHERE id = 'd0000000-0000-0000-0000-000000000002' $$,
  $$ VALUES ('paid', 1000.00::numeric, true) $$,
  'second instalment: contribution fully paid'
);
SELECT is(
  (SELECT sum(amount) FROM public.contribution_payments WHERE contribution_id = 'd0000000-0000-0000-0000-000000000002'),
  1000.00,
  'instalments: payment rows add up to the contribution'
);
SELECT is(
  (SELECT sum(amount) FROM public.book_entries
   WHERE entry_type = 'contribution' AND metadata->>'contribution_id' = 'd0000000-0000-0000-0000-000000000002'),
  1000.00,
  'instalments: cashbook adds up to the contribution'
);
SELECT is(pg_temp.wallet('a0000000-0000-0000-0000-000000000001'), 1000.00, 'instalments: wallet unchanged');

-- Overpayment: the extra stays in the wallet.
SELECT is(pg_temp.complete('e0000000-0000-0000-0000-000000000013')->>'amount_paid', '1000.00',
  'overpayment: only the remaining 1000 goes to the contribution');
SELECT is(pg_temp.wallet('a0000000-0000-0000-0000-000000000001'), 1500.00, 'overpayment: 500 change stays in the wallet');
SELECT is(
  (SELECT amount FROM public.contribution_payments WHERE contribution_id = 'd0000000-0000-0000-0000-000000000003'),
  1000.00,
  'overpayment: payment row is capped at what was owed'
);
SELECT is(pg_temp.journal('e0000000-0000-0000-0000-000000000013'), '1000/3000 1500.00 CONTRIBUTIONS',
  'overpayment: receipt entry is the full 1500 received');
SELECT is(pg_temp.journal('e0000000-0000-0000-0000-000000000013', 'contribution_change'),
  '3000/2000 500.00 CONTRIBUTIONS',
  'overpayment: the 500 change moves from dues clearing to wallet liability');
SELECT is(
  (SELECT payment_intent_id FROM public.journal_entries
   WHERE source_type = 'contribution_change' AND source_id = 'e0000000-0000-0000-0000-000000000013'),
  'e0000000-0000-0000-0000-000000000013'::uuid,
  'overpayment: change entry is linked to the intent (shows on its admin case file)'
);
SELECT is(pg_temp.complete('e0000000-0000-0000-0000-000000000013')->>'already_completed', 'true',
  'overpayment replay: no-op');
SELECT is(
  (SELECT count(*) FROM public.journal_entries
   WHERE source_type = 'contribution_change' AND source_id = 'e0000000-0000-0000-0000-000000000013'),
  1::bigint,
  'overpayment replay: still one change entry'
);
SELECT is(
  (SELECT count(*) FROM public.journal_entries
   WHERE source_type = 'contribution_change' AND source_id IN (
     'e0000000-0000-0000-0000-000000000010', 'e0000000-0000-0000-0000-000000000011',
     'e0000000-0000-0000-0000-000000000012')),
  0::bigint,
  'exact and part payments post no change entry'
);

-- Circle transaction fee comes out of the wallet once the contribution is fully paid.
SELECT is(pg_temp.complete('e0000000-0000-0000-0000-000000000014')->>'status', 'paid', 'fee circle: contribution paid');
SELECT results_eq(
  $$ SELECT type::text, direction::text, amount, jamiya_id::text FROM public.transactions
     WHERE reference = 'contrib_fee:d0000000-0000-0000-0000-000000000004' $$,
  $$ VALUES ('fee', 'debit', 50.00::numeric, 'b0000000-0000-0000-0000-000000000002') $$,
  'fee circle: one 50 fee debit'
);
SELECT is(pg_temp.wallet('a0000000-0000-0000-0000-000000000001'), 1500.00,
  'fee circle: 1050 in, 1000 contribution, 50 fee');
SELECT is(pg_temp.journal('e0000000-0000-0000-0000-000000000014', 'contribution_change'),
  '3000/2000 50.00 CONTRIBUTIONS',
  'fee circle: the 50 over the contribution goes to wallet liability before the fee takes it');

-- ---------------------------------------------------------------------------
-- Sadaka
-- ---------------------------------------------------------------------------
SELECT is(pg_temp.complete('e0000000-0000-0000-0000-000000000023')->>'error', 'CAMPAIGN_REQUIRED',
  'sadaka without campaign → CAMPAIGN_REQUIRED');
SELECT is(pg_temp.complete('e0000000-0000-0000-0000-000000000022')->>'error', 'CAMPAIGN_UNAVAILABLE',
  'sadaka to a paused campaign → CAMPAIGN_UNAVAILABLE');
SELECT is(
  (SELECT count(*) FROM public.payment_intents
   WHERE id IN ('e0000000-0000-0000-0000-000000000022', 'e0000000-0000-0000-0000-000000000023')
     AND status = 'pending'),
  2::bigint,
  'rejected sadaka intents stay pending'
);

CREATE TEMP TABLE r_addon AS SELECT pg_temp.complete('e0000000-0000-0000-0000-000000000020', 'MPESA-S1') AS r;
SELECT is((SELECT r->>'kind' FROM r_addon), 'sadaka', 'donation_addon: ok');
SELECT results_eq(
  $$ SELECT amount, fee_amount, donor_user_id::text, donor_phone, donor_name, is_anonymous, payment_intent_id::text
     FROM public.charity_donations WHERE id = (SELECT (r->>'donation_id')::uuid FROM r_addon) $$,
  $$ VALUES (1000.00::numeric, 25.00::numeric, 'a0000000-0000-0000-0000-000000000001', '+254700000001',
             'Payer', false, 'e0000000-0000-0000-0000-000000000020') $$,
  'donation_addon: full gift to the cause, 2.5% fee recorded on top'
);
SELECT is(
  (SELECT raised_amount FROM public.charity_campaigns WHERE id = 'f0000000-0000-0000-0000-000000000001'),
  1000.00,
  'donation_addon: campaign raised +1000'
);
SELECT matches((SELECT r->>'receipt_code' FROM r_addon), '^[A-Z]{3}-[0-9A-F]{10}$', 'donation_addon: receipt code issued');
SELECT is(
  (SELECT metadata->>'receipt_code' FROM public.payment_intents WHERE id = 'e0000000-0000-0000-0000-000000000020'),
  (SELECT r->>'receipt_code' FROM r_addon),
  'donation_addon: receipt stored on the intent'
);
SELECT is(pg_temp.journal('e0000000-0000-0000-0000-000000000020'), '1000/5000 1000.00 SADAKA',
  'donation_addon: journal Dr PSP clearing / Cr charity clearing');

CREATE TEMP TABLE r_deduct AS SELECT pg_temp.complete('e0000000-0000-0000-0000-000000000021') AS r;
SELECT results_eq(
  $$ SELECT amount, fee_amount, is_anonymous FROM public.charity_donations
     WHERE id = (SELECT (r->>'donation_id')::uuid FROM r_deduct) $$,
  $$ VALUES (975.00::numeric, 25.00::numeric, true) $$,
  'donation_deduct: 2.5% fee taken out of the gift'
);
SELECT is(
  (SELECT raised_amount FROM public.charity_campaigns WHERE id = 'f0000000-0000-0000-0000-000000000002'),
  975.00,
  'donation_deduct: campaign raised the net amount'
);

SELECT is(pg_temp.complete('e0000000-0000-0000-0000-000000000020')->>'already_completed', 'true', 'sadaka replay: no-op');
SELECT is(
  (SELECT count(*) FROM public.charity_donations WHERE payment_intent_id = 'e0000000-0000-0000-0000-000000000020'),
  1::bigint,
  'sadaka replay: still one donation'
);
SELECT is(
  (SELECT raised_amount FROM public.charity_campaigns WHERE id = 'f0000000-0000-0000-0000-000000000001'),
  1000.00,
  'sadaka replay: raised amount not double counted'
);
SELECT is(pg_temp.wallet('a0000000-0000-0000-0000-000000000001'), 1500.00, 'sadaka never touches the wallet');

-- ---------------------------------------------------------------------------
-- Platform tip
-- ---------------------------------------------------------------------------
CREATE TEMP TABLE r_tip AS SELECT pg_temp.complete('e0000000-0000-0000-0000-000000000030') AS r;
SELECT is((SELECT r->>'kind' FROM r_tip), 'platform_tip', 'tip: ok');
SELECT results_eq(
  $$ SELECT user_id::text, amount, phone, payment_intent_id::text FROM public.platform_tips
     WHERE id = (SELECT (r->>'tip_id')::uuid FROM r_tip) $$,
  $$ VALUES ('a0000000-0000-0000-0000-000000000001', 50.00::numeric, '+254700000001',
             'e0000000-0000-0000-0000-000000000030') $$,
  'tip: recorded against the intent'
);
SELECT is(pg_temp.journal('e0000000-0000-0000-0000-000000000030'), '1000/2100 50.00 OPERATING',
  'tip: journal Dr PSP clearing / Cr platform tips');
SELECT is(pg_temp.complete('e0000000-0000-0000-0000-000000000030')->>'already_completed', 'true', 'tip replay: no-op');
SELECT is(
  (SELECT count(*) FROM public.platform_tips WHERE payment_intent_id = 'e0000000-0000-0000-0000-000000000030'),
  1::bigint,
  'tip replay: still one tip'
);
SELECT is(pg_temp.wallet('a0000000-0000-0000-0000-000000000001'), 1500.00, 'tip never touches the wallet');

-- ---------------------------------------------------------------------------
-- Sponsorship
-- ---------------------------------------------------------------------------
SELECT is(
  pg_temp.complete('e0000000-0000-0000-0000-000000000040'),
  '{"ok": true, "kind": "sponsorship", "charge_id": "f4000000-0000-0000-0000-000000000001",
    "sponsorship_id": "f3000000-0000-0000-0000-000000000001"}'::jsonb,
  'sponsorship: ok'
);
SELECT results_eq(
  $$ SELECT status, charged_at IS NOT NULL FROM public.sponsorship_charges
     WHERE id = 'f4000000-0000-0000-0000-000000000001' $$,
  $$ VALUES ('paid', true) $$,
  'sponsorship: charge marked paid'
);
SELECT is(
  (SELECT next_charge_date FROM public.sponsorships WHERE id = 'f3000000-0000-0000-0000-000000000001'),
  CURRENT_DATE + 30,
  'sponsorship: next charge pushed out 30 days'
);
SELECT is(pg_temp.journal('e0000000-0000-0000-0000-000000000040'), '1000/6000 2000.00 TAKAFUL',
  'sponsorship: journal Dr PSP clearing / Cr sponsorship clearing');
SELECT is(pg_temp.wallet('a0000000-0000-0000-0000-000000000001'), 1500.00, 'sponsorship never touches the wallet');

-- ---------------------------------------------------------------------------
-- Ledger-wide invariants
-- ---------------------------------------------------------------------------
SELECT is(
  (SELECT count(*) FROM public.payment_intents
   WHERE status = 'completed' AND id::text LIKE 'e0000000-%'),
  12::bigint,
  '12 intents completed in this run'
);
SELECT is(
  (SELECT count(*) FROM public.payment_intents p
   WHERE p.status = 'completed' AND p.id::text LIKE 'e0000000-%'
     AND NOT EXISTS (
       SELECT 1 FROM public.journal_entries e
       WHERE e.source_type = 'payment_intent' AND e.source_id = p.id::text
     )),
  0::bigint,
  'every completed intent has a journal entry'
);
SELECT is(
  (SELECT count(*) FROM public.journal_entries e
   WHERE e.source_type = 'payment_intent' AND e.source_id LIKE 'e0000000-%'
     AND (SELECT count(*) FROM public.journal_lines l WHERE l.journal_entry_id = e.id) <> 2),
  0::bigint,
  'every journal entry has exactly two lines'
);
SELECT is(
  (SELECT count(*) FROM (
     SELECT e.id
     FROM public.journal_entries e
     JOIN public.journal_lines l ON l.journal_entry_id = e.id
     WHERE e.source_type = 'payment_intent' AND e.source_id LIKE 'e0000000-%'
     GROUP BY e.id
     HAVING sum(CASE WHEN l.side = 'debit' THEN l.amount_minor ELSE -l.amount_minor END) <> 0
   ) unbalanced),
  0::bigint,
  'every journal entry balances (debits = credits)'
);
SELECT is(
  (SELECT count(*) FROM public.journal_entries e
   JOIN public.payment_intents p ON p.id::text = e.source_id
   JOIN public.journal_lines l ON l.journal_entry_id = e.id AND l.side = 'debit'
   WHERE e.source_type = 'payment_intent' AND e.source_id LIKE 'e0000000-%'
     AND l.amount <> p.amount),
  0::bigint,
  'every journal entry is for the full amount received'
);
SELECT is(
  (SELECT count(*) FROM public.journal_entries
   WHERE source_type = 'payment_intent' AND source_id IN (
     'e0000000-0000-0000-0000-000000000003', 'e0000000-0000-0000-0000-000000000015',
     'e0000000-0000-0000-0000-000000000022')),
  0::bigint,
  'rejected intents post nothing to the journal'
);
SELECT is(
  (SELECT sum(CASE WHEN direction = 'credit' THEN amount ELSE -amount END)
   FROM public.transactions WHERE user_id = 'a0000000-0000-0000-0000-000000000001' AND status = 'completed'),
  pg_temp.wallet('a0000000-0000-0000-0000-000000000001'),
  'payer wallet balance equals the sum of their completed transactions'
);
SELECT is(
  pg_temp.wallet_liability('a0000000-0000-0000-0000-000000000001'),
  pg_temp.wallet('a0000000-0000-0000-0000-000000000001'),
  'journal wallet liability (2000) for the payer equals their wallet balance'
);
SELECT is(
  (SELECT count(*) FROM (
     SELECT e.id
     FROM public.journal_entries e
     JOIN public.journal_lines l ON l.journal_entry_id = e.id
     WHERE e.source_type = 'contribution_change'
     GROUP BY e.id
     HAVING sum(CASE WHEN l.side = 'debit' THEN l.amount_minor ELSE -l.amount_minor END) <> 0
   ) unbalanced),
  0::bigint,
  'change entries balance'
);
SELECT is(pg_temp.tx_count('a0000000-0000-0000-0000-000000000003'), 0::bigint, 'other user has no transactions');

SELECT * FROM finish();
ROLLBACK;
