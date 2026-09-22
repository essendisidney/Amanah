-- Finance engine: request_refund RPC + member-readable own journal rows.

CREATE OR REPLACE FUNCTION public.request_refund(
  p_payment_intent_id UUID,
  p_amount NUMERIC,
  p_reason TEXT DEFAULT NULL,
  p_metadata JSONB DEFAULT '{}'::jsonb
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_intent public.payment_intents%ROWTYPE;
  v_refund_id UUID;
  v_minor BIGINT;
BEGIN
  IF auth.uid() IS NULL AND coalesce(auth.role(), '') <> 'service_role' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'UNAUTHENTICATED');
  END IF;

  IF coalesce(auth.role(), '') <> 'service_role'
     AND NOT private.is_platform_admin() THEN
    RETURN jsonb_build_object('ok', false, 'error', 'FORBIDDEN');
  END IF;

  IF p_amount IS NULL OR p_amount <= 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'INVALID_AMOUNT');
  END IF;

  SELECT * INTO v_intent
  FROM public.payment_intents
  WHERE id = p_payment_intent_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'NOT_FOUND');
  END IF;

  IF v_intent.status <> 'completed' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'INTENT_NOT_COMPLETED');
  END IF;

  IF p_amount > v_intent.amount THEN
    RETURN jsonb_build_object('ok', false, 'error', 'AMOUNT_EXCEEDS_INTENT');
  END IF;

  v_minor := round(p_amount * 100)::bigint;

  INSERT INTO public.refunds (
    payment_intent_id,
    amount,
    amount_minor,
    currency,
    reason,
    status,
    created_by,
    metadata
  ) VALUES (
    p_payment_intent_id,
    p_amount,
    v_minor,
    v_intent.currency,
    p_reason,
    'pending',
    CASE WHEN auth.uid() IS NOT NULL THEN auth.uid() ELSE NULL END,
    coalesce(p_metadata, '{}'::jsonb) || jsonb_build_object('requested_at', NOW())
  )
  RETURNING id INTO v_refund_id;

  UPDATE public.payment_intents
  SET
    settlement_status = CASE
      WHEN settlement_status = 'settled' THEN 'disputed'
      ELSE settlement_status
    END,
    reconcile_status = CASE
      WHEN reconcile_status = 'matched' THEN 'exception'
      ELSE reconcile_status
    END,
    metadata = metadata || jsonb_build_object(
      'refund_requested_id', v_refund_id,
      'refund_requested_at', NOW()
    ),
    updated_at = NOW()
  WHERE id = p_payment_intent_id;

  RETURN jsonb_build_object('ok', true, 'refund_id', v_refund_id);
END;
$$;

REVOKE ALL ON FUNCTION public.request_refund(UUID, NUMERIC, TEXT, JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.request_refund(UUID, NUMERIC, TEXT, JSONB)
  TO authenticated, service_role;

-- Members can read their own journal projection (statement path).
DROP POLICY IF EXISTS journal_entries_own_read ON public.journal_entries;
CREATE POLICY journal_entries_own_read ON public.journal_entries
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR private.is_platform_admin());

DROP POLICY IF EXISTS journal_lines_own_read ON public.journal_lines;
CREATE POLICY journal_lines_own_read ON public.journal_lines
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.journal_entries e
      WHERE e.id = journal_entry_id
        AND (e.user_id = auth.uid() OR private.is_platform_admin())
    )
  );
