-- Phase 4: Verified payout destinations + lock M-Pesa withdrawals to them.

CREATE TABLE IF NOT EXISTS public.user_payout_destinations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('mpesa', 'bank')),
  label TEXT,
  phone TEXT,
  bank_name TEXT,
  bank_account_name TEXT,
  bank_account_number TEXT,
  is_default BOOLEAN NOT NULL DEFAULT false,
  verified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT user_payout_destinations_mpesa_phone
    CHECK (kind <> 'mpesa' OR (phone IS NOT NULL AND phone ~ '^\+[1-9]\d{7,14}$')),
  CONSTRAINT user_payout_destinations_bank_fields
    CHECK (
      kind <> 'bank'
      OR (
        bank_name IS NOT NULL
        AND bank_account_name IS NOT NULL
        AND bank_account_number IS NOT NULL
      )
    )
);

CREATE UNIQUE INDEX IF NOT EXISTS user_payout_destinations_user_mpesa_phone_uidx
  ON public.user_payout_destinations (user_id, phone)
  WHERE kind = 'mpesa' AND phone IS NOT NULL;

CREATE INDEX IF NOT EXISTS user_payout_destinations_user_default_idx
  ON public.user_payout_destinations (user_id, is_default DESC);

ALTER TABLE public.user_payout_destinations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS user_payout_destinations_select_own ON public.user_payout_destinations;
CREATE POLICY user_payout_destinations_select_own
  ON public.user_payout_destinations FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR private.is_compliance_or_admin()
  );

DROP POLICY IF EXISTS user_payout_destinations_insert_own ON public.user_payout_destinations;
CREATE POLICY user_payout_destinations_insert_own
  ON public.user_payout_destinations FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS user_payout_destinations_update_own ON public.user_payout_destinations;
CREATE POLICY user_payout_destinations_update_own
  ON public.user_payout_destinations FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

GRANT SELECT, INSERT, UPDATE ON public.user_payout_destinations TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.user_payout_destinations TO service_role;

ALTER TABLE public.withdrawal_requests
  ADD COLUMN IF NOT EXISTS destination_id UUID
    REFERENCES public.user_payout_destinations (id) ON DELETE SET NULL;

-- Backfill default M-Pesa destinations from profiles.
INSERT INTO public.user_payout_destinations (
  user_id, kind, label, phone, is_default, verified_at
)
SELECT
  p.id,
  'mpesa',
  'Primary M-Pesa',
  coalesce(nullif(trim(p.mpesa_phone), ''), nullif(trim(p.phone), '')),
  true,
  NOW()
FROM public.profiles p
WHERE coalesce(nullif(trim(p.mpesa_phone), ''), nullif(trim(p.phone), ''))
  ~ '^\+[1-9]\d{7,14}$'
  AND NOT EXISTS (
    SELECT 1 FROM public.user_payout_destinations d
    WHERE d.user_id = p.id
      AND d.kind = 'mpesa'
      AND d.phone = coalesce(nullif(trim(p.mpesa_phone), ''), nullif(trim(p.phone), ''))
  );

CREATE OR REPLACE FUNCTION public.link_mpesa_phone(p_phone TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_dest UUID;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'UNAUTHENTICATED');
  END IF;
  IF p_phone IS NULL OR p_phone !~ '^\+[1-9]\d{7,14}$' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'INVALID_PHONE');
  END IF;

  UPDATE public.profiles
  SET mpesa_phone = p_phone
  WHERE id = v_uid;

  UPDATE public.user_payout_destinations
  SET is_default = false, updated_at = NOW()
  WHERE user_id = v_uid AND kind = 'mpesa' AND is_default;

  SELECT id INTO v_dest
  FROM public.user_payout_destinations
  WHERE user_id = v_uid AND kind = 'mpesa' AND phone = p_phone
  LIMIT 1;

  IF v_dest IS NULL THEN
    INSERT INTO public.user_payout_destinations (
      user_id, kind, label, phone, is_default, verified_at
    )
    VALUES (v_uid, 'mpesa', 'Primary M-Pesa', p_phone, true, NOW())
    RETURNING id INTO v_dest;
  ELSE
    UPDATE public.user_payout_destinations
    SET is_default = true,
        verified_at = NOW(),
        updated_at = NOW(),
        label = coalesce(label, 'Primary M-Pesa')
    WHERE id = v_dest;
  END IF;

  RETURN jsonb_build_object('ok', true, 'destination_id', v_dest, 'phone', p_phone);
