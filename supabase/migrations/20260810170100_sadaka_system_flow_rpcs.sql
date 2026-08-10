-- Sadaka system flow RPCs

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

CREATE OR REPLACE FUNCTION public.review_sadaka_campaign(
  p_campaign_id UUID,
  p_approve BOOLEAN,
  p_rejection_reason TEXT DEFAULT NULL,
  p_sharia_endorsed BOOLEAN DEFAULT false
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_c public.charity_campaigns%ROWTYPE;
BEGIN
  IF v_uid IS NULL OR NOT private.is_compliance_or_admin() THEN
    RETURN jsonb_build_object('ok', false, 'error', 'FORBIDDEN');
  END IF;

  SELECT * INTO v_c FROM public.charity_campaigns WHERE id = p_campaign_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'NOT_FOUND');
  END IF;
  IF v_c.status NOT IN ('pending_review', 'draft') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'NOT_REVIEWABLE');
  END IF;

  IF NOT p_approve THEN
    IF btrim(COALESCE(p_rejection_reason, '')) = '' THEN
      RETURN jsonb_build_object('ok', false, 'error', 'REASON_REQUIRED');
    END IF;
    UPDATE public.charity_campaigns
    SET status = 'rejected',
        rejection_reason = btrim(p_rejection_reason),
        reviewed_by = v_uid,
        reviewed_at = NOW(),
        updated_at = NOW()
    WHERE id = p_campaign_id;

    IF v_c.created_by IS NOT NULL THEN
      INSERT INTO public.notifications (user_id, type, channel, title, body, data)
      VALUES (
        v_c.created_by, 'system', 'in_app',
        'Campaign rejected',
        btrim(p_rejection_reason),
        jsonb_build_object('campaign_id', p_campaign_id)
      );
    END IF;
    RETURN jsonb_build_object('ok', true, 'status', 'rejected');
  END IF;

  UPDATE public.charity_campaigns
  SET status = 'live',
      rejection_reason = NULL,
      sharia_board_endorsed = COALESCE(p_sharia_endorsed, false),
      reviewed_by = v_uid,
      reviewed_at = NOW(),
      updated_at = NOW()
  WHERE id = p_campaign_id;

  IF v_c.created_by IS NOT NULL THEN
    INSERT INTO public.notifications (user_id, type, channel, title, body, data)
    VALUES (
      v_c.created_by, 'system', 'in_app',
      'Campaign approved',
      'Your Sadaka campaign is now live.',
      jsonb_build_object('campaign_id', p_campaign_id, 'slug', v_c.slug)
    );
  END IF;

  RETURN jsonb_build_object('ok', true, 'status', 'live');
END;
$$;

REVOKE ALL ON FUNCTION public.review_sadaka_campaign(UUID, BOOLEAN, TEXT, BOOLEAN) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.review_sadaka_campaign(UUID, BOOLEAN, TEXT, BOOLEAN) TO authenticated;

