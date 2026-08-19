-- Invite RLS calls private.is_circle_officer; REVOKE FROM PUBLIC left only postgres.
GRANT EXECUTE ON FUNCTION private.is_circle_officer(UUID) TO authenticated;

-- Cycles are optional: savings/share groups are not merry-go-round by default.
ALTER TABLE public.jamiyas
  ALTER COLUMN cycle_count DROP NOT NULL;

ALTER TABLE public.jamiyas
  DROP CONSTRAINT IF EXISTS jamiyas_cycle_count_range;

ALTER TABLE public.jamiyas
  ADD CONSTRAINT jamiyas_cycle_count_range
  CHECK (cycle_count IS NULL OR cycle_count BETWEEN 2 AND 50);

ALTER TABLE public.jamiyas
  DROP CONSTRAINT IF EXISTS jamiyas_current_cycle_range;

ALTER TABLE public.jamiyas
  ADD CONSTRAINT jamiyas_current_cycle_range
  CHECK (
    current_cycle >= 0
    AND (cycle_count IS NULL OR current_cycle <= cycle_count)
  );

CREATE OR REPLACE FUNCTION public.activate_jamiya(p_jamiya_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_jamiya public.jamiyas%ROWTYPE;
  v_member RECORD;
  v_cycle INT;
  v_due DATE;
  v_start DATE;
  v_contrib_count INT := 0;
  v_payout_count INT := 0;
  v_skip_payouts BOOLEAN;
  v_cycles INT;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'UNAUTHENTICATED');
  END IF;

  IF NOT private.is_circle_admin(p_jamiya_id) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'FORBIDDEN');
  END IF;

  SELECT * INTO v_jamiya FROM public.jamiyas WHERE id = p_jamiya_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'NOT_FOUND');
  END IF;

  IF v_jamiya.status = 'active' THEN
    RETURN jsonb_build_object('ok', true, 'already_active', true);
  END IF;

  IF v_jamiya.member_count < 2 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'NOT_ENOUGH_MEMBERS');
  END IF;

  v_skip_payouts := coalesce(v_jamiya.challenge_kind, 'rotating') IN ('savings', 'share_dividend');
  v_cycles := coalesce(v_jamiya.cycle_count, 0);

  v_cycle := 1;
  FOR v_member IN
    SELECT * FROM public.members
    WHERE jamiya_id = p_jamiya_id AND status = 'active'
    ORDER BY payout_position NULLS LAST, created_at
  LOOP
    IF v_member.payout_position IS NULL THEN
      UPDATE public.members SET payout_position = v_cycle, updated_at = NOW()
      WHERE id = v_member.id;
    END IF;
    v_cycle := v_cycle + 1;
  END LOOP;

  v_start := COALESCE(v_jamiya.start_date, CURRENT_DATE);

  IF v_cycles >= 2 THEN
    FOR v_cycle IN 1..v_cycles LOOP
      v_due := v_start + ((v_cycle - 1) * v_jamiya.contribution_frequency_days);

      FOR v_member IN
        SELECT * FROM public.members
        WHERE jamiya_id = p_jamiya_id AND status = 'active'
      LOOP
        INSERT INTO public.contributions (
          jamiya_id, member_id, cycle_number, amount, currency, status, due_date
        )
        VALUES (
          p_jamiya_id, v_member.id, v_cycle, v_jamiya.contribution_amount,
          v_jamiya.currency, 'pending', v_due
        )
        ON CONFLICT (member_id, cycle_number) DO NOTHING;
        v_contrib_count := v_contrib_count + 1;
      END LOOP;
    END LOOP;
  END IF;

  IF NOT v_skip_payouts AND v_cycles >= 2 THEN
    FOR v_member IN
      SELECT * FROM public.members
      WHERE jamiya_id = p_jamiya_id AND status = 'active' AND payout_position IS NOT NULL
      ORDER BY payout_position
    LOOP
      IF v_member.payout_position > v_cycles THEN
        CONTINUE;
      END IF;
      v_due := v_start + ((v_member.payout_position - 1) * v_jamiya.contribution_frequency_days);
      INSERT INTO public.payouts (
        jamiya_id, member_id, cycle_number, amount, currency, status, scheduled_date
      )
      VALUES (
        p_jamiya_id,
        v_member.id,
        v_member.payout_position,
        v_jamiya.contribution_amount * v_jamiya.member_count,
        v_jamiya.currency,
        'scheduled',
        v_due
      )
      ON CONFLICT (jamiya_id, cycle_number) DO NOTHING;
      v_payout_count := v_payout_count + 1;
    END LOOP;
  END IF;

  UPDATE public.jamiyas
  SET status = 'active', current_cycle = 1, start_date = v_start, updated_at = NOW()
  WHERE id = p_jamiya_id;

  INSERT INTO public.audit_logs (actor_id, action, entity_type, entity_id, jamiya_id, metadata)
  VALUES (
    v_uid, 'update', 'jamiya', p_jamiya_id, p_jamiya_id,
    jsonb_build_object(
      'activated', true,
      'contributions', v_contrib_count,
      'payouts', v_payout_count,
      'challenge_kind', v_jamiya.challenge_kind
    )
  );

  INSERT INTO public.notifications (user_id, type, channel, title, body, data)
  SELECT
    m.user_id,
    'system',
    'in_app',
    'Circle activated',
    v_jamiya.name || ' is now active. Contributions are on the schedule.',
    jsonb_build_object('jamiya_id', p_jamiya_id, 'slug', v_jamiya.slug)
  FROM public.members m
  WHERE m.jamiya_id = p_jamiya_id AND m.status = 'active';

  RETURN jsonb_build_object(
    'ok', true,
    'contributions_created', v_contrib_count,
    'payouts_created', v_payout_count,
    'challenge_kind', v_jamiya.challenge_kind
  );
END;
$$;
