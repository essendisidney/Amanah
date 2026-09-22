-- F continued: repay_qard uses qard_repayment (enum added in prior migration).
-- Must be a separate migration so the new enum label is committed first.

CREATE OR REPLACE FUNCTION public.repay_qard(p_loan_id UUID, p_amount NUMERIC)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_l public.qard_loans%ROWTYPE;
  v_remaining NUMERIC;
  v_tx UUID;
BEGIN
  SELECT * INTO v_l FROM public.qard_loans WHERE id = p_loan_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'error', 'NOT_FOUND'); END IF;
  IF v_l.borrower_id <> v_uid THEN RETURN jsonb_build_object('ok', false, 'error', 'FORBIDDEN'); END IF;
  IF v_l.status <> 'active' THEN RETURN jsonb_build_object('ok', false, 'error', 'NOT_ACTIVE'); END IF;
  v_remaining := v_l.amount - v_l.amount_repaid;
  IF p_amount IS NULL OR p_amount <= 0 OR p_amount > v_remaining THEN
    RETURN jsonb_build_object('ok', false, 'error', 'INVALID_AMOUNT', 'remaining', v_remaining);
  END IF;

  v_tx := private.ledger_debit(
    v_uid, v_l.currency, p_amount, 'qard_repayment'::public.transaction_type, v_l.jamiya_id,
    'qard_repay:' || p_loan_id::text || ':' || gen_random_uuid()::text,
    'qard_repay:' || p_loan_id::text || ':' || gen_random_uuid()::text,
    jsonb_build_object('kind', 'qard_repayment', 'loan_id', p_loan_id)
  );

  INSERT INTO public.qard_repayments (loan_id, amount, currency, created_by)
  VALUES (p_loan_id, p_amount, v_l.currency, v_uid);

  UPDATE public.qard_loans
  SET amount_repaid = amount_repaid + p_amount,
      status = CASE WHEN amount_repaid + p_amount >= amount THEN 'repaid'::public.qard_status ELSE status END
  WHERE id = p_loan_id;

  PERFORM private.post_balanced_journal(
    'qard_repayment',
    p_loan_id::text || ':' || v_tx::text,
    'QARD',
    'Qard Hassan repayment',
    v_l.currency,
    '4100',
    '4000',
    p_amount,
    NULL,
    v_l.jamiya_id,
    v_uid,
    jsonb_build_object('loan_id', p_loan_id, 'transaction_id', v_tx)
  );

  RETURN jsonb_build_object('ok', true, 'remaining', v_remaining - p_amount, 'transaction_id', v_tx);
END;
$$;

REVOKE ALL ON FUNCTION public.repay_qard(UUID, NUMERIC) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.repay_qard(UUID, NUMERIC) TO authenticated;

-- Wallet-path contribution → cashbook (same bridge as STK complete)
CREATE OR REPLACE FUNCTION public.pay_contribution(
  p_contribution_id UUID,
  p_amount NUMERIC DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_c public.contributions%ROWTYPE;
  v_member public.members%ROWTYPE;
  v_tx UUID;
  v_remaining NUMERIC;
  v_debit NUMERIC;
  v_new_paid NUMERIC;
  v_new_status public.contribution_status;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'UNAUTHENTICATED');
  END IF;

  SELECT * INTO v_c FROM public.contributions WHERE id = p_contribution_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'NOT_FOUND');
  END IF;

  IF v_c.status NOT IN ('pending', 'late', 'partial') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'NOT_PAYABLE');
  END IF;

  SELECT * INTO v_member FROM public.members WHERE id = v_c.member_id;
  IF v_member.user_id <> v_uid THEN
    RETURN jsonb_build_object('ok', false, 'error', 'FORBIDDEN');
  END IF;

  v_remaining := v_c.amount - coalesce(v_c.amount_paid, 0);
  IF v_remaining <= 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'ALREADY_PAID');
  END IF;

  IF p_amount IS NULL THEN
    v_debit := v_remaining;
  ELSE
    IF p_amount <= 0 THEN
      RETURN jsonb_build_object('ok', false, 'error', 'INVALID_AMOUNT');
    END IF;
    v_debit := LEAST(p_amount, v_remaining);
  END IF;

  BEGIN
    v_tx := private.ledger_debit(
      v_uid, v_c.currency, v_debit, 'contribution', v_c.jamiya_id,
      'contribution:' || v_c.id::text || ':' || gen_random_uuid()::text,
      'pay_contribution:' || v_c.id::text || ':' || gen_random_uuid()::text,
      jsonb_build_object(
        'contribution_id', v_c.id,
        'cycle', v_c.cycle_number,
        'partial', v_debit < v_remaining,
        'amount', v_debit
      )
    );
  EXCEPTION
    WHEN OTHERS THEN
      IF SQLERRM = 'INSUFFICIENT_FUNDS' THEN
        RETURN jsonb_build_object('ok', false, 'error', 'INSUFFICIENT_FUNDS');
      END IF;
      RAISE;
  END;

  v_new_paid := coalesce(v_c.amount_paid, 0) + v_debit;
  IF v_new_paid >= v_c.amount THEN
    v_new_status := 'paid';
  ELSE
    v_new_status := 'partial';
  END IF;

  UPDATE public.contributions
  SET
    amount_paid = v_new_paid,
    status = v_new_status,
    paid_at = CASE WHEN v_new_status = 'paid' THEN NOW() ELSE paid_at END,
    transaction_id = v_tx,
    updated_at = NOW()
  WHERE id = v_c.id;

  INSERT INTO public.contribution_payments (
    contribution_id, transaction_id, amount, currency, created_by
  ) VALUES (
    v_c.id, v_tx, v_debit, v_c.currency, v_uid
  );

  PERFORM private.bridge_contribution_to_cashbook(
    v_c.id, v_debit, NULL, v_tx
  );

  PERFORM private.post_balanced_journal(
    'contribution_wallet',
    v_tx::text,
    'CONTRIBUTIONS',
    'Contribution (wallet)',
    v_c.currency,
    '2000',
    '3000',
    v_debit,
    NULL,
    v_c.jamiya_id,
    v_uid,
    jsonb_build_object('contribution_id', v_c.id, 'transaction_id', v_tx)
  );

  INSERT INTO public.notifications (user_id, type, channel, title, body, data)
  SELECT
    m.user_id,
    'contribution_received',
    'in_app',
    CASE WHEN v_new_status = 'paid' THEN 'Contribution fully paid' ELSE 'Partial contribution received' END,
    'Cycle ' || v_c.cycle_number || ': ' || v_debit::text || ' ' || v_c.currency
      || ' paid (' || v_new_paid::text || '/' || v_c.amount::text || ').',
    jsonb_build_object(
      'jamiya_id', v_c.jamiya_id,
      'contribution_id', v_c.id,
      'amount', v_debit,
      'amount_paid', v_new_paid,
      'status', v_new_status
    )
  FROM public.members m
  WHERE m.jamiya_id = v_c.jamiya_id
    AND m.role = 'circle_admin'
    AND m.status = 'active';

  RETURN jsonb_build_object(
    'ok', true,
    'transaction_id', v_tx,
    'status', v_new_status,
    'amount_paid', v_new_paid,
    'remaining', v_c.amount - v_new_paid
  );
END;
$$;

REVOKE ALL ON FUNCTION public.pay_contribution(UUID, NUMERIC) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.pay_contribution(UUID, NUMERIC) TO authenticated;
