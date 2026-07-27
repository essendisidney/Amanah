-- Phase 10: close feature-doc gaps (welfare claims, vouching, join fee, payout withdraw, payment retry)

-- ---------------------------------------------------------------------------
-- Welfare: file claim
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.file_welfare_claim(
  p_jamiya_id UUID,
  p_claim_type TEXT,
  p_amount NUMERIC,
  p_reason TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_fund public.welfare_funds%ROWTYPE;
  v_id UUID;
  v_type TEXT := lower(trim(coalesce(p_claim_type, '')));
  v_reason TEXT := nullif(trim(coalesce(p_reason, '')), '');
BEGIN
  IF v_uid IS NULL OR NOT private.is_active_jamiya_member(p_jamiya_id) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'FORBIDDEN');
  END IF;
  IF p_amount IS NULL OR p_amount < 100 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'INVALID_AMOUNT');
  END IF;
  IF v_type NOT IN ('medical', 'funeral', 'accident', 'other') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'INVALID_TYPE');
  END IF;
  IF v_reason IS NULL OR char_length(v_reason) < 5 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'REASON_REQUIRED');
  END IF;

  SELECT * INTO v_fund FROM public.welfare_funds WHERE jamiya_id = p_jamiya_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'NO_FUND');
  END IF;

  INSERT INTO public.welfare_claims (
    fund_id, jamiya_id, claimant_id, claim_type, amount, currency, reason, status
  ) VALUES (
    v_fund.id, p_jamiya_id, v_uid, v_type, p_amount, v_fund.currency, v_reason, 'pending'
  ) RETURNING id INTO v_id;

  RETURN jsonb_build_object('ok', true, 'claim_id', v_id);
END;
$$;

REVOKE ALL ON FUNCTION public.file_welfare_claim(UUID, TEXT, NUMERIC, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.file_welfare_claim(UUID, TEXT, NUMERIC, TEXT) TO authenticated;

-- ---------------------------------------------------------------------------
-- Vouching
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.vouch_for_member(
  p_member_id UUID,
  p_approve BOOLEAN,
  p_notes TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_m public.members%ROWTYPE;
  v_id UUID;
  v_status public.vouch_status := CASE WHEN p_approve THEN 'approved'::public.vouch_status ELSE 'rejected'::public.vouch_status END;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'UNAUTHENTICATED');
  END IF;

  SELECT * INTO v_m FROM public.members WHERE id = p_member_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'NOT_FOUND');
  END IF;

  IF NOT (
    private.is_circle_admin(v_m.jamiya_id)
    OR EXISTS (
      SELECT 1 FROM public.members m
      WHERE m.jamiya_id = v_m.jamiya_id AND m.user_id = v_uid
        AND m.role::text IN ('chair', 'treasurer', 'circle_admin')
        AND m.status = 'active'
    )
  ) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'FORBIDDEN');
  END IF;

  INSERT INTO public.member_vouches (jamiya_id, member_id, voucher_user_id, status, notes, decided_at)
  VALUES (v_m.jamiya_id, p_member_id, v_uid, v_status, nullif(trim(coalesce(p_notes, '')), ''), NOW())
  ON CONFLICT (jamiya_id, member_id) DO UPDATE
    SET status = EXCLUDED.status,
        notes = EXCLUDED.notes,
        voucher_user_id = EXCLUDED.voucher_user_id,
        decided_at = NOW()
  RETURNING id INTO v_id;

  RETURN jsonb_build_object('ok', true, 'vouch_id', v_id, 'status', v_status);
END;
$$;

