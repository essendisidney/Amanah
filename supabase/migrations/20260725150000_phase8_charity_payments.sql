-- Phase 8: Charity/tip payments via payment_intents (no wallet credit)

-- Allow create_payment_intent to attach purpose metadata
CREATE OR REPLACE FUNCTION public.create_payment_intent(
  p_amount NUMERIC,
  p_currency CHAR(3) DEFAULT 'KES',
  p_phone TEXT DEFAULT NULL,
  p_provider public.payment_provider DEFAULT 'simulated',
  p_idempotency_key TEXT DEFAULT NULL,
  p_metadata JSONB DEFAULT '{}'::jsonb
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_intent public.payment_intents%ROWTYPE;
  v_min NUMERIC := 100;
  v_kind TEXT := coalesce(p_metadata->>'kind', 'wallet_top_up');
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'UNAUTHENTICATED');
  END IF;

  IF v_kind IN ('sadaka', 'platform_tip') THEN
    v_min := 10;
  END IF;

  IF p_amount IS NULL OR p_amount < v_min OR p_amount > 10000000 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'INVALID_AMOUNT');
  END IF;
  IF p_provider = 'mpesa' AND (p_phone IS NULL OR p_phone !~ '^\+[1-9]\d{7,14}$') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'PHONE_REQUIRED');
  END IF;

  IF p_idempotency_key IS NOT NULL THEN
    SELECT * INTO v_intent FROM public.payment_intents WHERE idempotency_key = p_idempotency_key;
    IF FOUND THEN
      RETURN jsonb_build_object(
        'ok', true,
        'intent_id', v_intent.id,
        'status', v_intent.status,
        'provider', v_intent.provider,
        'amount', v_intent.amount,
        'currency', v_intent.currency,
        'idempotent', true
      );
    END IF;
  END IF;

  INSERT INTO public.payment_intents (
    user_id, provider, status, amount, currency, phone, idempotency_key, metadata
  )
  VALUES (
    v_uid, p_provider, 'pending', p_amount, p_currency, p_phone, p_idempotency_key,
    jsonb_build_object('initiated_at', NOW(), 'kind', v_kind) || coalesce(p_metadata, '{}'::jsonb)
  )
  RETURNING * INTO v_intent;

  INSERT INTO public.audit_logs (actor_id, action, entity_type, entity_id, metadata)
  VALUES (
    v_uid, 'create', 'payment_intent', v_intent.id,
    jsonb_build_object('provider', p_provider, 'amount', p_amount, 'kind', v_kind)
  );

  RETURN jsonb_build_object(
    'ok', true,
    'intent_id', v_intent.id,
    'status', v_intent.status,
    'provider', v_intent.provider,
    'amount', v_intent.amount,
    'currency', v_intent.currency,
    'kind', v_kind
  );
END;
$$;

