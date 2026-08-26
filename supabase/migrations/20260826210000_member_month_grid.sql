-- Member books grid: upsert monthly savings + replace-safe share capital.

CREATE OR REPLACE FUNCTION public.upsert_member_month_savings(
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
  v_row JSONB;
  v_member UUID;
  v_year INT;
  v_month INT;
  v_amount NUMERIC;
  v_currency CHAR(3);
  v_month_start DATE;
  v_updated INT := 0;
  v_cleared INT := 0;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'UNAUTHENTICATED');
  END IF;
  IF NOT (private.is_circle_officer(p_jamiya_id) OR private.is_platform_admin()) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'FORBIDDEN');
  END IF;
  IF p_rows IS NULL OR jsonb_typeof(p_rows) <> 'array' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'INVALID_ROWS');
  END IF;

  SELECT currency INTO v_currency FROM public.jamiyas WHERE id = p_jamiya_id;
  IF v_currency IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'NOT_FOUND');
  END IF;

  FOR v_row IN SELECT * FROM jsonb_array_elements(p_rows)
  LOOP
    v_member := NULLIF(v_row->>'member_id', '')::UUID;
    v_year := NULLIF(v_row->>'year', '')::INT;
    v_month := NULLIF(v_row->>'month', '')::INT;
    v_amount := COALESCE(NULLIF(v_row->>'amount', '')::NUMERIC, 0);

    IF v_member IS NULL OR v_year IS NULL OR v_month IS NULL THEN
      CONTINUE;
    END IF;
    IF v_month < 1 OR v_month > 12 OR v_year < 2000 OR v_year > 2100 THEN
      CONTINUE;
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM public.members m
      WHERE m.id = v_member
        AND m.jamiya_id = p_jamiya_id
        AND m.status IN ('active', 'pending', 'suspended')
    ) THEN
      CONTINUE;
    END IF;

    v_month_start := make_date(v_year, v_month, 1);

    DELETE FROM public.book_entries
    WHERE jamiya_id = p_jamiya_id
      AND member_id = v_member
      AND entry_type = 'contribution'
      AND date_trunc('month', effective_date::timestamptz) = date_trunc('month', v_month_start::timestamptz);

    IF v_amount > 0 THEN
      INSERT INTO public.book_entries (
        jamiya_id, member_id, entry_type, amount, currency, effective_date, entered_by, notes, metadata
      ) VALUES (
        p_jamiya_id,
        v_member,
        'contribution',
        round(v_amount, 2),
        v_currency,
        v_month_start,
        v_uid,
        'Monthly savings · ' || to_char(v_month_start, 'Mon YYYY'),
        jsonb_build_object('source', 'month_grid', 'year', v_year, 'month', v_month)
      );
      v_updated := v_updated + 1;
    ELSE
      v_cleared := v_cleared + 1;
    END IF;
  END LOOP;

  RETURN jsonb_build_object('ok', true, 'updated', v_updated, 'cleared', v_cleared);
END;
$$;

REVOKE ALL ON FUNCTION public.upsert_member_month_savings(UUID, JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.upsert_member_month_savings(UUID, JSONB) TO authenticated;

-- Replace-safe initial share capital for the books grid (SHARES ONE OFF).
-- Uses notes marker so re-save does not double-count grid lots.
CREATE OR REPLACE FUNCTION public.upsert_member_share_capital(
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
  v_row JSONB;
  v_member UUID;
  v_amount NUMERIC;
  v_purchased_on DATE;
  v_par NUMERIC;
  v_currency CHAR(3);
  v_shares NUMERIC;
  v_lot UUID;
  v_updated INT := 0;
  v_cleared INT := 0;
  v_old_lot UUID;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'UNAUTHENTICATED');
  END IF;
  IF NOT (private.is_circle_officer(p_jamiya_id) OR private.is_platform_admin()) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'FORBIDDEN');
  END IF;
  IF p_rows IS NULL OR jsonb_typeof(p_rows) <> 'array' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'INVALID_ROWS');
  END IF;

  SELECT share_par_value, share_currency INTO v_par, v_currency
  FROM public.jamiyas WHERE id = p_jamiya_id;
  IF v_currency IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'NOT_FOUND');
  END IF;
  IF v_par IS NULL OR v_par <= 0 THEN
    v_par := 100;
  END IF;

  FOR v_row IN SELECT * FROM jsonb_array_elements(p_rows)
  LOOP
    v_member := NULLIF(v_row->>'member_id', '')::UUID;
    v_amount := COALESCE(NULLIF(v_row->>'amount', '')::NUMERIC, 0);
    v_purchased_on := COALESCE(NULLIF(v_row->>'purchased_on', '')::DATE, DATE '2026-02-05');

    IF v_member IS NULL THEN
      CONTINUE;
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM public.members m
      WHERE m.id = v_member
        AND m.jamiya_id = p_jamiya_id
        AND m.status IN ('active', 'pending', 'suspended')
    ) THEN
      CONTINUE;
    END IF;

    -- Replace this member's share capital with the grid amount (one lot).
    FOR v_old_lot IN
      SELECT id FROM public.circle_share_lots
      WHERE jamiya_id = p_jamiya_id
        AND member_id = v_member
    LOOP
      DELETE FROM public.book_entries
      WHERE jamiya_id = p_jamiya_id
        AND member_id = v_member
        AND entry_type = 'adjustment'
        AND (
          (metadata->>'lot_id') = v_old_lot::text
          OR metadata->>'source' IN ('share_purchase', 'share_capital_grid')
        );
      DELETE FROM public.circle_share_lots WHERE id = v_old_lot;
    END LOOP;

    IF v_amount > 0 THEN
      v_shares := round(v_amount / v_par, 4);
      IF v_shares <= 0 THEN
        CONTINUE;
      END IF;

      INSERT INTO public.circle_share_lots (
        jamiya_id, member_id, shares, unit_price, amount, currency, purchased_on, notes, recorded_by
      ) VALUES (
        p_jamiya_id, v_member, v_shares, v_par, round(v_amount, 2), v_currency,
        v_purchased_on, 'Share capital (grid)', v_uid
      )
      RETURNING id INTO v_lot;

      INSERT INTO public.book_entries (
        jamiya_id, member_id, entry_type, amount, currency, effective_date, entered_by, notes, metadata
      ) VALUES (
        p_jamiya_id, v_member, 'adjustment', round(v_amount, 2), v_currency,
        v_purchased_on, v_uid, 'Share capital',
        jsonb_build_object(
          'source', 'share_capital_grid',
          'lot_id', v_lot,
          'shares', v_shares
        )
      );
      v_updated := v_updated + 1;
    ELSE
      v_cleared := v_cleared + 1;
    END IF;
  END LOOP;

  RETURN jsonb_build_object('ok', true, 'updated', v_updated, 'cleared', v_cleared);
END;
$$;

REVOKE ALL ON FUNCTION public.upsert_member_share_capital(UUID, JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.upsert_member_share_capital(UUID, JSONB) TO authenticated;