REVOKE ALL ON FUNCTION public.vouch_for_member(UUID, BOOLEAN, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.vouch_for_member(UUID, BOOLEAN, TEXT) TO authenticated;

-- ---------------------------------------------------------------------------
-- Join fee charge (after membership exists)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.charge_join_fee(p_jamiya_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_j public.jamiyas%ROWTYPE;
  v_fee NUMERIC;
  v_tx UUID;
BEGIN
  IF v_uid IS NULL OR NOT private.is_active_jamiya_member(p_jamiya_id) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'FORBIDDEN');
  END IF;

  SELECT * INTO v_j FROM public.jamiyas WHERE id = p_jamiya_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'NOT_FOUND');
  END IF;

  v_fee := coalesce(v_j.join_fee_amount, 0);
  IF v_fee <= 0 THEN
    RETURN jsonb_build_object('ok', true, 'skipped', true, 'fee', 0);
  END IF;

  -- Idempotent: skip if already charged for this user+circle
  IF EXISTS (
    SELECT 1 FROM public.transactions t
    WHERE t.user_id = v_uid
      AND t.jamiya_id = p_jamiya_id
      AND t.metadata->>'kind' = 'join_fee'
      AND t.status = 'completed'
  ) THEN
    RETURN jsonb_build_object('ok', true, 'skipped', true, 'already_paid', true);
  END IF;

  v_tx := private.ledger_debit(
    v_uid, v_j.currency, v_fee, 'fee'::public.transaction_type, p_jamiya_id,
    'join_fee', p_jamiya_id::text, jsonb_build_object('kind', 'join_fee')
  );

  RETURN jsonb_build_object('ok', true, 'fee', v_fee, 'transaction_id', v_tx);
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('ok', false, 'error', SQLERRM);
END;
$$;

REVOKE ALL ON FUNCTION public.charge_join_fee(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.charge_join_fee(UUID) TO authenticated;

-- Optional per-contribution platform/circle fee (fixed amount on jamiya metadata via join_fee pattern)
-- Uses jamiyas.metadata key transaction_fee_amount if present; else 0.
-- Safer: add column
ALTER TABLE public.jamiyas
  ADD COLUMN IF NOT EXISTS transaction_fee_amount NUMERIC(14, 2) NOT NULL DEFAULT 0
    CHECK (transaction_fee_amount >= 0);

CREATE OR REPLACE FUNCTION public.charge_contribution_fee(p_contribution_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_c public.contributions%ROWTYPE;
  v_j public.jamiyas%ROWTYPE;
  v_fee NUMERIC;
  v_tx UUID;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'UNAUTHENTICATED');
  END IF;

  SELECT * INTO v_c FROM public.contributions WHERE id = p_contribution_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'NOT_FOUND');
  END IF;

  SELECT * INTO v_j FROM public.jamiyas WHERE id = v_c.jamiya_id;
  v_fee := coalesce(v_j.transaction_fee_amount, 0);
  IF v_fee <= 0 THEN
    RETURN jsonb_build_object('ok', true, 'skipped', true);
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.transactions t
    WHERE t.user_id = v_uid
      AND t.reference = 'contrib_fee:' || p_contribution_id::text
      AND t.status = 'completed'
  ) THEN
    RETURN jsonb_build_object('ok', true, 'skipped', true, 'already_paid', true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.members m
    WHERE m.id = v_c.member_id AND m.user_id = v_uid
  ) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'FORBIDDEN');
  END IF;

  v_tx := private.ledger_debit(
    v_uid, v_j.currency, v_fee, 'fee'::public.transaction_type, v_j.id,
    'contrib_fee:' || p_contribution_id::text, p_contribution_id::text,
    jsonb_build_object('kind', 'contribution_fee', 'contribution_id', p_contribution_id)
  );

  RETURN jsonb_build_object('ok', true, 'fee', v_fee, 'transaction_id', v_tx);
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('ok', false, 'error', SQLERRM);
END;
$$;

