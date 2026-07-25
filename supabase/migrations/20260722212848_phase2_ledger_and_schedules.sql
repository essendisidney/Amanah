-- Phase 2: Ledger mutations, schedule generation, settlement, late marking
-- Wallet writes remain locked to SECURITY DEFINER functions only.

-- ---------------------------------------------------------------------------
-- Ledger: credit wallet (top-up / payout)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION private.ledger_credit(
  p_user_id UUID,
  p_currency CHAR(3),
  p_amount NUMERIC,
  p_type public.transaction_type,
  p_jamiya_id UUID DEFAULT NULL,
  p_reference TEXT DEFAULT NULL,
  p_idempotency_key TEXT DEFAULT NULL,
  p_metadata JSONB DEFAULT '{}'::jsonb
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_wallet public.wallets%ROWTYPE;
  v_tx_id UUID;
BEGIN
  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'INVALID_AMOUNT';
  END IF;

  IF p_idempotency_key IS NOT NULL THEN
    SELECT id INTO v_tx_id FROM public.transactions WHERE idempotency_key = p_idempotency_key;
    IF FOUND THEN
      RETURN v_tx_id;
    END IF;
  END IF;

  SELECT * INTO v_wallet
  FROM public.wallets
  WHERE user_id = p_user_id AND currency = p_currency
  FOR UPDATE;

  IF NOT FOUND THEN
    INSERT INTO public.wallets (user_id, currency, balance, available_balance)
    VALUES (p_user_id, p_currency, 0, 0)
    RETURNING * INTO v_wallet;
  END IF;

  UPDATE public.wallets
  SET
    balance = balance + p_amount,
    available_balance = available_balance + p_amount,
    updated_at = NOW()
  WHERE id = v_wallet.id;

  INSERT INTO public.transactions (
    wallet_id, user_id, jamiya_id, type, status, amount, currency,
    direction, reference, idempotency_key, metadata, processed_at
  )
  VALUES (
    v_wallet.id, p_user_id, p_jamiya_id, p_type, 'completed', p_amount, p_currency,
    'credit', p_reference, p_idempotency_key, COALESCE(p_metadata, '{}'::jsonb), NOW()
  )
  RETURNING id INTO v_tx_id;

  RETURN v_tx_id;
END;
$$;

CREATE OR REPLACE FUNCTION private.ledger_debit(
  p_user_id UUID,
  p_currency CHAR(3),
  p_amount NUMERIC,
  p_type public.transaction_type,
  p_jamiya_id UUID DEFAULT NULL,
  p_reference TEXT DEFAULT NULL,
  p_idempotency_key TEXT DEFAULT NULL,
  p_metadata JSONB DEFAULT '{}'::jsonb
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_wallet public.wallets%ROWTYPE;
  v_tx_id UUID;
BEGIN
  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'INVALID_AMOUNT';
  END IF;

  IF p_idempotency_key IS NOT NULL THEN
    SELECT id INTO v_tx_id FROM public.transactions WHERE idempotency_key = p_idempotency_key;
    IF FOUND THEN
      RETURN v_tx_id;
    END IF;
  END IF;

  SELECT * INTO v_wallet
  FROM public.wallets
  WHERE user_id = p_user_id AND currency = p_currency
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'WALLET_NOT_FOUND';
  END IF;

  IF v_wallet.available_balance < p_amount THEN
    RAISE EXCEPTION 'INSUFFICIENT_FUNDS';
  END IF;

  UPDATE public.wallets
  SET
    balance = balance - p_amount,
    available_balance = available_balance - p_amount,
    updated_at = NOW()
  WHERE id = v_wallet.id;

  INSERT INTO public.transactions (
    wallet_id, user_id, jamiya_id, type, status, amount, currency,
    direction, reference, idempotency_key, metadata, processed_at
  )
  VALUES (
    v_wallet.id, p_user_id, p_jamiya_id, p_type, 'completed', p_amount, p_currency,
    'debit', p_reference, p_idempotency_key, COALESCE(p_metadata, '{}'::jsonb), NOW()
  )
  RETURNING id INTO v_tx_id;

  RETURN v_tx_id;
END;
$$;

-- ---------------------------------------------------------------------------
-- Public: wallet top-up (simulated funding for Phase 2)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.wallet_top_up(
  p_amount NUMERIC,
  p_currency CHAR(3) DEFAULT 'KES',
  p_idempotency_key TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_tx UUID;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'UNAUTHENTICATED');
  END IF;
  IF p_amount IS NULL OR p_amount < 100 OR p_amount > 10000000 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'INVALID_AMOUNT');
  END IF;

  v_tx := private.ledger_credit(
    v_uid, p_currency, p_amount, 'wallet_top_up', NULL,
    'top_up', p_idempotency_key, jsonb_build_object('source', 'simulated')
  );

  INSERT INTO public.audit_logs (actor_id, action, entity_type, entity_id, metadata)
  VALUES (v_uid, 'create', 'transaction', v_tx, jsonb_build_object('type', 'wallet_top_up', 'amount', p_amount));

  RETURN jsonb_build_object('ok', true, 'transaction_id', v_tx);
END;
$$;

-- ---------------------------------------------------------------------------
-- Generate contribution + payout schedules and activate circle
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.activate_jamiya(p_jamiya_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_jamiya public.jamiyas%ROWTYPE;
  v_member RECORD;
  v_cycle INT;
  v_due DATE;
  v_start DATE;
  v_contrib_count INT := 0;
  v_payout_count INT := 0;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'UNAUTHENTICATED');
  END IF;

  IF NOT private.is_circle_admin(p_jamiya_id) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'FORBIDDEN');
  END IF;

  SELECT * INTO v_jamiya FROM public.jamiyas WHERE id = p_jamiya_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'NOT_FOUND');
  END IF;

  IF v_jamiya.status = 'active' THEN
    RETURN jsonb_build_object('ok', true, 'already_active', true);
  END IF;

  IF v_jamiya.member_count < 2 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'NOT_ENOUGH_MEMBERS');
  END IF;

  -- Ensure every active member has a payout position
  v_cycle := 1;
  FOR v_member IN
    SELECT * FROM public.members
    WHERE jamiya_id = p_jamiya_id AND status = 'active'
    ORDER BY payout_position NULLS LAST, created_at
  LOOP
    IF v_member.payout_position IS NULL THEN
      UPDATE public.members SET payout_position = v_cycle, updated_at = NOW()
      WHERE id = v_member.id;
    END IF;
    v_cycle := v_cycle + 1;
  END LOOP;

  v_start := COALESCE(v_jamiya.start_date, CURRENT_DATE);

  -- Contributions: one per active member per cycle (1..cycle_count)
  FOR v_cycle IN 1..v_jamiya.cycle_count LOOP
    v_due := v_start + ((v_cycle - 1) * v_jamiya.contribution_frequency_days);

    FOR v_member IN
      SELECT * FROM public.members
      WHERE jamiya_id = p_jamiya_id AND status = 'active'
    LOOP
      INSERT INTO public.contributions (
        jamiya_id, member_id, cycle_number, amount, currency, status, due_date
      )
      VALUES (
        p_jamiya_id, v_member.id, v_cycle, v_jamiya.contribution_amount,
        v_jamiya.currency, 'pending', v_due
      )
      ON CONFLICT (member_id, cycle_number) DO NOTHING;
      v_contrib_count := v_contrib_count + 1;
    END LOOP;
  END LOOP;

  -- Payouts: one recipient per cycle by payout_position
  FOR v_member IN
    SELECT * FROM public.members
    WHERE jamiya_id = p_jamiya_id AND status = 'active' AND payout_position IS NOT NULL
    ORDER BY payout_position
  LOOP
    IF v_member.payout_position > v_jamiya.cycle_count THEN
      CONTINUE;
    END IF;
    v_due := v_start + ((v_member.payout_position - 1) * v_jamiya.contribution_frequency_days);
    INSERT INTO public.payouts (
      jamiya_id, member_id, cycle_number, amount, currency, status, scheduled_date
    )
    VALUES (
      p_jamiya_id,
      v_member.id,
      v_member.payout_position,
      v_jamiya.contribution_amount * v_jamiya.member_count,
      v_jamiya.currency,
      'scheduled',
      v_due
    )
    ON CONFLICT (jamiya_id, cycle_number) DO NOTHING;
    v_payout_count := v_payout_count + 1;
  END LOOP;

  UPDATE public.jamiyas
  SET status = 'active', current_cycle = 1, start_date = v_start, updated_at = NOW()
  WHERE id = p_jamiya_id;

  INSERT INTO public.audit_logs (actor_id, action, entity_type, entity_id, jamiya_id, metadata)
  VALUES (
    v_uid, 'update', 'jamiya', p_jamiya_id, p_jamiya_id,
    jsonb_build_object('activated', true, 'contributions', v_contrib_count, 'payouts', v_payout_count)
  );

  INSERT INTO public.notifications (user_id, type, channel, title, body, data)
  SELECT
    m.user_id,
    'system',
    'in_app',
    'Circle activated',
    v_jamiya.name || ' is now active. Contributions are on the schedule.',
    jsonb_build_object('jamiya_id', p_jamiya_id, 'slug', v_jamiya.slug)
  FROM public.members m
  WHERE m.jamiya_id = p_jamiya_id AND m.status = 'active';

  RETURN jsonb_build_object(
    'ok', true,
    'contributions_created', v_contrib_count,
    'payouts_created', v_payout_count
  );
