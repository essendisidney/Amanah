-- Phase 7: Treasury B2B payouts (Paybill / Till / bank) behind dual approval.

-- ---------------------------------------------------------------------------
-- Circle-owned payout destinations (supplier Paybill / Till / bank)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.circle_payout_destinations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  jamiya_id UUID NOT NULL REFERENCES public.jamiyas (id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('paybill', 'till', 'bank')),
  label TEXT NOT NULL,
  shortcode TEXT,
  account_reference TEXT,
  bank_name TEXT,
  bank_account_number TEXT,
  bank_account_name TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_by UUID REFERENCES public.profiles (id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT circle_payout_destinations_label_len CHECK (char_length(btrim(label)) BETWEEN 2 AND 80),
  CONSTRAINT circle_payout_destinations_paybill_req CHECK (
    kind <> 'paybill' OR (shortcode IS NOT NULL AND btrim(shortcode) <> '')
  ),
  CONSTRAINT circle_payout_destinations_till_req CHECK (
    kind <> 'till' OR (shortcode IS NOT NULL AND btrim(shortcode) <> '')
  ),
  CONSTRAINT circle_payout_destinations_bank_req CHECK (
    kind <> 'bank' OR (
      bank_name IS NOT NULL AND btrim(bank_name) <> ''
      AND bank_account_number IS NOT NULL AND btrim(bank_account_number) <> ''
    )
  )
);

CREATE INDEX IF NOT EXISTS circle_payout_destinations_jamiya_idx
  ON public.circle_payout_destinations (jamiya_id)
  WHERE is_active;

ALTER TABLE public.circle_payout_destinations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS circle_payout_destinations_select ON public.circle_payout_destinations;
CREATE POLICY circle_payout_destinations_select ON public.circle_payout_destinations
  FOR SELECT TO authenticated
  USING (
    private.is_jamiya_member(jamiya_id)
    OR private.is_platform_admin()
  );

DROP POLICY IF EXISTS circle_payout_destinations_write ON public.circle_payout_destinations;
CREATE POLICY circle_payout_destinations_write ON public.circle_payout_destinations
  FOR ALL TO authenticated
  USING (private.is_circle_officer(jamiya_id) OR private.is_platform_admin())
  WITH CHECK (private.is_circle_officer(jamiya_id) OR private.is_platform_admin());

GRANT SELECT, INSERT, UPDATE ON public.circle_payout_destinations TO authenticated;
GRANT ALL ON public.circle_payout_destinations TO service_role;

