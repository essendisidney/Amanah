-- Remaining gaps wave: loan penalties, pocket moves, WhatsApp channel,
-- deceased status, circle KPIs, Sadaka Option A custody fields.

DO $$ BEGIN
  ALTER TYPE public.membership_status ADD VALUE IF NOT EXISTS 'deceased';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TYPE public.notification_channel ADD VALUE IF NOT EXISTS 'whatsapp';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE public.notification_outbox
  DROP CONSTRAINT IF EXISTS notification_outbox_channel_delivery;
ALTER TABLE public.notification_outbox
  ADD CONSTRAINT notification_outbox_channel_delivery
  CHECK (channel IN ('email', 'sms', 'push', 'whatsapp'));

ALTER TABLE public.charity_campaigns
  ADD COLUMN IF NOT EXISTS custody_mode TEXT NOT NULL DEFAULT 'amanah_pass_through',
  ADD COLUMN IF NOT EXISTS psp_subaccount_ref TEXT,
  ADD COLUMN IF NOT EXISTS psp_provider TEXT;

DO $$ BEGIN
  ALTER TABLE public.charity_campaigns
    ADD CONSTRAINT charity_campaigns_custody_mode_check
    CHECK (custody_mode IN ('amanah_pass_through', 'psp_subaccount'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ---------------------------------------------------------------------------
-- Assess late loan penalties (idempotent per loan per due period)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.assess_loan_penalties(p_jamiya_id UUID DEFAULT NULL)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_count INT := 0;
  r RECORD;
  v_amt NUMERIC;
BEGIN
  FOR r IN
    SELECT
      l.id AS loan_id,
      l.jamiya_id,
      l.borrower_id,
      l.amount,
      l.amount_repaid,
      l.currency,
      l.due_date,
      j.late_loan_penalty_fixed,
      j.late_loan_penalty_pct,
      m.id AS member_id
    FROM public.qard_loans l
    JOIN public.jamiyas j ON j.id = l.jamiya_id
    JOIN public.members m ON m.jamiya_id = l.jamiya_id AND m.user_id = l.borrower_id
    WHERE l.status = 'active'
      AND l.due_date IS NOT NULL
      AND l.due_date < CURRENT_DATE
      AND l.amount_repaid < l.amount
      AND (j.late_loan_penalty_fixed > 0 OR j.late_loan_penalty_pct > 0)
      AND (p_jamiya_id IS NULL OR l.jamiya_id = p_jamiya_id)
      AND NOT EXISTS (
        SELECT 1 FROM public.penalties p
        WHERE p.qard_loan_id = l.id
          AND p.kind = 'late_loan'
          AND p.status IN ('open', 'paid')
          AND p.assessed_at::date = CURRENT_DATE
      )
  LOOP
    v_amt := COALESCE(r.late_loan_penalty_fixed, 0)
      + ROUND(
          GREATEST(r.amount - r.amount_repaid, 0) * COALESCE(r.late_loan_penalty_pct, 0) / 100.0,
          2
        );
    IF v_amt <= 0 THEN
      CONTINUE;
    END IF;

    INSERT INTO public.penalties (
      jamiya_id, member_id, user_id, kind, amount, currency, qard_loan_id, notes
    ) VALUES (
      r.jamiya_id, r.member_id, r.borrower_id, 'late_loan', v_amt, r.currency,
      r.loan_id, 'Auto-assessed late loan penalty'
    );
    v_count := v_count + 1;

    INSERT INTO public.notifications (user_id, type, channel, title, body, data)
    VALUES (
      r.borrower_id,
      'system',
      'in_app',
      'Late loan penalty',
      'A penalty of ' || v_amt::text || ' ' || r.currency || ' was assessed on your facility.',
      jsonb_build_object('loan_id', r.loan_id, 'penalty', v_amt)
    );
  END LOOP;

  RETURN jsonb_build_object('ok', true, 'assessed', v_count);
END;
$$;

REVOKE ALL ON FUNCTION public.assess_loan_penalties(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.assess_loan_penalties(UUID) TO authenticated;

-- ---------------------------------------------------------------------------
-- Savings pocket deposit (wallet → pocket) / withdraw (pocket → wallet)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.move_savings_pocket(
  p_pocket_id UUID,
  p_amount NUMERIC,
  p_direction TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_p public.savings_pockets%ROWTYPE;
  v_m public.members%ROWTYPE;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'UNAUTHENTICATED');
  END IF;
  IF p_amount IS NULL OR p_amount <= 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'INVALID_AMOUNT');
  END IF;
  IF p_direction NOT IN ('deposit', 'withdraw') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'INVALID_DIRECTION');
  END IF;

  SELECT * INTO v_p FROM public.savings_pockets WHERE id = p_pocket_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'NOT_FOUND');
  END IF;

  SELECT * INTO v_m FROM public.members WHERE id = v_p.member_id;
  IF v_m.user_id <> v_uid AND NOT private.is_circle_admin(v_p.jamiya_id) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'FORBIDDEN');
  END IF;

  IF p_direction = 'deposit' THEN
    PERFORM private.ledger_debit(
      v_m.user_id, v_p.currency, p_amount, 'contribution'::public.transaction_type,
      v_p.jamiya_id, 'savings_pocket', p_pocket_id::text,
      jsonb_build_object('kind', 'pocket_deposit', 'category', v_p.category)
    );
    UPDATE public.savings_pockets
    SET balance = balance + p_amount, updated_at = NOW()
    WHERE id = p_pocket_id;
  ELSE
    IF v_p.balance < p_amount THEN
      RETURN jsonb_build_object('ok', false, 'error', 'INSUFFICIENT_POCKET');
    END IF;
    UPDATE public.savings_pockets
    SET balance = balance - p_amount, updated_at = NOW()
    WHERE id = p_pocket_id;
    PERFORM private.ledger_credit(
      v_m.user_id, v_p.currency, p_amount, 'payout'::public.transaction_type,
      v_p.jamiya_id, 'savings_pocket', p_pocket_id::text,
      jsonb_build_object('kind', 'pocket_withdraw', 'category', v_p.category)
    );
  END IF;

  RETURN jsonb_build_object('ok', true, 'balance', (
    SELECT balance FROM public.savings_pockets WHERE id = p_pocket_id
  ));