END;
$$;

-- ---------------------------------------------------------------------------
-- Pay a contribution from the caller's wallet
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.pay_contribution(p_contribution_id UUID)
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
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'UNAUTHENTICATED');
  END IF;

  SELECT * INTO v_c FROM public.contributions WHERE id = p_contribution_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'NOT_FOUND');
  END IF;

  IF v_c.status NOT IN ('pending', 'late') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'NOT_PAYABLE');
  END IF;

  SELECT * INTO v_member FROM public.members WHERE id = v_c.member_id;
  IF v_member.user_id <> v_uid THEN
    RETURN jsonb_build_object('ok', false, 'error', 'FORBIDDEN');
  END IF;

  BEGIN
    v_tx := private.ledger_debit(
      v_uid, v_c.currency, v_c.amount, 'contribution', v_c.jamiya_id,
      'contribution:' || v_c.id::text,
      'pay_contribution:' || v_c.id::text,
      jsonb_build_object('contribution_id', v_c.id, 'cycle', v_c.cycle_number)
    );
  EXCEPTION
    WHEN OTHERS THEN
      IF SQLERRM = 'INSUFFICIENT_FUNDS' THEN
        RETURN jsonb_build_object('ok', false, 'error', 'INSUFFICIENT_FUNDS');
      END IF;
      RAISE;
  END;

  UPDATE public.contributions
  SET status = 'paid', paid_at = NOW(), transaction_id = v_tx, updated_at = NOW()
  WHERE id = v_c.id;

  INSERT INTO public.notifications (user_id, type, channel, title, body, data)
  SELECT
    m.user_id,
    'contribution_received',
    'in_app',
    'Contribution received',
    'A member paid cycle ' || v_c.cycle_number || ' contribution.',
    jsonb_build_object('jamiya_id', v_c.jamiya_id, 'contribution_id', v_c.id)
  FROM public.members m
  WHERE m.jamiya_id = v_c.jamiya_id
    AND m.role = 'circle_admin'
    AND m.status = 'active';

  RETURN jsonb_build_object('ok', true, 'transaction_id', v_tx);