-- ---------------------------------------------------------------------------
-- Treasury payout requests (mirror withdrawal lifecycle, circle cashbook settle)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.treasury_payout_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  jamiya_id UUID NOT NULL REFERENCES public.jamiyas (id) ON DELETE CASCADE,
  source_account_id UUID REFERENCES public.circle_bank_accounts (id) ON DELETE SET NULL,
  destination_id UUID NOT NULL REFERENCES public.circle_payout_destinations (id),
  category_id UUID REFERENCES public.circle_ledger_categories (id) ON DELETE SET NULL,
  amount NUMERIC(14, 2) NOT NULL CHECK (amount > 0),
  currency CHAR(3) NOT NULL DEFAULT 'KES',
  narrative TEXT,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN (
      'pending', 'approved', 'processing', 'completed', 'failed', 'cancelled'
    )),
  provider TEXT,
  provider_reference TEXT,
  book_entry_id UUID,
  requested_by UUID REFERENCES public.profiles (id) ON DELETE SET NULL,
  error_message TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS treasury_payout_requests_jamiya_idx
  ON public.treasury_payout_requests (jamiya_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS treasury_payout_requests_provider_ref_idx
  ON public.treasury_payout_requests (provider_reference)
  WHERE provider_reference IS NOT NULL;

ALTER TABLE public.treasury_payout_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS treasury_payout_requests_select ON public.treasury_payout_requests;
CREATE POLICY treasury_payout_requests_select ON public.treasury_payout_requests
  FOR SELECT TO authenticated
  USING (
    private.is_jamiya_member(jamiya_id)
    OR private.is_platform_admin()
  );

GRANT SELECT ON public.treasury_payout_requests TO authenticated;
GRANT ALL ON public.treasury_payout_requests TO service_role;

-- Dual-approval kind: add treasury_b2b_payout
ALTER TABLE public.dual_approval_requests
  DROP CONSTRAINT IF EXISTS dual_approval_requests_kind_check;

ALTER TABLE public.dual_approval_requests
  ADD CONSTRAINT dual_approval_requests_kind_check
  CHECK (kind IN ('withdrawal', 'payout_settle', 'qard_decide', 'treasury_b2b_payout'));

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION private.circle_needs_dual_approval(
  p_jamiya_id UUID,
  p_amount NUMERIC
)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_enabled BOOLEAN;
  v_threshold NUMERIC;
BEGIN
  SELECT coalesce(dual_approval_enabled, false),
         coalesce(dual_approval_threshold, 10000)
    INTO v_enabled, v_threshold
  FROM public.jamiyas
  WHERE id = p_jamiya_id;
  RETURN coalesce(v_enabled, false) AND coalesce(p_amount, 0) >= coalesce(v_threshold, 10000);
END;
$$;

-- ---------------------------------------------------------------------------
-- Request treasury B2B payout (+ optional dual approval)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.request_treasury_payout(
  p_jamiya_id UUID,
  p_destination_id UUID,
  p_amount NUMERIC,
  p_source_account_id UUID DEFAULT NULL,
  p_category_id UUID DEFAULT NULL,
  p_narrative TEXT DEFAULT NULL,
  p_currency TEXT DEFAULT 'KES'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_dest public.circle_payout_destinations%ROWTYPE;
  v_id UUID;
  v_currency CHAR(3);
  v_needs_dual BOOLEAN;
  v_dual JSONB;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'UNAUTHENTICATED');
  END IF;
  IF NOT (private.is_circle_officer(p_jamiya_id) OR private.is_platform_admin()) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'FORBIDDEN');
  END IF;
  IF p_amount IS NULL OR p_amount <= 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'INVALID_AMOUNT');
  END IF;

  SELECT * INTO v_dest
  FROM public.circle_payout_destinations
  WHERE id = p_destination_id AND jamiya_id = p_jamiya_id AND is_active = TRUE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'DESTINATION_NOT_FOUND');
  END IF;

  SELECT currency INTO v_currency FROM public.jamiyas WHERE id = p_jamiya_id;
  IF v_currency IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'NOT_FOUND');
  END IF;

  INSERT INTO public.treasury_payout_requests (
    jamiya_id, source_account_id, destination_id, category_id,
    amount, currency, narrative, status, requested_by, metadata
  )
  VALUES (
    p_jamiya_id,
    p_source_account_id,
    p_destination_id,
    p_category_id,
    p_amount,
    left(upper(coalesce(nullif(btrim(p_currency), ''), v_currency)), 3),
    nullif(btrim(p_narrative), ''),
    'pending',
    v_uid,
    jsonb_build_object(
      'destination_kind', v_dest.kind,
      'destination_label', v_dest.label,
      'shortcode', v_dest.shortcode,
      'account_reference', v_dest.account_reference
    )
  )
  RETURNING id INTO v_id;

  INSERT INTO public.audit_logs (actor_id, action, entity_type, entity_id, metadata)
  VALUES (
    v_uid, 'create', 'treasury_payout_request', v_id,
    jsonb_build_object('amount', p_amount, 'destination_id', p_destination_id)
  );

  v_needs_dual := private.circle_needs_dual_approval(p_jamiya_id, p_amount);
  IF v_needs_dual THEN
    v_dual := public.propose_dual_approval(
      'treasury_b2b_payout',
      v_id,
      p_amount,
      left(upper(coalesce(nullif(btrim(p_currency), ''), v_currency)), 3),
      p_jamiya_id,
      jsonb_build_object(
        'destination_kind', v_dest.kind,
        'destination_label', v_dest.label,
        'shortcode', v_dest.shortcode
      )
    );
    RETURN jsonb_build_object(
      'ok', true,
      'payout_id', v_id,
      'pending_dual_approval', true,
      'dual', v_dual
    );
  END IF;

  UPDATE public.treasury_payout_requests
  SET status = 'approved',
      metadata = metadata || jsonb_build_object('ready_to_disburse', true),
      updated_at = NOW()
  WHERE id = v_id;

  RETURN jsonb_build_object(
    'ok', true,
    'payout_id', v_id,
    'ready_to_disburse', true
  );
