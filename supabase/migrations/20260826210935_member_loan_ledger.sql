-- Member loan ledger: profit share, repayments, and rollovers (table-banking style).
-- Mirrors Asha's Excel columns: NEW LOAN / INTEREST(profit) / REPAYMENT / rollover+top-up.

ALTER TABLE public.jamiyas
  ADD COLUMN IF NOT EXISTS loan_profit_rate_pct NUMERIC(5, 2) DEFAULT 10
    CHECK (loan_profit_rate_pct >= 0 AND loan_profit_rate_pct <= 100);

COMMENT ON COLUMN public.jamiyas.loan_profit_rate_pct IS
  'Default profit-share rate (%) on member loan balances for internal table-banking ledgers.';

CREATE TABLE IF NOT EXISTS public.member_loan_facilities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  jamiya_id UUID NOT NULL REFERENCES public.jamiyas (id) ON DELETE CASCADE,
  member_id UUID NOT NULL REFERENCES public.members (id) ON DELETE CASCADE,
  currency CHAR(3) NOT NULL DEFAULT 'KES',
  principal_outstanding NUMERIC(18, 2) NOT NULL DEFAULT 0 CHECK (principal_outstanding >= 0),
  profit_rate_pct NUMERIC(5, 2),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'closed')),
  opened_on DATE NOT NULL,
  closed_on DATE,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS member_loan_facilities_one_active_idx
  ON public.member_loan_facilities (jamiya_id, member_id)
  WHERE status = 'active';

CREATE INDEX IF NOT EXISTS member_loan_facilities_jamiya_idx
  ON public.member_loan_facilities (jamiya_id, member_id);

