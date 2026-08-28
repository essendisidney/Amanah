-- Officers can mark open penalties as paid or waived.

CREATE OR REPLACE FUNCTION public.resolve_member_penalty(
  p_penalty_id UUID,
  p_action TEXT,
  p_notes TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_p public.penalties%ROWTYPE;
  v_action TEXT := lower(trim(COALESCE(p_action, '')));
  v_notes TEXT := NULLIF(trim(COALESCE(p_notes, '')), '');
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'UNAUTHENTICATED');
  END IF;

  IF v_action NOT IN ('paid', 'waived') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'INVALID_ACTION');
  END IF;

  SELECT * INTO v_p FROM public.penalties WHERE id = p_penalty_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'NOT_FOUND');
  END IF;

  IF NOT (
    private.is_circle_officer(v_p.jamiya_id)
    OR private.is_platform_admin()
    OR EXISTS (
      SELECT 1 FROM public.members m
      WHERE m.jamiya_id = v_p.jamiya_id
        AND m.user_id = v_uid
        AND m.status = 'active'
        AND m.role::text = 'secretary'
    )
  ) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'FORBIDDEN');
  END IF;

  IF v_p.status <> 'open' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'NOT_OPEN', 'status', v_p.status);
  END IF;

  UPDATE public.penalties
  SET
    status = v_action,
    paid_at = CASE WHEN v_action = 'paid' THEN NOW() ELSE paid_at END,
    notes = CASE
      WHEN v_notes IS NULL THEN notes
      WHEN notes IS NULL OR notes = '' THEN v_notes
      ELSE notes || ' · ' || v_notes
    END,
    updated_at = NOW()
  WHERE id = v_p.id;

  INSERT INTO public.audit_logs (actor_id, action, entity_type, entity_id, jamiya_id, metadata)
  VALUES (
    v_uid,
    'update',
    'penalty',
    v_p.id,
    v_p.jamiya_id,
    jsonb_build_object(
      'resolved_as', v_action,
      'amount', v_p.amount,
      'member_id', v_p.member_id,
      'notes', v_notes
    )
  );

  RETURN jsonb_build_object(
    'ok', true,
    'id', v_p.id,
    'status', v_action,
    'amount', v_p.amount
  );
END;
$$;

REVOKE ALL ON FUNCTION public.resolve_member_penalty(UUID, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.resolve_member_penalty(UUID, TEXT, TEXT) TO authenticated;
