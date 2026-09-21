-- Add IntaSend to payment_provider enum (collections + disbursements via orchestrator).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_enum e ON t.oid = e.enumtypid
    WHERE t.typname = 'payment_provider'
      AND e.enumlabel = 'intasend'
  ) THEN
    ALTER TYPE public.payment_provider ADD VALUE 'intasend';
  END IF;
END $$;