-- Simulated B2C disbursement (Option B MVP — short pass-through; live Daraja later)
CREATE OR REPLACE FUNCTION public.disburse_sadaka_campaign(
  p_campaign_id UUID,
  p_amount NUMERIC DEFAULT NULL,
  p_notes TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_c public.charity_campaigns%ROWTYPE;
  v_gross NUMERIC;
  v_fee NUMERIC;
  v_net NUMERIC;
  v_id UUID;
  v_available NUMERIC;
BEGIN
  IF v_uid IS NULL OR NOT private.is_compliance_or_admin() THEN
    RETURN jsonb_build_object('ok', false, 'error', 'FORBIDDEN');
  END IF;

  SELECT * INTO v_c FROM public.charity_campaigns WHERE id = p_campaign_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'NOT_FOUND');
  END IF;
  IF v_c.status NOT IN ('live', 'funded', 'disbursed') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'NOT_DISBURSABLE');
  END IF;
  IF btrim(COALESCE(v_c.beneficiary_phone, '')) = '' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'NO_BENEFICIARY_PHONE');
  END IF;

  v_available := GREATEST(v_c.raised_amount - v_c.disbursed_amount, 0);
  IF v_available <= 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'NOTHING_TO_DISBURSE');
  END IF;

  v_gross := COALESCE(p_amount, v_available);
  IF v_gross <= 0 OR v_gross > v_available THEN
    RETURN jsonb_build_object('ok', false, 'error', 'INVALID_AMOUNT', 'available', v_available);
  END IF;

  -- Fee already collected at donation time for donation_addon; deduct mode already netted.
  -- Platform fee on disbursement is 0 when addon; otherwise already in donation fee_amount.
  v_fee := 0;
  v_net := v_gross - v_fee;

  INSERT INTO public.charity_disbursements (
    campaign_id, amount, fee_deducted, net_amount, currency,
    beneficiary_phone, mpesa_b2c_id, status, approved_by, notes, paid_at
  ) VALUES (
    p_campaign_id, v_gross, v_fee, v_net, v_c.currency,
    v_c.beneficiary_phone,
    'sim-b2c:' || gen_random_uuid()::text,
    'paid',
    v_uid,
    COALESCE(p_notes, 'Simulated B2C disbursement (MVP Option B)'),
    NOW()
  )
  RETURNING id INTO v_id;

  UPDATE public.charity_campaigns
  SET disbursed_amount = disbursed_amount + v_net,
      last_disbursed_at = NOW(),
      status = CASE
        WHEN disbursed_amount + v_net >= raised_amount THEN 'disbursed'::public.campaign_status
        WHEN raised_amount >= goal_amount THEN 'funded'::public.campaign_status
        ELSE status
      END,
      updated_at = NOW()
  WHERE id = p_campaign_id;

  IF v_c.created_by IS NOT NULL THEN
    INSERT INTO public.notifications (user_id, type, channel, title, body, data)
    VALUES (
      v_c.created_by, 'system', 'in_app',
      'Campaign disbursed',
      'KES ' || v_net::text || ' sent to beneficiary M-Pesa.',
      jsonb_build_object('campaign_id', p_campaign_id, 'disbursement_id', v_id)
    );
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'disbursement_id', v_id,
    'net', v_net,
    'mpesa_b2c_id', 'simulated'
  );
END;
$$;

REVOKE ALL ON FUNCTION public.disburse_sadaka_campaign(UUID, NUMERIC, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.disburse_sadaka_campaign(UUID, NUMERIC, TEXT) TO authenticated;

CREATE OR REPLACE FUNCTION public.register_sadaka_institution(
  p_name TEXT,
  p_type TEXT,
  p_contact_person TEXT,
  p_registration_doc_url TEXT,
  p_contact_phone TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_id UUID;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'UNAUTHENTICATED');
  END IF;
  IF p_type NOT IN ('mosque', 'madrasa', 'orphanage') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'INVALID_TYPE');
  END IF;
  IF btrim(COALESCE(p_name, '')) = ''
     OR btrim(COALESCE(p_contact_person, '')) = ''
     OR btrim(COALESCE(p_registration_doc_url, '')) = '' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'DOCS_REQUIRED');
  END IF;

  INSERT INTO public.sadaka_institutions (
    name, type, registration_doc_url, contact_person, contact_phone, contact_user_id
  ) VALUES (
    btrim(p_name), p_type::public.institution_type, btrim(p_registration_doc_url),
    btrim(p_contact_person), nullif(btrim(COALESCE(p_contact_phone, '')), ''), v_uid
  )
  RETURNING id INTO v_id;

  RETURN jsonb_build_object('ok', true, 'institution_id', v_id);
END;
$$;

