-- Money out on a circle's own bank statement: payouts to members, savings withdrawals, loans given
-- and expenses (bank charges, rent, airtime). The officer reads the statement, says what each
-- line was, and record_statement_payouts writes it into the circle's Books. Each statement
-- reference is kept, so a line is never recorded twice, here or in a circle sharing the account.

CREATE TABLE IF NOT EXISTS public.circle_statement_payouts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  jamiya_id UUID NOT NULL REFERENCES public.jamiyas (id) ON DELETE CASCADE,
  reference TEXT NOT NULL,
  paid_on DATE,
  amount NUMERIC(14, 2) NOT NULL CHECK (amount > 0),
  kind TEXT NOT NULL CHECK (kind IN ('payout', 'withdrawal', 'loan', 'expense')),
  member_id UUID REFERENCES public.members (id) ON DELETE SET NULL,
  details TEXT,
  recorded_by UUID NOT NULL REFERENCES auth.users (id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (jamiya_id, reference)
);

CREATE INDEX IF NOT EXISTS circle_statement_payouts_member_idx
  ON public.circle_statement_payouts (member_id);

ALTER TABLE public.circle_statement_payouts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.circle_statement_payouts FROM anon;
GRANT SELECT ON public.circle_statement_payouts TO authenticated;

DROP POLICY IF EXISTS circle_statement_payouts_select ON public.circle_statement_payouts;
CREATE POLICY circle_statement_payouts_select ON public.circle_statement_payouts
  FOR SELECT TO authenticated
  USING (private.is_circle_officer(jamiya_id) OR private.is_compliance_or_admin());

-- References already recorded (money in or out) in this circle or a circle sharing its account.
CREATE OR REPLACE FUNCTION public.circle_statement_refs(p_jamiya_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  v_circles UUID[];
BEGIN
  IF auth.uid() IS NULL OR NOT (private.is_circle_officer(p_jamiya_id) OR private.is_platform_admin()) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'FORBIDDEN');
  END IF;
  v_circles := coalesce(private.circles_sharing_account(p_jamiya_id), ARRAY[p_jamiya_id]);
  RETURN jsonb_build_object(
    'ok', true,
    'refs', coalesce((
      SELECT jsonb_agg(jsonb_build_object('reference', x.reference, 'circle', j.name,
                                          'here', x.jamiya_id = p_jamiya_id))
      FROM (
        SELECT r.reference, r.jamiya_id FROM public.circle_statement_receipts r
        WHERE r.jamiya_id = ANY (v_circles)
        UNION ALL
        SELECT p.reference, p.jamiya_id FROM public.circle_statement_payouts p
        WHERE p.jamiya_id = ANY (v_circles)
      ) x
      JOIN public.jamiyas j ON j.id = x.jamiya_id
    ), '[]'::jsonb)
  );
END;
$$;