END;
$$;

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
  v_dest public.user_payout_destinations%ROWTYPE;
  v_phone TEXT;
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

  IF p_destination_type = 'mpesa' THEN
    SELECT * INTO v_dest
    FROM public.user_payout_destinations
    WHERE user_id = v_uid
      AND kind = 'mpesa'
      AND verified_at IS NOT NULL
      AND (
        (p_destination_phone IS NOT NULL AND phone = p_destination_phone)
        OR (p_destination_phone IS NULL AND is_default)
      )
    ORDER BY is_default DESC, verified_at DESC
    LIMIT 1;

    IF NOT FOUND THEN
      -- Fall back: require profile linked phone matches request (or use linked if blank).
      SELECT coalesce(nullif(trim(mpesa_phone), ''), nullif(trim(phone), ''))
      INTO v_phone
      FROM public.profiles
      WHERE id = v_uid;

      IF v_phone IS NULL OR v_phone !~ '^\+[1-9]\d{7,14}$' THEN
        RETURN jsonb_build_object('ok', false, 'error', 'DESTINATION_REQUIRED');
      END IF;

      IF p_destination_phone IS NOT NULL AND p_destination_phone IS DISTINCT FROM v_phone THEN
        RETURN jsonb_build_object('ok', false, 'error', 'DESTINATION_MISMATCH');
      END IF;

      -- Auto-create verified destination from profile.
      INSERT INTO public.user_payout_destinations (
        user_id, kind, label, phone, is_default, verified_at
      )
      VALUES (v_uid, 'mpesa', 'Primary M-Pesa', v_phone, true, NOW())
      RETURNING * INTO v_dest;
    ELSE
      v_phone := v_dest.phone;
      IF p_destination_phone IS NOT NULL AND p_destination_phone IS DISTINCT FROM v_phone THEN
        RETURN jsonb_build_object('ok', false, 'error', 'DESTINATION_MISMATCH');
      END IF;
    END IF;
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
    destination_phone, bank_name, bank_account_name, bank_account_number,
    destination_id, metadata
  )
  VALUES (
    v_uid, p_amount, p_currency, 'pending', p_destination_type,
    CASE WHEN p_destination_type = 'mpesa' THEN v_phone ELSE p_destination_phone END,
    p_bank_name, p_bank_account_name, p_bank_account_number,
    CASE WHEN p_destination_type = 'mpesa' THEN v_dest.id ELSE NULL END,
    CASE
      WHEN p_destination_type = 'mpesa' THEN
        jsonb_build_object(
          'destination_locked', true,
          'destination_id', v_dest.id,
          'destination_phone', v_phone
        )
      ELSE '{}'::jsonb
    END
  )
  RETURNING * INTO v_req;

  INSERT INTO public.audit_logs (actor_id, action, entity_type, entity_id, metadata)
  VALUES (
    v_uid, 'create', 'withdrawal_request', v_req.id,
    jsonb_build_object(
      'amount', p_amount,
      'destination_type', p_destination_type,
      'destination_id', v_req.destination_id,
      'destination_phone', v_req.destination_phone
    )
  );

  INSERT INTO public.notifications (user_id, type, channel, title, body, data)
  VALUES (
    v_uid, 'system', 'in_app', 'Withdrawal requested',
    'Your withdrawal request is pending processing.',
    jsonb_build_object('withdrawal_id', v_req.id)
  );

  RETURN jsonb_build_object(
    'ok', true,
    'withdrawal_id', v_req.id,
    'status', v_req.status,
    'destination_phone', v_req.destination_phone
  );
END;
$$;

-- Stamp destination on dual-approval payload for checker UX.
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
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'UNAUTHENTICATED');
  END IF;
  IF p_kind NOT IN ('withdrawal', 'payout_settle', 'qard_decide') THEN
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

  -- Notify other compliance/admins for platform withdrawals.
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
