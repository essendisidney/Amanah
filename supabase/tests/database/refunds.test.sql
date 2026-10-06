-- pgTAP: public.request_refund / public.complete_refund
-- Run with scripts/test-db.mjs (or `supabase test db`). Everything rolls back.
BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SET LOCAL search_path = public, extensions;

SELECT plan(52);

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------
CREATE FUNCTION pg_temp.as_service() RETURNS VOID LANGUAGE sql AS $$
  SELECT set_config('request.jwt.claims', '{"role":"service_role"}', true)
$$;

CREATE FUNCTION pg_temp.request(p_intent UUID, p_amount NUMERIC)
RETURNS JSONB LANGUAGE plpgsql AS $$
DECLARE r JSONB;
BEGIN
  PERFORM pg_temp.as_service();
  SET LOCAL ROLE service_role;
  r := public.request_refund(p_intent, p_amount, 'test');
  RESET ROLE;
  RETURN r;
END;
$$;

CREATE FUNCTION pg_temp.complete(p_refund UUID)
RETURNS JSONB LANGUAGE plpgsql AS $$
DECLARE r JSONB;
BEGIN
  PERFORM pg_temp.as_service();
  SET LOCAL ROLE service_role;
  r := public.complete_refund(p_refund);
  RESET ROLE;
  RETURN r;
END;
$$;

-- Request then complete; returns the complete result (or the request error).
CREATE FUNCTION pg_temp.refund(p_intent UUID, p_amount NUMERIC)
RETURNS JSONB LANGUAGE plpgsql AS $$
DECLARE r JSONB;
BEGIN
  r := pg_temp.request(p_intent, p_amount);
  IF NOT coalesce((r->>'ok')::boolean, false) THEN
    RETURN r;
  END IF;
  RETURN pg_temp.complete((r->>'refund_id')::uuid);
END;
$$;

CREATE FUNCTION pg_temp.wallet(p_user UUID DEFAULT 'a0000000-0000-0000-0000-000000000001')
RETURNS NUMERIC LANGUAGE sql AS $$
  SELECT coalesce((SELECT balance FROM public.wallets WHERE user_id = p_user AND currency = 'KES'), 0)
$$;

-- '<debit code>/<credit code> <amount> <domain>' for a refund's journal entry.
CREATE FUNCTION pg_temp.journal(p_refund UUID)
RETURNS TEXT LANGUAGE sql AS $$
  SELECT d.code || '/' || c.code || ' ' || dl.amount::text || ' ' || e.domain
  FROM public.journal_entries e
  JOIN public.journal_lines dl ON dl.journal_entry_id = e.id AND dl.side = 'debit'
  JOIN public.journal_lines cl ON cl.journal_entry_id = e.id AND cl.side = 'credit'
  JOIN public.ledger_accounts d ON d.id = dl.ledger_account_id
  JOIN public.ledger_accounts c ON c.id = cl.ledger_account_id
  WHERE e.source_type = 'refund' AND e.source_id = p_refund::text
$$;

CREATE FUNCTION pg_temp.wallet_liability(p_user UUID DEFAULT 'a0000000-0000-0000-0000-000000000001')
RETURNS NUMERIC LANGUAGE sql AS $$
  SELECT coalesce(sum(CASE WHEN l.side = 'credit' THEN l.amount ELSE -l.amount END), 0)
  FROM public.journal_lines l
  JOIN public.journal_entries e ON e.id = l.journal_entry_id
  JOIN public.ledger_accounts a ON a.id = l.ledger_account_id
  WHERE a.code = '2000' AND e.user_id = p_user
$$;

-- ---------------------------------------------------------------------------
-- Fixtures: a payer with one of each kind of completed payment
-- ---------------------------------------------------------------------------
INSERT INTO auth.users (id, email, raw_user_meta_data) VALUES
  ('a0000000-0000-0000-0000-000000000001', 'payer@test.local', '{"full_name":"Payer"}'),
  ('a0000000-0000-0000-0000-000000000002', 'admin@test.local', '{"full_name":"Circle Admin"}');

INSERT INTO public.jamiyas (id, name, slug, created_by, contribution_amount, max_members, transaction_fee_amount)
VALUES ('b0000000-0000-0000-0000-000000000001', 'Refund Circle', 'refund-test-circle',
        'a0000000-0000-0000-0000-000000000002', 1000, 10, 0);
