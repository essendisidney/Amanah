-- Circles can charge a fixed loan facilitation fee on Qard Hassan; never interest or profit.
--
-- Some circles charge a facilitation fee for loans. A loan with interest or profit would be riba,
-- so Qard stays interest-free; what a circle may set is one flat fee per loan, in KES, taken once
-- from the borrower's wallet when the loan is approved (the borrower has just received the loan
-- there). It is a circle term like the others: members must accept it before it is charged
-- (step 1), and raising it needs a members' vote (step 2). Each loan records the fee it paid.

ALTER TABLE public.jamiyas ADD COLUMN IF NOT EXISTS qard_fee_amount NUMERIC(14, 2) NOT NULL DEFAULT 0
  CHECK (qard_fee_amount >= 0 AND qard_fee_amount <= 100000);
ALTER TABLE public.qard_loans ADD COLUMN IF NOT EXISTS fee_amount NUMERIC(14, 2) NOT NULL DEFAULT 0;

CREATE OR REPLACE FUNCTION private.circle_terms(p_j jamiyas)
 RETURNS jsonb
 LANGUAGE sql
 STABLE
 SET search_path TO ''
AS $function$
  SELECT jsonb_build_object(
    'version', p_j.terms_version,
    'currency', p_j.currency,
    'contribution_amount', p_j.contribution_amount,
    'join_fee_amount', coalesce(p_j.join_fee_amount, 0),
    'transaction_fee_amount', coalesce(p_j.transaction_fee_amount, 0),
    'early_slot_fee_pct', CASE WHEN coalesce(p_j.slot_pricing_enabled, false)
                               THEN coalesce(p_j.early_slot_fee_pct, 0) ELSE 0 END,
    'early_slot_fee_amount', CASE WHEN coalesce(p_j.slot_pricing_enabled, false)
                                  THEN round(coalesce(p_j.contribution_amount, 0)
                                             * coalesce(p_j.early_slot_fee_pct, 0) / 100.0, 2)
                                  ELSE 0 END,
    'late_contribution_penalty', coalesce(p_j.late_contribution_penalty, 0),
    'missed_contribution_penalty', coalesce(p_j.missed_contribution_penalty, 0),
    'late_loan_penalty_fixed', coalesce(p_j.late_loan_penalty_fixed, 0),
    'late_loan_penalty_pct', coalesce(p_j.late_loan_penalty_pct, 0),
    'qard_fee_amount', coalesce(p_j.qard_fee_amount, 0),
    'auto_fine_enabled', coalesce(p_j.auto_fine_enabled, false),
    'payout_compliance_mode', p_j.payout_compliance_mode
  );
$function$;

