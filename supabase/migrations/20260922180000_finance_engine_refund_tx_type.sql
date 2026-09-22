-- Add refund transaction type (must commit before use in later migration).

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    WHERE t.typname = 'transaction_type' AND e.enumlabel = 'refund'
  ) THEN
    ALTER TYPE public.transaction_type ADD VALUE 'refund';
  END IF;
END $$;