INSERT INTO public.members (id, jamiya_id, user_id, role, status)
VALUES ('c0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001',
        'a0000000-0000-0000-0000-000000000001', 'member', 'active');
INSERT INTO public.contributions (id, jamiya_id, member_id, cycle_number, amount, currency, due_date) VALUES
  ('d0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001',
   'c0000000-0000-0000-0000-000000000001', 1, 1000, 'KES', CURRENT_DATE),
  ('d0000000-0000-0000-0000-000000000002', 'b0000000-0000-0000-0000-000000000001',
   'c0000000-0000-0000-0000-000000000001', 2, 1000, 'KES', CURRENT_DATE);

INSERT INTO public.charity_campaigns (id, slug, title, summary, goal_amount, status, fee_mode, fee_bps) VALUES
  ('f0000000-0000-0000-0000-000000000001', 'refund-deduct', 'School Fund', 'Deduct fee', 100000, 'live', 'donation_deduct', 250),
  ('f0000000-0000-0000-0000-000000000002', 'refund-addon', 'Water Well', 'Addon fee', 100000, 'live', 'donation_addon', 0);
INSERT INTO public.sadaka_institutions (id, name, type, contact_person)
VALUES ('f1000000-0000-0000-0000-000000000001', 'Test Orphanage', 'orphanage', 'Contact');
INSERT INTO public.adoption_profiles (id, institution_id, slug, title, description, suggested_monthly_amount)
VALUES ('f2000000-0000-0000-0000-000000000001', 'f1000000-0000-0000-0000-000000000001',
        'refund-child', 'Child', 'Profile', 2000);
INSERT INTO public.sponsorships (id, adoption_profile_id, sponsor_user_id, monthly_amount, next_charge_date)
VALUES ('f3000000-0000-0000-0000-000000000001', 'f2000000-0000-0000-0000-000000000001',
        'a0000000-0000-0000-0000-000000000001', 2000, CURRENT_DATE);
INSERT INTO public.sponsorship_charges (id, sponsorship_id, amount, status)
VALUES ('f4000000-0000-0000-0000-000000000001', 'f3000000-0000-0000-0000-000000000001', 2000, 'pending');

