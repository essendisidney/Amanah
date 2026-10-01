-- Platform revenue in the books.
-- Fees charged to member wallets (circle plans, contribution fees, join and early-slot fees)
-- reduced the wallet but never posted a journal, so the wallet liability was overstated and
-- no income was recorded. This posts every fee as: Dr 2000 Member wallet liability / Cr income,
-- splits the Sadaka platform fee out of charity clearing, backfills history, and adds an
-- admin-only revenue summary.

-- 1. Income accounts (2100 stays as "other platform income").
INSERT INTO public.ledger_accounts (code, name, domain, normal_balance, currency, is_active)
VALUES
  ('2110', 'Circle plan income', 'OPERATING', 'credit', 'KES', true),
  ('2120', 'Contribution fee income', 'OPERATING', 'credit', 'KES', true),
  ('2130', 'Join and slot fee income', 'OPERATING', 'credit', 'KES', true),
  ('2140', 'Sadaka platform fee income', 'OPERATING', 'credit', 'KES', true),
  ('2150', 'Financing fee income', 'OPERATING', 'credit', 'KES', true)
ON CONFLICT (code) DO NOTHING;

UPDATE public.ledger_accounts SET name = 'Other platform income' WHERE code = '2100';

-- 2. Which income account a fee belongs to.
CREATE OR REPLACE FUNCTION private.fee_income_code(p_kind text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path TO ''
AS $$
  SELECT CASE
    WHEN p_kind IN ('circle_plan', 'circle_plan_renewal') THEN '2110'
    WHEN p_kind = 'contribution_fee' THEN '2120'
    WHEN p_kind IN ('join_fee', 'early_slot_fee') THEN '2130'
    WHEN p_kind IN ('sadaka_fee', 'charity_fee') THEN '2140'
    WHEN p_kind IN ('financing_fee', 'tawarruq_fee') THEN '2150'
    ELSE '2100'
  END;
$$;

-- 3. Post a journal for one completed wallet fee (idempotent via source_type/source_id).
CREATE OR REPLACE FUNCTION private.post_journal_for_fee(p_tx_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  v_tx public.transactions%ROWTYPE;
  v_kind text;
BEGIN
  SELECT * INTO v_tx FROM public.transactions WHERE id = p_tx_id;
  IF NOT FOUND OR v_tx.type <> 'fee' OR v_tx.status <> 'completed'
     OR coalesce(v_tx.direction, 'debit') <> 'debit' OR coalesce(v_tx.amount, 0) <= 0 THEN
    RETURN NULL;
  END IF;
  v_kind := coalesce(v_tx.metadata->>'kind', 'fee');
  RETURN private.post_balanced_journal(
    'fee_transaction',
    v_tx.id::text,
    'OPERATING',
    'Platform fee: ' || replace(v_kind, '_', ' '),
    v_tx.currency,
    '2000',
    private.fee_income_code(v_kind),
    v_tx.amount,
    NULL,
    v_tx.jamiya_id,
    v_tx.user_id,
    jsonb_build_object('kind', v_kind, 'transaction_id', v_tx.id)
  );
END;
$$;

CREATE OR REPLACE FUNCTION private.trg_fee_transaction_journal()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
BEGIN
  IF NEW.type = 'fee' AND NEW.status = 'completed' THEN
    PERFORM private.post_journal_for_fee(NEW.id);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS fee_transaction_journal ON public.transactions;
CREATE TRIGGER fee_transaction_journal
AFTER INSERT OR UPDATE OF status ON public.transactions
FOR EACH ROW
WHEN (NEW.type = 'fee' AND NEW.status = 'completed')
EXECUTE FUNCTION private.trg_fee_transaction_journal();

-- 4. Sadaka: the donation lands in 5000 charity clearing; move the platform fee to income.
CREATE OR REPLACE FUNCTION private.post_journal_for_sadaka_fee(p_donation_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  v_d public.charity_donations%ROWTYPE;
BEGIN
  SELECT * INTO v_d FROM public.charity_donations WHERE id = p_donation_id;
  IF NOT FOUND OR coalesce(v_d.fee_amount, 0) <= 0 THEN
    RETURN NULL;
  END IF;
  RETURN private.post_balanced_journal(
    'sadaka_fee',
    v_d.id::text,
    'SADAKA',
    'Sadaka platform fee',
    v_d.currency,
    '5000',
    '2140',
    v_d.fee_amount,
    v_d.payment_intent_id,
    NULL,
    v_d.donor_user_id,
    jsonb_build_object('kind', 'sadaka_fee', 'campaign_id', v_d.campaign_id, 'donation_id', v_d.id)
  );
END;
$$;

CREATE OR REPLACE FUNCTION private.trg_sadaka_fee_journal()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
BEGIN
  IF coalesce(NEW.fee_amount, 0) > 0 THEN
    PERFORM private.post_journal_for_sadaka_fee(NEW.id);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS sadaka_fee_journal ON public.charity_donations;
CREATE TRIGGER sadaka_fee_journal
AFTER INSERT OR UPDATE OF fee_amount ON public.charity_donations
FOR EACH ROW
WHEN (coalesce(NEW.fee_amount, 0) > 0)
EXECUTE FUNCTION private.trg_sadaka_fee_journal();

-- 5. Backfill history.
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN SELECT id FROM public.transactions WHERE type = 'fee' AND status = 'completed' LOOP
    PERFORM private.post_journal_for_fee(r.id);
  END LOOP;
  FOR r IN SELECT id FROM public.charity_donations WHERE coalesce(fee_amount, 0) > 0 LOOP
    PERFORM private.post_journal_for_sadaka_fee(r.id);
  END LOOP;
END;
$$;

-- 6. Admin revenue summary: booked income by stream, by day and by circle, plus plan
--    recurring revenue and financing fees agreed but not yet collected.
CREATE OR REPLACE FUNCTION public.admin_revenue_summary(p_from date, p_to date)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  v_from timestamptz := p_from::timestamptz;
  v_to timestamptz := (p_to + 1)::timestamptz;
  v_result jsonb;
BEGIN
  IF NOT private.is_platform_admin() THEN
    RETURN jsonb_build_object('ok', false, 'error', 'FORBIDDEN');
  END IF;

  WITH income AS (
    SELECT la.code, la.name, je.posted_at, je.jamiya_id,
           CASE WHEN jl.side = 'credit' THEN jl.amount ELSE -jl.amount END AS amt
    FROM public.journal_lines jl
    JOIN public.journal_entries je ON je.id = jl.journal_entry_id
    JOIN public.ledger_accounts la ON la.id = jl.ledger_account_id
    WHERE la.code BETWEEN '2100' AND '2199'
  ),
  in_range AS (
    SELECT * FROM income WHERE posted_at >= v_from AND posted_at < v_to
  )
  SELECT jsonb_build_object(
    'ok', true,
    'from', p_from,
    'to', p_to,
    'total', coalesce((SELECT sum(amt) FROM in_range), 0),
    'all_time', coalesce((SELECT sum(amt) FROM income), 0),
    'by_stream', coalesce((
      SELECT jsonb_agg(jsonb_build_object('code', s.code, 'name', s.name, 'amount', s.amount) ORDER BY s.code)
      FROM (
        SELECT la.code, la.name, coalesce((SELECT sum(amt) FROM in_range r WHERE r.code = la.code), 0) AS amount
        FROM public.ledger_accounts la
        WHERE la.code BETWEEN '2100' AND '2199'
      ) s
    ), '[]'::jsonb),
    'by_day', coalesce((
      SELECT jsonb_agg(jsonb_build_object('day', d.day, 'amount', d.amount) ORDER BY d.day)
      FROM (
        SELECT (posted_at AT TIME ZONE 'Africa/Nairobi')::date AS day, sum(amt) AS amount
        FROM in_range GROUP BY 1
      ) d
    ), '[]'::jsonb),
    'by_circle', coalesce((
      SELECT jsonb_agg(jsonb_build_object('jamiya_id', c.jamiya_id, 'name', c.name, 'amount', c.amount) ORDER BY c.amount DESC)
      FROM (
        SELECT r.jamiya_id, j.name, sum(r.amt) AS amount
        FROM in_range r LEFT JOIN public.jamiyas j ON j.id = r.jamiya_id
        WHERE r.jamiya_id IS NOT NULL
        GROUP BY 1, 2
        ORDER BY 3 DESC
        LIMIT 10
      ) c
    ), '[]'::jsonb),
    'paying_circles', (
      SELECT count(*) FROM public.circle_subscriptions s
      JOIN public.platform_plans p ON p.id = s.plan_id
      WHERE s.status = 'active' AND p.price_kes > 0
    ),
    'monthly_recurring', coalesce((
      SELECT sum(p.price_kes) FROM public.circle_subscriptions s
      JOIN public.platform_plans p ON p.id = s.plan_id
      WHERE s.status = 'active' AND p.price_kes > 0
    ), 0),
    'circles_total', (SELECT count(*) FROM public.jamiyas WHERE status IN ('open', 'active')),
    'financing_fees_agreed', coalesce((
      SELECT sum(platform_fee_amount) FROM public.tawarruq_applications
      WHERE status IN ('approved', 'submitted_to_partner', 'disbursed')
    ), 0)
  ) INTO v_result;

  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_revenue_summary(date, date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_revenue_summary(date, date) TO authenticated;
REVOKE ALL ON FUNCTION private.post_journal_for_fee(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION private.post_journal_for_sadaka_fee(uuid) FROM PUBLIC, anon, authenticated;
