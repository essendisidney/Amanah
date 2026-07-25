-- Phase 4: Withdrawals, bank rails, member risk scores, collections hooks

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------
CREATE TYPE public.withdrawal_status AS ENUM (
  'pending',
  'processing',
  'completed',
  'failed',
  'cancelled'
);

CREATE TYPE public.risk_band AS ENUM ('low', 'medium', 'high', 'critical');

-- ---------------------------------------------------------------------------
-- withdrawal_requests
-- ---------------------------------------------------------------------------
CREATE TABLE public.withdrawal_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  amount NUMERIC(14, 2) NOT NULL CHECK (amount > 0),
  currency CHAR(3) NOT NULL DEFAULT 'KES',
  status public.withdrawal_status NOT NULL DEFAULT 'pending',
  destination_type TEXT NOT NULL DEFAULT 'mpesa'
    CHECK (destination_type IN ('mpesa', 'bank')),
  destination_phone TEXT,
  bank_name TEXT,
  bank_account_name TEXT,
  bank_account_number TEXT,
  transaction_id UUID REFERENCES public.transactions (id) ON DELETE SET NULL,
  provider_reference TEXT,
  error_message TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  processed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX withdrawal_requests_user_created_idx
  ON public.withdrawal_requests (user_id, created_at DESC);
CREATE INDEX withdrawal_requests_status_idx
  ON public.withdrawal_requests (status, created_at DESC);

CREATE TRIGGER withdrawal_requests_set_updated_at
  BEFORE UPDATE ON public.withdrawal_requests
  FOR EACH ROW EXECUTE FUNCTION private.set_updated_at();

ALTER TABLE public.withdrawal_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "withdrawal_requests_select_own"
  ON public.withdrawal_requests FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR private.is_compliance_or_admin());

CREATE POLICY "withdrawal_requests_insert_own"
  ON public.withdrawal_requests FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

REVOKE UPDATE, DELETE ON public.withdrawal_requests FROM authenticated, anon;
GRANT SELECT, INSERT ON public.withdrawal_requests TO authenticated;

-- ---------------------------------------------------------------------------
-- member_risk_scores
-- ---------------------------------------------------------------------------
CREATE TABLE public.member_risk_scores (
  user_id UUID PRIMARY KEY REFERENCES public.profiles (id) ON DELETE CASCADE,
  score INT NOT NULL DEFAULT 0 CHECK (score BETWEEN 0 AND 100),
  band public.risk_band NOT NULL DEFAULT 'low',
  late_contributions INT NOT NULL DEFAULT 0,
  open_disputes INT NOT NULL DEFAULT 0,
  failed_payments INT NOT NULL DEFAULT 0,
  factors JSONB NOT NULL DEFAULT '{}'::jsonb,
  computed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX member_risk_scores_band_idx ON public.member_risk_scores (band, score DESC);

CREATE TRIGGER member_risk_scores_set_updated_at
  BEFORE UPDATE ON public.member_risk_scores
  FOR EACH ROW EXECUTE FUNCTION private.set_updated_at();

ALTER TABLE public.member_risk_scores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "member_risk_scores_select"
  ON public.member_risk_scores FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR private.is_compliance_or_admin());

REVOKE INSERT, UPDATE, DELETE ON public.member_risk_scores FROM authenticated, anon;
GRANT SELECT ON public.member_risk_scores TO authenticated;

