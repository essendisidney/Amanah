-- profiles_update_own WITH CHECK calls private.current_kyc_status().
-- The function was created with REVOKE ALL FROM PUBLIC and never granted
-- EXECUTE to authenticated, so profile saves failed with:
-- "permission denied for function current_kyc_status".

GRANT EXECUTE ON FUNCTION private.current_kyc_status() TO authenticated;
GRANT EXECUTE ON FUNCTION private.current_kyc_status() TO service_role;
