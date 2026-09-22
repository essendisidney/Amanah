-- Finance engine Phase 4: controlled status transitions + settlement RPC.

CREATE OR REPLACE FUNCTION private.assert_intent_status_transition(
  p_from public.payment_intent_status,
  p_to public.payment_intent_status
)
RETURNS VOID
LANGUAGE plpgsql
IMMUTABLE
SET search_path = ''
AS $$
BEGIN
  IF p_from = p_to THEN
    RETURN;
  END IF;
  IF p_from = 'pending' AND p_to IN (
    'processing', 'completed', 'failed', 'cancelled', 'expired'
  ) THEN
    RETURN;
  END IF;
  IF p_from = 'processing' AND p_to IN (
    'completed', 'failed', 'cancelled', 'expired'
  ) THEN
    RETURN;
  END IF;
  RAISE EXCEPTION 'ILLEGAL_INTENT_TRANSITION: % → %', p_from, p_to;
END;
$$;

CREATE OR REPLACE FUNCTION private.assert_settlement_status_transition(
  p_from TEXT,
  p_to TEXT
)
RETURNS VOID
LANGUAGE plpgsql
IMMUTABLE
SET search_path = ''
AS $$
BEGIN
  IF p_from = p_to THEN
    RETURN;
  END IF;
  IF p_from = 'unsettled' AND p_to IN ('settled', 'disputed', 'waived') THEN
    RETURN;
  END IF;
  IF p_from = 'settled' AND p_to = 'disputed' THEN
    RETURN;
  END IF;
  IF p_from = 'disputed' AND p_to IN ('settled', 'waived') THEN
    RETURN;
  END IF;
  RAISE EXCEPTION 'ILLEGAL_SETTLEMENT_TRANSITION: % → %', p_from, p_to;
END;
$$;

CREATE OR REPLACE FUNCTION private.assert_reconcile_status_transition(
  p_from TEXT,
  p_to TEXT
)
RETURNS VOID
LANGUAGE plpgsql
IMMUTABLE
SET search_path = ''
AS $$
BEGIN
  IF p_from = p_to THEN
    RETURN;
  END IF;
  IF p_from = 'open' AND p_to IN ('matched', 'exception', 'manual') THEN
    RETURN;
  END IF;
  IF p_from = 'exception' AND p_to IN ('matched', 'manual', 'open') THEN
    RETURN;
  END IF;
  IF p_from = 'manual' AND p_to IN ('matched', 'exception') THEN
    RETURN;
  END IF;
  IF p_from = 'matched' AND p_to = 'exception' THEN
    RETURN;
  END IF;
  RAISE EXCEPTION 'ILLEGAL_RECONCILE_TRANSITION: % → %', p_from, p_to;
END;
$$;

-- Harden mark_payment_intent_reconciled with transition checks
CREATE OR REPLACE FUNCTION public.mark_payment_intent_reconciled(
  p_intent_id UUID,
  p_settled BOOLEAN DEFAULT true
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_row public.payment_intents%ROWTYPE;
  v_next_settle TEXT;
BEGIN
  IF coalesce(auth.role(), '') NOT IN ('service_role', 'authenticated') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'FORBIDDEN');
  END IF;
  IF auth.role() = 'authenticated' AND NOT private.is_platform_admin() THEN
    RETURN jsonb_build_object('ok', false, 'error', 'FORBIDDEN');
  END IF;

  SELECT * INTO v_row FROM public.payment_intents WHERE id = p_intent_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'NOT_FOUND');
  END IF;

  PERFORM private.assert_reconcile_status_transition(v_row.reconcile_status, 'matched');

  v_next_settle := CASE
    WHEN p_settled THEN 'settled'
    ELSE v_row.settlement_status
  END;
  IF p_settled THEN
    PERFORM private.assert_settlement_status_transition(
      v_row.settlement_status,
      v_next_settle
    );
  END IF;

  UPDATE public.payment_intents
  SET
    settlement_status = v_next_settle,
    reconcile_status = 'matched',
    updated_at = NOW()
  WHERE id = p_intent_id;

  RETURN jsonb_build_object('ok', true);