-- ---------------------------------------------------------------------------
-- Request wallet withdrawal (holds funds via ledger debit when approved/processed)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.request_withdrawal(
  p_amount NUMERIC,
  p_currency CHAR(3) DEFAULT 'KES',
  p_destination_type TEXT DEFAULT 'mpesa',
  p_destination_phone TEXT DEFAULT NULL,
  p_bank_name TEXT DEFAULT NULL,
  p_bank_account_name TEXT DEFAULT NULL,
  p_bank_account_number TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_req public.withdrawal_requests%ROWTYPE;
  v_kyc TEXT;
  v_risk INT := 0;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'UNAUTHENTICATED');
  END IF;
  IF p_amount IS NULL OR p_amount < 100 OR p_amount > 5000000 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'INVALID_AMOUNT');
  END IF;
  IF p_destination_type NOT IN ('mpesa', 'bank') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'INVALID_DESTINATION');
  END IF;
  IF p_destination_type = 'mpesa' AND (p_destination_phone IS NULL OR p_destination_phone !~ '^\+[1-9]\d{7,14}$') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'PHONE_REQUIRED');
  END IF;
  IF p_destination_type = 'bank' AND (
    p_bank_name IS NULL OR p_bank_account_number IS NULL OR p_bank_account_name IS NULL
  ) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'BANK_DETAILS_REQUIRED');
  END IF;

  SELECT kyc_status INTO v_kyc FROM public.profiles WHERE id = v_uid;
  IF v_kyc IS DISTINCT FROM 'approved' AND p_amount >= 20000 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'KYC_REQUIRED', 'kyc_status', v_kyc);
  END IF;

  SELECT score INTO v_risk FROM public.member_risk_scores WHERE user_id = v_uid;
  IF coalesce(v_risk, 0) >= 80 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'RISK_BLOCKED', 'score', v_risk);
  END IF;

  INSERT INTO public.withdrawal_requests (
    user_id, amount, currency, status, destination_type,
    destination_phone, bank_name, bank_account_name, bank_account_number
  )
  VALUES (
    v_uid, p_amount, p_currency, 'pending', p_destination_type,
    p_destination_phone, p_bank_name, p_bank_account_name, p_bank_account_number
  )
  RETURNING * INTO v_req;

  INSERT INTO public.audit_logs (actor_id, action, entity_type, entity_id, metadata)
  VALUES (
    v_uid, 'create', 'withdrawal_request', v_req.id,
    jsonb_build_object('amount', p_amount, 'destination_type', p_destination_type)
  );

  INSERT INTO public.notifications (user_id, type, channel, title, body, data)
  VALUES (
    v_uid, 'system', 'in_app', 'Withdrawal requested',
    'Your withdrawal request is pending processing.',
    jsonb_build_object('withdrawal_id', v_req.id)
  );

  RETURN jsonb_build_object('ok', true, 'withdrawal_id', v_req.id, 'status', v_req.status);
END;
$$;

-- ---------------------------------------------------------------------------
-- Process withdrawal (service or admin): debit wallet + mark completed
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.process_withdrawal(
  p_withdrawal_id UUID,
  p_approve BOOLEAN DEFAULT TRUE,
  p_provider_reference TEXT DEFAULT NULL,
  p_error_message TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_req public.withdrawal_requests%ROWTYPE;
  v_tx UUID;
BEGIN
  IF coalesce(auth.role(), '') <> 'service_role' AND NOT private.is_compliance_or_admin() THEN
    RETURN jsonb_build_object('ok', false, 'error', 'FORBIDDEN');
  END IF;

  SELECT * INTO v_req FROM public.withdrawal_requests WHERE id = p_withdrawal_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'NOT_FOUND');
  END IF;
  IF v_req.status NOT IN ('pending', 'processing') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'NOT_PROCESSABLE');
  END IF;

  IF NOT p_approve THEN
    UPDATE public.withdrawal_requests
    SET status = 'cancelled', error_message = coalesce(p_error_message, 'Cancelled'), updated_at = NOW()
    WHERE id = v_req.id;
    RETURN jsonb_build_object('ok', true, 'status', 'cancelled');
  END IF;

  BEGIN
    v_tx := private.ledger_debit(
      v_req.user_id, v_req.currency, v_req.amount, 'wallet_withdrawal', NULL,
      coalesce(p_provider_reference, 'withdrawal:' || v_req.id::text),
      'withdrawal:' || v_req.id::text,
      jsonb_build_object('withdrawal_id', v_req.id, 'destination_type', v_req.destination_type)
    );
  EXCEPTION
    WHEN OTHERS THEN
      IF SQLERRM = 'INSUFFICIENT_FUNDS' THEN
        UPDATE public.withdrawal_requests
        SET status = 'failed', error_message = 'INSUFFICIENT_FUNDS', updated_at = NOW()
        WHERE id = v_req.id;
        RETURN jsonb_build_object('ok', false, 'error', 'INSUFFICIENT_FUNDS');
      END IF;
      RAISE;
  END;

  UPDATE public.withdrawal_requests
  SET
    status = 'completed',
    transaction_id = v_tx,
    provider_reference = coalesce(p_provider_reference, provider_reference),
    processed_at = NOW(),
    updated_at = NOW()
  WHERE id = v_req.id;

  INSERT INTO public.notifications (user_id, type, channel, title, body, data)
  VALUES (
    v_req.user_id, 'system', 'in_app', 'Withdrawal completed',
    'Funds have been sent to your destination.',
    jsonb_build_object('withdrawal_id', v_req.id, 'transaction_id', v_tx)
  );

  INSERT INTO public.audit_logs (actor_id, action, entity_type, entity_id, metadata)
  VALUES (
    v_uid, 'approve', 'withdrawal_request', v_req.id,
    jsonb_build_object('transaction_id', v_tx)
  );

  RETURN jsonb_build_object('ok', true, 'transaction_id', v_tx, 'status', 'completed');
