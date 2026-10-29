-- Circles that keep their own bank account (for example a chama paid through its DIB Bank paybill):
--
-- 1. How to pay: officers save the paybill, account number, bank and a note ("pay by the 5th"),
--    and every member sees them on the circle page.
-- 2. Statement matching: an officer pastes the month's bank or M-Pesa statement, the app matches
--    each money-in line to a member, and record_statement_payments marks that member's open
--    contributions as paid, oldest first. Each statement reference is kept, so pasting the same
--    statement twice never counts a payment twice. Money left over after the member's open
--    contributions is kept on the line as unallocated, for the officer to record in Books.

-- ---------------------------------------------------------------------------
-- 1. How to pay
-- ---------------------------------------------------------------------------
ALTER TABLE public.jamiyas ADD COLUMN IF NOT EXISTS payment_details JSONB;

CREATE OR REPLACE FUNCTION public.set_circle_payment_details(
  p_jamiya_id UUID,
  p_paybill TEXT,
  p_account TEXT,
  p_bank TEXT,
  p_note TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_details JSONB;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'UNAUTHENTICATED');
  END IF;
  IF NOT (private.is_circle_officer(p_jamiya_id) OR private.is_platform_admin()) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'FORBIDDEN');
  END IF;
  IF char_length(coalesce(p_paybill, '')) > 20 OR char_length(coalesce(p_account, '')) > 40
     OR char_length(coalesce(p_bank, '')) > 60 OR char_length(coalesce(p_note, '')) > 280 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'INVALID');
  END IF;

  v_details := jsonb_strip_nulls(jsonb_build_object(
    'paybill', nullif(btrim(p_paybill), ''),
    'account', nullif(btrim(p_account), ''),
    'bank', nullif(btrim(p_bank), ''),
    'note', nullif(btrim(p_note), '')
  ));
  IF v_details = '{}'::jsonb THEN
    v_details := NULL;
  END IF;

  UPDATE public.jamiyas SET payment_details = v_details, updated_at = NOW() WHERE id = p_jamiya_id;

  INSERT INTO public.audit_logs (actor_id, action, entity_type, entity_id, jamiya_id, metadata)
  VALUES (v_uid, 'update', 'jamiya', p_jamiya_id, p_jamiya_id,
          jsonb_build_object('kind', 'payment_details', 'payment_details', v_details));

  RETURN jsonb_build_object('ok', true, 'payment_details', v_details);
END;
$$;

-- ---------------------------------------------------------------------------
-- 2. Statement lines already recorded
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.circle_statement_receipts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  jamiya_id UUID NOT NULL REFERENCES public.jamiyas (id) ON DELETE CASCADE,
  reference TEXT NOT NULL,
  paid_on DATE,
  amount NUMERIC(14, 2) NOT NULL CHECK (amount > 0),
  member_id UUID NOT NULL REFERENCES public.members (id) ON DELETE CASCADE,
  allocated NUMERIC(14, 2) NOT NULL DEFAULT 0,
  unallocated NUMERIC(14, 2) NOT NULL DEFAULT 0,
  details TEXT,
  recorded_by UUID NOT NULL REFERENCES auth.users (id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (jamiya_id, reference)
);

CREATE INDEX IF NOT EXISTS circle_statement_receipts_member_idx
  ON public.circle_statement_receipts (member_id);

ALTER TABLE public.circle_statement_receipts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.circle_statement_receipts FROM anon;
GRANT SELECT ON public.circle_statement_receipts TO authenticated;

DROP POLICY IF EXISTS circle_statement_receipts_select ON public.circle_statement_receipts;
CREATE POLICY circle_statement_receipts_select ON public.circle_statement_receipts
  FOR SELECT TO authenticated
  USING (private.is_circle_officer(jamiya_id) OR private.is_compliance_or_admin());

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
               WHERE r.jamiya_id = p_jamiya_id AND r.reference = v_ref) THEN
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

REVOKE ALL ON FUNCTION public.set_circle_payment_details(UUID, TEXT, TEXT, TEXT, TEXT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.record_statement_payments(UUID, JSONB) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_circle_payment_details(UUID, TEXT, TEXT, TEXT, TEXT) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.record_statement_payments(UUID, JSONB) TO authenticated, service_role;