CREATE OR REPLACE FUNCTION private.circle_terms_view(p_j jamiyas, p_user_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v_terms JSONB := private.circle_terms(p_j);
  v_c public.member_consents%ROWTYPE := private.latest_circle_consent(p_user_id, p_j.id);
BEGIN
  RETURN jsonb_build_object(
    'ok', true,
    'jamiya_id', p_j.id,
    'terms', v_terms,
    'has_charges', (
      (v_terms->>'join_fee_amount')::numeric > 0
      OR (v_terms->>'transaction_fee_amount')::numeric > 0
      OR (v_terms->>'early_slot_fee_amount')::numeric > 0
      OR (v_terms->>'late_contribution_penalty')::numeric > 0
      OR (v_terms->>'missed_contribution_penalty')::numeric > 0
      OR (v_terms->>'late_loan_penalty_fixed')::numeric > 0
      OR (v_terms->>'late_loan_penalty_pct')::numeric > 0
      OR coalesce((v_terms->>'qard_fee_amount')::numeric, 0) > 0
    ),
    'accepted_version', v_c.version,
    'accepted_at', v_c.accepted_at,
    'needs_acceptance', v_c.version IS DISTINCT FROM p_j.terms_version
  );
END;
$function$;

CREATE OR REPLACE FUNCTION private.terms_increases(p_old jamiyas, p_new jamiyas)
 RETURNS text[]
 LANGUAGE plpgsql
 STABLE
 SET search_path TO ''
AS $function$
DECLARE
  v_o JSONB := private.circle_terms(p_old);
  v_n JSONB := private.circle_terms(p_new);
  v_key TEXT;
  v_out TEXT[] := ARRAY[]::TEXT[];
BEGIN
  FOREACH v_key IN ARRAY ARRAY['join_fee_amount', 'transaction_fee_amount', 'early_slot_fee_pct',
                               'late_contribution_penalty', 'missed_contribution_penalty',
                               'late_loan_penalty_fixed', 'late_loan_penalty_pct',
                               'qard_fee_amount'] LOOP
    IF coalesce((v_n->>v_key)::numeric, 0) > coalesce((v_o->>v_key)::numeric, 0) THEN
      v_out := v_out || v_key;
    END IF;
  END LOOP;
  IF (v_n->>'auto_fine_enabled')::boolean AND NOT (v_o->>'auto_fine_enabled')::boolean THEN
    v_out := v_out || 'auto_fine_enabled'::text;
  END IF;
  IF v_n->>'payout_compliance_mode' = 'deduct'
     AND v_o->>'payout_compliance_mode' IS DISTINCT FROM 'deduct' THEN
    v_out := v_out || 'payout_compliance_mode'::text;
  END IF;
  RETURN v_out;
END;
$function$;

CREATE OR REPLACE FUNCTION private.with_terms_changes(p_j jamiyas, p_changes jsonb)
 RETURNS jamiyas
 LANGUAGE plpgsql
 STABLE
 SET search_path TO ''
AS $function$
DECLARE
  v_j public.jamiyas := p_j;
  v_key TEXT;
BEGIN
  IF p_changes IS NULL OR jsonb_typeof(p_changes) <> 'object' THEN
    RAISE EXCEPTION 'INVALID_CHANGE';
  END IF;
  FOR v_key IN SELECT jsonb_object_keys(p_changes) LOOP
    IF v_key NOT IN ('join_fee_amount', 'transaction_fee_amount', 'slot_pricing_enabled',
                     'early_slot_fee_pct', 'late_contribution_penalty',
                     'missed_contribution_penalty', 'late_loan_penalty_fixed',
                     'late_loan_penalty_pct', 'auto_fine_enabled', 'payout_compliance_mode',
                     'qard_fee_amount') THEN
      RAISE EXCEPTION 'INVALID_CHANGE' USING DETAIL = v_key;
    END IF;
  END LOOP;

  BEGIN
    v_j.join_fee_amount := coalesce((p_changes->>'join_fee_amount')::numeric, v_j.join_fee_amount);
    v_j.transaction_fee_amount := coalesce((p_changes->>'transaction_fee_amount')::numeric, v_j.transaction_fee_amount);
    v_j.slot_pricing_enabled := coalesce((p_changes->>'slot_pricing_enabled')::boolean, v_j.slot_pricing_enabled);
    v_j.early_slot_fee_pct := coalesce((p_changes->>'early_slot_fee_pct')::numeric, v_j.early_slot_fee_pct);
    v_j.late_contribution_penalty := coalesce((p_changes->>'late_contribution_penalty')::numeric, v_j.late_contribution_penalty);
    v_j.missed_contribution_penalty := coalesce((p_changes->>'missed_contribution_penalty')::numeric, v_j.missed_contribution_penalty);
    v_j.late_loan_penalty_fixed := coalesce((p_changes->>'late_loan_penalty_fixed')::numeric, v_j.late_loan_penalty_fixed);
    v_j.late_loan_penalty_pct := coalesce((p_changes->>'late_loan_penalty_pct')::numeric, v_j.late_loan_penalty_pct);
    v_j.auto_fine_enabled := coalesce((p_changes->>'auto_fine_enabled')::boolean, v_j.auto_fine_enabled);
    v_j.payout_compliance_mode := coalesce(p_changes->>'payout_compliance_mode', v_j.payout_compliance_mode);
    v_j.qard_fee_amount := coalesce((p_changes->>'qard_fee_amount')::numeric, v_j.qard_fee_amount);
  EXCEPTION WHEN invalid_text_representation OR numeric_value_out_of_range THEN
    RAISE EXCEPTION 'INVALID_CHANGE';
  END;

  IF least(coalesce(v_j.join_fee_amount, 0), coalesce(v_j.transaction_fee_amount, 0),
           coalesce(v_j.early_slot_fee_pct, 0), coalesce(v_j.late_contribution_penalty, 0),
           coalesce(v_j.missed_contribution_penalty, 0), coalesce(v_j.late_loan_penalty_fixed, 0),
           coalesce(v_j.late_loan_penalty_pct, 0), coalesce(v_j.qard_fee_amount, 0)) < 0
     OR coalesce(v_j.qard_fee_amount, 0) > 100000
     OR coalesce(v_j.early_slot_fee_pct, 0) > 100
     OR coalesce(v_j.late_loan_penalty_pct, 0) > 100
     OR v_j.payout_compliance_mode NOT IN ('block', 'approve', 'deduct', 'allow') THEN
    RAISE EXCEPTION 'INVALID_CHANGE';
  END IF;
  RETURN v_j;
END;
$function$;

CREATE OR REPLACE FUNCTION private.apply_terms_proposal(p_proposal_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v_p public.circle_terms_proposals%ROWTYPE;
  v_j public.jamiyas%ROWTYPE;
  v_new public.jamiyas%ROWTYPE;
BEGIN
  SELECT * INTO v_p FROM public.circle_terms_proposals WHERE id = p_proposal_id FOR UPDATE;
  IF NOT FOUND OR v_p.status <> 'passed' OR v_p.effective_at > NOW() THEN
    RETURN false;
  END IF;

  SELECT * INTO v_j FROM public.jamiyas WHERE id = v_p.jamiya_id FOR UPDATE;
  v_new := private.with_terms_changes(v_j, v_p.changes);

  PERFORM set_config('jamiya.applying_terms_proposal', v_j.id::text, true);
  UPDATE public.jamiyas
  SET join_fee_amount = v_new.join_fee_amount,
      transaction_fee_amount = v_new.transaction_fee_amount,
      slot_pricing_enabled = v_new.slot_pricing_enabled,
      early_slot_fee_pct = v_new.early_slot_fee_pct,
      late_contribution_penalty = v_new.late_contribution_penalty,
      missed_contribution_penalty = v_new.missed_contribution_penalty,
      late_loan_penalty_fixed = v_new.late_loan_penalty_fixed,
      late_loan_penalty_pct = v_new.late_loan_penalty_pct,
      auto_fine_enabled = v_new.auto_fine_enabled,
      payout_compliance_mode = v_new.payout_compliance_mode,
      qard_fee_amount = v_new.qard_fee_amount,
      updated_at = NOW()
  WHERE id = v_j.id;
  PERFORM set_config('jamiya.applying_terms_proposal', '', true);

  UPDATE public.circle_terms_proposals SET status = 'applied', applied_at = NOW() WHERE id = v_p.id;

  PERFORM private.notify_circle_members(
    v_j.id,
    'New circle fees in effect',
    'The fee change members approved for ' || v_j.name || ' is now in effect. Open the circle to '
      || 'review and accept it; until you do, you keep paying the fees you accepted before.',
    jsonb_build_object('kind', 'circle_terms_applied', 'jamiya_id', v_j.id, 'proposal_id', v_p.id)
  );
  RETURN true;
END;
$function$;

CREATE OR REPLACE FUNCTION public.decide_qard(p_loan_id uuid, p_approve boolean)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v_uid UUID := auth.uid();
  v_l public.qard_loans%ROWTYPE;
  v_pending INT := 0;
  v_accepted INT := 0;
  v_total INT := 0;
  v_fee NUMERIC := 0;
BEGIN
  SELECT * INTO v_l FROM public.qard_loans WHERE id = p_loan_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'error', 'NOT_FOUND'); END IF;
  IF NOT private.is_circle_officer(v_l.jamiya_id) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'FORBIDDEN');
  END IF;
  IF v_l.status <> 'requested' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'NOT_REQUESTED');
  END IF;

  IF NOT p_approve THEN
    UPDATE public.qard_loans SET status = 'rejected', approved_by = v_uid, decided_at = NOW()
    WHERE id = p_loan_id;
    UPDATE public.qard_guarantees
    SET status = 'released', updated_at = NOW()
    WHERE loan_id = p_loan_id AND status = 'pending';
    RETURN jsonb_build_object('ok', true, 'status', 'rejected');
  END IF;

  IF v_l.agreement_accepted_at IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'AGREEMENT_REQUIRED');
  END IF;

  SELECT
    count(*)::INT,
    count(*) FILTER (WHERE status = 'pending')::INT,
    count(*) FILTER (WHERE status = 'accepted')::INT
  INTO v_total, v_pending, v_accepted
  FROM public.qard_guarantees
  WHERE loan_id = p_loan_id;

  IF v_pending > 0 THEN
    RETURN jsonb_build_object(
      'ok', false,
      'error', 'GUARANTEES_PENDING',
      'pending', v_pending,
      'accepted', v_accepted
    );
  END IF;

  IF v_total > 0 AND v_accepted < 1 THEN
    RETURN jsonb_build_object(
      'ok', false,
      'error', 'GUARANTEE_REQUIRED',
      'accepted', v_accepted
    );
  END IF;

  PERFORM private.ledger_credit(
    v_l.borrower_id, v_l.currency, v_l.amount, 'payout'::public.transaction_type, v_l.jamiya_id,
    'qard', p_loan_id::text, jsonb_build_object('kind', 'qard_disbursement')
  );
  -- The circle's fixed loan facilitation fee, if the borrower accepted it in the circle's terms.
  -- A flat amount, never a percentage or a charge for time, so the loan stays interest-free.
  v_fee := least(private.agreed_circle_fee(v_l.borrower_id, v_l.jamiya_id, 'qard_fee_amount'), v_l.amount);
  IF v_fee > 0 THEN
    PERFORM private.ledger_debit(
      v_l.borrower_id, v_l.currency, v_fee, 'fee'::public.transaction_type, v_l.jamiya_id,
      'qard_fee:' || p_loan_id::text, 'qard_fee:' || p_loan_id::text,
      jsonb_build_object('kind', 'qard_fee', 'loan_id', p_loan_id)
    );
  END IF;
  UPDATE public.qard_loans
  SET status = 'active', approved_by = v_uid, decided_at = NOW(),
      due_date = CURRENT_DATE + (v_l.installment_count * 30),
      fee_amount = v_fee
  WHERE id = p_loan_id;
  RETURN jsonb_build_object('ok', true, 'status', 'active', 'guarantors_accepted', v_accepted, 'fee', v_fee);
END;
$function$;