END;
$$;

-- ---------------------------------------------------------------------------
-- Settle a payout when all contributions for that cycle are paid
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.settle_payout(p_payout_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_p public.payouts%ROWTYPE;
  v_member public.members%ROWTYPE;
  v_unpaid INT;
  v_tx UUID;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'UNAUTHENTICATED');
  END IF;

  SELECT * INTO v_p FROM public.payouts WHERE id = p_payout_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'NOT_FOUND');
  END IF;

  IF NOT (private.is_circle_admin(v_p.jamiya_id) OR private.is_platform_admin()) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'FORBIDDEN');
  END IF;

  IF v_p.status NOT IN ('scheduled', 'processing') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'NOT_SETTLEABLE');
  END IF;

  SELECT COUNT(*) INTO v_unpaid
  FROM public.contributions
  WHERE jamiya_id = v_p.jamiya_id
    AND cycle_number = v_p.cycle_number
    AND status NOT IN ('paid', 'waived');

  IF v_unpaid > 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'CYCLE_INCOMPLETE', 'unpaid', v_unpaid);
  END IF;

  SELECT * INTO v_member FROM public.members WHERE id = v_p.member_id;

  UPDATE public.payouts SET status = 'processing', updated_at = NOW() WHERE id = v_p.id;

  v_tx := private.ledger_credit(
    v_member.user_id, v_p.currency, v_p.amount, 'payout', v_p.jamiya_id,
    'payout:' || v_p.id::text,
    'settle_payout:' || v_p.id::text,
    jsonb_build_object('payout_id', v_p.id, 'cycle', v_p.cycle_number)
  );

  UPDATE public.payouts
  SET status = 'paid', paid_at = NOW(), transaction_id = v_tx, updated_at = NOW()
  WHERE id = v_p.id;

  UPDATE public.jamiyas
  SET current_cycle = GREATEST(current_cycle, v_p.cycle_number), updated_at = NOW()
  WHERE id = v_p.jamiya_id;

  INSERT INTO public.notifications (user_id, type, channel, title, body, data)
  VALUES (
    v_member.user_id,
    'payout_paid',
    'in_app',
    'Payout received',
    'Your cycle ' || v_p.cycle_number || ' payout has been credited to your wallet.',
    jsonb_build_object('payout_id', v_p.id, 'jamiya_id', v_p.jamiya_id)
  );

  INSERT INTO public.audit_logs (actor_id, action, entity_type, entity_id, jamiya_id, metadata)
  VALUES (v_uid, 'approve', 'payout', v_p.id, v_p.jamiya_id, jsonb_build_object('transaction_id', v_tx));

  RETURN jsonb_build_object('ok', true, 'transaction_id', v_tx);