REVOKE ALL ON FUNCTION public.charge_contribution_fee(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.charge_contribution_fee(UUID) TO authenticated;

-- ---------------------------------------------------------------------------
-- Settle payout then queue M-Pesa withdrawal for the recipient
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.settle_payout_to_mpesa(
  p_payout_id UUID,
  p_phone TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_p public.payouts%ROWTYPE;
  v_member public.members%ROWTYPE;
  v_phone TEXT;
  v_settle JSONB;
  v_wd UUID;
  v_profile public.profiles%ROWTYPE;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'UNAUTHENTICATED');
  END IF;

  SELECT * INTO v_p FROM public.payouts WHERE id = p_payout_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'NOT_FOUND');
  END IF;

  IF NOT private.is_circle_admin(v_p.jamiya_id) AND NOT private.is_compliance_or_admin() THEN
    RETURN jsonb_build_object('ok', false, 'error', 'FORBIDDEN');
  END IF;

  SELECT * INTO v_member FROM public.members WHERE id = v_p.member_id;
  SELECT * INTO v_profile FROM public.profiles WHERE id = v_member.user_id;

  v_phone := coalesce(
    nullif(trim(p_phone), ''),
    nullif(trim(coalesce(v_profile.mpesa_phone, '')), ''),
    nullif(trim(coalesce(v_profile.phone, '')), '')
  );

  IF v_phone IS NULL OR v_phone !~ '^\+[1-9]\d{7,14}$' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'PHONE_REQUIRED');
  END IF;

  IF v_p.status NOT IN ('paid') THEN
    v_settle := public.settle_payout(p_payout_id);
    IF coalesce(v_settle->>'ok', 'false') <> 'true' THEN
      RETURN v_settle;
    END IF;
  END IF;

  -- Create withdrawal on behalf of recipient (admin-initiated)
  INSERT INTO public.withdrawal_requests (
    user_id, amount, currency, status, destination_type, destination_phone, metadata
  ) VALUES (
    v_member.user_id, v_p.amount, v_p.currency, 'pending', 'mpesa', v_phone,
    jsonb_build_object('kind', 'payout_cashout', 'payout_id', p_payout_id, 'queued_by', v_uid)
  ) RETURNING id INTO v_wd;

  UPDATE public.payouts
  SET notes = coalesce(notes || ' | ', '') || 'M-Pesa withdrawal queued: ' || v_wd::text,
      updated_at = NOW()
  WHERE id = p_payout_id;

  RETURN jsonb_build_object(
    'ok', true,
    'payout_id', p_payout_id,
    'withdrawal_id', v_wd,
    'phone', v_phone
  );
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('ok', false, 'error', SQLERRM);
END;
$$;

REVOKE ALL ON FUNCTION public.settle_payout_to_mpesa(UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.settle_payout_to_mpesa(UUID, TEXT) TO authenticated;

-- ---------------------------------------------------------------------------
-- Retry failed payment intent (new intent + same purpose metadata)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.retry_payment_intent(p_intent_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_old public.payment_intents%ROWTYPE;
  v_new public.payment_intents%ROWTYPE;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'UNAUTHENTICATED');
  END IF;

  SELECT * INTO v_old FROM public.payment_intents WHERE id = p_intent_id;
  IF NOT FOUND OR v_old.user_id IS DISTINCT FROM v_uid THEN
    RETURN jsonb_build_object('ok', false, 'error', 'NOT_FOUND');
  END IF;

  IF v_old.status NOT IN ('failed', 'expired', 'cancelled') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'NOT_RETRYABLE');
  END IF;

  INSERT INTO public.payment_intents (
    user_id, provider, status, amount, currency, phone, metadata
  ) VALUES (
    v_uid, v_old.provider, 'pending', v_old.amount, v_old.currency, v_old.phone,
    coalesce(v_old.metadata, '{}'::jsonb) || jsonb_build_object(
      'retried_from', v_old.id,
      'retried_at', NOW()
    )
  ) RETURNING * INTO v_new;

  RETURN jsonb_build_object(
    'ok', true,
    'intent_id', v_new.id,
    'provider', v_new.provider,
    'amount', v_new.amount,
    'phone', v_new.phone,
    'kind', coalesce(v_new.metadata->>'kind', 'wallet_top_up')
  );
END;
$$;

REVOKE ALL ON FUNCTION public.retry_payment_intent(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.retry_payment_intent(UUID) TO authenticated;
