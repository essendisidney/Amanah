-- Phase 1.2: Auth bootstrap — profiles + auto-provisioning trigger
-- Full domain schema (jamiyas, contributions, etc.) lands in Phase 1.3.

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ---------------------------------------------------------------------------
-- Private schema for security-definer helpers (not exposed via Data API)
-- ---------------------------------------------------------------------------
CREATE SCHEMA IF NOT EXISTS private;

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------
CREATE TYPE public.platform_role AS ENUM (
  'member',
  'compliance_officer',
  'platform_admin',
  'super_admin'
);

CREATE TYPE public.kyc_status AS ENUM (
  'not_started',
  'pending',
  'under_review',
  'approved',
  'rejected'
);

-- ---------------------------------------------------------------------------
-- profiles
-- ---------------------------------------------------------------------------
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  email TEXT,
  full_name TEXT,
  phone TEXT,
  avatar_url TEXT,
  bio TEXT,
  country_code CHAR(2),
  platform_role public.platform_role NOT NULL DEFAULT 'member',
  kyc_status public.kyc_status NOT NULL DEFAULT 'not_started',
  profile_completed BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT profiles_email_format CHECK (
    email IS NULL OR email ~* '^[^@]+@[^@]+\.[^@]+$'
  ),
  CONSTRAINT profiles_phone_e164 CHECK (
    phone IS NULL OR phone ~ '^\+[1-9][0-9]{7,14}$'
  )
);

CREATE UNIQUE INDEX profiles_email_unique_idx
  ON public.profiles (lower(email))
  WHERE email IS NOT NULL;

CREATE UNIQUE INDEX profiles_phone_unique_idx
  ON public.profiles (phone)
  WHERE phone IS NOT NULL;

CREATE INDEX profiles_platform_role_idx ON public.profiles (platform_role);
CREATE INDEX profiles_kyc_status_idx ON public.profiles (kyc_status);

COMMENT ON TABLE public.profiles IS
  'Application profile for each auth.users row. platform_role is authoritative in DB; mirror to app_metadata for JWT claims via admin tooling only.';

-- ---------------------------------------------------------------------------
-- updated_at trigger
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION private.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE TRIGGER profiles_set_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION private.set_updated_at();

-- ---------------------------------------------------------------------------
-- Auto-create profile on signup
-- ---------------------------------------------------------------------------
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
  v_phone := NULLIF(TRIM(COALESCE(NEW.phone, NEW.raw_user_meta_data ->> 'phone', '')), '');

  INSERT INTO public.profiles (id, email, full_name, phone, platform_role, kyc_status)
  VALUES (
    NEW.id,
    LOWER(NEW.email),
    v_full_name,
    v_phone,
    'member',
    'not_started'
  );

  -- Authoritative role claim for JWT (never store roles in user_metadata)
  UPDATE auth.users
  SET raw_app_meta_data =
    COALESCE(raw_app_meta_data, '{}'::jsonb) || jsonb_build_object('platform_role', 'member')
  WHERE id = NEW.id;

  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION private.handle_new_user();

-- ---------------------------------------------------------------------------
-- Helpers for RLS (SECURITY DEFINER, private schema)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION private.current_platform_role()
RETURNS public.platform_role
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT platform_role
  FROM public.profiles
  WHERE id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION private.is_platform_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT COALESCE(
    (SELECT platform_role IN ('platform_admin', 'super_admin')
     FROM public.profiles
     WHERE id = auth.uid()),
    FALSE
  );
$$;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "profiles_select_own"
  ON public.profiles
  FOR SELECT
  TO authenticated
  USING (id = auth.uid() OR private.is_platform_admin());

CREATE POLICY "profiles_update_own"
  ON public.profiles
  FOR UPDATE
  TO authenticated
  USING (id = auth.uid())
  WITH CHECK (
    id = auth.uid()
    AND platform_role = (SELECT p.platform_role FROM public.profiles p WHERE p.id = auth.uid())
    AND kyc_status = (SELECT p.kyc_status FROM public.profiles p WHERE p.id = auth.uid())
  );

-- Admins can update any profile (role / KYC changes)
CREATE POLICY "profiles_admin_update"
  ON public.profiles
  FOR UPDATE
  TO authenticated
  USING (private.is_platform_admin())
  WITH CHECK (private.is_platform_admin());

-- No direct INSERT/DELETE for authenticated clients — trigger owns inserts;
-- deletes cascade from auth.users.
REVOKE INSERT, DELETE ON public.profiles FROM authenticated, anon;
GRANT SELECT, UPDATE ON public.profiles TO authenticated;
