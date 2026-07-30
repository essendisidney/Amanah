-- Phase 12: receipts, referrals, phone sync, reminder helpers, qard cap preview

-- Public donation receipt lookup by code (guest-friendly)
CREATE OR REPLACE FUNCTION public.get_donation_receipt(p_code TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_d public.charity_donations%ROWTYPE;
  v_c public.charity_campaigns%ROWTYPE;
BEGIN
  IF p_code IS NULL OR char_length(trim(p_code)) < 4 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'INVALID');
  END IF;

  SELECT * INTO v_d
  FROM public.charity_donations
  WHERE receipt_code = upper(trim(p_code));

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'NOT_FOUND');
  END IF;

  SELECT * INTO v_c FROM public.charity_campaigns WHERE id = v_d.campaign_id;

  RETURN jsonb_build_object(
    'ok', true,
    'receipt_code', v_d.receipt_code,
    'amount', v_d.amount,
    'fee_amount', v_d.fee_amount,
    'currency', v_d.currency,
    'created_at', v_d.created_at,
    'is_anonymous', v_d.is_anonymous,
    'donor_name', CASE WHEN v_d.is_anonymous THEN NULL ELSE v_d.donor_name END,
    'campaign', jsonb_build_object(
      'title', v_c.title,
      'slug', v_c.slug,
      'fee_mode', v_c.fee_mode,
      'fee_bps', v_c.fee_bps,
      'sharia_board_endorsed', v_c.sharia_board_endorsed
    )
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_donation_receipt(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_donation_receipt(TEXT) TO anon, authenticated;

-- Qard cap preview for a circle
CREATE OR REPLACE FUNCTION public.qard_cap_for_jamiya(p_jamiya_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_paid NUMERIC := 0;
  v_cap NUMERIC;
BEGIN
  IF v_uid IS NULL OR NOT private.is_active_jamiya_member(p_jamiya_id) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'FORBIDDEN');
  END IF;

  SELECT coalesce(sum(c.amount), 0) INTO v_paid
  FROM public.contributions c
  JOIN public.members m ON m.id = c.member_id
  WHERE m.user_id = v_uid AND m.jamiya_id = p_jamiya_id AND c.status = 'paid';

  v_cap := greatest(v_paid * 0.5, 0);
  IF v_cap = 0 THEN v_cap := 5000; END IF;

  RETURN jsonb_build_object('ok', true, 'paid_total', v_paid, 'cap', v_cap, 'currency', 'KES');
END;
$$;

REVOKE ALL ON FUNCTION public.qard_cap_for_jamiya(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.qard_cap_for_jamiya(UUID) TO authenticated;

-- Sync phone from auth.users onto profile
CREATE OR REPLACE FUNCTION public.sync_phone_from_auth()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_phone TEXT;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'UNAUTHENTICATED');
  END IF;

  SELECT nullif(trim(phone), '') INTO v_phone FROM auth.users WHERE id = v_uid;
  IF v_phone IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'NO_AUTH_PHONE');
  END IF;

  IF v_phone !~ '^\+[1-9]\d{7,14}$' THEN
    -- normalize common KE local formats
    IF v_phone ~ '^0\d{9}$' THEN
      v_phone := '+254' || substr(v_phone, 2);
    ELSIF v_phone ~ '^254\d{9}$' THEN
      v_phone := '+' || v_phone;
    END IF;
  END IF;

  UPDATE public.profiles
  SET
    phone = coalesce(nullif(trim(phone), ''), v_phone),
    mpesa_phone = coalesce(nullif(trim(mpesa_phone), ''), v_phone),
    updated_at = NOW()
  WHERE id = v_uid;

  RETURN jsonb_build_object('ok', true, 'phone', v_phone);
END;
$$;

REVOKE ALL ON FUNCTION public.sync_phone_from_auth() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.sync_phone_from_auth() TO authenticated;

-- Referrals
CREATE OR REPLACE FUNCTION public.apply_referral(p_code TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_referrer UUID;
  v_id UUID;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'UNAUTHENTICATED');
  END IF;
  IF p_code IS NULL OR char_length(trim(p_code)) < 4 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'INVALID_CODE');
  END IF;

  SELECT id INTO v_referrer
  FROM public.profiles
  WHERE upper(referral_code) = upper(trim(p_code))
  LIMIT 1;

  IF v_referrer IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'CODE_NOT_FOUND');
  END IF;
  IF v_referrer = v_uid THEN
    RETURN jsonb_build_object('ok', false, 'error', 'SELF_REFERRAL');
  END IF;

  IF EXISTS (SELECT 1 FROM public.referrals WHERE referee_id = v_uid) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'ALREADY_APPLIED');
  END IF;

  INSERT INTO public.referrals (referrer_id, referee_id, reward_amount, currency, status)
  VALUES (v_referrer, v_uid, 100, 'KES', 'pending')
  RETURNING id INTO v_id;

  RETURN jsonb_build_object('ok', true, 'referral_id', v_id, 'status', 'pending');