REVOKE ALL ON FUNCTION public.register_sadaka_institution(TEXT, TEXT, TEXT, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.register_sadaka_institution(TEXT, TEXT, TEXT, TEXT, TEXT) TO authenticated;

CREATE OR REPLACE FUNCTION public.verify_sadaka_institution(
  p_institution_id UUID,
  p_approve BOOLEAN,
  p_rejection_reason TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_i public.sadaka_institutions%ROWTYPE;
BEGIN
  IF v_uid IS NULL OR NOT private.is_compliance_or_admin() THEN
    RETURN jsonb_build_object('ok', false, 'error', 'FORBIDDEN');
  END IF;
  SELECT * INTO v_i FROM public.sadaka_institutions WHERE id = p_institution_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'NOT_FOUND');
  END IF;

  IF NOT p_approve THEN
    UPDATE public.sadaka_institutions
    SET verification_status = 'rejected',
        rejection_reason = btrim(COALESCE(p_rejection_reason, 'Rejected')),
        verified_by = v_uid,
        verified_at = NOW(),
        updated_at = NOW()
    WHERE id = p_institution_id;
    RETURN jsonb_build_object('ok', true, 'status', 'rejected');
  END IF;

  UPDATE public.sadaka_institutions
  SET verification_status = 'verified',
      rejection_reason = NULL,
      verified_by = v_uid,
      verified_at = NOW(),
      updated_at = NOW()
  WHERE id = p_institution_id;
  RETURN jsonb_build_object('ok', true, 'status', 'verified');
END;
$$;

REVOKE ALL ON FUNCTION public.verify_sadaka_institution(UUID, BOOLEAN, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.verify_sadaka_institution(UUID, BOOLEAN, TEXT) TO authenticated;

CREATE OR REPLACE FUNCTION public.create_adoption_profile(
  p_institution_id UUID,
  p_title TEXT,
  p_description TEXT,
  p_suggested_monthly_amount NUMERIC
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_i public.sadaka_institutions%ROWTYPE;
  v_slug TEXT;
  v_base TEXT;
  v_n INT := 1;
  v_id UUID;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'UNAUTHENTICATED');
  END IF;
  SELECT * INTO v_i FROM public.sadaka_institutions WHERE id = p_institution_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'NOT_FOUND');
  END IF;
  IF v_i.verification_status <> 'verified' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'NOT_VERIFIED');
  END IF;
  IF v_i.contact_user_id <> v_uid AND NOT private.is_compliance_or_admin() THEN
    RETURN jsonb_build_object('ok', false, 'error', 'FORBIDDEN');
  END IF;
  IF p_suggested_monthly_amount IS NULL OR p_suggested_monthly_amount < 100 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'INVALID_AMOUNT');
  END IF;

  v_base := lower(regexp_replace(p_title, '[^a-zA-Z0-9]+', '-', 'g'));
  v_base := trim(both '-' from v_base);
  IF v_base = '' THEN v_base := 'adopt'; END IF;
  v_slug := v_base;
  WHILE EXISTS (SELECT 1 FROM public.adoption_profiles WHERE slug = v_slug) LOOP
    v_n := v_n + 1;
    v_slug := v_base || '-' || v_n::text;
  END LOOP;

  INSERT INTO public.adoption_profiles (
    institution_id, slug, title, description, suggested_monthly_amount
  ) VALUES (
    p_institution_id, v_slug, btrim(p_title), btrim(p_description), p_suggested_monthly_amount
  )
  RETURNING id INTO v_id;

  RETURN jsonb_build_object('ok', true, 'profile_id', v_id, 'slug', v_slug);
END;
$$;

REVOKE ALL ON FUNCTION public.create_adoption_profile(UUID, TEXT, TEXT, NUMERIC) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_adoption_profile(UUID, TEXT, TEXT, NUMERIC) TO authenticated;

CREATE OR REPLACE FUNCTION public.start_sponsorship(
  p_adoption_profile_id UUID,
  p_monthly_amount NUMERIC,
  p_phone TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_ap public.adoption_profiles%ROWTYPE;
  v_id UUID;
  v_charge UUID;
  v_fee NUMERIC;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'UNAUTHENTICATED');
  END IF;
  SELECT * INTO v_ap FROM public.adoption_profiles WHERE id = p_adoption_profile_id;
  IF NOT FOUND OR v_ap.status <> 'active' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'NOT_AVAILABLE');
  END IF;
  IF p_monthly_amount IS NULL OR p_monthly_amount < 100 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'INVALID_AMOUNT');
  END IF;

  INSERT INTO public.sponsorships (
    adoption_profile_id, sponsor_user_id, monthly_amount, currency, phone, next_charge_date
  ) VALUES (
    p_adoption_profile_id, v_uid, p_monthly_amount, v_ap.currency,
    nullif(btrim(COALESCE(p_phone, '')), ''),
    CURRENT_DATE + 30
  )
  RETURNING id INTO v_id;

  -- First month charge recorded as simulated (Daraja recurring deferred)
  v_fee := round(p_monthly_amount * v_ap.fee_bps / 10000.0, 2);
  INSERT INTO public.sponsorship_charges (
    sponsorship_id, amount, fee_amount, currency, status
  ) VALUES (v_id, p_monthly_amount, v_fee, v_ap.currency, 'paid')
  RETURNING id INTO v_charge;

  RETURN jsonb_build_object(
    'ok', true,
    'sponsorship_id', v_id,
    'first_charge_id', v_charge,
    'note', 'First month recorded (simulated). Recurring STK schedule later.'
  );
END;
$$;

