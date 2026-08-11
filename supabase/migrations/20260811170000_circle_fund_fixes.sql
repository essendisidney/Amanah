-- Circle fund: accurate loan totals + pocket deposit/withdraw RPC

CREATE OR REPLACE FUNCTION public.table_banking_fund(p_jamiya_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_contrib NUMERIC;
  v_penalties NUMERIC;
  v_lent NUMERIC;
  v_repaid NUMERIC;
  v_outstanding NUMERIC;
  v_overdue NUMERIC;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'UNAUTHENTICATED');
  END IF;
  IF NOT (private.is_circle_admin(p_jamiya_id) OR private.is_jamiya_member(p_jamiya_id)) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'FORBIDDEN');
  END IF;

  SELECT COALESCE(SUM(amount_paid), 0) INTO v_contrib
  FROM public.contributions WHERE jamiya_id = p_jamiya_id;

  SELECT COALESCE(SUM(amount), 0) INTO v_penalties
  FROM public.penalties WHERE jamiya_id = p_jamiya_id AND status = 'paid';

  -- Only count loans that actually left the pool (not requested/rejected/cancelled)
  SELECT
    COALESCE(SUM(amount), 0),
    COALESCE(SUM(amount_repaid), 0),
    COALESCE(SUM(GREATEST(amount - amount_repaid, 0))
      FILTER (WHERE status IN ('active', 'defaulted')), 0),
    COALESCE(SUM(CASE
      WHEN status IN ('active', 'defaulted')
        AND due_date < CURRENT_DATE
        AND amount_repaid < amount
      THEN GREATEST(amount - amount_repaid, 0)
      ELSE 0 END), 0)
  INTO v_lent, v_repaid, v_outstanding, v_overdue
  FROM public.qard_loans
  WHERE jamiya_id = p_jamiya_id
    AND status IN ('active', 'repaid', 'defaulted');

  RETURN jsonb_build_object(
    'ok', true,
    'jamiya_id', p_jamiya_id,
    'member_contributions', v_contrib,
    'penalties_received', v_penalties,
    'lent_out', v_lent,
    'repaid', v_repaid,
    'outstanding', v_outstanding,
    'overdue', v_overdue,
    'available_to_lend', GREATEST(v_contrib + v_penalties + v_repaid - v_lent, 0),
    'portfolio_at_risk_pct',
      CASE WHEN v_outstanding > 0
        THEN ROUND((v_overdue / NULLIF(v_outstanding, 0)) * 100, 1)
        ELSE 0 END
  );
END;
$$;

REVOKE ALL ON FUNCTION public.table_banking_fund(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.table_banking_fund(UUID) TO authenticated;

CREATE OR REPLACE FUNCTION public.move_savings_pocket(
  p_pocket_id UUID,
  p_amount NUMERIC,
  p_direction TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_p public.savings_pockets%ROWTYPE;
  v_m public.members%ROWTYPE;
  v_key TEXT;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'UNAUTHENTICATED');
  END IF;
  IF p_amount IS NULL OR p_amount <= 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'INVALID_AMOUNT');
  END IF;
  IF p_direction NOT IN ('deposit', 'withdraw') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'INVALID_DIRECTION');
  END IF;

  SELECT * INTO v_p FROM public.savings_pockets WHERE id = p_pocket_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'NOT_FOUND');
  END IF;

  SELECT * INTO v_m FROM public.members WHERE id = v_p.member_id;
  IF v_m.user_id IS NULL OR (v_m.user_id <> v_uid AND NOT private.is_circle_admin(v_p.jamiya_id)) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'FORBIDDEN');
  END IF;

  v_key := 'pocket_' || p_direction || ':' || p_pocket_id::text || ':' || gen_random_uuid()::text;

  IF p_direction = 'deposit' THEN
    PERFORM private.ledger_debit(
      v_m.user_id, v_p.currency, p_amount, 'contribution'::public.transaction_type,
      v_p.jamiya_id, 'savings_pocket', v_key,
      jsonb_build_object('kind', 'pocket_deposit', 'category', v_p.category)
    );
    UPDATE public.savings_pockets
    SET balance = balance + p_amount, updated_at = NOW()
    WHERE id = p_pocket_id;
  ELSE
    IF v_p.balance < p_amount THEN
      RETURN jsonb_build_object('ok', false, 'error', 'INSUFFICIENT_POCKET');
    END IF;
    UPDATE public.savings_pockets
    SET balance = balance - p_amount, updated_at = NOW()
    WHERE id = p_pocket_id;
    PERFORM private.ledger_credit(
      v_m.user_id, v_p.currency, p_amount, 'payout'::public.transaction_type,
      v_p.jamiya_id, 'savings_pocket', v_key,
      jsonb_build_object('kind', 'pocket_withdraw', 'category', v_p.category)
    );
  END IF;

  RETURN jsonb_build_object('ok', true, 'balance', (
    SELECT balance FROM public.savings_pockets WHERE id = p_pocket_id
  ));
END;
$$;

REVOKE ALL ON FUNCTION public.move_savings_pocket(UUID, NUMERIC, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.move_savings_pocket(UUID, NUMERIC, TEXT) TO authenticated;
