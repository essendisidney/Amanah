-- Phone OTP createUser was failing: auth stores MSISDN without '+',
-- but profiles.phone requires E.164 (+...). Normalize in the signup trigger.

CREATE OR REPLACE FUNCTION private.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_full_name TEXT;
  v_phone TEXT;
BEGIN
  v_full_name := NULLIF(TRIM(COALESCE(NEW.raw_user_meta_data ->> 'full_name', '')), '');
  -- Prefer metadata (app sends E.164), fall back to auth.users.phone
  v_phone := NULLIF(
    TRIM(COALESCE(NEW.raw_user_meta_data ->> 'phone', NEW.phone, '')),
    ''
  );

  IF v_phone IS NOT NULL THEN
    v_phone := regexp_replace(v_phone, '\s+', '', 'g');
    IF left(v_phone, 1) <> '+' THEN
      IF v_phone ~ '^0[17][0-9]{8}$' THEN
        v_phone := '+254' || substr(v_phone, 2);
      ELSIF v_phone ~ '^[1-9][0-9]{7,14}$' THEN
        v_phone := '+' || v_phone;
      END IF;
    END IF;
    -- Final guard: drop invalid values rather than aborting signup
    IF v_phone !~ '^\+[1-9][0-9]{7,14}$' THEN
      v_phone := NULL;
    END IF;
  END IF;

  INSERT INTO public.profiles (id, email, full_name, phone, platform_role, kyc_status)
  VALUES (
    NEW.id,
    LOWER(NEW.email),
    v_full_name,
    v_phone,
    'member',
    'not_started'
  );

  UPDATE auth.users
  SET raw_app_meta_data =
    COALESCE(raw_app_meta_data, '{}'::jsonb) || jsonb_build_object('platform_role', 'member')
  WHERE id = NEW.id;

  RETURN NEW;
END;
$$;
