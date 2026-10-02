-- Rolling contribution calendar for open-ended savings / share circles.
--
-- Circles created without a fixed number of cycles got no calendar at activation, so
-- members only saw their own ad-hoc payments (all labelled "Cycle 1") and nobody could
-- set the next due date. Now:
--   * jamiyas.next_due_date holds the due date of the next round still to be created.
--   * private.roll_open_schedule() creates each round for every active member when the
--     previous due date has passed (one round ahead is always on the calendar).
--   * public.set_circle_schedule() lets officers set amount, how often and the next date.
--   * open_member_circle_payment() pays into the member's open due (or the next round)
--     instead of inserting a duplicate cycle row (which failed on the unique index).

ALTER TABLE public.jamiyas ADD COLUMN IF NOT EXISTS next_due_date DATE;

COMMENT ON COLUMN public.jamiyas.next_due_date IS
  'Open-ended savings/share circles: due date of the next contribution round to create. NULL = no rolling schedule.';

CREATE OR REPLACE FUNCTION private.is_open_ended_circle(j public.jamiyas)
RETURNS BOOLEAN
LANGUAGE sql
IMMUTABLE
SET search_path = ''
AS $$
  SELECT coalesce(j.challenge_kind, 'rotating') IN ('savings', 'share_dividend')
     AND coalesce(j.cycle_count, 0) < 2;
$$;

CREATE OR REPLACE FUNCTION private.roll_open_schedule(p_jamiya_id UUID)
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  j public.jamiyas%ROWTYPE;
  v_cycle INT;
  v_due DATE;
  v_n INT;
  v_count INT := 0;
  v_guard INT := 0;
BEGIN
  SELECT * INTO j FROM public.jamiyas WHERE id = p_jamiya_id FOR UPDATE;
  IF NOT FOUND
     OR j.status IS DISTINCT FROM 'active'
     OR NOT private.is_open_ended_circle(j)
     OR j.next_due_date IS NULL
     OR coalesce(j.contribution_frequency_days, 0) < 1
     OR coalesce(j.contribution_amount, 0) <= 0 THEN
    RETURN 0;
  END IF;

  LOOP
    v_guard := v_guard + 1;
    EXIT WHEN v_guard > 60;

    -- The round already on the calendar is still upcoming: make sure late joiners have
    -- a row for it, then stop.
    IF j.current_cycle >= 1
       AND (j.next_due_date - j.contribution_frequency_days) >= CURRENT_DATE
       AND EXISTS (
         SELECT 1 FROM public.contributions c
         WHERE c.jamiya_id = p_jamiya_id
           AND c.cycle_number = j.current_cycle
           AND c.notes IS NULL
       ) THEN
      INSERT INTO public.contributions (
        jamiya_id, member_id, cycle_number, amount, currency, status, due_date
      )
      SELECT p_jamiya_id, m.id, j.current_cycle, j.contribution_amount,
             coalesce(j.currency, 'KES'), 'pending', j.next_due_date - j.contribution_frequency_days
      FROM public.members m
      WHERE m.jamiya_id = p_jamiya_id AND m.status = 'active'
      ON CONFLICT (member_id, cycle_number) DO NOTHING;
      GET DIAGNOSTICS v_n = ROW_COUNT;
      v_count := v_count + v_n;
      EXIT;
    END IF;

    -- Next round number: after the current one if it has rows, else the current one.
    IF EXISTS (
      SELECT 1 FROM public.contributions c
      WHERE c.jamiya_id = p_jamiya_id AND c.cycle_number = greatest(j.current_cycle, 1)
    ) THEN
      v_cycle := greatest(j.current_cycle, 1) + 1;
    ELSE
      v_cycle := greatest(j.current_cycle, 1);
    END IF;
    v_due := j.next_due_date;

    INSERT INTO public.contributions (
      jamiya_id, member_id, cycle_number, amount, currency, status, due_date
    )
    SELECT p_jamiya_id, m.id, v_cycle, j.contribution_amount,
           coalesce(j.currency, 'KES'), 'pending', v_due
    FROM public.members m
    WHERE m.jamiya_id = p_jamiya_id AND m.status = 'active'
    ON CONFLICT (member_id, cycle_number) DO NOTHING;
    GET DIAGNOSTICS v_n = ROW_COUNT;
    v_count := v_count + v_n;

    j.current_cycle := v_cycle;
    j.next_due_date := v_due + j.contribution_frequency_days;
    UPDATE public.jamiyas
    SET current_cycle = j.current_cycle, next_due_date = j.next_due_date, updated_at = NOW()
    WHERE id = p_jamiya_id;

    EXIT WHEN v_due >= CURRENT_DATE;
  END LOOP;

  RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION private.roll_open_schedule(UUID) FROM PUBLIC;

