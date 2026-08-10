-- Circle members only may submit Sadaka campaigns.
CREATE OR REPLACE FUNCTION public.submit_sadaka_campaign(
  p_title TEXT,
  p_story TEXT,
  p_category TEXT,
  p_target_amount NUMERIC,
  p_beneficiary_name TEXT,
  p_beneficiary_phone TEXT,
  p_beneficiary_kyc_doc_url TEXT,
  p_slug TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_slug TEXT;
  v_base TEXT;
  v_n INT := 1;
  v_id UUID;
  v_cat public.sadaka_category;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'UNAUTHENTICATED');
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.members m
    WHERE m.user_id = v_uid AND m.status = 'active'
  ) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'NOT_A_MEMBER');
  END IF;
  IF btrim(COALESCE(p_title, '')) = '' OR char_length(btrim(p_story)) < 40 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'INVALID_STORY');
  END IF;
  IF p_target_amount IS NULL OR p_target_amount < 100 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'INVALID_TARGET');
  END IF;
  IF btrim(COALESCE(p_beneficiary_name, '')) = ''
     OR btrim(COALESCE(p_beneficiary_phone, '')) = ''
     OR btrim(COALESCE(p_beneficiary_kyc_doc_url, '')) = '' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'BENEFICIARY_KYC_REQUIRED');
  END IF;
  IF p_category NOT IN (
    'medical', 'funeral', 'education', 'business_startup',
    'emergency_disaster', 'institutional'
  ) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'INVALID_CATEGORY');
  END IF;
  v_cat := p_category::public.sadaka_category;

  v_base := lower(regexp_replace(COALESCE(nullif(btrim(p_slug), ''), p_title), '[^a-zA-Z0-9]+', '-', 'g'));
  v_base := trim(both '-' from v_base);
  IF v_base = '' THEN v_base := 'campaign'; END IF;
  v_slug := v_base;
  WHILE EXISTS (SELECT 1 FROM public.charity_campaigns WHERE slug = v_slug) LOOP
    v_n := v_n + 1;
    v_slug := v_base || '-' || v_n::text;
  END LOOP;

  INSERT INTO public.charity_campaigns (
    slug, title, summary, description, goal_amount, currency, status,
    sharia_board_endorsed, fee_mode, fee_bps, created_by,
    category, beneficiary_name, beneficiary_phone, beneficiary_kyc_doc_url
  ) VALUES (
    v_slug,
    btrim(p_title),
    left(btrim(p_story), 280),
    btrim(p_story),
    p_target_amount,
    'KES',
    'pending_review',
    false,
    'donation_addon',
    250,
    v_uid,
    v_cat,
    btrim(p_beneficiary_name),
    btrim(p_beneficiary_phone),
    btrim(p_beneficiary_kyc_doc_url)
  )
  RETURNING id INTO v_id;

  INSERT INTO public.notifications (user_id, type, channel, title, body, data)
  SELECT p.id, 'system', 'in_app',
    'Sadaka campaign pending review',
    'A new campaign awaits approval: ' || btrim(p_title),
    jsonb_build_object('campaign_id', v_id)
  FROM public.profiles p
  WHERE p.platform_role IN ('platform_admin', 'super_admin', 'compliance_officer');

  RETURN jsonb_build_object('ok', true, 'campaign_id', v_id, 'slug', v_slug);
END;
$$;

REVOKE ALL ON FUNCTION public.submit_sadaka_campaign(TEXT, TEXT, TEXT, NUMERIC, TEXT, TEXT, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.submit_sadaka_campaign(TEXT, TEXT, TEXT, NUMERIC, TEXT, TEXT, TEXT, TEXT) TO authenticated;
