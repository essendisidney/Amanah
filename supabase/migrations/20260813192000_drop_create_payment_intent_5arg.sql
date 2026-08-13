-- PostgREST cannot pick between the 5-arg and 6-arg create_payment_intent
-- overloads when p_metadata is omitted (Paystack wallet top-up failure).
-- Keep only the metadata-capable signature.

DROP FUNCTION IF EXISTS public.create_payment_intent(
  NUMERIC, CHAR, TEXT, public.payment_provider, TEXT
);

-- Ensure grants remain on the 6-arg form
REVOKE ALL ON FUNCTION public.create_payment_intent(
  NUMERIC, CHAR, TEXT, public.payment_provider, TEXT, JSONB
) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_payment_intent(
  NUMERIC, CHAR, TEXT, public.payment_provider, TEXT, JSONB
) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_payment_intent(
  NUMERIC, CHAR, TEXT, public.payment_provider, TEXT, JSONB
) TO service_role;
