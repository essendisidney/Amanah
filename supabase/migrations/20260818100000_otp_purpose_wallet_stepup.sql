-- Tag OTP codes by purpose so login codes cannot unlock wallet money movement.

ALTER TABLE public.otp_codes
  ADD COLUMN IF NOT EXISTS purpose TEXT NOT NULL DEFAULT 'auth';

ALTER TABLE public.otp_codes
  DROP CONSTRAINT IF EXISTS otp_codes_purpose_check;

ALTER TABLE public.otp_codes
  ADD CONSTRAINT otp_codes_purpose_check
  CHECK (purpose IN ('auth', 'wallet_top_up', 'wallet_withdraw'));

CREATE INDEX IF NOT EXISTS otp_codes_purpose_lookup_idx
  ON public.otp_codes (phone, purpose, used, expires_at);
