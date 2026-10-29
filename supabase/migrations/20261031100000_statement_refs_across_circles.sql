-- One bank account often serves several circles (Asha's DIB account takes her savings circle and
-- her table-banking circle). A payment recorded from the statement in one of them must not be
-- recorded again in another, so a statement reference now counts as used across every circle
-- whose saved payment details name the same account number.

-- The circle itself plus every circle whose payment details carry the same account number.
CREATE OR REPLACE FUNCTION private.circles_sharing_account(p_jamiya_id UUID)
RETURNS UUID[]
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO ''
AS $$
  SELECT array_agg(DISTINCT j.id) || ARRAY[p_jamiya_id]
  FROM public.jamiyas me
  JOIN public.jamiyas j
    ON nullif(btrim(me.payment_details->>'account'), '') IS NOT NULL
   AND btrim(j.payment_details->>'account') = btrim(me.payment_details->>'account')
  WHERE me.id = p_jamiya_id;
$$;

-- References already recorded in this circle or a circle sharing its account, for the matching page.
CREATE OR REPLACE FUNCTION public.circle_statement_refs(p_jamiya_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO ''
AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT (private.is_circle_officer(p_jamiya_id) OR private.is_platform_admin()) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'FORBIDDEN');
  END IF;
  RETURN jsonb_build_object(
    'ok', true,
    'refs', coalesce((
      SELECT jsonb_agg(jsonb_build_object('reference', r.reference, 'circle', j.name,
                                          'here', r.jamiya_id = p_jamiya_id))
      FROM public.circle_statement_receipts r
      JOIN public.jamiyas j ON j.id = r.jamiya_id
      WHERE r.jamiya_id = ANY (coalesce(private.circles_sharing_account(p_jamiya_id), ARRAY[p_jamiya_id]))
    ), '[]'::jsonb)
  );
END;
$$;

-- Record matched statement lines. p_rows: [{reference, paid_on, amount, member_id, details}].
CREATE OR REPLACE FUNCTION public.record_statement_payments(p_jamiya_id UUID, p_rows JSONB)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_row JSONB;
  v_ref TEXT;
  v_amount NUMERIC;
  v_member UUID;
  v_paid_on DATE;
  v_left NUMERIC;
  v_credit NUMERIC;
  v_c public.contributions%ROWTYPE;
  v_new_paid NUMERIC;
  v_results JSONB := '[]'::jsonb;
  v_recorded INT := 0;
  v_duplicates INT := 0;
  v_total NUMERIC := 0;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'UNAUTHENTICATED');
  END IF;
  IF NOT (private.is_circle_officer(p_jamiya_id) OR private.is_platform_admin()) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'FORBIDDEN');
  END IF;
  IF p_rows IS NULL OR jsonb_typeof(p_rows) <> 'array' OR jsonb_array_length(p_rows) = 0
     OR jsonb_array_length(p_rows) > 500 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'INVALID');
  END IF;

  FOR v_row IN SELECT * FROM jsonb_array_elements(p_rows) LOOP
    v_ref := upper(left(btrim(coalesce(v_row->>'reference', '')), 64));
    BEGIN
      v_amount := round((v_row->>'amount')::numeric, 2);
      v_member := (v_row->>'member_id')::uuid;
      v_paid_on := nullif(v_row->>'paid_on', '')::date;
    EXCEPTION WHEN OTHERS THEN
      v_results := v_results || jsonb_build_object('reference', v_ref, 'status', 'invalid');
      CONTINUE;
    END;

    IF v_ref = '' OR v_amount IS NULL OR v_amount <= 0 OR v_member IS NULL THEN
      v_results := v_results || jsonb_build_object('reference', v_ref, 'status', 'invalid');
      CONTINUE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM public.members m WHERE m.id = v_member AND m.jamiya_id = p_jamiya_id) THEN
      v_results := v_results || jsonb_build_object('reference', v_ref, 'status', 'not_a_member');
      CONTINUE;
    END IF;
    IF EXISTS (SELECT 1 FROM public.circle_statement_receipts r
               WHERE r.reference = v_ref
                 AND r.jamiya_id = ANY (private.circles_sharing_account(p_jamiya_id))) THEN
      v_results := v_results || jsonb_build_object('reference', v_ref, 'status', 'duplicate');
      v_duplicates := v_duplicates + 1;
      CONTINUE;
    END IF;

    -- Pay the member's open contributions, oldest first.
    v_left := v_amount;
    FOR v_c IN
      SELECT * FROM public.contributions c
      WHERE c.jamiya_id = p_jamiya_id AND c.member_id = v_member
        AND c.status IN ('pending', 'late', 'partial')
        AND c.amount > coalesce(c.amount_paid, 0)
      ORDER BY c.due_date NULLS LAST, c.cycle_number
      FOR UPDATE
    LOOP
      EXIT WHEN v_left <= 0;
      v_credit := least(v_left, v_c.amount - coalesce(v_c.amount_paid, 0));
      v_new_paid := coalesce(v_c.amount_paid, 0) + v_credit;

      UPDATE public.contributions
      SET amount_paid = v_new_paid,
          status = CASE WHEN v_new_paid >= v_c.amount THEN 'paid'::public.contribution_status
                        ELSE 'partial'::public.contribution_status END,
          paid_at = CASE WHEN v_new_paid >= v_c.amount
                         THEN coalesce(v_paid_on::timestamptz, NOW()) ELSE paid_at END,
          updated_at = NOW()
      WHERE id = v_c.id;

      INSERT INTO public.contribution_payments (
        contribution_id, transaction_id, amount, currency, paid_at, created_by, payment_method, notes
      ) VALUES (
        v_c.id, NULL, v_credit, v_c.currency, coalesce(v_paid_on::timestamptz, NOW()), v_uid,
        'external', 'Bank statement ' || v_ref
      );

      v_left := v_left - v_credit;
    END LOOP;

    INSERT INTO public.circle_statement_receipts (
      jamiya_id, reference, paid_on, amount, member_id, allocated, unallocated, details, recorded_by
    ) VALUES (
      p_jamiya_id, v_ref, v_paid_on, v_amount, v_member, v_amount - v_left, v_left,
      left(v_row->>'details', 500), v_uid
    );

    v_results := v_results || jsonb_build_object(
      'reference', v_ref, 'status', 'recorded', 'member_id', v_member,
      'allocated', v_amount - v_left, 'unallocated', v_left);
    v_recorded := v_recorded + 1;
    v_total := v_total + v_amount;
  END LOOP;

  IF v_recorded > 0 THEN
    INSERT INTO public.audit_logs (actor_id, action, entity_type, entity_id, jamiya_id, metadata)
    VALUES (v_uid, 'create', 'circle_statement_receipts', p_jamiya_id, p_jamiya_id,
            jsonb_build_object('recorded', v_recorded, 'total', v_total, 'duplicates', v_duplicates));
  END IF;

  RETURN jsonb_build_object('ok', true, 'recorded', v_recorded, 'duplicates', v_duplicates,
                            'total', v_total, 'results', v_results);
END;
$$;


REVOKE ALL ON FUNCTION private.circles_sharing_account(UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.circle_statement_refs(UUID) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.record_statement_payments(UUID, JSONB) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.circle_statement_refs(UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.record_statement_payments(UUID, JSONB) TO authenticated, service_role;