END;
$$;

-- ---------------------------------------------------------------------------
-- Recompute risk score for a member
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.recompute_member_risk(p_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_late INT := 0;
  v_disputes INT := 0;
  v_failed_pay INT := 0;
  v_score INT := 0;
  v_band public.risk_band;
BEGIN
  IF auth.uid() IS NULL AND coalesce(auth.role(), '') <> 'service_role' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'UNAUTHENTICATED');
  END IF;

  IF coalesce(auth.role(), '') <> 'service_role'
     AND auth.uid() IS DISTINCT FROM p_user_id
     AND NOT private.is_compliance_or_admin() THEN
    RETURN jsonb_build_object('ok', false, 'error', 'FORBIDDEN');
  END IF;

  SELECT COUNT(*) INTO v_late
  FROM public.contributions c
  JOIN public.members m ON m.id = c.member_id
  WHERE m.user_id = p_user_id AND c.status = 'late';

  SELECT COUNT(*) INTO v_disputes
  FROM public.disputes
  WHERE (opened_by = p_user_id OR against_user_id = p_user_id)
    AND status IN ('open', 'under_review');

  SELECT COUNT(*) INTO v_failed_pay
  FROM public.payment_intents
  WHERE user_id = p_user_id AND status = 'failed';

  v_score := LEAST(
    100,
    (v_late * 12) + (v_disputes * 18) + (v_failed_pay * 10)
  );

  v_band := CASE
    WHEN v_score >= 80 THEN 'critical'::public.risk_band
    WHEN v_score >= 55 THEN 'high'::public.risk_band
    WHEN v_score >= 30 THEN 'medium'::public.risk_band
    ELSE 'low'::public.risk_band
  END;

  INSERT INTO public.member_risk_scores (
    user_id, score, band, late_contributions, open_disputes, failed_payments, factors, computed_at
  )
  VALUES (
    p_user_id, v_score, v_band, v_late, v_disputes, v_failed_pay,
    jsonb_build_object(
      'late_contributions', v_late,
      'open_disputes', v_disputes,
      'failed_payments', v_failed_pay
    ),
    NOW()
  )
  ON CONFLICT (user_id) DO UPDATE SET
    score = EXCLUDED.score,
    band = EXCLUDED.band,
    late_contributions = EXCLUDED.late_contributions,
    open_disputes = EXCLUDED.open_disputes,
    failed_payments = EXCLUDED.failed_payments,
    factors = EXCLUDED.factors,
    computed_at = NOW(),
    updated_at = NOW();

  RETURN jsonb_build_object('ok', true, 'score', v_score, 'band', v_band);
END;
$$;

CREATE OR REPLACE FUNCTION public.recompute_all_member_risk()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid UUID;
  v_count INT := 0;
BEGIN
  IF coalesce(auth.role(), '') <> 'service_role' AND NOT private.is_compliance_or_admin() THEN
    RETURN jsonb_build_object('ok', false, 'error', 'FORBIDDEN');
  END IF;

  FOR v_uid IN SELECT id FROM public.profiles LOOP
    PERFORM public.recompute_member_risk(v_uid);
    v_count := v_count + 1;
  END LOOP;

  RETURN jsonb_build_object('ok', true, 'updated', v_count);
END;
$$;

-- ---------------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------------
REVOKE ALL ON FUNCTION public.request_withdrawal(NUMERIC, CHAR, TEXT, TEXT, TEXT, TEXT, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.process_withdrawal(UUID, BOOLEAN, TEXT, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.recompute_member_risk(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.recompute_all_member_risk() FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.request_withdrawal(NUMERIC, CHAR, TEXT, TEXT, TEXT, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.process_withdrawal(UUID, BOOLEAN, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.process_withdrawal(UUID, BOOLEAN, TEXT, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.recompute_member_risk(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.recompute_member_risk(UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.recompute_all_member_risk() TO authenticated;
GRANT EXECUTE ON FUNCTION public.recompute_all_member_risk() TO service_role;
