-- Phone OTP codes for Taifa Mobile SMS auth (Creda / Savr pattern)

CREATE TABLE IF NOT EXISTS public.otp_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone TEXT NOT NULL,
  code TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  used BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS otp_codes_phone_created_idx
  ON public.otp_codes (phone, created_at DESC);

CREATE INDEX IF NOT EXISTS otp_codes_lookup_idx
  ON public.otp_codes (phone, code, used, expires_at);

ALTER TABLE public.otp_codes ENABLE ROW LEVEL SECURITY;

-- No public policies: only service role (API routes) touches this table.
