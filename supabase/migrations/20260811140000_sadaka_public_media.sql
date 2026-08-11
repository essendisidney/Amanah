-- Public campaign photos (separate from private KYC docs)

ALTER TABLE public.charity_campaigns
  ADD COLUMN IF NOT EXISTS public_media_urls TEXT[] NOT NULL DEFAULT '{}'::text[];

-- Public bucket for Sadaka cover / story photos
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'sadaka-media',
  'sadaka-media',
  TRUE,
  10485760,
  ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO UPDATE
SET
  public = TRUE,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS sadaka_media_public_read ON storage.objects;
CREATE POLICY sadaka_media_public_read
  ON storage.objects FOR SELECT TO anon, authenticated
  USING (bucket_id = 'sadaka-media');

DROP POLICY IF EXISTS sadaka_media_auth_insert ON storage.objects;
CREATE POLICY sadaka_media_auth_insert
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'sadaka-media'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS sadaka_media_auth_delete ON storage.objects;
CREATE POLICY sadaka_media_auth_delete
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'sadaka-media'
    AND (
      (storage.foldername(name))[1] = auth.uid()::text
      OR private.is_compliance_or_admin()
    )
  );

DROP FUNCTION IF EXISTS public.submit_sadaka_campaign(TEXT, TEXT, TEXT, NUMERIC, TEXT, TEXT, TEXT, TEXT);

CREATE OR REPLACE FUNCTION public.submit_sadaka_campaign(
  p_title TEXT,
  p_story TEXT,
  p_category TEXT,
  p_target_amount NUMERIC,
  p_beneficiary_name TEXT,
  p_beneficiary_phone TEXT,
  p_beneficiary_kyc_doc_url TEXT,
  p_slug TEXT DEFAULT NULL,
  p_cover_image_url TEXT DEFAULT NULL,
  p_public_media_urls TEXT[] DEFAULT NULL
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
  v_media TEXT[] := COALESCE(p_public_media_urls, '{}'::text[]);
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
    category, beneficiary_name, beneficiary_phone, beneficiary_kyc_doc_url,
    cover_image_url, public_media_urls
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
    btrim(p_beneficiary_kyc_doc_url),
    nullif(btrim(COALESCE(p_cover_image_url, '')), ''),
    v_media
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

REVOKE ALL ON FUNCTION public.submit_sadaka_campaign(TEXT, TEXT, TEXT, NUMERIC, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.submit_sadaka_campaign(TEXT, TEXT, TEXT, NUMERIC, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT[]) TO authenticated;