END;
$$;

CREATE OR REPLACE FUNCTION public.record_settlement_for_intent(
  p_intent_id UUID,
  p_provider TEXT DEFAULT NULL,
  p_provider_reference TEXT DEFAULT NULL,
  p_metadata JSONB DEFAULT '{}'::jsonb
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_intent public.payment_intents%ROWTYPE;
  v_settlement_id UUID;
  v_provider TEXT;
  v_ref TEXT;
  v_minor BIGINT;
BEGIN
  IF coalesce(auth.role(), '') NOT IN ('service_role', 'authenticated') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'FORBIDDEN');
  END IF;
  IF auth.role() = 'authenticated' AND NOT private.is_platform_admin() THEN
    RETURN jsonb_build_object('ok', false, 'error', 'FORBIDDEN');
  END IF;

  SELECT * INTO v_intent FROM public.payment_intents WHERE id = p_intent_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'NOT_FOUND');
  END IF;
  IF v_intent.status <> 'completed' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'INTENT_NOT_COMPLETED');
  END IF;

  v_provider := coalesce(p_provider, v_intent.provider::text);
  v_ref := nullif(trim(coalesce(p_provider_reference, v_intent.provider_reference, '')), '');
  v_minor := coalesce(v_intent.amount_minor, round(v_intent.amount * 100)::bigint);

  IF v_ref IS NOT NULL THEN
    SELECT id INTO v_settlement_id
    FROM public.settlements
    WHERE provider = v_provider AND provider_reference = v_ref
    LIMIT 1;

    IF FOUND THEN
      UPDATE public.settlements
      SET
        status = 'settled',
        settled_at = coalesce(settled_at, NOW()),
        payment_intent_id = p_intent_id,
        updated_at = NOW()
      WHERE id = v_settlement_id;

      INSERT INTO public.provider_transactions (
        provider, provider_reference, payment_intent_id, direction,
        amount, amount_minor, currency, status, raw, observed_at
      ) VALUES (
        v_provider, v_ref, p_intent_id, 'collection',
        v_intent.amount, v_minor, v_intent.currency, 'settled',
        coalesce(p_metadata, '{}'::jsonb), NOW()
      )
      ON CONFLICT (provider, provider_reference) DO UPDATE
      SET
        payment_intent_id = EXCLUDED.payment_intent_id,
        status = EXCLUDED.status,
        raw = EXCLUDED.raw,
        observed_at = NOW();

      RETURN jsonb_build_object('ok', true, 'settlement_id', v_settlement_id, 'existing', true);
    END IF;
  END IF;

  INSERT INTO public.settlements (
    payment_intent_id, provider, provider_reference,
    amount, amount_minor, currency, status, settled_at, metadata
  ) VALUES (
    p_intent_id, v_provider, v_ref,
    v_intent.amount, v_minor, v_intent.currency, 'settled', NOW(),
    coalesce(p_metadata, '{}'::jsonb)
  )
  RETURNING id INTO v_settlement_id;

  IF v_ref IS NOT NULL THEN
    INSERT INTO public.provider_transactions (
      provider, provider_reference, payment_intent_id, direction,
      amount, amount_minor, currency, status, raw, observed_at
    ) VALUES (
      v_provider, v_ref, p_intent_id, 'collection',
      v_intent.amount, v_minor, v_intent.currency, 'settled',
      coalesce(p_metadata, '{}'::jsonb), NOW()
    )
    ON CONFLICT (provider, provider_reference) DO UPDATE
    SET
      payment_intent_id = EXCLUDED.payment_intent_id,
      status = EXCLUDED.status,
      raw = EXCLUDED.raw,
      observed_at = NOW();
  END IF;

  RETURN jsonb_build_object('ok', true, 'settlement_id', v_settlement_id);
END;
$$;

REVOKE ALL ON FUNCTION public.record_settlement_for_intent(UUID, TEXT, TEXT, JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.record_settlement_for_intent(UUID, TEXT, TEXT, JSONB)
  TO authenticated, service_role;