END;
$$;

-- ---------------------------------------------------------------------------
-- Mark overdue contributions as late (callable by edge/cron / admins)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.mark_late_contributions()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_count INT;
BEGIN
  UPDATE public.contributions
  SET status = 'late', updated_at = NOW()
  WHERE status = 'pending'
    AND due_date < CURRENT_DATE;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN jsonb_build_object('ok', true, 'updated', v_count);
END;
$$;

-- ---------------------------------------------------------------------------
-- Service-role settle (for Edge Function batch settlement; no auth.uid())
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.service_settle_payout(p_payout_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_p public.payouts%ROWTYPE;
  v_member public.members%ROWTYPE;
  v_unpaid INT;
  v_tx UUID;
BEGIN
  -- Only callable with service_role JWT (auth.role() = service_role)
  IF coalesce(auth.role(), '') <> 'service_role' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'FORBIDDEN');
  END IF;

  SELECT * INTO v_p FROM public.payouts WHERE id = p_payout_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'NOT_FOUND');
  END IF;

  IF v_p.status NOT IN ('scheduled', 'processing') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'NOT_SETTLEABLE');
  END IF;

  SELECT COUNT(*) INTO v_unpaid
  FROM public.contributions
  WHERE jamiya_id = v_p.jamiya_id
    AND cycle_number = v_p.cycle_number
    AND status NOT IN ('paid', 'waived');

  IF v_unpaid > 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'CYCLE_INCOMPLETE', 'unpaid', v_unpaid);
  END IF;

  SELECT * INTO v_member FROM public.members WHERE id = v_p.member_id;

  UPDATE public.payouts SET status = 'processing', updated_at = NOW() WHERE id = v_p.id;

  v_tx := private.ledger_credit(
    v_member.user_id, v_p.currency, v_p.amount, 'payout', v_p.jamiya_id,
    'payout:' || v_p.id::text,
    'settle_payout:' || v_p.id::text,
    jsonb_build_object('payout_id', v_p.id, 'cycle', v_p.cycle_number, 'source', 'service')
  );

  UPDATE public.payouts
  SET status = 'paid', paid_at = NOW(), transaction_id = v_tx, updated_at = NOW()
  WHERE id = v_p.id;

  UPDATE public.jamiyas
  SET current_cycle = GREATEST(current_cycle, v_p.cycle_number), updated_at = NOW()
  WHERE id = v_p.jamiya_id;

  INSERT INTO public.notifications (user_id, type, channel, title, body, data)
  VALUES (
    v_member.user_id,
    'payout_paid',
    'in_app',
    'Payout received',
    'Your cycle ' || v_p.cycle_number || ' payout has been credited to your wallet.',
    jsonb_build_object('payout_id', v_p.id, 'jamiya_id', v_p.jamiya_id)
  );

  INSERT INTO public.audit_logs (actor_id, action, entity_type, entity_id, jamiya_id, metadata)
  VALUES (NULL, 'approve', 'payout', v_p.id, v_p.jamiya_id, jsonb_build_object('transaction_id', v_tx, 'source', 'service'));

  RETURN jsonb_build_object('ok', true, 'transaction_id', v_tx);
END;
$$;

-- ---------------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------------
REVOKE ALL ON FUNCTION public.wallet_top_up(NUMERIC, CHAR, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.activate_jamiya(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.pay_contribution(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.settle_payout(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.mark_late_contributions() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.service_settle_payout(UUID) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.wallet_top_up(NUMERIC, CHAR, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.activate_jamiya(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.pay_contribution(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.settle_payout(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.mark_late_contributions() TO authenticated;
GRANT EXECUTE ON FUNCTION public.mark_late_contributions() TO service_role;
GRANT EXECUTE ON FUNCTION public.service_settle_payout(UUID) TO service_role;

-- Realtime for notifications (idempotent)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'notifications'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
  END IF;
END $$;