-- Daily job (called from the reminders cron before reminders go out).
CREATE OR REPLACE FUNCTION public.roll_open_schedules()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  r RECORD;
  v_total INT := 0;
  v_circles INT := 0;
BEGIN
  FOR r IN
    SELECT id FROM public.jamiyas
    WHERE status = 'active' AND next_due_date IS NOT NULL
  LOOP
    v_total := v_total + private.roll_open_schedule(r.id);
    v_circles := v_circles + 1;
  END LOOP;
  RETURN jsonb_build_object('ok', true, 'circles', v_circles, 'rows_created', v_total);
END;
$$;

REVOKE ALL ON FUNCTION public.roll_open_schedules() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.roll_open_schedules() TO service_role;

-- Officers set (or turn off) the rolling calendar.
CREATE OR REPLACE FUNCTION public.set_circle_schedule(
  p_jamiya_id UUID,
  p_next_due DATE,
  p_amount NUMERIC,
  p_every_days INT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid UUID := auth.uid();
  j public.jamiyas%ROWTYPE;
  v_amount NUMERIC;
  v_moved INT := 0;
  v_created INT := 0;
  v_reschedule BOOLEAN;
  v_target INT;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'UNAUTHENTICATED');
  END IF;
  IF NOT (private.is_circle_officer(p_jamiya_id) OR private.is_circle_admin(p_jamiya_id)) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'FORBIDDEN');
  END IF;

  SELECT * INTO j FROM public.jamiyas WHERE id = p_jamiya_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'NOT_FOUND');
  END IF;
  IF j.status IS DISTINCT FROM 'active' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'CIRCLE_NOT_ACTIVE');
  END IF;
  IF NOT private.is_open_ended_circle(j) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'FIXED_SCHEDULE');
  END IF;

  -- Turn the rolling calendar off.
  IF p_next_due IS NULL THEN
    UPDATE public.jamiyas SET next_due_date = NULL, updated_at = NOW() WHERE id = p_jamiya_id;
    INSERT INTO public.audit_logs (actor_id, action, entity_type, entity_id, jamiya_id, metadata)
    VALUES (v_uid, 'update', 'jamiya', p_jamiya_id, p_jamiya_id, jsonb_build_object('schedule', 'off'));
    RETURN jsonb_build_object('ok', true, 'schedule', 'off');
  END IF;

  v_amount := round(coalesce(p_amount, j.contribution_amount), 2);
  IF v_amount IS NULL OR v_amount <= 0 OR v_amount > 500000 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'INVALID_AMOUNT');
  END IF;
  IF p_every_days IS NULL OR p_every_days < 1 OR p_every_days > 366 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'INVALID_FREQUENCY');
  END IF;
  IF p_next_due < CURRENT_DATE OR p_next_due > CURRENT_DATE + 366 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'INVALID_DATE');
  END IF;

  -- Is the round on the calendar still upcoming and still being paid? Then the new date
  -- replaces its date; otherwise the new date is for the round after it.
  v_reschedule := EXISTS (
    SELECT 1 FROM public.contributions c
    WHERE c.jamiya_id = p_jamiya_id AND c.cycle_number = j.current_cycle
      AND c.notes IS NULL AND c.due_date >= CURRENT_DATE
      AND c.status IN ('pending', 'late', 'partial')
  );
  v_target := CASE WHEN v_reschedule THEN j.current_cycle ELSE j.current_cycle + 1 END;

  -- Move rows already on the calendar for that round and later ones (paid-ahead rows keep
  -- their amount; untouched rows take the new amount).
  UPDATE public.contributions c
  SET due_date = p_next_due + (c.cycle_number - v_target) * p_every_days,
      amount = CASE WHEN c.status = 'pending' AND coalesce(c.amount_paid, 0) = 0
                    THEN v_amount ELSE c.amount END,
      updated_at = NOW()
  WHERE c.jamiya_id = p_jamiya_id
    AND c.cycle_number >= v_target
    AND c.notes IS NULL
    AND (c.cycle_number > j.current_cycle OR c.due_date >= CURRENT_DATE);
  GET DIAGNOSTICS v_moved = ROW_COUNT;

  IF v_reschedule THEN
    UPDATE public.jamiyas
    SET contribution_amount = v_amount,
        contribution_frequency_days = p_every_days,
        next_due_date = p_next_due + p_every_days,
        updated_at = NOW()
    WHERE id = p_jamiya_id;
  ELSE
    UPDATE public.jamiyas
    SET contribution_amount = v_amount,
        contribution_frequency_days = p_every_days,
        next_due_date = p_next_due,
        updated_at = NOW()
    WHERE id = p_jamiya_id;
  END IF;

  v_created := private.roll_open_schedule(p_jamiya_id);

  INSERT INTO public.audit_logs (actor_id, action, entity_type, entity_id, jamiya_id, metadata)
  VALUES (
    v_uid, 'update', 'jamiya', p_jamiya_id, p_jamiya_id,
    jsonb_build_object('schedule', 'set', 'next_due', p_next_due, 'amount', v_amount,
                       'every_days', p_every_days, 'moved', v_moved, 'created', v_created)
  );

  INSERT INTO public.notifications (user_id, type, channel, title, body, data)
  SELECT
    m.user_id,
    'system',
    'in_app',
    'Contribution dates set',
    j.name || ': next contribution ' || to_char(p_next_due, 'DD Mon YYYY') || ', '
      || coalesce(j.currency, 'KES') || ' ' || trim(to_char(v_amount, 'FM999,999,990.##'))
      || CASE WHEN p_every_days = 7 THEN ' every week.'
              WHEN p_every_days = 14 THEN ' every 2 weeks.'
              WHEN p_every_days BETWEEN 28 AND 31 THEN ' every month.'
              ELSE ' every ' || p_every_days || ' days.' END,
    jsonb_build_object('jamiya_id', p_jamiya_id, 'slug', j.slug)
  FROM public.members m
  WHERE m.jamiya_id = p_jamiya_id AND m.status = 'active';

  RETURN jsonb_build_object('ok', true, 'next_due', p_next_due, 'moved', v_moved, 'created', v_created);