REVOKE ALL ON FUNCTION public.start_sponsorship(UUID, NUMERIC, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.start_sponsorship(UUID, NUMERIC, TEXT) TO authenticated;

CREATE OR REPLACE FUNCTION public.post_adoption_impact_report(
  p_adoption_profile_id UUID,
  p_period_label TEXT,
  p_body TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_id UUID;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'UNAUTHENTICATED');
  END IF;
  IF NOT (
    private.is_compliance_or_admin()
    OR EXISTS (
      SELECT 1 FROM public.adoption_profiles ap
      JOIN public.sadaka_institutions i ON i.id = ap.institution_id
      WHERE ap.id = p_adoption_profile_id AND i.contact_user_id = v_uid
    )
  ) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'FORBIDDEN');
  END IF;

  INSERT INTO public.adoption_impact_reports (
    adoption_profile_id, period_label, body, created_by
  ) VALUES (
    p_adoption_profile_id, btrim(p_period_label), btrim(p_body), v_uid
  )
  RETURNING id INTO v_id;

  RETURN jsonb_build_object('ok', true, 'report_id', v_id);
END;
$$;

REVOKE ALL ON FUNCTION public.post_adoption_impact_report(UUID, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.post_adoption_impact_report(UUID, TEXT, TEXT) TO authenticated;

-- Mark campaigns funded when raised hits goal (hook used after donations)
CREATE OR REPLACE FUNCTION private.mark_campaign_funded_if_ready()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NEW.raised_amount >= NEW.goal_amount AND NEW.status = 'live' THEN
    NEW.status := 'funded';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS charity_campaigns_mark_funded ON public.charity_campaigns;
CREATE TRIGGER charity_campaigns_mark_funded
  BEFORE UPDATE OF raised_amount ON public.charity_campaigns
  FOR EACH ROW
  EXECUTE FUNCTION private.mark_campaign_funded_if_ready();

-- Allow new statuses in fee policy helper
CREATE OR REPLACE FUNCTION public.set_campaign_fee_policy(
  p_campaign_id UUID,
  p_fee_mode TEXT,
  p_fee_bps INT,
  p_sharia_board_endorsed BOOLEAN,
  p_decision_reference TEXT DEFAULT NULL,
  p_notes TEXT DEFAULT NULL,
  p_status TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_c public.charity_campaigns%ROWTYPE;
  v_mode public.fee_mode;
  v_status public.campaign_status;
  v_event_id UUID;
BEGIN
  IF v_uid IS NULL OR NOT private.is_compliance_or_admin() THEN
    RETURN jsonb_build_object('ok', false, 'error', 'FORBIDDEN');
  END IF;

  IF p_fee_mode NOT IN ('donation_addon', 'donation_deduct') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'INVALID_FEE_MODE');
  END IF;
  IF p_fee_bps IS NULL OR p_fee_bps < 0 OR p_fee_bps > 2000 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'INVALID_FEE_BPS');
  END IF;

  v_mode := p_fee_mode::public.fee_mode;

  SELECT * INTO v_c FROM public.charity_campaigns WHERE id = p_campaign_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'NOT_FOUND');
  END IF;

  IF p_status IS NOT NULL AND nullif(trim(p_status), '') IS NOT NULL THEN
    IF trim(p_status) NOT IN (
      'draft', 'pending_review', 'live', 'paused', 'completed', 'cancelled',
      'rejected', 'funded', 'disbursed', 'closed'
    ) THEN
      RETURN jsonb_build_object('ok', false, 'error', 'INVALID_STATUS');
    END IF;
    v_status := trim(p_status)::public.campaign_status;
  ELSE
    v_status := v_c.status;
  END IF;

  INSERT INTO public.sharia_fee_policy_events (
    campaign_id, actor_id,
    previous_fee_mode, fee_mode,
    previous_fee_bps, fee_bps,
    previous_endorsed, sharia_board_endorsed,
    decision_reference, notes
  ) VALUES (
    p_campaign_id, v_uid,
    v_c.fee_mode, v_mode,
    v_c.fee_bps, p_fee_bps,
    v_c.sharia_board_endorsed, p_sharia_board_endorsed,
    nullif(trim(COALESCE(p_decision_reference, '')), ''),
    nullif(trim(COALESCE(p_notes, '')), '')
  )
  RETURNING id INTO v_event_id;

  UPDATE public.charity_campaigns
  SET fee_mode = v_mode,
      fee_bps = p_fee_bps,
      sharia_board_endorsed = p_sharia_board_endorsed,
      status = v_status,
      updated_at = NOW()
  WHERE id = p_campaign_id;

  RETURN jsonb_build_object('ok', true, 'event_id', v_event_id);
END;
$$;
