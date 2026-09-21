-- Disbursement was setting facility status to 'open', but the check only allows
-- 'active' | 'closed'. That blocked every New facility save for Asha.

CREATE OR REPLACE FUNCTION public.record_member_loan_event(
  p_jamiya_id UUID,
  p_member_id UUID,
  p_event_type TEXT,
  p_amount NUMERIC,
  p_effective_date DATE,
  p_notes TEXT DEFAULT NULL,
  p_profit_amount NUMERIC DEFAULT 0,
  p_new_principal NUMERIC DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_facility_id UUID;
  v_facility public.member_loan_facilities%ROWTYPE;
  v_currency CHAR(3);
  v_event_id UUID;
  v_book_id UUID;
  v_principal_delta NUMERIC(18, 2) := 0;
  v_profit NUMERIC(18, 2) := COALESCE(p_profit_amount, 0);
  v_amount NUMERIC(18, 2) := COALESCE(p_amount, 0);
  v_prior_principal NUMERIC(18, 2);
  v_new_principal NUMERIC(18, 2);
  v_book_type TEXT;
  v_principal_paid NUMERIC(18, 2);
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'UNAUTHENTICATED');
  END IF;
  IF NOT (private.is_circle_officer(p_jamiya_id) OR private.is_platform_admin()) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'FORBIDDEN');
  END IF;

  p_event_type := lower(btrim(p_event_type));
  IF p_event_type NOT IN ('disbursement', 'profit', 'repayment', 'rollover') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'INVALID_EVENT_TYPE');
  END IF;
  IF v_amount < 0 OR v_profit < 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'INVALID_AMOUNT');
  END IF;
  IF p_effective_date IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'INVALID_DATE');
  END IF;

  SELECT currency INTO v_currency FROM public.jamiyas WHERE id = p_jamiya_id;

  v_facility_id := public.ensure_member_loan_facility(p_jamiya_id, p_member_id, p_effective_date);

  SELECT * INTO v_facility
  FROM public.member_loan_facilities
  WHERE id = v_facility_id
  FOR UPDATE;

  v_prior_principal := v_facility.principal_outstanding;

  IF p_event_type = 'disbursement' THEN
    IF v_amount <= 0 THEN
      RETURN jsonb_build_object('ok', false, 'error', 'DISBURSEMENT_AMOUNT_REQUIRED');
    END IF;
    v_principal_delta := v_amount;
    v_book_type := 'loan';
  ELSIF p_event_type = 'profit' THEN
    IF v_amount <= 0 THEN
      RETURN jsonb_build_object('ok', false, 'error', 'PROFIT_AMOUNT_REQUIRED');
    END IF;
    v_profit := v_amount;
    v_principal_delta := 0;
    v_book_type := 'loan_profit';
  ELSIF p_event_type = 'repayment' THEN
    IF v_amount <= 0 THEN
      RETURN jsonb_build_object('ok', false, 'error', 'REPAYMENT_AMOUNT_REQUIRED');
    END IF;
    IF v_profit > v_amount THEN
      RETURN jsonb_build_object('ok', false, 'error', 'PROFIT_EXCEEDS_REPAYMENT');
    END IF;
    v_principal_delta := -(v_amount - v_profit);
    IF v_facility.principal_outstanding + v_principal_delta < 0 THEN
      RETURN jsonb_build_object(
        'ok', false,
        'error', 'REPAYMENT_EXCEEDS_PRINCIPAL',
        'principal_outstanding', v_facility.principal_outstanding
      );
    END IF;
    v_book_type := 'loan_repayment';
  ELSIF p_event_type = 'rollover' THEN
    v_new_principal := COALESCE(p_new_principal, v_amount);
    IF v_new_principal < 0 THEN
      RETURN jsonb_build_object('ok', false, 'error', 'INVALID_NEW_PRINCIPAL');
    END IF;
    v_amount := v_new_principal;
    v_principal_delta := v_new_principal - v_facility.principal_outstanding;
    v_book_type := NULL;
  END IF;

  INSERT INTO public.member_loan_events (
    facility_id, jamiya_id, member_id, event_type,
    amount, profit_amount, principal_delta,
    effective_date, entered_by, notes, metadata
  ) VALUES (
    v_facility.id, p_jamiya_id, p_member_id, p_event_type,
    v_amount, v_profit, v_principal_delta,
    p_effective_date, v_uid, p_notes,
    CASE
      WHEN p_event_type = 'rollover' THEN jsonb_build_object(
        'prior_principal', v_prior_principal,
        'new_principal', v_new_principal,
        'profit_paid', v_profit
      )
      ELSE '{}'::jsonb
    END
  )
  RETURNING id INTO v_event_id;

  UPDATE public.member_loan_facilities
  SET
    principal_outstanding = GREATEST(principal_outstanding + v_principal_delta, 0),
    updated_at = NOW(),
    status = CASE
      WHEN p_event_type = 'rollover' AND COALESCE(v_new_principal, 0) = 0 THEN 'closed'
      WHEN principal_outstanding + v_principal_delta <= 0 AND p_event_type = 'repayment' THEN 'closed'
      WHEN p_event_type = 'disbursement' THEN 'active'
      ELSE status
    END,
    closed_on = CASE
      WHEN p_event_type = 'rollover' AND COALESCE(v_new_principal, 0) = 0 THEN p_effective_date
      WHEN principal_outstanding + v_principal_delta <= 0 AND p_event_type = 'repayment' THEN p_effective_date
      WHEN p_event_type = 'disbursement' THEN NULL
      ELSE closed_on
    END
  WHERE id = v_facility.id;

  IF p_event_type = 'repayment' THEN
    v_principal_paid := v_amount - v_profit;
    IF v_principal_paid > 0 THEN
      INSERT INTO public.book_entries (
        jamiya_id, member_id, entry_type, amount, currency, effective_date, entered_by, notes, metadata
      ) VALUES (
        p_jamiya_id, p_member_id, 'loan_repayment', v_principal_paid, COALESCE(v_currency, 'KES'),
        p_effective_date, v_uid, p_notes, jsonb_build_object('loan_event_id', v_event_id)
      )
      RETURNING id INTO v_book_id;
      UPDATE public.member_loan_events SET book_entry_id = v_book_id WHERE id = v_event_id;
    END IF;
    IF v_profit > 0 THEN
      INSERT INTO public.book_entries (
        jamiya_id, member_id, entry_type, amount, currency, effective_date, entered_by, notes, metadata
      ) VALUES (
        p_jamiya_id, p_member_id, 'loan_profit', v_profit, COALESCE(v_currency, 'KES'),
        p_effective_date, v_uid, COALESCE(p_notes, 'Profit on repayment'),
        jsonb_build_object('loan_event_id', v_event_id)
      );
    END IF;
  ELSIF v_book_type IS NOT NULL THEN
    INSERT INTO public.book_entries (
      jamiya_id, member_id, entry_type, amount, currency, effective_date, entered_by, notes, metadata
    ) VALUES (
      p_jamiya_id, p_member_id, v_book_type, v_amount,
      COALESCE(v_currency, 'KES'), p_effective_date, v_uid, p_notes,
      jsonb_build_object('loan_event_id', v_event_id)
    )
    RETURNING id INTO v_book_id;
    UPDATE public.member_loan_events SET book_entry_id = v_book_id WHERE id = v_event_id;
  END IF;

  IF p_event_type = 'rollover' AND v_profit > 0 THEN
    INSERT INTO public.book_entries (
      jamiya_id, member_id, entry_type, amount, currency, effective_date, entered_by, notes, metadata
    ) VALUES (
      p_jamiya_id, p_member_id, 'loan_profit', v_profit, COALESCE(v_currency, 'KES'),
      p_effective_date, v_uid, COALESCE(p_notes, 'Profit on rollover'),
      jsonb_build_object('loan_event_id', v_event_id)
    );
  END IF;

  IF p_event_type = 'rollover' AND v_new_principal > 0 THEN
    INSERT INTO public.book_entries (
      jamiya_id, member_id, entry_type, amount, currency, effective_date, entered_by, notes, metadata
    ) VALUES (
      p_jamiya_id, p_member_id, 'loan', v_new_principal, COALESCE(v_currency, 'KES'),
      p_effective_date, v_uid, COALESCE(p_notes, 'Rollover loan'),
      jsonb_build_object('loan_event_id', v_event_id, 'rollover', true)
    );
  END IF;

  SELECT principal_outstanding INTO v_new_principal
  FROM public.member_loan_facilities WHERE id = v_facility.id;

  RETURN jsonb_build_object(
    'ok', true,
    'event_id', v_event_id,
    'principal_outstanding', v_new_principal
  );
END;
$$;
