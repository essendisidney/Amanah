-- Jameiyah Tawarruq: Jameiyah sets the profit rate, not the applicant.
--
-- Until now the request form let the applicant pick 5%, 10% or 15%, and submit_jameiyah_tawarruq
-- accepted any of them, so anyone could choose the lowest. The rate now comes from Jameiyah's
-- rate table (platform setting 'tawarruq_profit_bps', one rate per term in basis points), which
-- platform admins change. It starts at 10% for every term, the old default. A rate sent by the
-- client must match the table (RATE_CHANGED otherwise), so applicants get the quote they saw.

INSERT INTO public.platform_settings (key, value)
VALUES ('tawarruq_profit_bps', '{"3": 1000, "6": 1000, "12": 1000, "24": 1000}'::jsonb)
ON CONFLICT (key) DO NOTHING;

-- Jameiyah's profit rate for a term, in basis points; NULL if the term is not offered.
CREATE OR REPLACE FUNCTION private.tawarruq_profit_bps(p_tenor_months INT)
RETURNS INT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO ''
AS $$
  SELECT CASE
    WHEN p_tenor_months IN (3, 6, 12, 24) AND (s.value->>p_tenor_months::text) ~ '^[0-9]+$'
         AND (s.value->>p_tenor_months::text)::int BETWEEN 1 AND 5000
      THEN (s.value->>p_tenor_months::text)::int
  END
  FROM public.platform_settings s
  WHERE s.key = 'tawarruq_profit_bps';
$$;

-- The rate table, for the request form.
CREATE OR REPLACE FUNCTION public.get_tawarruq_rates()
RETURNS JSONB
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO ''
AS $$
  SELECT jsonb_build_object('ok', true, 'rates', coalesce(jsonb_object_agg(t::text, private.tawarruq_profit_bps(t)), '{}'::jsonb))
  FROM unnest(ARRAY[3, 6, 12, 24]) AS t
  WHERE private.tawarruq_profit_bps(t) IS NOT NULL;
$$;

-- Platform admins set the rates (1 to 5000 basis points per term).
CREATE OR REPLACE FUNCTION public.set_tawarruq_rates(p_rates JSONB)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  v_key TEXT;
  v_clean JSONB := '{}'::jsonb;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'UNAUTHENTICATED');
  END IF;
  IF NOT private.is_platform_admin() THEN
    RETURN jsonb_build_object('ok', false, 'error', 'FORBIDDEN');
  END IF;
  IF p_rates IS NULL OR jsonb_typeof(p_rates) <> 'object' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'INVALID');
  END IF;
  FOR v_key IN SELECT jsonb_object_keys(p_rates) LOOP
    IF v_key NOT IN ('3', '6', '12', '24')
       OR coalesce(p_rates->>v_key, '') !~ '^[0-9]+$'
       OR (p_rates->>v_key)::int NOT BETWEEN 1 AND 5000 THEN
      RETURN jsonb_build_object('ok', false, 'error', 'INVALID', 'term', v_key);
    END IF;
    v_clean := v_clean || jsonb_build_object(v_key, (p_rates->>v_key)::int);
  END LOOP;
  IF v_clean = '{}'::jsonb THEN
    RETURN jsonb_build_object('ok', false, 'error', 'INVALID');
  END IF;

  INSERT INTO public.platform_settings (key, value, updated_at)
  VALUES ('tawarruq_profit_bps', v_clean, NOW())
  ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW();

  INSERT INTO public.audit_logs (actor_id, action, entity_type, entity_id, metadata)
  VALUES (auth.uid(), 'update', 'platform_setting', NULL,
          jsonb_build_object('key', 'tawarruq_profit_bps', 'value', v_clean));

  RETURN jsonb_build_object('ok', true, 'rates', v_clean);
END;
$$;