END;
$$;

REVOKE ALL ON FUNCTION public.move_savings_pocket(UUID, NUMERIC, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.move_savings_pocket(UUID, NUMERIC, TEXT) TO authenticated;

-- ---------------------------------------------------------------------------
-- Officer KPI snapshot
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.circle_officer_kpis(p_jamiya_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_late INT;
  v_partial INT;
  v_open_penalties NUMERIC;
  v_open_loans INT;
  v_loan_outstanding NUMERIC;
  v_fund JSONB;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'UNAUTHENTICATED');
  END IF;
  IF NOT (
    private.is_circle_admin(p_jamiya_id)
    OR private.is_jamiya_member(p_jamiya_id)
    OR private.is_platform_admin()
  ) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'FORBIDDEN');
  END IF;

  SELECT COUNT(*) FILTER (WHERE status = 'late')::INT,
         COUNT(*) FILTER (WHERE status = 'partial')::INT
  INTO v_late, v_partial
  FROM public.contributions WHERE jamiya_id = p_jamiya_id;

  SELECT COALESCE(SUM(amount), 0) INTO v_open_penalties
  FROM public.penalties WHERE jamiya_id = p_jamiya_id AND status = 'open';

  SELECT COUNT(*)::INT,
         COALESCE(SUM(GREATEST(amount - amount_repaid, 0)), 0)
  INTO v_open_loans, v_loan_outstanding
  FROM public.qard_loans
  WHERE jamiya_id = p_jamiya_id AND status = 'active';

  v_fund := public.table_banking_fund(p_jamiya_id);

  RETURN jsonb_build_object(
    'ok', true,
    'late_dues', v_late,
    'partial_dues', v_partial,
    'open_penalties', v_open_penalties,
    'active_loans', v_open_loans,
    'loan_outstanding', v_loan_outstanding,
    'available_to_lend', v_fund->'available_to_lend',
    'portfolio_at_risk_pct', v_fund->'portfolio_at_risk_pct',
    'overdue', v_fund->'overdue'
  );
END;
$$;

