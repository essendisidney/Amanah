-- Wave 5: broaden Kenya bank SMS providers on circle_bank_alerts.

ALTER TABLE public.circle_bank_alerts
  DROP CONSTRAINT IF EXISTS circle_bank_alerts_provider_check;

ALTER TABLE public.circle_bank_alerts
  ADD CONSTRAINT circle_bank_alerts_provider_check
  CHECK (
    provider IN (
      'manual',
      'equity',
      'mpesa',
      'kcb',
      'coop',
      'absa',
      'ncba',
      'stanbic',
      'other'
    )
  );

CREATE OR REPLACE FUNCTION public.ingest_bank_alert(
  p_jamiya_id UUID,
  p_provider TEXT,
  p_alert_text TEXT,
  p_amount NUMERIC DEFAULT NULL,
  p_direction TEXT DEFAULT NULL,
  p_currency TEXT DEFAULT 'KES',
  p_external_ref TEXT DEFAULT NULL,
  p_bank_account_id UUID DEFAULT NULL,
  p_occurred_at TIMESTAMPTZ DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_role TEXT := coalesce(auth.role(), '');
  v_id UUID;
  v_provider TEXT := lower(btrim(COALESCE(p_provider, 'other')));
  v_direction TEXT := lower(btrim(COALESCE(p_direction, '')));
  v_currency CHAR(3) := left(upper(coalesce(nullif(btrim(p_currency), ''), 'KES')), 3);
BEGIN
  IF v_uid IS NOT NULL THEN
    IF NOT (private.is_circle_officer(p_jamiya_id) OR private.is_platform_admin()) THEN
      RETURN jsonb_build_object('ok', false, 'error', 'FORBIDDEN');
    END IF;
  ELSIF v_role IS DISTINCT FROM 'service_role' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'UNAUTHENTICATED');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.jamiyas WHERE id = p_jamiya_id) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'NOT_FOUND');
  END IF;

  IF v_provider NOT IN (
    'manual', 'equity', 'mpesa', 'kcb', 'coop', 'absa', 'ncba', 'stanbic', 'other'
  ) THEN
    v_provider := 'other';
  END IF;
  IF v_direction NOT IN ('credit', 'debit') THEN
    v_direction := NULL;
  END IF;

  IF p_external_ref IS NOT NULL THEN
    SELECT id INTO v_id
    FROM public.circle_bank_alerts
    WHERE jamiya_id = p_jamiya_id AND external_ref = p_external_ref
    LIMIT 1;
    IF v_id IS NOT NULL THEN
      RETURN jsonb_build_object('ok', true, 'alert_id', v_id, 'duplicate', true);
    END IF;
  END IF;

  INSERT INTO public.circle_bank_alerts (
    jamiya_id, bank_account_id, provider, external_ref, alert_text,
    amount, currency, direction, occurred_at, status, created_by
  ) VALUES (
    p_jamiya_id, p_bank_account_id, v_provider, p_external_ref,
    nullif(btrim(COALESCE(p_alert_text, '')), ''),
    p_amount, v_currency, v_direction,
    COALESCE(p_occurred_at, NOW()), 'pending', v_uid
  )
  RETURNING id INTO v_id;

  RETURN jsonb_build_object('ok', true, 'alert_id', v_id, 'duplicate', false);
END;
$$;

REVOKE ALL ON FUNCTION public.ingest_bank_alert(
  UUID, TEXT, TEXT, NUMERIC, TEXT, TEXT, TEXT, UUID, TIMESTAMPTZ
) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.ingest_bank_alert(
  UUID, TEXT, TEXT, NUMERIC, TEXT, TEXT, TEXT, UUID, TIMESTAMPTZ
) TO authenticated, service_role;