CREATE OR REPLACE FUNCTION public.submit_jameiyah_tawarruq(p_amount numeric, p_purpose text, p_jamiya_id uuid, p_profit_rate_bps integer, p_tenor_months integer, p_wakalah boolean, p_guarantor_user_id uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v_uid UUID := auth.uid();
  v_id UUID;
  v_profit NUMERIC(14, 2);
  v_deferred NUMERIC(14, 2);
  v_installment NUMERIC(14, 2);
  v_phone TEXT;
  v_kyc TEXT;
  v_name TEXT;
  v_qual JSONB;
  v_room NUMERIC := 0;
  v_company_left NUMERIC := 0;
  v_ceiling NUMERIC := 0;
  v_rate INT;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'UNAUTHENTICATED');
  END IF;
  IF p_wakalah IS NOT TRUE THEN
    RETURN jsonb_build_object('ok', false, 'error', 'WAKALAH_REQUIRED');
  END IF;
  IF p_amount IS NULL OR p_amount < 1000 OR p_amount > 5000000
     OR p_tenor_months IS NULL OR p_tenor_months NOT IN (3, 6, 12, 24)
     OR p_purpose IS NULL OR char_length(trim(p_purpose)) < 5 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'INVALID');
  END IF;

  -- Jameiyah sets the profit rate for each term; the applicant does not choose it. A rate sent
  -- by the client must match, so the quote the applicant saw is the one they get.
  v_rate := private.tawarruq_profit_bps(p_tenor_months);
  IF v_rate IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'INVALID');
  END IF;
  IF p_profit_rate_bps IS NOT NULL AND p_profit_rate_bps <> v_rate THEN
    RETURN jsonb_build_object('ok', false, 'error', 'RATE_CHANGED', 'profit_rate_bps', v_rate);
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

  PERFORM 1 FROM public.platform_settings WHERE key = 'tawarruq_exposure_ceiling' FOR UPDATE;

  SELECT coalesce(nullif(trim(mpesa_phone), ''), nullif(trim(phone), '')), kyc_status::text,
         coalesce(full_name, email, 'A member')
  INTO v_phone, v_kyc, v_name
  FROM public.profiles
  WHERE id = v_uid;

  IF v_phone IS NULL OR v_phone !~ '^\+[1-9]\d{7,14}$' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'PHONE_REQUIRED');
  END IF;

  IF private.facility_member_overdue(v_uid) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'OVERDUE');
  END IF;

  v_qual := public.my_facility_qualification();
  v_room := coalesce((v_qual->>'tawarruq_room')::numeric, 0);
  v_company_left := coalesce((v_qual->>'company_left')::numeric, 0);
  v_ceiling := coalesce((v_qual->>'company_ceiling')::numeric, 500000);

  IF p_amount > v_room THEN
    RETURN jsonb_build_object('ok', false, 'error', 'ABOVE_ROOM', 'room', v_room);
  END IF;
  IF p_amount > v_company_left THEN
    RETURN jsonb_build_object(
      'ok', false,
      'error', 'ABOVE_COMPANY_LIMIT',
      'company_left', v_company_left,
      'ceiling', v_ceiling
    );
  END IF;
  IF p_amount > 5000 AND v_kyc IS DISTINCT FROM 'approved' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'KYC_REQUIRED', 'kyc_status', v_kyc);
  END IF;
  IF p_amount > 20000 AND (
    p_guarantor_user_id IS NULL
    OR p_guarantor_user_id = v_uid
    OR NOT EXISTS (
      SELECT 1
      FROM public.members mine
      JOIN public.members theirs
        ON theirs.jamiya_id = mine.jamiya_id
       AND theirs.user_id = p_guarantor_user_id
       AND theirs.status = 'active'
      WHERE mine.user_id = v_uid AND mine.status = 'active'
    )
  ) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'GUARANTOR_REQUIRED');
  END IF;

  v_profit := round(p_amount * v_rate / 10000.0, 2);
  IF v_profit <= 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'INVALID');
  END IF;
  v_deferred := round(p_amount + v_profit, 2);
  v_installment := round(v_deferred / p_tenor_months, 2);

  INSERT INTO public.tawarruq_applications (
    user_id, jamiya_id, amount, purpose, status,
    profit_rate_bps, tenor_months, profit_amount, deferred_amount,
    platform_fee_amount, circle_profit_amount, installment_amount,
    wakalah_accepted_at, commodity, metadata
  )
  VALUES (
    v_uid, p_jamiya_id, p_amount, trim(p_purpose), 'requested',
    v_rate, p_tenor_months, v_profit, v_deferred,
    v_profit, 0, v_installment,
    NOW(), 'crude_palm_oil',
    jsonb_build_object(
      'structure', 'jameiyah_murabaha_tawarruq',
      'financier', 'jameiyah',
      'profit_to', 'jameiyah',
      'cash_moves', false,
      'qualification_room', v_room,
      'band', CASE
        WHEN p_amount > 100000 THEN 'two_admins'
        WHEN p_amount > 20000 THEN 'guarantor'
        WHEN p_amount > 5000 THEN 'kyc'
        ELSE 'standard'
      END
    )
  )
  RETURNING id INTO v_id;

  IF p_amount > 20000 THEN
    INSERT INTO public.tawarruq_guarantees (
      application_id, borrower_id, guarantor_user_id, status
    )
    VALUES (v_id, v_uid, p_guarantor_user_id, 'pending');

    INSERT INTO public.notifications (user_id, type, channel, title, body, data)
    VALUES (
      p_guarantor_user_id,
      'system',
      'in_app',
      'Guarantee requested',
      v_name || ' asked you to guarantee a Jameiyah financing request.',
      jsonb_build_object('kind', 'tawarruq_guarantee', 'application_id', v_id)
    );
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'application_id', v_id,
    'cash_amount', p_amount,
    'profit_rate_bps', v_rate,
    'deferred_amount', v_deferred,
    'platform_fee_amount', v_profit,
    'circle_profit_amount', 0,
    'installment_amount', v_installment,
    'room', v_room
  );
END;
$function$;

REVOKE ALL ON FUNCTION private.tawarruq_profit_bps(INT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.get_tawarruq_rates() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.set_tawarruq_rates(JSONB) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_tawarruq_rates() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.set_tawarruq_rates(JSONB) TO authenticated, service_role;
