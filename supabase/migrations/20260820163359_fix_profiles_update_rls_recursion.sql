-- Fix: profiles_update_own WITH CHECK subqueried public.profiles under RLS,
-- which re-entered SELECT policies and caused "infinite recursion detected in
-- policy for relation profiles" when members saved personal details.

CREATE OR REPLACE FUNCTION private.current_kyc_status()
RETURNS public.kyc_status
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT kyc_status
  FROM public.profiles
  WHERE id = auth.uid();
$$;

REVOKE ALL ON FUNCTION private.current_kyc_status() FROM PUBLIC;

DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;
CREATE POLICY "profiles_update_own"
  ON public.profiles
  FOR UPDATE
  TO authenticated
  USING (id = auth.uid())
  WITH CHECK (
    id = auth.uid()
    AND platform_role = private.current_platform_role()
    AND kyc_status = private.current_kyc_status()
  );
