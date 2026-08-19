-- Compliance officers must see IPRS lookups in the admin KYC console.
DROP POLICY IF EXISTS iprs_verifications_select_own ON public.iprs_verifications;
CREATE POLICY iprs_verifications_select_own
  ON public.iprs_verifications
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid() OR private.is_compliance_or_admin());
