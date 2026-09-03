-- Fix MGR grid save: membership_status uses invited (not pending).
-- Also allow active + invited + suspended members, matching books helpers.

CREATE OR REPLACE FUNCTION public.officer_save_mgr_monthly_payments(
  p_jamiya_id UUID,
  p_rows JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_jamiya public.jamiyas%ROWTYPE;
  v_row JSONB;
  v_member_id UUID;
  v_cycle INT;
  v_year INT;
  v_month INT;
  v_amount NUMERIC;
  v_due DATE;
  v_day INT;
  v_c public.contributions%ROWTYPE;
  v_prev_paid NUMERIC;
  v_delta NUMERIC;
  v_new_status public.contribution_status;
  v_updated INT := 0;
  v_max_cycle INT;
  v_m RECORD;
  v_cycle_month RECORD;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'UNAUTHENTICATED');
  END IF;

  IF p_rows IS NULL OR jsonb_typeof(p_rows) <> 'array' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'INVALID_ROWS');
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

  v_day := GREATEST(1, LEAST(28, EXTRACT(DAY FROM COALESCE(v_jamiya.start_date, CURRENT_DATE))::INT));

  FOR v_cycle_month IN
    SELECT DISTINCT
      NULLIF(trim(COALESCE(e->>'cycle_number', '')), '')::INT AS cycle_number,
      NULLIF(trim(COALESCE(e->>'year', '')), '')::INT AS year,
      NULLIF(trim(COALESCE(e->>'month', '')), '')::INT AS month
    FROM jsonb_array_elements(p_rows) e
    WHERE NULLIF(trim(COALESCE(e->>'cycle_number', '')), '')::INT BETWEEN 1 AND 50
      AND NULLIF(trim(COALESCE(e->>'year', '')), '')::INT IS NOT NULL
      AND NULLIF(trim(COALESCE(e->>'month', '')), '')::INT BETWEEN 1 AND 12
  LOOP
    v_due := make_date(
      v_cycle_month.year,
      v_cycle_month.month,
      LEAST(
        v_day,
        EXTRACT(
          DAY FROM (
            date_trunc('month', make_date(v_cycle_month.year, v_cycle_month.month, 1))
            + INTERVAL '1 month - 1 day'
          )
        )::INT
      )
    );

    FOR v_m IN
      SELECT id FROM public.members
      WHERE jamiya_id = p_jamiya_id
        AND status IN ('active', 'invited', 'suspended')
    LOOP
      INSERT INTO public.contributions (
        jamiya_id, member_id, cycle_number, amount, amount_paid, currency, status, due_date
      )
      VALUES (
        p_jamiya_id,
        v_m.id,
        v_cycle_month.cycle_number,
        v_jamiya.contribution_amount,
        0,
        v_jamiya.currency,
        'pending',
        v_due
      )
      ON CONFLICT (member_id, cycle_number) DO UPDATE
        SET due_date = EXCLUDED.due_date,
            updated_at = NOW();
    END LOOP;
  END LOOP;

  FOR v_row IN SELECT * FROM jsonb_array_elements(p_rows)
  LOOP
    BEGIN
      v_member_id := (v_row->>'member_id')::UUID;
      v_cycle := NULLIF(trim(COALESCE(v_row->>'cycle_number', '')), '')::INT;
      v_year := NULLIF(trim(COALESCE(v_row->>'year', '')), '')::INT;
      v_month := NULLIF(trim(COALESCE(v_row->>'month', '')), '')::INT;
      v_amount := NULLIF(trim(COALESCE(v_row->>'amount', '')), '')::NUMERIC;
    EXCEPTION WHEN OTHERS THEN
      CONTINUE;
    END;

    IF v_member_id IS NULL OR v_cycle IS NULL OR v_cycle < 1 OR v_amount IS NULL OR v_amount < 0 THEN
      CONTINUE;
    END IF;
    IF v_year IS NULL OR v_month IS NULL OR v_month < 1 OR v_month > 12 THEN
      CONTINUE;
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM public.members
      WHERE id = v_member_id AND jamiya_id = p_jamiya_id
        AND status IN ('active', 'invited', 'suspended')
    ) THEN
      CONTINUE;
    END IF;

    v_due := make_date(
      v_year,
      v_month,
      LEAST(
        v_day,
        EXTRACT(DAY FROM (date_trunc('month', make_date(v_year, v_month, 1)) + INTERVAL '1 month - 1 day'))::INT
      )
    );

    SELECT * INTO v_c
    FROM public.contributions
    WHERE member_id = v_member_id AND cycle_number = v_cycle
    FOR UPDATE;

    IF NOT FOUND THEN
      CONTINUE;
    END IF;

    IF v_amount > v_c.amount THEN
      v_amount := v_c.amount;
    END IF;

    v_prev_paid := coalesce(v_c.amount_paid, 0);
    IF v_amount = v_prev_paid THEN
      CONTINUE;
    END IF;

    v_delta := v_amount - v_prev_paid;

    IF v_amount <= 0 THEN
      v_new_status := 'pending';
    ELSIF v_amount >= v_c.amount THEN
      v_new_status := 'paid';
    ELSE
      v_new_status := 'partial';
    END IF;

    UPDATE public.contributions
    SET
      amount_paid = v_amount,
      status = v_new_status,
      due_date = v_due,
      paid_at = CASE
        WHEN v_new_status = 'paid' THEN COALESCE(paid_at, NOW())
        ELSE NULL
      END,
      updated_at = NOW()
    WHERE id = v_c.id;

    IF v_delta > 0 THEN
      INSERT INTO public.contribution_payments (
        contribution_id, transaction_id, amount, currency, created_by, payment_method, notes
      ) VALUES (
        v_c.id,
        NULL,
        v_delta,
        v_c.currency,
        v_uid,
        'cash',
        format('MGR grid %s-%s', v_year, lpad(v_month::text, 2, '0'))
      );
    END IF;

    v_updated := v_updated + 1;
  END LOOP;

  SELECT COALESCE(MAX(cycle_number), 0) INTO v_max_cycle
  FROM public.contributions
  WHERE jamiya_id = p_jamiya_id;

  IF v_max_cycle > 0 AND (v_jamiya.cycle_count IS NULL OR v_jamiya.cycle_count < v_max_cycle) THEN
    UPDATE public.jamiyas
    SET cycle_count = GREATEST(COALESCE(cycle_count, 0), v_max_cycle),
        updated_at = NOW()
    WHERE id = p_jamiya_id;
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'updated', v_updated,
    'max_cycle', v_max_cycle
  );
