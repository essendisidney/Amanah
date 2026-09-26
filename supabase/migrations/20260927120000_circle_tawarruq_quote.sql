-- Jameiyah offers Tawarruq. The member repays Jameiyah the deferred price.
-- The murabaha profit is Jameiyah's income. A circle link is optional context.
-- Commodity purchase and cash disbursement stay with the partner agent.

ALTER TABLE public.tawarruq_applications
  ADD COLUMN IF NOT EXISTS profit_rate_bps INT,
  ADD COLUMN IF NOT EXISTS tenor_months INT,
  ADD COLUMN IF NOT EXISTS profit_amount NUMERIC(14, 2),
  ADD COLUMN IF NOT EXISTS deferred_amount NUMERIC(14, 2),
  ADD COLUMN IF NOT EXISTS platform_fee_amount NUMERIC(14, 2),
  ADD COLUMN IF NOT EXISTS circle_profit_amount NUMERIC(14, 2),
  ADD COLUMN IF NOT EXISTS installment_amount NUMERIC(14, 2),
  ADD COLUMN IF NOT EXISTS wakalah_accepted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS commodity TEXT;

DROP FUNCTION IF EXISTS public.submit_circle_tawarruq(NUMERIC, TEXT, UUID, INT, INT, BOOLEAN);

CREATE OR REPLACE FUNCTION public.submit_jameiyah_tawarruq(
  p_amount NUMERIC,
  p_purpose TEXT,
  p_jamiya_id UUID,
  p_profit_rate_bps INT,
  p_tenor_months INT,
  p_wakalah BOOLEAN
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_id UUID;
  v_profit NUMERIC(14, 2);
  v_deferred NUMERIC(14, 2);
  v_installment NUMERIC(14, 2);
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'UNAUTHENTICATED');
  END IF;
  IF p_wakalah IS NOT TRUE THEN
    RETURN jsonb_build_object('ok', false, 'error', 'WAKALAH_REQUIRED');
  END IF;
  IF p_amount IS NULL OR p_amount < 1000 OR p_amount > 5000000
     OR p_profit_rate_bps IS NULL OR p_profit_rate_bps NOT IN (500, 1000, 1500)
     OR p_tenor_months IS NULL OR p_tenor_months NOT IN (3, 6, 12, 24)
     OR p_purpose IS NULL OR char_length(trim(p_purpose)) < 5 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'INVALID');
  END IF;

  IF p_jamiya_id IS NOT NULL AND NOT EXISTS (
    SELECT 1
    FROM public.members
    WHERE user_id = v_uid
      AND jamiya_id = p_jamiya_id
      AND status = 'active'
  ) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'NOT_A_MEMBER');
  END IF;

  v_profit := round(p_amount * p_profit_rate_bps / 10000.0, 2);
  IF v_profit <= 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'INVALID');
  END IF;
  v_deferred := round(p_amount + v_profit, 2);
  v_installment := round(v_deferred / p_tenor_months, 2);

  INSERT INTO public.tawarruq_applications (
    user_id,
    jamiya_id,
    amount,
    purpose,
    status,
    profit_rate_bps,
    tenor_months,
    profit_amount,
    deferred_amount,
    platform_fee_amount,
    circle_profit_amount,
    installment_amount,
    wakalah_accepted_at,
    commodity,
    metadata
  )
  VALUES (
    v_uid,
    p_jamiya_id,
    p_amount,
    trim(p_purpose),
    'requested',
    p_profit_rate_bps,
    p_tenor_months,
    v_profit,
    v_deferred,
    v_profit,
    0,
    v_installment,
    NOW(),
    'crude_palm_oil',
    jsonb_build_object(
      'structure', 'jameiyah_murabaha_tawarruq',
      'financier', 'jameiyah',
      'profit_to', 'jameiyah',
      'cash_moves', false
    )
  )
  RETURNING id INTO v_id;

  RETURN jsonb_build_object(
    'ok', true,
    'application_id', v_id,
    'cash_amount', p_amount,
    'deferred_amount', v_deferred,
    'platform_fee_amount', v_profit,
    'circle_profit_amount', 0,
    'installment_amount', v_installment
  );
END;
$$;

REVOKE ALL ON FUNCTION public.submit_jameiyah_tawarruq(NUMERIC, TEXT, UUID, INT, INT, BOOLEAN) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.submit_jameiyah_tawarruq(NUMERIC, TEXT, UUID, INT, INT, BOOLEAN) TO authenticated;

CREATE OR REPLACE FUNCTION public.update_tawarruq_partner_status(
  p_application_id UUID,
  p_status TEXT,
  p_partner_reference TEXT DEFAULT NULL,
  p_partner_status TEXT DEFAULT NULL,
  p_notes TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_app public.tawarruq_applications%ROWTYPE;
  v_status public.tawarruq_status;
  v_reference TEXT;
BEGIN
  IF v_uid IS NULL OR NOT private.is_compliance_or_admin() THEN
    RETURN jsonb_build_object('ok', false, 'error', 'FORBIDDEN');
  END IF;

  BEGIN
    v_status := p_status::public.tawarruq_status;
  EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('ok', false, 'error', 'INVALID_STATUS');
  END;

  SELECT * INTO v_app FROM public.tawarruq_applications WHERE id = p_application_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'NOT_FOUND');
  END IF;

  v_reference := coalesce(nullif(trim(p_partner_reference), ''), v_app.partner_reference);
  IF v_status = 'disbursed' AND v_reference IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'PARTNER_REFERENCE_REQUIRED');
  END IF;

  UPDATE public.tawarruq_applications
  SET
    status = v_status,
    partner_reference = v_reference,
    partner_status = coalesce(nullif(trim(p_partner_status), ''), partner_status),
    metadata = coalesce(metadata, '{}'::jsonb)
      || jsonb_build_object(
        'updated_by', v_uid,
        'notes', p_notes,
        'updated_at', NOW()
      )
      || CASE
        WHEN v_status = 'disbursed' AND v_app.platform_fee_amount IS NOT NULL
          THEN jsonb_build_object('jameiyah_profit_status', 'earned_when_disbursed')
        ELSE '{}'::jsonb
      END,
    updated_at = NOW()
  WHERE id = p_application_id;

  INSERT INTO public.notifications (user_id, type, channel, title, body, data)
  VALUES (
    v_app.user_id, 'system', 'in_app',
    'Tawarruq update',
    'Your financing application is now: ' || v_status::text,
    jsonb_build_object('application_id', p_application_id, 'status', v_status)
  );

  RETURN jsonb_build_object('ok', true, 'status', v_status);
END;
$$;

REVOKE ALL ON FUNCTION public.update_tawarruq_partner_status(UUID, TEXT, TEXT, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.update_tawarruq_partner_status(UUID, TEXT, TEXT, TEXT, TEXT) TO authenticated;