END;
$$;

REVOKE ALL ON FUNCTION public.set_circle_schedule(UUID, DATE, NUMERIC, INT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_circle_schedule(UUID, DATE, NUMERIC, INT) TO authenticated;

-- Paying into a share/savings circle: use the member's open due first (raising it when
-- they pay more), else open the next round for them (pay ahead). Never insert a second
-- row for a cycle the member already has.
CREATE OR REPLACE FUNCTION public.open_member_circle_payment(
  p_jamiya_id UUID,
  p_purpose TEXT,
  p_amount NUMERIC
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_member public.members%ROWTYPE;
  v_j public.jamiyas%ROWTYPE;
  v_purpose TEXT;
  v_label TEXT;
  v_amount NUMERIC;
  v_existing public.contributions%ROWTYPE;
  v_member_max INT;
  v_cycle INT;
  v_due DATE;
  v_id UUID;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'UNAUTHENTICATED');
  END IF;
  v_purpose := lower(btrim(coalesce(p_purpose, '')));
  IF v_purpose = 'maulid' THEN
    v_label := 'Maulid';
  ELSIF v_purpose = 'contribution' THEN
    v_label := 'Contribution';
  ELSE
    RETURN jsonb_build_object('ok', false, 'error', 'UNKNOWN_PURPOSE');
  END IF;
  SELECT * INTO v_j FROM public.jamiyas WHERE id = p_jamiya_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'NOT_FOUND');
  END IF;
  IF v_j.status IS DISTINCT FROM 'active' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'CIRCLE_NOT_ACTIVE');
  END IF;
  IF v_j.challenge_kind IS DISTINCT FROM 'share_dividend' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'NOT_SHARE_DIVIDEND');
  END IF;
  SELECT * INTO v_member FROM public.members
  WHERE jamiya_id = p_jamiya_id AND user_id = v_uid AND status = 'active';
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'FORBIDDEN');
  END IF;
  IF p_amount IS NULL THEN
    v_amount := v_j.contribution_amount;
  ELSE
    v_amount := round(p_amount, 2);
  END IF;
  IF v_amount IS NULL OR v_amount <= 0 OR v_amount > 500000 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'INVALID_AMOUNT');
  END IF;

  -- 1. The member's earliest open due (scheduled or an earlier unfinished payment).
  SELECT * INTO v_existing FROM public.contributions
  WHERE jamiya_id = p_jamiya_id AND member_id = v_member.id
    AND status IN ('pending', 'late', 'partial')
  ORDER BY due_date NULLS LAST, cycle_number, created_at
  LIMIT 1
  FOR UPDATE;
  IF FOUND THEN
    IF coalesce(v_existing.amount_paid, 0) + v_amount > v_existing.amount THEN
      UPDATE public.contributions
      SET amount = coalesce(v_existing.amount_paid, 0) + v_amount, updated_at = NOW()
      WHERE id = v_existing.id;
    END IF;
    RETURN jsonb_build_object('ok', true, 'contribution_id', v_existing.id, 'reused', true);
  END IF;

  -- 2. Nothing open: open the member's next round.
  SELECT coalesce(max(cycle_number), 0) INTO v_member_max
  FROM public.contributions WHERE member_id = v_member.id;
  v_cycle := greatest(v_member_max, coalesce(v_j.current_cycle, 0)) + 1;
  IF v_member_max = 0 AND coalesce(v_j.current_cycle, 0) >= 1
     AND NOT EXISTS (SELECT 1 FROM public.contributions c
                     WHERE c.jamiya_id = p_jamiya_id AND c.cycle_number = v_j.current_cycle) THEN
    v_cycle := v_j.current_cycle;
  END IF;
  IF v_j.next_due_date IS NOT NULL AND coalesce(v_j.contribution_frequency_days, 0) >= 1
     AND v_cycle > coalesce(v_j.current_cycle, 0) THEN
    v_due := v_j.next_due_date
      + (v_cycle - coalesce(v_j.current_cycle, 0) - 1) * v_j.contribution_frequency_days;
  ELSE
    v_due := CURRENT_DATE;
  END IF;

  INSERT INTO public.contributions (
    jamiya_id, member_id, cycle_number, amount, currency, status, due_date, notes, amount_paid
  ) VALUES (
    p_jamiya_id, v_member.id, v_cycle, v_amount, coalesce(v_j.currency, 'KES'), 'pending',
    v_due, CASE WHEN v_j.next_due_date IS NULL THEN v_label ELSE NULL END, 0
  )
  RETURNING id INTO v_id;
  RETURN jsonb_build_object('ok', true, 'contribution_id', v_id, 'reused', false);