END;
$$;

REVOKE ALL ON FUNCTION public.apply_referral(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.apply_referral(TEXT) TO authenticated;

CREATE OR REPLACE FUNCTION public.qualify_referral_for_user(p_user_id UUID)
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_count INT := 0;
BEGIN
  UPDATE public.referrals
  SET status = 'qualified'
  WHERE referee_id = p_user_id
    AND status = 'pending'
    AND EXISTS (
      SELECT 1
      FROM public.contributions c
      JOIN public.members m ON m.id = c.member_id
      WHERE m.user_id = p_user_id AND c.status = 'paid'
    );
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.qualify_referral_for_user(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.qualify_referral_for_user(UUID) TO service_role;

CREATE OR REPLACE FUNCTION public.mark_referral_rewarded(p_referral_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT private.is_compliance_or_admin() THEN
    RETURN jsonb_build_object('ok', false, 'error', 'FORBIDDEN');
  END IF;
  UPDATE public.referrals
  SET status = 'rewarded'
  WHERE id = p_referral_id AND status = 'qualified';
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'NOT_QUALIFIED');
  END IF;
  RETURN jsonb_build_object('ok', true, 'status', 'rewarded');
END;
$$;

REVOKE ALL ON FUNCTION public.mark_referral_rewarded(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.mark_referral_rewarded(UUID) TO authenticated;

-- Qualify referral when a contribution becomes paid
CREATE OR REPLACE FUNCTION private.trg_qualify_referral_on_paid()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user UUID;
BEGIN
  IF NEW.status = 'paid' AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM 'paid') THEN
    SELECT user_id INTO v_user FROM public.members WHERE id = NEW.member_id;
    IF v_user IS NOT NULL THEN
      PERFORM public.qualify_referral_for_user(v_user);
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS contributions_qualify_referral ON public.contributions;
CREATE TRIGGER contributions_qualify_referral
  AFTER INSERT OR UPDATE OF status ON public.contributions
  FOR EACH ROW
  EXECUTE FUNCTION private.trg_qualify_referral_on_paid();

-- Reminder dedupe helpers
CREATE TABLE IF NOT EXISTS public.reminder_dedupe (
  dedupe_key TEXT PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE OR REPLACE FUNCTION public.claim_reminder_dedupe(p_key TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF coalesce(auth.role(), '') <> 'service_role' THEN
    RAISE EXCEPTION 'FORBIDDEN';
  END IF;
  BEGIN
    INSERT INTO public.reminder_dedupe (dedupe_key) VALUES (p_key);
    RETURN true;
  EXCEPTION WHEN unique_violation THEN
    RETURN false;
  END;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_reminder_dedupe(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.claim_reminder_dedupe(TEXT) TO service_role;

-- Enqueue multi-channel reminder for a user (email/sms/push when contacts exist)
CREATE OR REPLACE FUNCTION public.enqueue_contribution_reminder(
  p_user_id UUID,
  p_title TEXT,
  p_body TEXT,
  p_dedupe_key TEXT,
  p_data JSONB DEFAULT '{}'::jsonb
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_profile public.profiles%ROWTYPE;
  v_claimed BOOLEAN;
  v_channels INT := 0;
BEGIN
  IF coalesce(auth.role(), '') <> 'service_role' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'FORBIDDEN');
  END IF;

  v_claimed := public.claim_reminder_dedupe(p_dedupe_key);
  IF NOT v_claimed THEN
    RETURN jsonb_build_object('ok', true, 'skipped', true);
  END IF;

  SELECT * INTO v_profile FROM public.profiles WHERE id = p_user_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'NO_PROFILE');
  END IF;

  INSERT INTO public.notifications (user_id, type, channel, title, body, data)
  VALUES (
    p_user_id, 'contribution_due', 'in_app', p_title, p_body,
    coalesce(p_data, '{}'::jsonb)
  );

  IF nullif(trim(coalesce(v_profile.email, '')), '') IS NOT NULL THEN
    PERFORM private.enqueue_delivery(
      'email'::public.notification_channel,
      v_profile.email,
      p_title,
      p_body,
      p_user_id,
      NULL,
      coalesce(p_data, '{}'::jsonb) || jsonb_build_object('dedupe_key', p_dedupe_key)
    );
    v_channels := v_channels + 1;
  END IF;

  IF nullif(trim(coalesce(v_profile.mpesa_phone, v_profile.phone, '')), '') IS NOT NULL THEN
    PERFORM private.enqueue_delivery(
      'sms'::public.notification_channel,
      coalesce(v_profile.mpesa_phone, v_profile.phone),
      p_title,
      p_body,
      p_user_id,
      NULL,
      coalesce(p_data, '{}'::jsonb) || jsonb_build_object('dedupe_key', p_dedupe_key)
    );
    v_channels := v_channels + 1;
  END IF;

  PERFORM public.queue_push_for_user(p_user_id, p_title, p_body, p_data);
  v_channels := v_channels + 1;

  RETURN jsonb_build_object('ok', true, 'channels', v_channels);
END;
$$;

REVOKE ALL ON FUNCTION public.enqueue_contribution_reminder(UUID, TEXT, TEXT, TEXT, JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.enqueue_contribution_reminder(UUID, TEXT, TEXT, TEXT, JSONB) TO service_role;

CREATE OR REPLACE FUNCTION public.enqueue_payout_reminder(
  p_user_id UUID,
  p_title TEXT,
  p_body TEXT,
  p_dedupe_key TEXT,
  p_data JSONB DEFAULT '{}'::jsonb
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  -- Reuse contribution reminder path with payout_scheduled notification type overlay
  RETURN public.enqueue_contribution_reminder(p_user_id, p_title, p_body, p_dedupe_key, p_data);
END;
$$;

REVOKE ALL ON FUNCTION public.enqueue_payout_reminder(UUID, TEXT, TEXT, TEXT, JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.enqueue_payout_reminder(UUID, TEXT, TEXT, TEXT, JSONB) TO service_role;

-- Fix notification type for payout reminders via dedicated insert helper used by edge
CREATE OR REPLACE FUNCTION public.enqueue_user_reminder(
  p_user_id UUID,
  p_type TEXT,
  p_title TEXT,
  p_body TEXT,
  p_dedupe_key TEXT,
  p_data JSONB DEFAULT '{}'::jsonb
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_profile public.profiles%ROWTYPE;
  v_claimed BOOLEAN;
  v_channels INT := 0;
  v_type public.notification_type;
BEGIN
  IF coalesce(auth.role(), '') <> 'service_role' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'FORBIDDEN');
  END IF;

  BEGIN
    v_type := p_type::public.notification_type;
  EXCEPTION WHEN OTHERS THEN
    v_type := 'system'::public.notification_type;
  END;

  v_claimed := public.claim_reminder_dedupe(p_dedupe_key);
  IF NOT v_claimed THEN
    RETURN jsonb_build_object('ok', true, 'skipped', true);
  END IF;

  SELECT * INTO v_profile FROM public.profiles WHERE id = p_user_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'NO_PROFILE');
  END IF;

  INSERT INTO public.notifications (user_id, type, channel, title, body, data)
  VALUES (p_user_id, v_type, 'in_app', p_title, p_body, coalesce(p_data, '{}'::jsonb));

  IF nullif(trim(coalesce(v_profile.email, '')), '') IS NOT NULL THEN
    PERFORM private.enqueue_delivery(
      'email'::public.notification_channel, v_profile.email, p_title, p_body, p_user_id, NULL,
      coalesce(p_data, '{}'::jsonb) || jsonb_build_object('dedupe_key', p_dedupe_key)
    );
    v_channels := v_channels + 1;
  END IF;

  IF nullif(trim(coalesce(v_profile.mpesa_phone, v_profile.phone, '')), '') IS NOT NULL THEN
    PERFORM private.enqueue_delivery(
      'sms'::public.notification_channel,
      coalesce(v_profile.mpesa_phone, v_profile.phone),
      p_title, p_body, p_user_id, NULL,
      coalesce(p_data, '{}'::jsonb) || jsonb_build_object('dedupe_key', p_dedupe_key)
    );
    v_channels := v_channels + 1;
  END IF;

  PERFORM public.queue_push_for_user(p_user_id, p_title, p_body, p_data);
  v_channels := v_channels + 1;

  RETURN jsonb_build_object('ok', true, 'channels', v_channels);
END;
$$;

REVOKE ALL ON FUNCTION public.enqueue_user_reminder(UUID, TEXT, TEXT, TEXT, TEXT, JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.enqueue_user_reminder(UUID, TEXT, TEXT, TEXT, TEXT, JSONB) TO service_role;
