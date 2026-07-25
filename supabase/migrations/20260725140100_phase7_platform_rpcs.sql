-- Phase 7 RPCs (companion to 20260725140000_phase7_platform_features.sql)

CREATE OR REPLACE FUNCTION public.link_mpesa_phone(p_phone TEXT)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE v_uid UUID := auth.uid();
BEGIN
  IF v_uid IS NULL THEN RETURN jsonb_build_object('ok', false, 'error', 'UNAUTHENTICATED'); END IF;
  IF p_phone IS NULL OR p_phone !~ '^\+[1-9]\d{7,14}$' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'INVALID_PHONE');
  END IF;
  UPDATE public.profiles SET mpesa_phone = p_phone WHERE id = v_uid;
  RETURN jsonb_build_object('ok', true);
END;
$$;

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
  IF NOT private.is_circle_admin(v_m.jamiya_id) THEN
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
  IF auth.uid() IS NULL OR NOT private.is_circle_admin(p_jamiya_id) THEN
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

CREATE OR REPLACE FUNCTION public.contribute_to_welfare(p_jamiya_id UUID, p_amount NUMERIC)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_fund public.welfare_funds%ROWTYPE;
  v_tx UUID;
BEGIN
  IF v_uid IS NULL OR NOT private.is_active_jamiya_member(p_jamiya_id) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'FORBIDDEN');
  END IF;
  IF p_amount IS NULL OR p_amount <= 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'INVALID_AMOUNT');
  END IF;
  SELECT * INTO v_fund FROM public.welfare_funds WHERE jamiya_id = p_jamiya_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'error', 'NO_FUND'); END IF;

  v_tx := private.ledger_debit(
    v_uid, v_fund.currency, p_amount, 'contribution'::public.transaction_type, p_jamiya_id,
    'welfare', NULL, jsonb_build_object('kind', 'welfare_contribution')
  );

  UPDATE public.welfare_funds SET balance = balance + p_amount WHERE id = v_fund.id;
  RETURN jsonb_build_object('ok', true, 'transaction_id', v_tx, 'balance', v_fund.balance + p_amount);
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('ok', false, 'error', SQLERRM);
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
  IF NOT (
    private.is_circle_admin(v_c.jamiya_id)
    OR EXISTS (
      SELECT 1 FROM public.members m
      WHERE m.jamiya_id = v_c.jamiya_id AND m.user_id = v_uid
        AND m.role::text IN ('treasurer', 'chair', 'circle_admin') AND m.status = 'active'
    )
  ) THEN
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

CREATE OR REPLACE FUNCTION public.request_qard(
  p_jamiya_id UUID, p_amount NUMERIC, p_purpose TEXT, p_installments INT DEFAULT 4
)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_paid NUMERIC := 0;
  v_cap NUMERIC;
  v_id UUID;
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
  IF v_cap = 0 THEN v_cap := 5000; END IF;
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

  RETURN jsonb_build_object('ok', true, 'loan_id', v_id, 'cap', v_cap);
END;
$$;

CREATE OR REPLACE FUNCTION public.decide_qard(p_loan_id UUID, p_approve BOOLEAN)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_l public.qard_loans%ROWTYPE;
BEGIN
  SELECT * INTO v_l FROM public.qard_loans WHERE id = p_loan_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'error', 'NOT_FOUND'); END IF;
  IF NOT (
    private.is_circle_admin(v_l.jamiya_id)
    OR EXISTS (
      SELECT 1 FROM public.members m
      WHERE m.jamiya_id = v_l.jamiya_id AND m.user_id = v_uid
        AND m.role::text IN ('treasurer', 'chair', 'circle_admin') AND m.status = 'active'
    )
  ) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'FORBIDDEN');
  END IF;
  IF v_l.status <> 'requested' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'NOT_REQUESTED');
  END IF;

  IF NOT p_approve THEN
    UPDATE public.qard_loans SET status = 'rejected', approved_by = v_uid, decided_at = NOW()
    WHERE id = p_loan_id;
    RETURN jsonb_build_object('ok', true, 'status', 'rejected');
  END IF;

  PERFORM private.ledger_credit(
    v_l.borrower_id, v_l.currency, v_l.amount, 'payout'::public.transaction_type, v_l.jamiya_id,
    'qard', p_loan_id::text, jsonb_build_object('kind', 'qard_disbursement')
  );
  UPDATE public.qard_loans
  SET status = 'active', approved_by = v_uid, decided_at = NOW(),
      due_date = CURRENT_DATE + (v_l.installment_count * 30)
  WHERE id = p_loan_id;
  RETURN jsonb_build_object('ok', true, 'status', 'active');