END;
$$;

-- ---------------------------------------------------------------------------
-- Complete / fail treasury payout (ledger on SUCCESS)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.complete_treasury_payout(
  p_payout_id UUID,
  p_provider_reference TEXT DEFAULT NULL,
  p_error_message TEXT DEFAULT NULL,
  p_fail BOOLEAN DEFAULT FALSE
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_role TEXT := coalesce(auth.role(), '');
  v_req public.treasury_payout_requests%ROWTYPE;
  v_dest public.circle_payout_destinations%ROWTYPE;
  v_entry UUID;
  v_bal NUMERIC;
  v_notes TEXT;
BEGIN
  IF v_role <> 'service_role' THEN
    IF v_uid IS NULL THEN
      RETURN jsonb_build_object('ok', false, 'error', 'UNAUTHENTICATED');
    END IF;
  END IF;

  SELECT * INTO v_req
  FROM public.treasury_payout_requests
  WHERE id = p_payout_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'NOT_FOUND');
  END IF;

  IF v_role <> 'service_role' THEN
    IF NOT (private.is_circle_officer(v_req.jamiya_id) OR private.is_platform_admin()) THEN
      RETURN jsonb_build_object('ok', false, 'error', 'FORBIDDEN');
    END IF;
  END IF;

  IF v_req.status = 'completed' THEN
    RETURN jsonb_build_object('ok', true, 'already_completed', true, 'payout_id', v_req.id);
  END IF;
  IF v_req.status NOT IN ('pending', 'approved', 'processing') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'NOT_PROCESSABLE', 'status', v_req.status);
  END IF;

  IF p_fail THEN
    UPDATE public.treasury_payout_requests
    SET status = 'failed',
        error_message = left(coalesce(p_error_message, 'FAILED'), 500),
        provider_reference = coalesce(nullif(btrim(p_provider_reference), ''), provider_reference),
        updated_at = NOW()
    WHERE id = v_req.id;
    RETURN jsonb_build_object('ok', true, 'status', 'failed', 'payout_id', v_req.id);
  END IF;

  SELECT * INTO v_dest FROM public.circle_payout_destinations WHERE id = v_req.destination_id;

  IF v_req.source_account_id IS NOT NULL THEN
    SELECT balance INTO v_bal
    FROM public.circle_bank_accounts
    WHERE id = v_req.source_account_id
    FOR UPDATE;
    IF v_bal IS NULL OR v_bal < v_req.amount THEN
      RETURN jsonb_build_object('ok', false, 'error', 'INSUFFICIENT_TREASURY_BALANCE');
    END IF;
    UPDATE public.circle_bank_accounts
    SET balance = balance - v_req.amount, updated_at = NOW()
    WHERE id = v_req.source_account_id;
  END IF;

  v_notes := coalesce(
    nullif(btrim(v_req.narrative), ''),
    'B2B payout to ' || coalesce(v_dest.label, 'supplier')
  );

  INSERT INTO public.book_entries (
    jamiya_id, entry_type, amount, currency, effective_date,
    bank_account_id, category_id, notes, entered_by, metadata
  )
  VALUES (
    v_req.jamiya_id,
    'expense',
    v_req.amount,
    v_req.currency,
    CURRENT_DATE,
    v_req.source_account_id,
    v_req.category_id,
    v_notes || coalesce(' · ref ' || nullif(btrim(p_provider_reference), ''), ''),
    coalesce(v_uid, v_req.requested_by),
    jsonb_build_object('source', 'treasury_b2b', 'payout_id', v_req.id)
  )
  RETURNING id INTO v_entry;

  UPDATE public.treasury_payout_requests
  SET status = 'completed',
      book_entry_id = v_entry,
      provider_reference = coalesce(nullif(btrim(p_provider_reference), ''), provider_reference),
      error_message = NULL,
      updated_at = NOW()
  WHERE id = v_req.id;

  INSERT INTO public.audit_logs (actor_id, action, entity_type, entity_id, metadata)
  VALUES (
    coalesce(v_uid, v_req.requested_by),
    'complete',
    'treasury_payout_request',
    v_req.id,
    jsonb_build_object(
      'book_entry_id', v_entry,
      'provider_reference', p_provider_reference,
      'amount', v_req.amount
    )
  );

  RETURN jsonb_build_object(
    'ok', true,
    'status', 'completed',
    'payout_id', v_req.id,
    'book_entry_id', v_entry
  );
