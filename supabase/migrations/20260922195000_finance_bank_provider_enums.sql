-- Add Co-op / KCB as payment_provider enum values (separate txn from usage).

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    WHERE t.typname = 'payment_provider' AND e.enumlabel = 'coop'
  ) THEN
    ALTER TYPE public.payment_provider ADD VALUE 'coop';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    WHERE t.typname = 'payment_provider' AND e.enumlabel = 'kcb'
  ) THEN
    ALTER TYPE public.payment_provider ADD VALUE 'kcb';
  END IF;
END $$;
