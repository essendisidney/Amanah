-- Secretary is a group leader. Chair, treasurer, and secretary share the
-- officer checks the admin already uses for invites, books, and treasury.

CREATE OR REPLACE FUNCTION private.is_circle_officer(p_jamiya_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.members m
    WHERE m.jamiya_id = p_jamiya_id
      AND m.user_id = auth.uid()
      AND m.status = 'active'
      AND m.role::text IN ('circle_admin', 'chair', 'treasurer', 'secretary')
  )
  OR private.is_platform_admin();
$$;

-- Role changes, welfare, qard, grace, and vouches use the same leader set.

CREATE OR REPLACE FUNCTION public.set_member_role(p_member_id UUID, p_role TEXT)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_m public.members%ROWTYPE;
BEGIN
  IF v_uid IS NULL THEN RETURN jsonb_build_object('ok', false, 'error', 'UNAUTHENTICATED'); END IF;
  IF p_role NOT IN ('member', 'circle_admin', 'treasurer', 'secretary', 'chair') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'INVALID_ROLE');
  END IF;
  SELECT * INTO v_m FROM public.members WHERE id = p_member_id;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'error', 'NOT_FOUND'); END IF;
  IF NOT private.is_circle_officer(v_m.jamiya_id) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'FORBIDDEN');
  END IF;
  UPDATE public.members SET role = p_role::public.membership_role WHERE id = p_member_id;
  RETURN jsonb_build_object('ok', true);
END;
$$;

CREATE OR REPLACE FUNCTION public.ensure_welfare_fund(p_jamiya_id UUID, p_contribution_amount NUMERIC DEFAULT 0)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE v_id UUID;
BEGIN
  IF auth.uid() IS NULL OR NOT private.is_circle_officer(p_jamiya_id) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'FORBIDDEN');
  END IF;
  INSERT INTO public.welfare_funds (jamiya_id, contribution_amount, currency)
  SELECT p_jamiya_id, greatest(p_contribution_amount, 0), j.currency
  FROM public.jamiyas j WHERE j.id = p_jamiya_id
  ON CONFLICT (jamiya_id) DO UPDATE
    SET contribution_amount = EXCLUDED.contribution_amount
  RETURNING id INTO v_id;
  RETURN jsonb_build_object('ok', true, 'fund_id', v_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.decide_welfare_claim(p_claim_id UUID, p_approve BOOLEAN, p_notes TEXT DEFAULT NULL)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_c public.welfare_claims%ROWTYPE;
  v_fund public.welfare_funds%ROWTYPE;
BEGIN
  SELECT * INTO v_c FROM public.welfare_claims WHERE id = p_claim_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'error', 'NOT_FOUND'); END IF;
  IF NOT private.is_circle_officer(v_c.jamiya_id) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'FORBIDDEN');
  END IF;
  IF v_c.status <> 'pending' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'NOT_PENDING');
  END IF;

  IF NOT p_approve THEN
    UPDATE public.welfare_claims
    SET status = 'rejected', decided_by = v_uid, decided_at = NOW(), reason = coalesce(p_notes, reason)
    WHERE id = p_claim_id;
    RETURN jsonb_build_object('ok', true, 'status', 'rejected');
  END IF;

  SELECT * INTO v_fund FROM public.welfare_funds WHERE id = v_c.fund_id FOR UPDATE;
  IF v_fund.balance < v_c.amount THEN
    RETURN jsonb_build_object('ok', false, 'error', 'INSUFFICIENT_FUND');
  END IF;

  UPDATE public.welfare_funds SET balance = balance - v_c.amount WHERE id = v_fund.id;
  PERFORM private.ledger_credit(
    v_c.claimant_id, v_c.currency, v_c.amount, 'payout'::public.transaction_type, v_c.jamiya_id,
    'welfare_claim', p_claim_id::text, jsonb_build_object('kind', 'welfare_claim')
  );
  UPDATE public.welfare_claims
  SET status = 'paid', decided_by = v_uid, decided_at = NOW()
  WHERE id = p_claim_id;
  RETURN jsonb_build_object('ok', true, 'status', 'paid');
END;
$$;

CREATE OR REPLACE FUNCTION public.decide_grace_request(p_request_id UUID, p_approve BOOLEAN)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_r public.grace_period_requests%ROWTYPE;
  v_c public.contributions%ROWTYPE;