END;
$$;

-- Extend propose_dual_approval for treasury_b2b_payout
CREATE OR REPLACE FUNCTION public.propose_dual_approval(
  p_kind TEXT,
  p_entity_id UUID,
  p_amount NUMERIC,
  p_currency TEXT DEFAULT 'KES',
  p_jamiya_id UUID DEFAULT NULL,
  p_payload JSONB DEFAULT '{}'::jsonb
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_id UUID;
  v_existing public.dual_approval_requests%ROWTYPE;
  v_payload JSONB := coalesce(p_payload, '{}'::jsonb);
  v_w public.withdrawal_requests%ROWTYPE;
  v_tp public.treasury_payout_requests%ROWTYPE;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'UNAUTHENTICATED');
  END IF;
  IF p_kind NOT IN ('withdrawal', 'payout_settle', 'qard_decide', 'treasury_b2b_payout') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'INVALID_KIND');
  END IF;

  IF p_kind = 'withdrawal' THEN
    SELECT * INTO v_w FROM public.withdrawal_requests WHERE id = p_entity_id;
    IF FOUND THEN
      v_payload := v_payload || jsonb_build_object(
        'destination_type', v_w.destination_type,
        'destination_phone', v_w.destination_phone,
        'destination_id', v_w.destination_id,
        'bank_name', v_w.bank_name,
        'bank_account_number', v_w.bank_account_number,
        'user_id', v_w.user_id
      );
    END IF;
  ELSIF p_kind = 'treasury_b2b_payout' THEN
    SELECT * INTO v_tp FROM public.treasury_payout_requests WHERE id = p_entity_id;
    IF FOUND THEN
      v_payload := v_payload || coalesce(v_tp.metadata, '{}'::jsonb) || jsonb_build_object(
        'payout_id', v_tp.id,
        'jamiya_id', v_tp.jamiya_id
      );
    END IF;
  END IF;

  SELECT * INTO v_existing
  FROM public.dual_approval_requests
  WHERE kind = p_kind AND entity_id = p_entity_id AND status = 'pending'
  LIMIT 1;

  IF FOUND THEN
    IF v_existing.first_approver_id = v_uid OR v_existing.requested_by = v_uid THEN
      RETURN jsonb_build_object(
        'ok', true,
        'pending_dual_approval', true,
        'request_id', v_existing.id,
        'error', 'AWAITING_SECOND_APPROVER'
      );
    END IF;
    RETURN jsonb_build_object(
      'ok', true,
      'ready_for_second', true,
      'request_id', v_existing.id,
      'first_approver_id', v_existing.first_approver_id
    );
  END IF;

  INSERT INTO public.dual_approval_requests (
    jamiya_id, kind, entity_id, amount, currency, status,
    requested_by, first_approver_id, payload
  )
  VALUES (
    p_jamiya_id, p_kind, p_entity_id, coalesce(p_amount, 0),
    left(upper(coalesce(nullif(btrim(p_currency), ''), 'KES')), 3),
    'pending', v_uid, v_uid, v_payload
  )
  RETURNING id INTO v_id;

  INSERT INTO public.audit_logs (actor_id, action, entity_type, entity_id, metadata)
  VALUES (
    v_uid, 'create', 'dual_approval_request', v_id,
    jsonb_build_object('kind', p_kind, 'entity_id', p_entity_id, 'amount', p_amount)
  );

  IF p_kind = 'withdrawal' THEN
    INSERT INTO public.notifications (user_id, type, channel, title, body, data)
    SELECT
      p.id, 'system', 'in_app',
      'Withdrawal needs second approval',
      'KES ' || coalesce(p_amount, 0)::text || ' to '
        || coalesce(v_payload->>'destination_phone', 'destination')
        || ' awaits a second approver.',
      jsonb_build_object(
        'dual_approval_id', v_id,
        'withdrawal_id', p_entity_id,
        'destination_phone', v_payload->>'destination_phone'
      )
    FROM public.profiles p
    WHERE p.platform_role IN ('compliance_officer', 'platform_admin', 'super_admin')
      AND p.id IS DISTINCT FROM v_uid;
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'pending_dual_approval', true,
    'request_id', v_id
  );