REVOKE ALL ON FUNCTION public.circle_officer_kpis(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.circle_officer_kpis(UUID) TO authenticated;

-- ---------------------------------------------------------------------------
-- Bulk book import helper (admin)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.import_book_entries(
  p_jamiya_id UUID,
  p_rows JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_row JSONB;
  v_count INT := 0;
  v_type TEXT;
  v_amount NUMERIC;
  v_date DATE;
  v_member UUID;
  v_notes TEXT;
  v_currency CHAR(3);
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'UNAUTHENTICATED');
  END IF;
  IF NOT (private.is_circle_admin(p_jamiya_id) OR private.is_platform_admin()) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'FORBIDDEN');
  END IF;
  IF p_rows IS NULL OR jsonb_typeof(p_rows) <> 'array' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'INVALID_ROWS');
  END IF;

  SELECT currency INTO v_currency FROM public.jamiyas WHERE id = p_jamiya_id;

  FOR v_row IN SELECT * FROM jsonb_array_elements(p_rows)
  LOOP
    v_type := lower(btrim(COALESCE(v_row->>'entry_type', '')));
    v_amount := NULLIF(v_row->>'amount', '')::NUMERIC;
    v_date := NULLIF(v_row->>'effective_date', '')::DATE;
    v_member := NULLIF(v_row->>'member_id', '')::UUID;
    v_notes := nullif(btrim(COALESCE(v_row->>'notes', '')), '');

    IF v_type NOT IN (
      'opening_balance', 'contribution', 'payout', 'loan', 'loan_repayment',
      'penalty', 'withdrawal', 'adjustment', 'merry_go_round'
    ) THEN
      CONTINUE;
    END IF;
    IF v_amount IS NULL OR v_date IS NULL THEN
      CONTINUE;
    END IF;

    INSERT INTO public.book_entries (
      jamiya_id, member_id, entry_type, amount, currency, effective_date, entered_by, notes,
      metadata
    ) VALUES (
      p_jamiya_id, v_member, v_type, v_amount, COALESCE(v_currency, 'KES'), v_date, v_uid, v_notes,
      jsonb_build_object('source', 'csv_import')
    );
    v_count := v_count + 1;
  END LOOP;

  RETURN jsonb_build_object('ok', true, 'imported', v_count);
END;
$$;

REVOKE ALL ON FUNCTION public.import_book_entries(UUID, JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.import_book_entries(UUID, JSONB) TO authenticated;

-- Queue WhatsApp-style reminder alongside SMS when broadcasting
CREATE OR REPLACE FUNCTION public.broadcast_announcement(
  p_jamiya_id UUID,
  p_title TEXT,
  p_body TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_ann UUID;
  v_count INT := 0;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'UNAUTHENTICATED');
  END IF;
  IF NOT private.is_circle_admin(p_jamiya_id) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'FORBIDDEN');
  END IF;

  INSERT INTO public.announcements (jamiya_id, created_by, title, body)
  VALUES (p_jamiya_id, v_uid, btrim(p_title), btrim(p_body))
  RETURNING id INTO v_ann;

  INSERT INTO public.notifications (user_id, type, channel, title, body, data)
  SELECT
    m.user_id,
    'system',
    'in_app',
    p_title,
    p_body,
    jsonb_build_object('jamiya_id', p_jamiya_id, 'announcement_id', v_ann)
  FROM public.members m
  WHERE m.jamiya_id = p_jamiya_id AND m.status = 'active';

  GET DIAGNOSTICS v_count = ROW_COUNT;

  -- Outbox SMS + WhatsApp for members with phones (dispatch skips if provider missing)
  INSERT INTO public.notification_outbox (channel, recipient, subject, body, user_id, metadata)
  SELECT
    ch.channel,
    p.phone,
    p_title,
    p_body,
    m.user_id,
    jsonb_build_object('jamiya_id', p_jamiya_id, 'announcement_id', v_ann, 'kind', 'broadcast')
  FROM public.members m
  JOIN public.profiles p ON p.id = m.user_id
  CROSS JOIN (VALUES ('sms'::public.notification_channel), ('whatsapp'::public.notification_channel)) AS ch(channel)
  WHERE m.jamiya_id = p_jamiya_id
    AND m.status = 'active'
    AND p.phone IS NOT NULL
    AND length(btrim(p.phone)) >= 9;

  RETURN jsonb_build_object('ok', true, 'announcement_id', v_ann, 'notified', v_count);
END;
$$;
