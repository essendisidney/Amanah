-- Wave 7: officer can reassign slots after activate (unpaid cycles only),
-- and mark merry-go-round pot paid as cash (no wallet credit).

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
  v_old_pos INTEGER;
  v_start DATE;
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

  IF v_jamiya.status IN ('completed', 'cancelled') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'CIRCLE_CLOSED');
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

  IF EXISTS (
    SELECT 1 FROM public.payouts
    WHERE jamiya_id = p_jamiya_id
      AND cycle_number = p_payout_position
      AND status IN ('paid', 'processing')
  ) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'PAYOUT_ALREADY_PAID');
  END IF;

  v_old_pos := v_member.payout_position;

  UPDATE public.members
  SET payout_position = p_payout_position, updated_at = NOW()
  WHERE id = v_member.id;

  -- Keep scheduled payouts aligned when the circle is already live.
  IF v_jamiya.status = 'active' THEN
    v_start := COALESCE(v_jamiya.start_date, CURRENT_DATE);

    IF v_old_pos IS NOT NULL AND v_old_pos <> p_payout_position THEN
      DELETE FROM public.payouts
      WHERE jamiya_id = p_jamiya_id
        AND cycle_number = v_old_pos
        AND member_id = v_member.id
        AND status = 'scheduled';
    END IF;

    INSERT INTO public.payouts (
      jamiya_id, member_id, cycle_number, amount, currency, status, scheduled_date
    )
    VALUES (
      p_jamiya_id,
      v_member.id,
      p_payout_position,
      v_jamiya.contribution_amount * GREATEST(v_jamiya.member_count, 1),
      v_jamiya.currency,
      'scheduled',
      v_start + ((p_payout_position - 1) * v_jamiya.contribution_frequency_days)
    )
    ON CONFLICT (jamiya_id, cycle_number) DO UPDATE
      SET member_id = EXCLUDED.member_id,
          amount = EXCLUDED.amount,
          scheduled_date = EXCLUDED.scheduled_date,
          updated_at = NOW()
      WHERE public.payouts.status = 'scheduled';
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'payout_position', p_payout_position,
    'member_id', v_member.id,
    'rebuilt_schedule', v_jamiya.status = 'active'
  );
END;
$$;

REVOKE ALL ON FUNCTION public.officer_assign_payout_slot(UUID, UUID, INTEGER) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.officer_assign_payout_slot(UUID, UUID, INTEGER) TO authenticated;

-- Cash pot handed over — no wallet credit (typical merry-go-round).
CREATE OR REPLACE FUNCTION public.officer_mark_mgr_pot_paid(p_payout_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_p public.payouts%ROWTYPE;
  v_kind TEXT;
  v_unpaid INT;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'UNAUTHENTICATED');
  END IF;

  SELECT * INTO v_p FROM public.payouts WHERE id = p_payout_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'NOT_FOUND');
  END IF;

  IF NOT (private.is_circle_officer(v_p.jamiya_id) OR private.is_platform_admin()) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'FORBIDDEN');
  END IF;

  SELECT COALESCE(challenge_kind, 'rotating') INTO v_kind
  FROM public.jamiyas WHERE id = v_p.jamiya_id;

  IF v_kind IN ('savings', 'share_dividend') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'NOT_ROTATING');
  END IF;

  IF v_p.status NOT IN ('scheduled', 'processing') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'NOT_SETTLEABLE');
  END IF;

  SELECT COUNT(*)::INT INTO v_unpaid
  FROM public.contributions
  WHERE jamiya_id = v_p.jamiya_id
    AND cycle_number = v_p.cycle_number
    AND status NOT IN ('paid', 'waived');

  IF v_unpaid > 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'CYCLE_INCOMPLETE', 'unpaid', v_unpaid);
  END IF;

  UPDATE public.payouts
  SET status = 'paid',
      paid_at = NOW(),
      receipt_confirmed_at = COALESCE(receipt_confirmed_at, NOW()),
      receipt_confirmed_by = COALESCE(receipt_confirmed_by, v_uid),
      updated_at = NOW()
  WHERE id = v_p.id;

  INSERT INTO public.audit_logs (actor_id, action, entity_type, entity_id, jamiya_id, metadata)
  VALUES (
    v_uid,
    'update',
    'payout',
    v_p.id,
    v_p.jamiya_id,
    jsonb_build_object('method', 'cash_mgr', 'cycle', v_p.cycle_number, 'amount', v_p.amount, 'event', 'mgr_pot_paid')
  );

  RETURN jsonb_build_object('ok', true, 'payout_id', v_p.id, 'method', 'cash');
END;
$$;

REVOKE ALL ON FUNCTION public.officer_mark_mgr_pot_paid(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.officer_mark_mgr_pot_paid(UUID) TO authenticated;
