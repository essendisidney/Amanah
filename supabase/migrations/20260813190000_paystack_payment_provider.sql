-- Add Paystack to payment_provider enum (wallet / sadaka / tips).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    WHERE t.typname = 'payment_provider'
      AND e.enumlabel = 'paystack'
  ) THEN
    ALTER TYPE public.payment_provider ADD VALUE 'paystack';
  END IF;
END
$$;
