-- Add TendePay to payment_provider enum (bake-off vs IntaSend / Daraja).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_enum e ON t.oid = e.enumtypid
    WHERE t.typname = 'payment_provider'
      AND e.enumlabel = 'tendepay'
  ) THEN
    ALTER TYPE public.payment_provider ADD VALUE 'tendepay';
  END IF;
END $$;

-- Phone required for TendePay STK (same as M-Pesa / IntaSend).
-- Full create_payment_intent body is maintained in prior migrations;
-- this only documents the live requirement applied with the bake-off.