-- Record money-out statement lines. p_rows: [{reference, paid_on, amount, kind, member_id, details}].
--   payout     → Books "payout" to the member (their turn / share-out)
--   withdrawal → Books "withdrawal" by the member (reduces their savings)
--   loan       → a loan given to the member (opens or adds to their loan account)
--   expense    → Books "expense"; member optional
CREATE OR REPLACE FUNCTION public.record_statement_payouts(p_jamiya_id UUID, p_rows JSONB)
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
  v_kind TEXT;
  v_member UUID;
  v_paid_on DATE;
  v_notes TEXT;
  v_loan JSONB;
  v_circles UUID[];
  v_currency CHAR(3);
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

  v_circles := coalesce(private.circles_sharing_account(p_jamiya_id), ARRAY[p_jamiya_id]);
  SELECT currency INTO v_currency FROM public.jamiyas WHERE id = p_jamiya_id;

  FOR v_row IN SELECT * FROM jsonb_array_elements(p_rows) LOOP
    v_ref := upper(left(btrim(coalesce(v_row->>'reference', '')), 64));
    v_kind := lower(btrim(coalesce(v_row->>'kind', '')));
    BEGIN
      v_amount := round((v_row->>'amount')::numeric, 2);
      v_member := nullif(v_row->>'member_id', '')::uuid;
      v_paid_on := nullif(v_row->>'paid_on', '')::date;
    EXCEPTION WHEN OTHERS THEN
      v_results := v_results || jsonb_build_object('reference', v_ref, 'status', 'invalid');
      CONTINUE;
    END;

    IF v_ref = '' OR v_amount IS NULL OR v_amount <= 0
       OR v_kind NOT IN ('payout', 'withdrawal', 'loan', 'expense')
       OR (v_kind <> 'expense' AND v_member IS NULL) THEN
      v_results := v_results || jsonb_build_object('reference', v_ref, 'status', 'invalid');
      CONTINUE;
    END IF;
    IF v_member IS NOT NULL
       AND NOT EXISTS (SELECT 1 FROM public.members m WHERE m.id = v_member AND m.jamiya_id = p_jamiya_id) THEN
      v_results := v_results || jsonb_build_object('reference', v_ref, 'status', 'not_a_member');
      CONTINUE;
    END IF;
    IF EXISTS (SELECT 1 FROM public.circle_statement_payouts p
               WHERE p.reference = v_ref AND p.jamiya_id = ANY (v_circles))
       OR EXISTS (SELECT 1 FROM public.circle_statement_receipts r
                  WHERE r.reference = v_ref AND r.jamiya_id = ANY (v_circles)) THEN
      v_results := v_results || jsonb_build_object('reference', v_ref, 'status', 'duplicate');
      v_duplicates := v_duplicates + 1;
      CONTINUE;
    END IF;

    v_notes := left('Bank statement ' || v_ref
                    || coalesce(': ' || nullif(btrim(v_row->>'details'), ''), ''), 500);

    IF v_kind = 'loan' THEN
      v_loan := public.record_member_loan_event(
        p_jamiya_id, v_member, 'disbursement', v_amount, coalesce(v_paid_on, CURRENT_DATE), v_notes);
      IF NOT coalesce((v_loan->>'ok')::boolean, false) THEN
        v_results := v_results || jsonb_build_object('reference', v_ref, 'status', 'invalid',
                                                     'error', v_loan->>'error');
        CONTINUE;
      END IF;
    ELSE
      INSERT INTO public.book_entries (
        jamiya_id, member_id, entry_type, amount, currency, effective_date, entered_by, notes, metadata
      ) VALUES (
        p_jamiya_id, v_member, v_kind, v_amount, coalesce(v_currency, 'KES'),
        coalesce(v_paid_on, CURRENT_DATE), v_uid, v_notes,
        jsonb_build_object('source', 'bank_statement', 'reference', v_ref)
      );
    END IF;

    INSERT INTO public.circle_statement_payouts (
      jamiya_id, reference, paid_on, amount, kind, member_id, details, recorded_by
    ) VALUES (
      p_jamiya_id, v_ref, v_paid_on, v_amount, v_kind, v_member, left(v_row->>'details', 500), v_uid
    );

    v_results := v_results || jsonb_build_object('reference', v_ref, 'status', 'recorded', 'kind', v_kind);
    v_recorded := v_recorded + 1;
    v_total := v_total + v_amount;
  END LOOP;

  IF v_recorded > 0 THEN
    INSERT INTO public.audit_logs (actor_id, action, entity_type, entity_id, jamiya_id, metadata)
    VALUES (v_uid, 'create', 'circle_statement_payouts', p_jamiya_id, p_jamiya_id,
            jsonb_build_object('recorded', v_recorded, 'total', v_total, 'duplicates', v_duplicates));
  END IF;

  RETURN jsonb_build_object('ok', true, 'recorded', v_recorded, 'duplicates', v_duplicates,
                            'total', v_total, 'results', v_results);
END;
$$;

REVOKE ALL ON FUNCTION public.circle_statement_refs(UUID) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.record_statement_payouts(UUID, JSONB) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.circle_statement_refs(UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.record_statement_payouts(UUID, JSONB) TO authenticated, service_role;