INSERT INTO public.payment_intents (id, user_id, provider, amount, currency, metadata) VALUES
  ('e0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'mpesa', 1000, 'KES', '{}'),
  ('e0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000001', 'mpesa', 1000, 'KES',
   '{"kind":"contribution","contribution_id":"d0000000-0000-0000-0000-000000000001"}'),
  ('e0000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000001', 'mpesa', 1500, 'KES',
   '{"kind":"contribution","contribution_id":"d0000000-0000-0000-0000-000000000002"}'),
  ('e0000000-0000-0000-0000-000000000004', 'a0000000-0000-0000-0000-000000000001', 'mpesa', 1000, 'KES',
   '{"kind":"sadaka","campaign_id":"f0000000-0000-0000-0000-000000000001"}'),
  ('e0000000-0000-0000-0000-000000000005', 'a0000000-0000-0000-0000-000000000001', 'mpesa', 2000, 'KES',
   '{"kind":"sponsorship","charge_id":"f4000000-0000-0000-0000-000000000001","sponsorship_id":"f3000000-0000-0000-0000-000000000001"}'),
  ('e0000000-0000-0000-0000-000000000006', 'a0000000-0000-0000-0000-000000000001', 'mpesa', 50, 'KES',
   '{"kind":"platform_tip"}'),
  ('e0000000-0000-0000-0000-000000000007', 'a0000000-0000-0000-0000-000000000001', 'mpesa', 300, 'KES',
   '{"kind":"sadaka","campaign_id":"f0000000-0000-0000-0000-000000000002"}'),
  -- never completed
  ('e0000000-0000-0000-0000-000000000009', 'a0000000-0000-0000-0000-000000000001', 'mpesa', 100, 'KES', '{}');

SELECT pg_temp.as_service();
SET LOCAL ROLE service_role;
SELECT public.complete_payment_intent(id) FROM public.payment_intents
WHERE id::text LIKE 'e0000000-%' AND id <> 'e0000000-0000-0000-0000-000000000009';
RESET ROLE;

-- Starting point: 1000 top-up + 500 overpayment change.
SELECT is(pg_temp.wallet(), 1500.00, 'setup: wallet holds the top-up and the overpayment change');
SELECT is(pg_temp.wallet_liability(), pg_temp.wallet(), 'setup: journal wallet liability matches the wallet');

-- ---------------------------------------------------------------------------
-- How much can be refunded
-- ---------------------------------------------------------------------------
SELECT is(pg_temp.request('e0000000-0000-0000-0000-000000000009', 100)->>'error', 'INTENT_NOT_COMPLETED',
  'cannot refund an intent that never completed');
SELECT is(pg_temp.request('e0000000-0000-0000-0000-000000000001', 0)->>'error', 'INVALID_AMOUNT',
  'zero refund rejected');
SELECT is(
  pg_temp.request('e0000000-0000-0000-0000-000000000003', 1500),
  '{"ok": false, "error": "AMOUNT_EXCEEDS_REFUNDABLE", "refundable": 1000.00}'::jsonb,
  'overpaid contribution: only the 1000 applied to dues is refundable (the 500 change is already in the wallet)'
);
SELECT is(
  pg_temp.request('e0000000-0000-0000-0000-000000000004', 1000),
  '{"ok": false, "error": "AMOUNT_EXCEEDS_REFUNDABLE", "refundable": 975.00}'::jsonb,
  'sadaka with deducted fee: only the 975 that reached the cause is refundable'
);
SELECT is(
  (SELECT count(*) FROM public.refunds),
  0::bigint,
  'rejected requests create no refund rows'
);

-- Pending requests count against the cap too.
CREATE TEMP TABLE q1 AS SELECT pg_temp.request('e0000000-0000-0000-0000-000000000003', 600) AS r;
SELECT is((SELECT r->>'ok' FROM q1), 'true', 'first part refund (600 of 1000) queued');
SELECT is(
  pg_temp.request('e0000000-0000-0000-0000-000000000003', 500),
  '{"ok": false, "error": "AMOUNT_EXCEEDS_REFUNDABLE", "refundable": 400.00}'::jsonb,
  'a pending 600 leaves only 400 refundable'
);

-- ---------------------------------------------------------------------------
-- Contribution refunds go back to the wallet
-- ---------------------------------------------------------------------------
CREATE TEMP TABLE c1 AS SELECT pg_temp.complete((SELECT (r->>'refund_id')::uuid FROM q1)) AS r;
SELECT is((SELECT r->>'ok' FROM c1), 'true', 'contribution refund 600: ok');
SELECT is(pg_temp.journal((SELECT (r->>'refund_id')::uuid FROM q1)), '3000/2000 600.00 CONTRIBUTIONS',
  'contribution refund: Dr dues clearing / Cr wallet liability (not cash)');
SELECT is(pg_temp.wallet(), 2100.00, 'contribution refund: wallet +600');
SELECT results_eq(
  $$ SELECT status::text, amount_paid FROM public.contributions WHERE id = 'd0000000-0000-0000-0000-000000000002' $$,
  $$ VALUES ('partial', 400.00::numeric) $$,
  'contribution refund: contribution back to 400 paid'
);
SELECT is(
  (SELECT status FROM public.refunds WHERE id = (SELECT (r->>'refund_id')::uuid FROM q1)),
  'completed',
  'contribution refund: refund row completed'
);

SELECT is(pg_temp.refund('e0000000-0000-0000-0000-000000000003', 400)->>'ok', 'true', 'rest of the contribution refunded');
SELECT results_eq(
  $$ SELECT status::text, amount_paid FROM public.contributions WHERE id = 'd0000000-0000-0000-0000-000000000002' $$,
  $$ VALUES ('pending', 0.00::numeric) $$,
  'contribution fully refunded: back to pending'
);
SELECT is(pg_temp.wallet(), 2500.00, 'wallet now holds the whole 1500 that was paid, once');
SELECT is(
  pg_temp.request('e0000000-0000-0000-0000-000000000003', 1),
  '{"ok": false, "error": "AMOUNT_EXCEEDS_REFUNDABLE", "refundable": 0.00}'::jsonb,
  'nothing left to refund on that payment'
);

CREATE TEMP TABLE c2 AS SELECT pg_temp.refund('e0000000-0000-0000-0000-000000000002', 1000) AS r;
SELECT is(pg_temp.journal((SELECT (r->>'refund_id')::uuid FROM c2)), '3000/2000 1000.00 CONTRIBUTIONS',
  'exact contribution refunded in full to the wallet');
SELECT is(pg_temp.wallet(), 3500.00, 'wallet +1000');

-- Repeating a completed refund does nothing.
SELECT is(pg_temp.complete((SELECT (r->>'refund_id')::uuid FROM c2))->>'idempotent', 'true',
  'completing a completed refund is a no-op');
SELECT is(pg_temp.wallet(), 3500.00, 'no-op: wallet unchanged');
SELECT is(
  (SELECT count(*) FROM public.journal_entries WHERE source_type = 'refund'
   AND source_id = (SELECT r->>'refund_id' FROM c2)),
  1::bigint,
  'no-op: still one journal entry'
);

-- ---------------------------------------------------------------------------
-- Sadaka
-- ---------------------------------------------------------------------------
CREATE TEMP TABLE s1 AS SELECT pg_temp.refund('e0000000-0000-0000-0000-000000000004', 975) AS r;
SELECT is((SELECT r->>'ok' FROM s1), 'true', 'sadaka refund 975: ok');
SELECT is(pg_temp.journal((SELECT (r->>'refund_id')::uuid FROM s1)), '5000/2000 975.00 SADAKA',
  'sadaka refund: Dr charity clearing / Cr wallet liability, for the amount credited');
SELECT is(pg_temp.wallet(), 4475.00, 'sadaka refund: wallet +975');
SELECT is(
  (SELECT raised_amount FROM public.charity_campaigns WHERE id = 'f0000000-0000-0000-0000-000000000001'),
  0.00,
  'sadaka refund: campaign total reduced'
);
SELECT is(
  pg_temp.request('e0000000-0000-0000-0000-000000000004', 1)->>'error',
  'AMOUNT_EXCEEDS_REFUNDABLE',
  'sadaka: no second refund'
);

-- A donation already marked refunded (e.g. by hand) must not complete with a journal and no money.
UPDATE public.charity_donations SET metadata = metadata || '{"refunded": true}'::jsonb
WHERE payment_intent_id = 'e0000000-0000-0000-0000-000000000007';
CREATE TEMP TABLE s2 AS SELECT pg_temp.request('e0000000-0000-0000-0000-000000000007', 300) AS r;
SELECT is(pg_temp.complete((SELECT (r->>'refund_id')::uuid FROM s2))->>'error', 'ALREADY_REFUNDED',
  'already-refunded donation: complete fails');
SELECT is(
  (SELECT status FROM public.refunds WHERE id = (SELECT (r->>'refund_id')::uuid FROM s2)),
  'failed',
  'already-refunded donation: refund marked failed'
);
SELECT is(pg_temp.journal((SELECT (r->>'refund_id')::uuid FROM s2)), NULL,
  'already-refunded donation: no journal entry');
SELECT is(pg_temp.wallet(), 4475.00, 'already-refunded donation: wallet unchanged');

-- ---------------------------------------------------------------------------
-- Sponsorship
-- ---------------------------------------------------------------------------
CREATE TEMP TABLE p1 AS SELECT pg_temp.refund('e0000000-0000-0000-0000-000000000005', 2000) AS r;
SELECT is(pg_temp.journal((SELECT (r->>'refund_id')::uuid FROM p1)), '6000/2000 2000.00 TAKAFUL',
  'sponsorship refund: Dr sponsorship clearing / Cr wallet liability');
SELECT is(pg_temp.wallet(), 6475.00, 'sponsorship refund: wallet +2000');
SELECT results_eq(
  $$ SELECT status, (metadata->>'refunded')::boolean FROM public.sponsorship_charges
     WHERE id = 'f4000000-0000-0000-0000-000000000001' $$,
  $$ VALUES ('failed', true) $$,
  'sponsorship refund: charge marked refunded'
);

-- ---------------------------------------------------------------------------
-- Refunds that leave the platform (unchanged): top-up and tip
-- ---------------------------------------------------------------------------
SELECT is(
  pg_temp.request('e0000000-0000-0000-0000-000000000001', 1001)->>'error',
  'AMOUNT_EXCEEDS_REFUNDABLE',
  'top-up: cannot refund more than was paid'
);
CREATE TEMP TABLE t1 AS SELECT pg_temp.refund('e0000000-0000-0000-0000-000000000001', 300) AS r;
SELECT is(pg_temp.journal((SELECT (r->>'refund_id')::uuid FROM t1)), '2000/1000 300.00 OPERATING',
  'top-up refund: Dr wallet liability / Cr cash');
SELECT is(pg_temp.wallet(), 6175.00, 'top-up refund: wallet -300');

CREATE TEMP TABLE t2 AS SELECT pg_temp.refund('e0000000-0000-0000-0000-000000000006', 50) AS r;
SELECT is(pg_temp.journal((SELECT (r->>'refund_id')::uuid FROM t2)), '2100/1000 50.00 OPERATING',
  'tip refund: Dr tip income / Cr cash');
SELECT is(pg_temp.wallet(), 6175.00, 'tip refund: wallet unchanged');

-- ---------------------------------------------------------------------------
-- complete_refund re-checks the cap (refund rows from before the cap, or inserted by hand)
-- ---------------------------------------------------------------------------
INSERT INTO public.refunds (id, payment_intent_id, amount, amount_minor, currency, status)
VALUES ('99000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000001', 800, 80000, 'KES', 'pending');
SELECT is(
  pg_temp.complete('99000000-0000-0000-0000-000000000001'),
  '{"ok": false, "error": "AMOUNT_EXCEEDS_REFUNDABLE"}'::jsonb,
  'complete: 300 already refunded + 800 > 1000 paid → refused'
);
SELECT is(
  (SELECT status FROM public.refunds WHERE id = '99000000-0000-0000-0000-000000000001'),
  'failed',
  'complete over the cap: refund marked failed'
);
SELECT is(pg_temp.wallet(), 6175.00, 'complete over the cap: wallet unchanged');
SELECT is(pg_temp.journal('99000000-0000-0000-0000-000000000001'), NULL, 'complete over the cap: no journal');

INSERT INTO public.refunds (id, payment_intent_id, amount, amount_minor, currency, status)
VALUES ('99000000-0000-0000-0000-000000000002', 'e0000000-0000-0000-0000-000000000001', 700, 70000, 'KES', 'pending');
SELECT is(pg_temp.complete('99000000-0000-0000-0000-000000000002')->>'ok', 'true',
  'complete: 300 + 700 = exactly what was paid → allowed');
SELECT is(
  pg_temp.request('e0000000-0000-0000-0000-000000000001', 1)->>'refundable',
  '0.00',
  'top-up now fully refunded'
);

-- ---------------------------------------------------------------------------
-- Books
-- ---------------------------------------------------------------------------
SELECT is(pg_temp.wallet(), 5475.00, 'final wallet');
SELECT is(pg_temp.wallet_liability(), pg_temp.wallet(),
  'journal wallet liability (2000) for the payer equals their wallet after all refunds');
SELECT is(
  (SELECT count(*) FROM (
     SELECT e.id FROM public.journal_entries e
     JOIN public.journal_lines l ON l.journal_entry_id = e.id
     WHERE e.source_type = 'refund'
     GROUP BY e.id
     HAVING sum(CASE WHEN l.side = 'debit' THEN l.amount_minor ELSE -l.amount_minor END) <> 0
   ) bad),
  0::bigint,
  'every refund journal entry balances'
);
SELECT is(
  (SELECT count(*) FROM public.refunds r
   WHERE r.status = 'completed'
     AND (SELECT l.amount FROM public.journal_lines l
          WHERE l.journal_entry_id = r.journal_entry_id AND l.side = 'debit') <> r.amount),
  0::bigint,
  'every completed refund journals exactly its amount'
);
SELECT is(
  (SELECT count(*) FROM public.payment_intents p
   WHERE p.id::text LIKE 'e0000000-%'
     AND (SELECT coalesce(sum(r.amount), 0) FROM public.refunds r
          WHERE r.payment_intent_id = p.id AND r.status = 'completed') > p.amount),
  0::bigint,
  'no payment refunded beyond what was paid'
);
SELECT is(
  (SELECT count(*) FROM public.journal_entries
   WHERE source_type IN ('refund_wallet_fix', 'refund_overpost_fix')),
  0::bigint,
  'new refunds need no corrections'
);

SELECT * FROM finish();
ROLLBACK;
