-- Allow demo IPRS outcome without treating it as live KYC.
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_iprs_status_check;
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_iprs_status_check
  CHECK (iprs_status IN (
    'not_checked',
    'matched',
    'matched_demo',
    'mismatch',
    'not_found',
    'error'
  ));

-- Soft-demote KYC approved only via simulated IPRS (no live docs approval).
UPDATE public.profiles p
SET
  kyc_status = 'under_review',
  updated_at = NOW()
WHERE p.kyc_status = 'approved'
  AND EXISTS (
    SELECT 1
    FROM public.iprs_verifications v
    WHERE v.user_id = p.id
      AND v.provider = 'simulated'
      AND v.matched IS TRUE
  )
  AND NOT EXISTS (
    SELECT 1
    FROM public.kyc_documents d
    WHERE d.user_id = p.id
      AND d.status = 'approved'
  );

-- Align stored IPRS status with simulated provider outcome.
UPDATE public.profiles p
SET
  iprs_status = 'matched_demo',
  updated_at = NOW()
WHERE EXISTS (
  SELECT 1
  FROM public.iprs_verifications v
  WHERE v.user_id = p.id
    AND v.provider = 'simulated'
    AND v.matched IS TRUE
)
AND coalesce(p.iprs_status, 'not_checked') IN ('matched', 'not_checked');
