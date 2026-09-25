-- A Qard Hassan cap is half of contributions already paid.
-- Do not invent a KES 5,000 allowance when paid_total is 0.

CREATE OR REPLACE FUNCTION public.qard_cap_for_jamiya(p_jamiya_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_paid NUMERIC := 0;
  v_cap NUMERIC;
BEGIN
  IF v_uid IS NULL OR NOT private.is_active_jamiya_member(p_jamiya_id) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'FORBIDDEN');
  END IF;

  SELECT coalesce(sum(c.amount), 0) INTO v_paid
  FROM public.contributions c
  JOIN public.members m ON m.id = c.member_id
  WHERE m.user_id = v_uid AND m.jamiya_id = p_jamiya_id AND c.status = 'paid';

  v_cap := greatest(v_paid * 0.5, 0);

  RETURN jsonb_build_object('ok', true, 'paid_total', v_paid, 'cap', v_cap, 'currency', 'KES');
END;
$$;

REVOKE ALL ON FUNCTION public.qard_cap_for_jamiya(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.qard_cap_for_jamiya(UUID) TO authenticated;

CREATE OR REPLACE FUNCTION public.request_qard(
  p_jamiya_id UUID,
  p_amount NUMERIC,
  p_purpose TEXT,
  p_installments INT DEFAULT 4,
  p_guarantor_user_ids UUID[] DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_paid NUMERIC := 0;
  v_cap NUMERIC;
  v_id UUID;
  v_g UUID;
  v_count INT := 0;
  v_name TEXT;
BEGIN
  IF v_uid IS NULL OR NOT private.is_active_jamiya_member(p_jamiya_id) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'FORBIDDEN');
  END IF;
  IF p_amount IS NULL OR p_amount < 100 OR char_length(trim(p_purpose)) < 5 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'INVALID');
  END IF;

  SELECT coalesce(sum(c.amount), 0) INTO v_paid
  FROM public.contributions c
  JOIN public.members m ON m.id = c.member_id
  WHERE m.user_id = v_uid AND m.jamiya_id = p_jamiya_id AND c.status = 'paid';

  v_cap := greatest(v_paid * 0.5, 0);
  IF p_amount > v_cap THEN
    RETURN jsonb_build_object('ok', false, 'error', 'ABOVE_CAP', 'cap', v_cap);
  END IF;

  INSERT INTO public.qard_loans (
    jamiya_id, borrower_id, amount, currency, purpose, installment_count
  )
  SELECT p_jamiya_id, v_uid, p_amount, j.currency, trim(p_purpose),
         least(greatest(coalesce(p_installments, 4), 1), 24)
  FROM public.jamiyas j WHERE j.id = p_jamiya_id
  RETURNING id INTO v_id;

  SELECT coalesce(full_name, email, 'A member') INTO v_name
  FROM public.profiles WHERE id = v_uid;

  IF p_guarantor_user_ids IS NOT NULL THEN
    FOREACH v_g IN ARRAY p_guarantor_user_ids LOOP
      IF v_g IS NULL OR v_g = v_uid THEN
        CONTINUE;
      END IF;
      IF NOT EXISTS (
        SELECT 1 FROM public.members m
        WHERE m.jamiya_id = p_jamiya_id
          AND m.user_id = v_g
          AND m.status = 'active'
      ) THEN
        CONTINUE;
      END IF;

      INSERT INTO public.qard_guarantees (
        loan_id, jamiya_id, borrower_id, guarantor_user_id, status
      )
      VALUES (v_id, p_jamiya_id, v_uid, v_g, 'pending')
      ON CONFLICT (loan_id, guarantor_user_id) DO NOTHING;

      IF EXISTS (
        SELECT 1 FROM public.qard_guarantees
        WHERE loan_id = v_id AND guarantor_user_id = v_g AND status = 'pending'
      ) THEN
        v_count := v_count + 1;
        INSERT INTO public.notifications (user_id, type, channel, title, body, data)
        VALUES (
          v_g,
          'system',
          'in_app',
          'Guarantee requested',
          v_name || ' asked you to guarantee their circle loan (Qard Hassan).',
          jsonb_build_object(
            'kind', 'qard_guarantee',
            'loan_id', v_id,
            'jamiya_id', p_jamiya_id
          )
        );
      END IF;
    END LOOP;
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'loan_id', v_id,
    'cap', v_cap,
    'guarantors_nominated', v_count
  );
END;
$$;

REVOKE ALL ON FUNCTION public.request_qard(UUID, NUMERIC, TEXT, INT, UUID[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.request_qard(UUID, NUMERIC, TEXT, INT, UUID[]) TO authenticated;
