-- Kenya IPRS / NPDM identity lookup (eKYC)

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS national_id TEXT,
  ADD COLUMN IF NOT EXISTS date_of_birth DATE,
  ADD COLUMN IF NOT EXISTS iprs_status TEXT NOT NULL DEFAULT 'not_checked',
  ADD COLUMN IF NOT EXISTS iprs_verified_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS iprs_full_name TEXT;

ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_iprs_status_check;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_iprs_status_check
  CHECK (iprs_status IN ('not_checked', 'matched', 'mismatch', 'not_found', 'error'));

ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_national_id_format;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_national_id_format
  CHECK (national_id IS NULL OR national_id ~ '^[0-9]{8,9}$');

CREATE UNIQUE INDEX IF NOT EXISTS profiles_national_id_unique_idx
  ON public.profiles (national_id)
  WHERE national_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.iprs_verifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  national_id TEXT NOT NULL,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  date_of_birth DATE,
  provider TEXT NOT NULL,
  outcome TEXT NOT NULL,
  matched BOOLEAN NOT NULL DEFAULT false,
  response JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT iprs_verifications_national_id_format CHECK (national_id ~ '^[0-9]{8,9}$'),
  CONSTRAINT iprs_verifications_outcome_check CHECK (
    outcome IN ('matched', 'mismatch', 'not_found', 'error')
  )
);

CREATE INDEX IF NOT EXISTS iprs_verifications_user_idx
  ON public.iprs_verifications (user_id, created_at DESC);

ALTER TABLE public.iprs_verifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS iprs_verifications_select_own ON public.iprs_verifications;
CREATE POLICY iprs_verifications_select_own
  ON public.iprs_verifications
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid() OR private.is_platform_admin());

REVOKE INSERT, UPDATE, DELETE ON public.iprs_verifications FROM authenticated, anon;
GRANT SELECT ON public.iprs_verifications TO authenticated;

COMMENT ON TABLE public.iprs_verifications IS
  'Kenya National ID lookups against IPRS/NPDM (or a licensed gateway). Writes are server-only.';