REVOKE ALL ON FUNCTION public.create_payment_intent(NUMERIC, CHAR, TEXT, public.payment_provider, TEXT, JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_payment_intent(NUMERIC, CHAR, TEXT, public.payment_provider, TEXT, JSONB) TO authenticated;

-- Keep old 5-arg signature as wrapper
CREATE OR REPLACE FUNCTION public.create_payment_intent(
  p_amount NUMERIC,
  p_currency CHAR(3) DEFAULT 'KES',
  p_phone TEXT DEFAULT NULL,
  p_provider public.payment_provider DEFAULT 'simulated',
  p_idempotency_key TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  RETURN public.create_payment_intent(
    p_amount, p_currency, p_phone, p_provider, p_idempotency_key, '{}'::jsonb
  );
END;
$$;

-- Complete: wallet top-up OR sadaka/tip fulfillment
CREATE OR REPLACE FUNCTION public.complete_payment_intent(
  p_intent_id UUID,
  p_provider_reference TEXT DEFAULT NULL,
  p_checkout_request_id TEXT DEFAULT NULL,
  p_metadata JSONB DEFAULT '{}'::jsonb
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_intent public.payment_intents%ROWTYPE;
  v_tx UUID;
  v_kind TEXT;
  v_tip_id UUID;
BEGIN
  IF coalesce(auth.role(), '') NOT IN ('service_role', 'authenticated') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'FORBIDDEN');
  END IF;

  SELECT * INTO v_intent FROM public.payment_intents WHERE id = p_intent_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'NOT_FOUND');
  END IF;

  IF v_intent.status = 'completed' THEN
    RETURN jsonb_build_object('ok', true, 'already_completed', true, 'transaction_id', v_intent.transaction_id);
  END IF;

  IF v_intent.status NOT IN ('pending', 'processing') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'NOT_COMPLETABLE');
  END IF;

  IF auth.role() = 'authenticated' THEN
    IF auth.uid() IS DISTINCT FROM v_intent.user_id OR v_intent.provider <> 'simulated' THEN
      RETURN jsonb_build_object('ok', false, 'error', 'FORBIDDEN');
    END IF;
  END IF;

  v_kind := coalesce(v_intent.metadata->>'kind', 'wallet_top_up');

  IF v_kind = 'sadaka' THEN
    IF v_intent.metadata->>'campaign_id' IS NULL THEN
      RETURN jsonb_build_object('ok', false, 'error', 'CAMPAIGN_REQUIRED');
    END IF;

    DECLARE
      v_c public.charity_campaigns%ROWTYPE;
      v_fee NUMERIC := 0;
      v_net NUMERIC;
      v_receipt TEXT;
      v_donation_id UUID;
      v_campaign_id UUID := (v_intent.metadata->>'campaign_id')::uuid;
    BEGIN
      SELECT * INTO v_c FROM public.charity_campaigns WHERE id = v_campaign_id FOR UPDATE;
      IF NOT FOUND OR v_c.status <> 'live' THEN
        RETURN jsonb_build_object('ok', false, 'error', 'CAMPAIGN_UNAVAILABLE');
      END IF;

      IF v_c.fee_mode = 'donation_addon' THEN
        v_fee := round(v_intent.amount * v_c.fee_bps / 10000.0, 2);
        v_net := v_intent.amount;
      ELSIF v_c.fee_mode = 'donation_deduct' THEN
        v_fee := round(v_intent.amount * v_c.fee_bps / 10000.0, 2);
        v_net := v_intent.amount - v_fee;
      ELSE
        v_net := v_intent.amount;
      END IF;

      v_receipt := 'AMA-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 10));

      INSERT INTO public.charity_donations (
        campaign_id, donor_user_id, donor_name, donor_phone, donor_email,
        amount, fee_amount, currency, receipt_code, is_anonymous, payment_intent_id
      ) VALUES (
        v_campaign_id, v_intent.user_id,
        v_intent.metadata->>'donor_name',
        coalesce(v_intent.phone, v_intent.metadata->>'donor_phone'),
        v_intent.metadata->>'donor_email',
        v_net, v_fee, v_c.currency, v_receipt,
        coalesce((v_intent.metadata->>'is_anonymous')::boolean, false),
        v_intent.id
      ) RETURNING id INTO v_donation_id;

      UPDATE public.charity_campaigns
      SET raised_amount = raised_amount + v_net
      WHERE id = v_campaign_id;

      UPDATE public.payment_intents
      SET
        status = 'completed',
        provider_reference = coalesce(p_provider_reference, provider_reference),
        checkout_request_id = coalesce(p_checkout_request_id, checkout_request_id),
        completed_at = NOW(),
        metadata = metadata || coalesce(p_metadata, '{}'::jsonb) ||
          jsonb_build_object('donation_id', v_donation_id, 'receipt_code', v_receipt),
        updated_at = NOW()
      WHERE id = v_intent.id;

      IF v_intent.user_id IS NOT NULL THEN
        INSERT INTO public.notifications (user_id, type, channel, title, body, data)
        VALUES (
          v_intent.user_id, 'system', 'in_app',
          'Donation receipt ' || v_receipt,
          'JazakAllah khair. Your gift of ' || v_net || ' ' || v_c.currency ||
            ' to ' || v_c.title || ' was recorded.',
          jsonb_build_object('donation_id', v_donation_id, 'receipt', v_receipt)
        );
      END IF;

      RETURN jsonb_build_object(
        'ok', true,
        'kind', 'sadaka',
        'donation_id', v_donation_id,
        'receipt_code', v_receipt
      );
    END;
  END IF;

  IF v_kind = 'platform_tip' THEN
    INSERT INTO public.platform_tips (user_id, amount, currency, phone, payment_intent_id)
    VALUES (v_intent.user_id, v_intent.amount, v_intent.currency, v_intent.phone, v_intent.id)
    RETURNING id INTO v_tip_id;

    UPDATE public.payment_intents
    SET
      status = 'completed',
      provider_reference = coalesce(p_provider_reference, provider_reference),
      checkout_request_id = coalesce(p_checkout_request_id, checkout_request_id),
      completed_at = NOW(),
      metadata = metadata || coalesce(p_metadata, '{}'::jsonb) || jsonb_build_object('tip_id', v_tip_id),
      updated_at = NOW()
    WHERE id = v_intent.id;

    RETURN jsonb_build_object('ok', true, 'kind', 'platform_tip', 'tip_id', v_tip_id);
  END IF;

  -- Default: wallet top-up
  v_tx := private.ledger_credit(
    v_intent.user_id,
    v_intent.currency,
    v_intent.amount,
    'wallet_top_up',
    NULL,
    coalesce(p_provider_reference, 'payment_intent:' || v_intent.id::text),
    'payment_intent:' || v_intent.id::text,
    jsonb_build_object(
      'payment_intent_id', v_intent.id,
      'provider', v_intent.provider
    ) || coalesce(p_metadata, '{}'::jsonb)
  );

  UPDATE public.payment_intents
  SET
    status = 'completed',
    provider_reference = coalesce(p_provider_reference, provider_reference),
    checkout_request_id = coalesce(p_checkout_request_id, checkout_request_id),
    transaction_id = v_tx,
    completed_at = NOW(),
    metadata = metadata || coalesce(p_metadata, '{}'::jsonb),
    updated_at = NOW()
  WHERE id = v_intent.id;

  INSERT INTO public.notifications (user_id, type, channel, title, body, data)
  VALUES (
    v_intent.user_id,
    'system',
    'in_app',
    'Wallet topped up',
    'Your wallet was credited after a successful payment.',
    jsonb_build_object('payment_intent_id', v_intent.id, 'transaction_id', v_tx)
  );

  RETURN jsonb_build_object('ok', true, 'transaction_id', v_tx);
END;
$$;
