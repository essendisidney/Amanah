-- Allow small IntaSend STK smoke tests (Ksh 10 wallet top-ups).

CREATE OR REPLACE FUNCTION public.create_payment_intent(
  p_amount NUMERIC,
  p_currency CHAR DEFAULT 'KES',
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
  v_min NUMERIC := 10;
  v_kind TEXT := coalesce(p_metadata->>'kind', 'wallet_top_up');
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'UNAUTHENTICATED');
  END IF;

  IF v_kind IN ('sadaka', 'platform_tip', 'wallet_top_up') THEN
    v_min := 10;
  ELSIF v_kind = 'sponsorship' THEN
    v_min := 100;
  ELSIF v_kind = 'contribution' THEN
    v_min := 1;
  END IF;

  IF p_amount IS NULL OR p_amount < v_min OR p_amount > 10000000 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'INVALID_AMOUNT');
  END IF;

  IF p_provider IN ('mpesa', 'intasend', 'tendepay')
     AND (p_phone IS NULL OR p_phone !~ '^\+[1-9]\d{7,14}$') THEN
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
