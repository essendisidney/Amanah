-- Fix: officers' direct edits to their circle failed with "permission denied for function
-- circle_terms". The terms-version trigger (20261008120000) ran with the caller's rights, and
-- members may not call private.circle_terms. Run it with the definer's rights, like the others.
ALTER FUNCTION private.trg_circle_terms_version() SECURITY DEFINER;