END;
$$;

CREATE OR REPLACE FUNCTION public.repay_qard(p_loan_id UUID, p_amount NUMERIC)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_l public.qard_loans%ROWTYPE;
  v_remaining NUMERIC;
BEGIN
  SELECT * INTO v_l FROM public.qard_loans WHERE id = p_loan_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'error', 'NOT_FOUND'); END IF;
  IF v_l.borrower_id <> v_uid THEN RETURN jsonb_build_object('ok', false, 'error', 'FORBIDDEN'); END IF;
  IF v_l.status <> 'active' THEN RETURN jsonb_build_object('ok', false, 'error', 'NOT_ACTIVE'); END IF;
  v_remaining := v_l.amount - v_l.amount_repaid;
  IF p_amount IS NULL OR p_amount <= 0 OR p_amount > v_remaining THEN
    RETURN jsonb_build_object('ok', false, 'error', 'INVALID_AMOUNT', 'remaining', v_remaining);
  END IF;

  PERFORM private.ledger_debit(
    v_uid, v_l.currency, p_amount, 'contribution'::public.transaction_type, v_l.jamiya_id,
    'qard_repay', p_loan_id::text, jsonb_build_object('kind', 'qard_repayment')
  );
  INSERT INTO public.qard_repayments (loan_id, amount, currency, created_by)
  VALUES (p_loan_id, p_amount, v_l.currency, v_uid);

  UPDATE public.qard_loans
  SET amount_repaid = amount_repaid + p_amount,
      status = CASE WHEN amount_repaid + p_amount >= amount THEN 'repaid'::public.qard_status ELSE status END
  WHERE id = p_loan_id;

  RETURN jsonb_build_object('ok', true, 'remaining', v_remaining - p_amount);
END;
$$;

CREATE OR REPLACE FUNCTION public.record_charity_donation(
  p_campaign_id UUID,
  p_amount NUMERIC,
  p_donor_name TEXT DEFAULT NULL,
  p_donor_phone TEXT DEFAULT NULL,
  p_donor_email TEXT DEFAULT NULL,
  p_is_anonymous BOOLEAN DEFAULT false
)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_c public.charity_campaigns%ROWTYPE;
  v_fee NUMERIC := 0;
  v_net NUMERIC;
  v_receipt TEXT;
  v_id UUID;
BEGIN
  SELECT * INTO v_c FROM public.charity_campaigns WHERE id = p_campaign_id FOR UPDATE;
  IF NOT FOUND OR v_c.status <> 'live' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'CAMPAIGN_UNAVAILABLE');
  END IF;
  IF p_amount IS NULL OR p_amount < 10 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'INVALID_AMOUNT');
  END IF;

  IF v_c.fee_mode = 'donation_addon' THEN
    v_fee := round(p_amount * v_c.fee_bps / 10000.0, 2);
    v_net := p_amount;
  ELSIF v_c.fee_mode = 'donation_deduct' THEN
    v_fee := round(p_amount * v_c.fee_bps / 10000.0, 2);
    v_net := p_amount - v_fee;
  ELSE
    v_net := p_amount;
  END IF;

  v_receipt := 'AMA-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 10));

  INSERT INTO public.charity_donations (
    campaign_id, donor_user_id, donor_name, donor_phone, donor_email,
    amount, fee_amount, currency, receipt_code, is_anonymous
  ) VALUES (
    p_campaign_id, v_uid, p_donor_name, p_donor_phone, p_donor_email,
    v_net, v_fee, v_c.currency, v_receipt, coalesce(p_is_anonymous, false)
  ) RETURNING id INTO v_id;

  UPDATE public.charity_campaigns
  SET raised_amount = raised_amount + v_net
  WHERE id = p_campaign_id;

  IF v_uid IS NOT NULL THEN
    INSERT INTO public.notifications (user_id, type, channel, title, body, data)
    VALUES (
      v_uid, 'system', 'in_app',
      'Donation receipt ' || v_receipt,
      'JazakAllah khair. Your gift of ' || v_net || ' ' || v_c.currency ||
        ' to ' || v_c.title || ' was recorded.' ||
        CASE WHEN v_fee > 0 AND v_c.fee_mode = 'donation_addon'
          THEN ' Platform fee ' || v_fee || ' ' || v_c.currency || ' charged separately (addon).'
          ELSE '' END,
      jsonb_build_object('donation_id', v_id, 'receipt', v_receipt)
    );
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'donation_id', v_id,
    'receipt_code', v_receipt,
    'amount', v_net,
    'fee_amount', v_fee,
    'fee_mode', v_c.fee_mode
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.pay_contribution_ahead(p_contribution_id UUID)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  RETURN public.pay_contribution(p_contribution_id);
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
  IF NOT private.is_circle_admin(v_r.jamiya_id) THEN
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