EXCEPTION
  WHEN check_violation THEN
    RETURN jsonb_build_object('ok', false, 'error', 'INVALID_AMOUNT');
END;
$$;

REVOKE ALL ON FUNCTION public.open_member_circle_payment(UUID, TEXT, NUMERIC) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.open_member_circle_payment(UUID, TEXT, NUMERIC) TO authenticated;

-- Activation: open-ended savings/share circles start their rolling calendar on the start date.
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
  SET status = 'active', current_cycle = 1, start_date = v_start,
      next_due_date = CASE WHEN v_skip_payouts AND v_cycles < 2 THEN v_start ELSE next_due_date END,
      updated_at = NOW()
  WHERE id = p_jamiya_id;

  IF v_skip_payouts AND v_cycles < 2 THEN
    v_contrib_count := v_contrib_count + private.roll_open_schedule(p_jamiya_id);
  END IF;

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

-- Existing open-ended circles: next round follows their own start date and frequency.
UPDATE public.jamiyas j
SET next_due_date = CASE
      WHEN j.start_date >= CURRENT_DATE THEN j.start_date
      ELSE j.start_date
        + (ceil((CURRENT_DATE - j.start_date)::numeric / j.contribution_frequency_days)::int
           * j.contribution_frequency_days)
    END
WHERE j.status = 'active'
  AND j.next_due_date IS NULL
  AND private.is_open_ended_circle(j)
  AND j.start_date IS NOT NULL
  AND coalesce(j.contribution_frequency_days, 0) >= 1
  AND coalesce(j.contribution_amount, 0) > 0;

SELECT public.roll_open_schedules();
