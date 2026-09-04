-- Officers assign payout slots for any member (before activation).
-- Members still claim their own slot via claim_payout_slot.

CREATE OR REPLACE FUNCTION public.officer_assign_payout_slot(
  p_jamiya_id UUID,
  p_member_id UUID,
  p_payout_position INTEGER
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_jamiya public.jamiyas%ROWTYPE;
  v_member public.members%ROWTYPE;
  v_max_slot INTEGER;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'UNAUTHENTICATED');
  END IF;

  IF NOT (
    private.is_circle_officer(p_jamiya_id)
    OR private.is_platform_admin()
  ) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'FORBIDDEN');
  END IF;

  SELECT * INTO v_jamiya FROM public.jamiyas WHERE id = p_jamiya_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'NOT_FOUND');
  END IF;

  IF v_jamiya.status = 'active' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'CIRCLE_ALREADY_ACTIVE');
  END IF;

  IF COALESCE(v_jamiya.challenge_kind, 'rotating') IN ('savings', 'share_dividend') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'NOT_ROTATING');
  END IF;

  SELECT * INTO v_member
  FROM public.members
  WHERE id = p_member_id
    AND jamiya_id = p_jamiya_id
    AND status IN ('active', 'invited', 'suspended')
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'MEMBER_NOT_FOUND');
  END IF;

  v_max_slot := GREATEST(
    COALESCE(v_jamiya.cycle_count, v_jamiya.max_members),
    v_jamiya.max_members,
    1
  );

  IF p_payout_position IS NULL OR p_payout_position < 1 OR p_payout_position > v_max_slot THEN
    RETURN jsonb_build_object('ok', false, 'error', 'INVALID_SLOT');
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.members
    WHERE jamiya_id = p_jamiya_id
      AND payout_position = p_payout_position
      AND status = 'active'
      AND id <> v_member.id
  ) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'SLOT_TAKEN');
  END IF;

  UPDATE public.members
  SET payout_position = p_payout_position, updated_at = NOW()
  WHERE id = v_member.id;

  RETURN jsonb_build_object(
    'ok', true,
    'payout_position', p_payout_position,
    'member_id', v_member.id
  );
END;
$$;

REVOKE ALL ON FUNCTION public.officer_assign_payout_slot(UUID, UUID, INTEGER) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.officer_assign_payout_slot(UUID, UUID, INTEGER) TO authenticated;
