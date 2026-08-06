-- Phase 14–17: phone-first, referral auto-reward, qard reminder helpers

-- Auto-credit referral reward to referrer wallet when status becomes qualified
CREATE OR REPLACE FUNCTION public.reward_qualified_referrals(p_limit INT DEFAULT 50)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_row public.referrals%ROWTYPE;
  v_count INT := 0;
  v_amount NUMERIC(14, 2);
  v_currency CHAR(3);
  v_wallet UUID;
BEGIN
  FOR v_row IN
    SELECT *
    FROM public.referrals
    WHERE status = 'qualified'
    ORDER BY created_at
    LIMIT greatest(1, least(coalesce(p_limit, 50), 200))
    FOR UPDATE SKIP LOCKED
  LOOP
    v_amount := coalesce(nullif(v_row.reward_amount, 0), 50);
    v_currency := coalesce(v_row.currency, 'KES');

    SELECT id INTO v_wallet
    FROM public.wallets
    WHERE user_id = v_row.referrer_id AND currency = v_currency
    LIMIT 1;

    IF v_wallet IS NULL THEN
      INSERT INTO public.wallets (user_id, currency, balance, available_balance)
      VALUES (v_row.referrer_id, v_currency, 0, 0)
      RETURNING id INTO v_wallet;
    END IF;

    UPDATE public.wallets
    SET
      balance = balance + v_amount,
      available_balance = available_balance + v_amount,
      updated_at = NOW()
    WHERE id = v_wallet;

    INSERT INTO public.transactions (
      wallet_id, user_id, type, status, amount, currency, direction, reference, metadata
    )
    VALUES (
      v_wallet,
      v_row.referrer_id,
      'adjustment'::public.transaction_type,
      'completed'::public.transaction_status,
      v_amount,
      v_currency,
      'credit',
      'referral:' || v_row.id::text,
      jsonb_build_object('kind', 'referral_reward', 'referral_id', v_row.id, 'referee_id', v_row.referee_id)
    );

    UPDATE public.referrals
    SET status = 'rewarded'
    WHERE id = v_row.id;

    v_count := v_count + 1;
  END LOOP;

  RETURN jsonb_build_object('ok', true, 'rewarded', v_count);
END;
$$;

REVOKE ALL ON FUNCTION public.reward_qualified_referrals(INT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.reward_qualified_referrals(INT) TO service_role;

-- Improve mark_referral_rewarded to also credit wallet (admin manual path)
CREATE OR REPLACE FUNCTION public.mark_referral_rewarded(p_referral_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_row public.referrals%ROWTYPE;
  v_amount NUMERIC(14, 2);
  v_currency CHAR(3);
  v_wallet UUID;
BEGIN
  IF auth.uid() IS NULL OR NOT private.is_compliance_or_admin() THEN
    RETURN jsonb_build_object('ok', false, 'error', 'FORBIDDEN');
  END IF;

  SELECT * INTO v_row FROM public.referrals WHERE id = p_referral_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'NOT_FOUND');
  END IF;
  IF v_row.status = 'rewarded' THEN
    RETURN jsonb_build_object('ok', true, 'status', 'rewarded', 'already', true);
  END IF;
  IF v_row.status <> 'qualified' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'NOT_QUALIFIED');
  END IF;

  v_amount := coalesce(nullif(v_row.reward_amount, 0), 50);
  v_currency := coalesce(v_row.currency, 'KES');

  SELECT id INTO v_wallet
  FROM public.wallets
  WHERE user_id = v_row.referrer_id AND currency = v_currency
  LIMIT 1;

  IF v_wallet IS NULL THEN
    INSERT INTO public.wallets (user_id, currency, balance, available_balance)
    VALUES (v_row.referrer_id, v_currency, 0, 0)
    RETURNING id INTO v_wallet;
  END IF;

  UPDATE public.wallets
  SET
    balance = balance + v_amount,
    available_balance = available_balance + v_amount,
    updated_at = NOW()
  WHERE id = v_wallet;

  INSERT INTO public.transactions (
    wallet_id, user_id, type, status, amount, currency, direction, reference, metadata
  )
  VALUES (
    v_wallet,
    v_row.referrer_id,
    'adjustment'::public.transaction_type,
    'completed'::public.transaction_status,
    v_amount,
    v_currency,
    'credit',
    'referral:' || v_row.id::text,
    jsonb_build_object('kind', 'referral_reward', 'referral_id', v_row.id, 'manual', true)
  );

  UPDATE public.referrals SET status = 'rewarded' WHERE id = p_referral_id;
  RETURN jsonb_build_object('ok', true, 'status', 'rewarded', 'amount', v_amount);
END;
$$;

REVOKE ALL ON FUNCTION public.mark_referral_rewarded(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.mark_referral_rewarded(UUID) TO authenticated;

-- Officer-visible late dues helper (service + authenticated via RLS on tables)
CREATE OR REPLACE FUNCTION public.officer_circle_snapshot(p_jamiya_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_late INT;
  v_grace INT;
  v_role TEXT;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'UNAUTHENTICATED');
  END IF;

  SELECT m.role::text INTO v_role
  FROM public.members m
  WHERE m.jamiya_id = p_jamiya_id AND m.user_id = v_uid AND m.status = 'active';

  IF v_role IS NULL OR v_role NOT IN ('circle_admin', 'chair', 'treasurer', 'secretary') THEN
    IF NOT private.is_compliance_or_admin() THEN
      RETURN jsonb_build_object('ok', false, 'error', 'FORBIDDEN');
    END IF;
    v_role := coalesce(v_role, 'compliance');
  END IF;

  SELECT count(*)::int INTO v_late
  FROM public.contributions c
  WHERE c.jamiya_id = p_jamiya_id AND c.status = 'late';

  SELECT count(*)::int INTO v_grace
  FROM public.grace_period_requests g
  WHERE g.jamiya_id = p_jamiya_id AND g.status = 'pending';

  RETURN jsonb_build_object(
    'ok', true,
    'role', v_role,
    'late_count', coalesce(v_late, 0),
    'pending_grace', coalesce(v_grace, 0)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.officer_circle_snapshot(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.officer_circle_snapshot(UUID) TO authenticated;