END;
$$;

-- Extend confirm_dual_approval for treasury_b2b_payout (defer live send)
CREATE OR REPLACE FUNCTION public.confirm_dual_approval(
  p_request_id UUID,
  p_approve BOOLEAN DEFAULT TRUE
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_req public.dual_approval_requests%ROWTYPE;
  v_result JSONB;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'UNAUTHENTICATED');
  END IF;

  SELECT * INTO v_req
  FROM public.dual_approval_requests
  WHERE id = p_request_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'NOT_FOUND');
  END IF;
  IF v_req.status <> 'pending' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'NOT_PENDING', 'status', v_req.status);
  END IF;
  IF v_req.first_approver_id = v_uid THEN
    RETURN jsonb_build_object('ok', false, 'error', 'SECOND_APPROVER_MUST_DIFFER');
  END IF;

  IF v_req.kind = 'withdrawal' THEN
    IF NOT private.is_compliance_or_admin() THEN
      RETURN jsonb_build_object('ok', false, 'error', 'FORBIDDEN');
    END IF;
  ELSIF v_req.jamiya_id IS NOT NULL THEN
    IF NOT (private.is_circle_officer(v_req.jamiya_id) OR private.is_platform_admin()) THEN
      RETURN jsonb_build_object('ok', false, 'error', 'FORBIDDEN');
    END IF;
  ELSE
    RETURN jsonb_build_object('ok', false, 'error', 'FORBIDDEN');
  END IF;

  IF NOT p_approve THEN
    UPDATE public.dual_approval_requests
    SET status = 'rejected', second_approver_id = v_uid, updated_at = NOW(),
        result = jsonb_build_object('rejected', true)
    WHERE id = v_req.id;

    IF v_req.kind = 'treasury_b2b_payout' THEN
      UPDATE public.treasury_payout_requests
      SET status = 'cancelled',
          error_message = 'Rejected by second officer',
          updated_at = NOW()
      WHERE id = v_req.entity_id AND status = 'pending';
    END IF;

    RETURN jsonb_build_object('ok', true, 'status', 'rejected');
  END IF;

  IF v_req.kind = 'withdrawal' THEN
    UPDATE public.withdrawal_requests
    SET metadata = coalesce(metadata, '{}'::jsonb) ||
          jsonb_build_object(
            'dual_approved', true,
            'dual_approval_request_id', v_req.id
          ),
        updated_at = NOW()
    WHERE id = v_req.entity_id;

    v_result := jsonb_build_object(
      'ok', true,
      'ready_to_disburse', true,
      'withdrawal_id', v_req.entity_id
    );

    UPDATE public.dual_approval_requests
    SET
      status = 'approved',
      second_approver_id = v_uid,
      result = v_result,
      updated_at = NOW()
    WHERE id = v_req.id;

    INSERT INTO public.audit_logs (actor_id, action, entity_type, entity_id, metadata)
    VALUES (
      v_uid, 'approve', 'dual_approval_request', v_req.id,
      jsonb_build_object('result', v_result, 'deferred_b2c', true)
    );

    RETURN jsonb_build_object(
      'ok', true,
      'status', 'approved',
      'ready_to_disburse', true,
      'withdrawal_id', v_req.entity_id,
      'result', v_result,
      'request_id', v_req.id
    );
  END IF;

  IF v_req.kind = 'treasury_b2b_payout' THEN
    UPDATE public.treasury_payout_requests
    SET status = 'approved',
        metadata = coalesce(metadata, '{}'::jsonb) ||
          jsonb_build_object(
            'ready_to_disburse', true,
            'dual_approval_request_id', v_req.id
          ),
        updated_at = NOW()
    WHERE id = v_req.entity_id AND status = 'pending';

    v_result := jsonb_build_object(
      'ok', true,
      'ready_to_disburse', true,
      'payout_id', v_req.entity_id
    );

    UPDATE public.dual_approval_requests
    SET
      status = 'approved',
      second_approver_id = v_uid,
      result = v_result,
      updated_at = NOW()
    WHERE id = v_req.id;

    INSERT INTO public.audit_logs (actor_id, action, entity_type, entity_id, metadata)
    VALUES (
      v_uid, 'approve', 'dual_approval_request', v_req.id,
      jsonb_build_object('result', v_result, 'deferred_b2b', true)
    );

    RETURN jsonb_build_object(
      'ok', true,
      'status', 'approved',
      'ready_to_disburse', true,
      'payout_id', v_req.entity_id,
      'result', v_result,
      'request_id', v_req.id
    );
  END IF;

  IF v_req.kind = 'payout_settle' THEN
    v_result := public.settle_payout(v_req.entity_id);
  ELSIF v_req.kind = 'qard_decide' THEN
    v_result := public.decide_qard(
      v_req.entity_id,
      coalesce((v_req.payload->>'approve')::boolean, true)
    );
  ELSE
    RETURN jsonb_build_object('ok', false, 'error', 'INVALID_KIND');
  END IF;

  UPDATE public.dual_approval_requests
  SET
    status = CASE WHEN coalesce((v_result->>'ok')::boolean, false) THEN 'executed' ELSE 'approved' END,
    second_approver_id = v_uid,
    result = v_result,
    updated_at = NOW()
  WHERE id = v_req.id;

  INSERT INTO public.audit_logs (actor_id, action, entity_type, entity_id, metadata)
  VALUES (
    v_uid, 'approve', 'dual_approval_request', v_req.id,
    jsonb_build_object('result', v_result)
  );

  RETURN jsonb_build_object(
    'ok', coalesce((v_result->>'ok')::boolean, false),
    'status', 'executed',
    'result', v_result,
    'request_id', v_req.id
  );
END;
$$;

REVOKE ALL ON FUNCTION public.request_treasury_payout(UUID, UUID, NUMERIC, UUID, UUID, TEXT, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.complete_treasury_payout(UUID, TEXT, TEXT, BOOLEAN) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.request_treasury_payout(UUID, UUID, NUMERIC, UUID, UUID, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.complete_treasury_payout(UUID, TEXT, TEXT, BOOLEAN) TO authenticated;
GRANT EXECUTE ON FUNCTION public.complete_treasury_payout(UUID, TEXT, TEXT, BOOLEAN) TO service_role;