END;
$$;

REVOKE ALL ON FUNCTION public.officer_save_mgr_monthly_payments(UUID, JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.officer_save_mgr_monthly_payments(UUID, JSONB) TO authenticated;

-- Next-of-kin member lookup used the same wrong membership enum value.
CREATE OR REPLACE FUNCTION public.upsert_member_next_of_kin(
  p_jamiya_id UUID,
  p_member_id UUID,
  p_full_name TEXT,
  p_phone TEXT DEFAULT NULL,
  p_relationship TEXT DEFAULT 'other',
  p_notes TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_name TEXT := NULLIF(trim(COALESCE(p_full_name, '')), '');
  v_phone TEXT := NULLIF(trim(COALESCE(p_phone, '')), '');
  v_rel TEXT := COALESCE(NULLIF(trim(COALESCE(p_relationship, '')), ''), 'other');
  v_notes TEXT := NULLIF(trim(COALESCE(p_notes, '')), '');
  v_id UUID;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'UNAUTHENTICATED');
  END IF;

  IF NOT (
    private.is_circle_officer(p_jamiya_id)
    OR private.is_platform_admin()
    OR EXISTS (
      SELECT 1 FROM public.members m
      WHERE m.jamiya_id = p_jamiya_id
        AND m.user_id = v_uid
        AND m.status = 'active'
        AND m.role::text = 'secretary'
    )
    OR EXISTS (
      SELECT 1 FROM public.members m
      WHERE m.jamiya_id = p_jamiya_id
        AND m.id = p_member_id
        AND m.user_id = v_uid
        AND m.status = 'active'
    )
  ) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'FORBIDDEN');
  END IF;

  IF v_name IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'NAME_REQUIRED');
  END IF;

  IF v_rel NOT IN ('spouse', 'parent', 'sibling', 'child', 'guardian', 'friend', 'other') THEN
    v_rel := 'other';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.members m
    WHERE m.id = p_member_id
      AND m.jamiya_id = p_jamiya_id
      AND m.status IN ('active', 'invited', 'suspended')
  ) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'MEMBER_NOT_FOUND');
  END IF;

  INSERT INTO public.member_next_of_kin (
    jamiya_id, member_id, full_name, phone, relationship, notes, created_by, updated_at
  ) VALUES (
    p_jamiya_id, p_member_id, v_name, v_phone, v_rel, v_notes, v_uid, NOW()
  )
  ON CONFLICT (member_id) DO UPDATE
    SET full_name = EXCLUDED.full_name,
        phone = EXCLUDED.phone,
        relationship = EXCLUDED.relationship,
        notes = EXCLUDED.notes,
        updated_at = NOW()
  RETURNING id INTO v_id;

  RETURN jsonb_build_object('ok', true, 'id', v_id);
END;
$$;

REVOKE ALL ON FUNCTION public.upsert_member_next_of_kin(UUID, UUID, TEXT, TEXT, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.upsert_member_next_of_kin(UUID, UUID, TEXT, TEXT, TEXT, TEXT) TO authenticated;