CREATE OR REPLACE FUNCTION public.submit_tawarruq_application(
  p_amount NUMERIC, p_purpose TEXT, p_jamiya_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE v_uid UUID := auth.uid(); v_id UUID;
BEGIN
  IF v_uid IS NULL THEN RETURN jsonb_build_object('ok', false, 'error', 'UNAUTHENTICATED'); END IF;
  IF p_amount IS NULL OR p_amount < 1000 OR char_length(trim(p_purpose)) < 5 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'INVALID');
  END IF;
  INSERT INTO public.tawarruq_applications (user_id, jamiya_id, amount, purpose, status)
  VALUES (v_uid, p_jamiya_id, p_amount, trim(p_purpose), 'requested')
  RETURNING id INTO v_id;
  RETURN jsonb_build_object('ok', true, 'application_id', v_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.record_platform_tip(
  p_amount NUMERIC, p_phone TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE v_uid UUID := auth.uid(); v_id UUID;
BEGIN
  IF p_amount IS NULL OR p_amount < 10 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'INVALID_AMOUNT');
  END IF;
  INSERT INTO public.platform_tips (user_id, amount, currency, phone)
  VALUES (v_uid, p_amount, 'KES', p_phone)
  RETURNING id INTO v_id;
  RETURN jsonb_build_object('ok', true, 'tip_id', v_id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.link_mpesa_phone(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_member_role(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.ensure_welfare_fund(UUID, NUMERIC) TO authenticated;
GRANT EXECUTE ON FUNCTION public.contribute_to_welfare(UUID, NUMERIC) TO authenticated;
GRANT EXECUTE ON FUNCTION public.decide_welfare_claim(UUID, BOOLEAN, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.request_qard(UUID, NUMERIC, TEXT, INT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.decide_qard(UUID, BOOLEAN) TO authenticated;
GRANT EXECUTE ON FUNCTION public.repay_qard(UUID, NUMERIC) TO authenticated;
GRANT EXECUTE ON FUNCTION public.record_charity_donation(UUID, NUMERIC, TEXT, TEXT, TEXT, BOOLEAN) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.pay_contribution_ahead(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.decide_grace_request(UUID, BOOLEAN) TO authenticated;
GRANT EXECUTE ON FUNCTION public.submit_tawarruq_application(NUMERIC, TEXT, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.record_platform_tip(NUMERIC, TEXT) TO authenticated, anon;

INSERT INTO public.charity_campaigns (
  slug, title, summary, description, goal_amount, status, fee_mode, fee_bps, sharia_board_endorsed
)
VALUES (
  'amanah-community-relief',
  'Amanah Community Relief',
  'Support medical and funeral needs for Amanah members and neighbours.',
  'Public sadaka campaign. Donations are open to anyone. Platform fee uses the addon model so 100% of your gift reaches the cause; any platform fee is charged separately and disclosed before you give. Pending final Sharia board sign-off on fee policy.',
  500000,
  'live',
  'donation_addon',
  250,
  true
)
ON CONFLICT (slug) DO NOTHING;