BEGIN
  SELECT * INTO v_r FROM public.grace_period_requests WHERE id = p_request_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'error', 'NOT_FOUND'); END IF;
  IF NOT private.is_circle_officer(v_r.jamiya_id) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'FORBIDDEN');
  END IF;
  IF v_r.status <> 'pending' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'NOT_PENDING');
  END IF;

  IF NOT p_approve THEN
    UPDATE public.grace_period_requests
    SET status = 'rejected', decided_by = v_uid, decided_at = NOW()
    WHERE id = p_request_id;
    RETURN jsonb_build_object('ok', true, 'status', 'rejected');
  END IF;

  SELECT * INTO v_c FROM public.contributions WHERE id = v_r.contribution_id FOR UPDATE;
  UPDATE public.contributions
  SET due_date = v_c.due_date + v_r.requested_days,
      status = CASE WHEN status = 'late' THEN 'pending'::public.contribution_status ELSE status END
  WHERE id = v_r.contribution_id;

  UPDATE public.grace_period_requests
  SET status = 'approved', decided_by = v_uid, decided_at = NOW(),
      new_due_date = v_c.due_date + v_r.requested_days
  WHERE id = p_request_id;

  RETURN jsonb_build_object('ok', true, 'status', 'approved', 'new_due_date', v_c.due_date + v_r.requested_days);
END;
$$;

CREATE OR REPLACE FUNCTION public.decide_qard(p_loan_id UUID, p_approve BOOLEAN)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_l public.qard_loans%ROWTYPE;
  v_pending INT := 0;
  v_accepted INT := 0;
  v_total INT := 0;
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
  UPDATE public.qard_loans
  SET status = 'active', approved_by = v_uid, decided_at = NOW(),
      due_date = CURRENT_DATE + (v_l.installment_count * 30)
  WHERE id = p_loan_id;
  RETURN jsonb_build_object('ok', true, 'status', 'active', 'guarantors_accepted', v_accepted);
END;
$$;

CREATE OR REPLACE FUNCTION public.vouch_for_member(
  p_member_id UUID,
  p_approve BOOLEAN,
  p_notes TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_m public.members%ROWTYPE;
  v_id UUID;
  v_status public.vouch_status := CASE WHEN p_approve THEN 'approved'::public.vouch_status ELSE 'rejected'::public.vouch_status END;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'UNAUTHENTICATED');
  END IF;

  SELECT * INTO v_m FROM public.members WHERE id = p_member_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'NOT_FOUND');
  END IF;

  IF NOT private.is_circle_officer(v_m.jamiya_id) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'FORBIDDEN');
  END IF;

  INSERT INTO public.member_vouches (jamiya_id, member_id, voucher_user_id, status, notes, decided_at)
  VALUES (v_m.jamiya_id, p_member_id, v_uid, v_status, nullif(trim(coalesce(p_notes, '')), ''), NOW())
  ON CONFLICT (jamiya_id, member_id) DO UPDATE
    SET status = EXCLUDED.status,
        notes = EXCLUDED.notes,
        voucher_user_id = EXCLUDED.voucher_user_id,
        decided_at = NOW()
  RETURNING id INTO v_id;

  RETURN jsonb_build_object('ok', true, 'vouch_id', v_id, 'status', v_status);
END;
$$;

DROP POLICY IF EXISTS "welfare_claims_select" ON public.welfare_claims;
CREATE POLICY "welfare_claims_select"
  ON public.welfare_claims FOR SELECT TO authenticated
  USING (
    claimant_id = auth.uid()
    OR private.is_circle_officer(jamiya_id)
    OR private.is_compliance_or_admin()
  );

DROP POLICY IF EXISTS "welfare_claims_update_admin" ON public.welfare_claims;
CREATE POLICY "welfare_claims_update_admin"
  ON public.welfare_claims FOR UPDATE TO authenticated
  USING (private.is_circle_officer(jamiya_id))
  WITH CHECK (private.is_circle_officer(jamiya_id));

DROP POLICY IF EXISTS "qard_select" ON public.qard_loans;
CREATE POLICY "qard_select"
  ON public.qard_loans FOR SELECT TO authenticated
  USING (
    borrower_id = auth.uid()
    OR private.is_circle_officer(jamiya_id)
    OR private.is_compliance_or_admin()
  );

DROP POLICY IF EXISTS "qard_update_admin" ON public.qard_loans;
CREATE POLICY "qard_update_admin"
  ON public.qard_loans FOR UPDATE TO authenticated
  USING (private.is_circle_officer(jamiya_id))
  WITH CHECK (private.is_circle_officer(jamiya_id));
