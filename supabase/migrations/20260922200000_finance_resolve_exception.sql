-- Finance ops: resolve reconcile exceptions + waive settlement.

CREATE OR REPLACE FUNCTION public.resolve_payment_intent_exception(
  p_intent_id UUID,
  p_action TEXT DEFAULT 'match',
  p_note TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_row public.payment_intents%ROWTYPE;
  v_next_reconcile TEXT;
  v_next_settle TEXT;
BEGIN
  IF coalesce(auth.role(), '') <> 'service_role'
     AND NOT private.is_platform_admin() THEN
    RETURN jsonb_build_object('ok', false, 'error', 'FORBIDDEN');
  END IF;

  IF p_action NOT IN ('match', 'manual', 'waive') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'INVALID_ACTION');
  END IF;

  SELECT * INTO v_row FROM public.payment_intents WHERE id = p_intent_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'NOT_FOUND');
  END IF;

  IF p_action = 'match' THEN
    v_next_reconcile := 'matched';
    v_next_settle := CASE
      WHEN v_row.settlement_status IN ('unsettled', 'disputed') THEN 'settled'
      ELSE v_row.settlement_status
    END;
  ELSIF p_action = 'manual' THEN
    v_next_reconcile := 'manual';
    v_next_settle := v_row.settlement_status;
  ELSE
    -- waive
    v_next_reconcile := 'manual';
    v_next_settle := 'waived';
  END IF;

  PERFORM private.assert_reconcile_status_transition(
    v_row.reconcile_status,
    v_next_reconcile
  );
  IF v_next_settle IS DISTINCT FROM v_row.settlement_status THEN
    PERFORM private.assert_settlement_status_transition(
      v_row.settlement_status,
      v_next_settle
    );
  END IF;

  UPDATE public.payment_intents
  SET
    reconcile_status = v_next_reconcile,
    settlement_status = v_next_settle,
    metadata = metadata || jsonb_build_object(
      'exception_resolved_at', NOW(),
      'exception_resolve_action', p_action,
      'exception_resolve_note', coalesce(p_note, p_action)
    ),
    updated_at = NOW()
  WHERE id = p_intent_id;

  RETURN jsonb_build_object(
    'ok', true,
    'reconcile_status', v_next_reconcile,
    'settlement_status', v_next_settle
  );
END;
$$;

REVOKE ALL ON FUNCTION public.resolve_payment_intent_exception(UUID, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.resolve_payment_intent_exception(UUID, TEXT, TEXT)
  TO authenticated, service_role;
