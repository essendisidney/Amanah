-- Simulated payments are off unless explicitly switched on.
-- Without Daraja secrets, payments-mpesa used to complete STK pushes and B2C payouts as
-- "simulated" unless REQUIRE_REAL_PROVIDERS=true, so a failed IntaSend collection that
-- failed over to M-Pesa credited real wallets with money that never arrived. Circle
-- payout cash-outs could likewise debit a wallet and mark the withdrawal paid with no
-- B2C sent.
--
-- One switch now governs every path: platform_settings 'simulated_payments'
-- ({"enabled": false} by default; local seed turns it on). The Edge Function reads it,
-- and the database refuses simulated money while it is off, whatever the caller:
--   * payment_intents: no simulated-provider intents, and none completed with a
--     simulated reference or source;
--   * transactions: no wallet credit or debit marked as simulated;
--   * withdrawal_requests: none completed with a simulated B2C reference.
-- Only the service role (or postgres) can change the setting; RLS lets admins read it.

INSERT INTO public.platform_settings (key, value)
VALUES ('simulated_payments', '{"enabled": false}'::jsonb)
ON CONFLICT (key) DO NOTHING;

CREATE OR REPLACE FUNCTION private.simulated_payments_allowed()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO ''
AS $$
  SELECT coalesce((
    SELECT (value->>'enabled')::boolean
    FROM public.platform_settings
    WHERE key = 'simulated_payments'
  ), false);
$$;

-- Is this money simulated? Matches every marker the simulated paths write.
CREATE OR REPLACE FUNCTION private.is_simulated_money(
  p_provider TEXT,
  p_reference TEXT,
  p_metadata JSONB
)
RETURNS BOOLEAN
LANGUAGE sql
IMMUTABLE
SET search_path TO ''
AS $$
  SELECT coalesce(p_provider, '') = 'simulated'
      OR coalesce(p_metadata->>'provider', '') = 'simulated'
      OR coalesce(p_metadata->>'source', '') ILIKE '%simulated%'
      OR coalesce(p_metadata->>'simulated', '') = 'true'
      OR coalesce(p_reference, '') LIKE 'mpesa-sim:%'
      OR coalesce(p_reference, '') LIKE 'sim-b2c:%';
$$;

CREATE OR REPLACE FUNCTION private.trg_block_simulated_intent()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
BEGIN
  IF private.simulated_payments_allowed() THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' AND NEW.provider::text = 'simulated' THEN
    RAISE EXCEPTION 'SIMULATED_PAYMENTS_DISABLED'
      USING HINT = 'Simulated payments are switched off (platform_settings.simulated_payments).';
  END IF;

  IF NEW.status = 'completed' AND OLD.status IS DISTINCT FROM 'completed'
     AND private.is_simulated_money(NEW.provider::text, NEW.provider_reference, NEW.metadata) THEN
    RAISE EXCEPTION 'SIMULATED_PAYMENTS_DISABLED'
      USING HINT = 'Simulated payments are switched off (platform_settings.simulated_payments).';
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE TRIGGER block_simulated_intent
BEFORE INSERT OR UPDATE ON public.payment_intents
FOR EACH ROW
EXECUTE FUNCTION private.trg_block_simulated_intent();

CREATE OR REPLACE FUNCTION private.trg_block_simulated_transaction()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
BEGIN
  IF NEW.status = 'completed'
     AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM 'completed')
     AND private.is_simulated_money(NULL, NEW.reference, NEW.metadata)
     AND NOT private.simulated_payments_allowed() THEN
    RAISE EXCEPTION 'SIMULATED_PAYMENTS_DISABLED'
      USING HINT = 'Simulated payments are switched off (platform_settings.simulated_payments).';
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE TRIGGER block_simulated_transaction
BEFORE INSERT OR UPDATE ON public.transactions
FOR EACH ROW
EXECUTE FUNCTION private.trg_block_simulated_transaction();

CREATE OR REPLACE FUNCTION private.trg_block_simulated_withdrawal()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
BEGIN
  IF NEW.status = 'completed'
     AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM 'completed')
     AND private.is_simulated_money(NULL, NEW.provider_reference, NEW.metadata)
     AND NOT private.simulated_payments_allowed() THEN
    RAISE EXCEPTION 'SIMULATED_PAYMENTS_DISABLED'
      USING HINT = 'Simulated payments are switched off (platform_settings.simulated_payments).';
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE TRIGGER block_simulated_withdrawal
BEFORE INSERT OR UPDATE ON public.withdrawal_requests
FOR EACH ROW
EXECUTE FUNCTION private.trg_block_simulated_withdrawal();

REVOKE ALL ON FUNCTION private.simulated_payments_allowed() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION private.is_simulated_money(TEXT, TEXT, JSONB) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION private.trg_block_simulated_intent() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION private.trg_block_simulated_transaction() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION private.trg_block_simulated_withdrawal() FROM PUBLIC, anon, authenticated;