CREATE TABLE IF NOT EXISTS public.member_loan_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  facility_id UUID NOT NULL REFERENCES public.member_loan_facilities (id) ON DELETE CASCADE,
  jamiya_id UUID NOT NULL REFERENCES public.jamiyas (id) ON DELETE CASCADE,
  member_id UUID NOT NULL REFERENCES public.members (id) ON DELETE CASCADE,
  event_type TEXT NOT NULL CHECK (event_type IN ('disbursement', 'profit', 'repayment', 'rollover')),
  amount NUMERIC(18, 2) NOT NULL CHECK (amount >= 0),
  profit_amount NUMERIC(18, 2) NOT NULL DEFAULT 0 CHECK (profit_amount >= 0),
  principal_delta NUMERIC(18, 2) NOT NULL DEFAULT 0,
  effective_date DATE NOT NULL,
  entered_by UUID NOT NULL REFERENCES public.profiles (id),
  notes TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  book_entry_id UUID REFERENCES public.book_entries (id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS member_loan_events_facility_idx
  ON public.member_loan_events (facility_id, effective_date DESC);

CREATE INDEX IF NOT EXISTS member_loan_events_jamiya_member_idx
  ON public.member_loan_events (jamiya_id, member_id, effective_date DESC);

ALTER TABLE public.member_loan_facilities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.member_loan_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS member_loan_facilities_select ON public.member_loan_facilities;
CREATE POLICY member_loan_facilities_select ON public.member_loan_facilities
  FOR SELECT TO authenticated
  USING (
    private.is_jamiya_member(jamiya_id)
    OR private.is_circle_officer(jamiya_id)
    OR private.is_platform_admin()
  );

DROP POLICY IF EXISTS member_loan_facilities_officer_write ON public.member_loan_facilities;
CREATE POLICY member_loan_facilities_officer_write ON public.member_loan_facilities
  FOR ALL TO authenticated
  USING (private.is_circle_officer(jamiya_id) OR private.is_platform_admin())
  WITH CHECK (private.is_circle_officer(jamiya_id) OR private.is_platform_admin());

DROP POLICY IF EXISTS member_loan_events_select ON public.member_loan_events;
CREATE POLICY member_loan_events_select ON public.member_loan_events
  FOR SELECT TO authenticated
  USING (
    private.is_jamiya_member(jamiya_id)
    OR private.is_circle_officer(jamiya_id)
    OR private.is_platform_admin()
  );

DROP POLICY IF EXISTS member_loan_events_officer_insert ON public.member_loan_events;
CREATE POLICY member_loan_events_officer_insert ON public.member_loan_events
  FOR INSERT TO authenticated
  WITH CHECK (private.is_circle_officer(jamiya_id) OR private.is_platform_admin());

GRANT SELECT ON public.member_loan_facilities TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.member_loan_facilities TO authenticated;
GRANT SELECT, INSERT ON public.member_loan_events TO authenticated;

-- Mirror profit in cashbook for treasury totals.
ALTER TABLE public.book_entries DROP CONSTRAINT IF EXISTS book_entries_entry_type_check;
ALTER TABLE public.book_entries
  ADD CONSTRAINT book_entries_entry_type_check CHECK (entry_type IN (
    'opening_balance', 'contribution', 'payout', 'loan', 'loan_repayment', 'loan_profit',
    'penalty', 'withdrawal', 'adjustment', 'merry_go_round',
    'income', 'expense', 'bank_deposit', 'bank_withdrawal', 'bank_transfer', 'investment'
  ));

CREATE OR REPLACE FUNCTION public.ensure_member_loan_facility(
  p_jamiya_id UUID,
  p_member_id UUID,
  p_opened_on DATE DEFAULT CURRENT_DATE
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_currency CHAR(3);
  v_facility_id UUID;
  v_rate NUMERIC(5, 2);
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'UNAUTHENTICATED';
  END IF;
  IF NOT (private.is_circle_officer(p_jamiya_id) OR private.is_platform_admin()) THEN
    RAISE EXCEPTION 'FORBIDDEN';
  END IF;

  SELECT id INTO v_facility_id
  FROM public.member_loan_facilities
  WHERE jamiya_id = p_jamiya_id
    AND member_id = p_member_id
    AND status = 'active'
  LIMIT 1;

  IF v_facility_id IS NOT NULL THEN
    RETURN v_facility_id;
  END IF;

  SELECT currency, loan_profit_rate_pct
  INTO v_currency, v_rate
  FROM public.jamiyas
  WHERE id = p_jamiya_id;

  INSERT INTO public.member_loan_facilities (
    jamiya_id, member_id, currency, profit_rate_pct, opened_on
  ) VALUES (
    p_jamiya_id, p_member_id, COALESCE(v_currency, 'KES'), v_rate, COALESCE(p_opened_on, CURRENT_DATE)
  )
  RETURNING id INTO v_facility_id;

  RETURN v_facility_id;
END;
$$;

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
      RETURN jsonb_build_object('ok', false, 'error', 'REPAYMENT_EXCEEDS_PRINCIPAL');
    END IF;
    v_book_type := 'loan_repayment';
  ELSIF p_event_type = 'rollover' THEN
    v_new_principal := COALESCE(p_new_principal, v_amount);
    IF v_new_principal < 0 THEN
      RETURN jsonb_build_object('ok', false, 'error', 'INVALID_NEW_PRINCIPAL');
    END IF;
    IF v_profit > 0 AND v_facility.principal_outstanding > 0 AND v_profit > v_facility.principal_outstanding THEN
      -- profit is usually % of balance, not capped by principal — allow
      NULL;
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
      ELSE status
    END,
    closed_on = CASE
      WHEN p_event_type = 'rollover' AND COALESCE(v_new_principal, 0) = 0 THEN p_effective_date
      WHEN principal_outstanding + v_principal_delta <= 0 AND p_event_type = 'repayment' THEN p_effective_date
      ELSE closed_on
    END
  WHERE id = v_facility.id;

  IF p_event_type = 'repayment' AND v_profit > 0 THEN
    INSERT INTO public.book_entries (
      jamiya_id, member_id, entry_type, amount, currency, effective_date, entered_by, notes, metadata
    ) VALUES (
      p_jamiya_id, p_member_id, 'loan_profit', v_profit, COALESCE(v_currency, 'KES'),
      p_effective_date, v_uid, COALESCE(p_notes, 'Profit on repayment'), jsonb_build_object('loan_event_id', v_event_id)
    );
  ELSIF p_book_type IS NOT NULL THEN
    INSERT INTO public.book_entries (
      jamiya_id, member_id, entry_type, amount, currency, effective_date, entered_by, notes, metadata
    ) VALUES (
      p_jamiya_id, p_member_id, v_book_type,
      CASE WHEN p_event_type = 'repayment' THEN v_amount - v_profit ELSE v_amount END,
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
      p_effective_date, v_uid, COALESCE(p_notes, 'Profit on rollover'), jsonb_build_object('loan_event_id', v_event_id)
    );
  END IF;

  IF p_event_type = 'rollover' AND v_new_principal > 0 THEN
    INSERT INTO public.book_entries (
      jamiya_id, member_id, entry_type, amount, currency, effective_date, entered_by, notes, metadata
    ) VALUES (
      p_jamiya_id, p_member_id, 'loan', v_new_principal, COALESCE(v_currency, 'KES'),
      p_effective_date, v_uid, COALESCE(p_notes, 'Rollover loan'), jsonb_build_object('loan_event_id', v_event_id, 'rollover', true)
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

CREATE OR REPLACE FUNCTION public.member_loan_ledger_summary(
  p_jamiya_id UUID,
  p_member_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_facility public.member_loan_facilities%ROWTYPE;
  v_default_rate NUMERIC(5, 2);
  v_profit_paid NUMERIC(18, 2) := 0;
  v_disbursed NUMERIC(18, 2) := 0;
  v_repaid_principal NUMERIC(18, 2) := 0;
  v_events JSONB;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'UNAUTHENTICATED');
  END IF;
  IF NOT (
    private.is_jamiya_member(p_jamiya_id)
    OR private.is_circle_officer(p_jamiya_id)
    OR private.is_platform_admin()
  ) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'FORBIDDEN');
  END IF;

  SELECT loan_profit_rate_pct INTO v_default_rate FROM public.jamiyas WHERE id = p_jamiya_id;

  SELECT * INTO v_facility
  FROM public.member_loan_facilities
  WHERE jamiya_id = p_jamiya_id AND member_id = p_member_id AND status = 'active'
  ORDER BY opened_on DESC
  LIMIT 1;

  SELECT
    COALESCE(sum(profit_amount), 0),
    COALESCE(sum(CASE WHEN event_type = 'disbursement' THEN amount ELSE 0 END), 0),
    COALESCE(sum(CASE WHEN event_type IN ('repayment', 'rollover') THEN amount - profit_amount ELSE 0 END), 0)
  INTO v_profit_paid, v_disbursed, v_repaid_principal
  FROM public.member_loan_events
  WHERE jamiya_id = p_jamiya_id AND member_id = p_member_id;

  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'id', e.id,
      'event_type', e.event_type,
      'amount', e.amount,
      'profit_amount', e.profit_amount,
      'principal_delta', e.principal_delta,
      'effective_date', e.effective_date,
      'notes', e.notes
    )
    ORDER BY e.effective_date DESC, e.created_at DESC
  ), '[]'::jsonb)
  INTO v_events
  FROM public.member_loan_events e
  WHERE e.jamiya_id = p_jamiya_id AND e.member_id = p_member_id
  LIMIT 100;

  RETURN jsonb_build_object(
    'ok', true,
    'facility', CASE WHEN v_facility.id IS NULL THEN NULL ELSE jsonb_build_object(
      'id', v_facility.id,
      'principal_outstanding', v_facility.principal_outstanding,
      'profit_rate_pct', COALESCE(v_facility.profit_rate_pct, v_default_rate),
      'status', v_facility.status,
      'opened_on', v_facility.opened_on
    ) END,
    'totals', jsonb_build_object(
      'profit_paid', v_profit_paid,
      'disbursed', v_disbursed,
      'repaid_principal', v_repaid_principal
    ),
    'events', v_events
  );
END;
$$;

REVOKE ALL ON FUNCTION public.ensure_member_loan_facility(UUID, UUID, DATE) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.ensure_member_loan_facility(UUID, UUID, DATE) TO authenticated;

REVOKE ALL ON FUNCTION public.record_member_loan_event(UUID, UUID, TEXT, NUMERIC, DATE, TEXT, NUMERIC, NUMERIC) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.record_member_loan_event(UUID, UUID, TEXT, NUMERIC, DATE, TEXT, NUMERIC, NUMERIC) TO authenticated;

REVOKE ALL ON FUNCTION public.member_loan_ledger_summary(UUID, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.member_loan_ledger_summary(UUID, UUID) TO authenticated;

-- Allow loan_profit in CSV import helper.
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
  IF NOT (private.is_circle_officer(p_jamiya_id) OR private.is_platform_admin()) THEN
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
      'opening_balance', 'contribution', 'payout', 'loan', 'loan_repayment', 'loan_profit',
      'penalty', 'withdrawal', 'adjustment', 'merry_go_round',
      'income', 'expense', 'bank_deposit', 'bank_withdrawal', 'bank_transfer', 'investment'
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
