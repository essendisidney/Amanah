-- Circle fees are never silently skipped.
--
-- A circle's transaction_fee_amount is taken from the member's wallet once a
-- contribution is fully paid. Before this migration:
--   * complete_payment_intent (M-Pesa) swallowed any error from the fee debit, so a
--     wallet that could not cover the fee meant no fee and no record;
--   * charge_contribution_fee (web, after a wallet payment) returned an error the app
--     ignored, with the same result;
--   * pay_contribution (mobile API, and pay_contribution_ahead) never charged it.
--
-- Now every path calls private.charge_circle_fee: it charges the fee when the wallet's
-- spendable balance (available minus pending withdrawals) covers it, and otherwise
-- records it in fees_owed and tells the member. Owed fees are collected automatically
-- the next time money comes in through complete_payment_intent, and before a
-- withdrawal. A fee is never charged or recorded twice for the same contribution.

-- ---------------------------------------------------------------------------
-- Fees owed
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.fees_owed (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  jamiya_id UUID REFERENCES public.jamiyas(id) ON DELETE SET NULL,
  contribution_id UUID REFERENCES public.contributions(id) ON DELETE SET NULL,
  kind TEXT NOT NULL DEFAULT 'contribution_fee' CHECK (kind IN ('contribution_fee')),
  amount NUMERIC(14,2) NOT NULL CHECK (amount > 0),
  currency CHAR(3) NOT NULL DEFAULT 'KES',
  status TEXT NOT NULL DEFAULT 'owed' CHECK (status IN ('owed', 'collected', 'waived')),
  transaction_id UUID REFERENCES public.transactions(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  collected_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS fees_owed_contribution_kind_unique
  ON public.fees_owed (contribution_id, kind)
  WHERE contribution_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS fees_owed_user_status_idx
  ON public.fees_owed (user_id, status, created_at);

ALTER TABLE public.fees_owed ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.fees_owed FROM anon;

DROP POLICY IF EXISTS fees_owed_select_own ON public.fees_owed;
CREATE POLICY fees_owed_select_own ON public.fees_owed
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR private.is_platform_admin());

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------
-- What the member can spend now: available balance less pending withdrawals.
-- Locks the wallet row so a concurrent debit cannot slip in between.
CREATE OR REPLACE FUNCTION private.wallet_spendable(p_user_id UUID, p_currency CHAR(3))
RETURNS NUMERIC
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  v_available NUMERIC;
  v_reserved NUMERIC;
BEGIN
  SELECT available_balance INTO v_available
  FROM public.wallets
  WHERE user_id = p_user_id AND currency = p_currency
  FOR UPDATE;

  SELECT coalesce(sum(amount), 0) INTO v_reserved
  FROM public.withdrawal_requests
  WHERE user_id = p_user_id
    AND currency = p_currency
    AND status IN ('pending', 'processing');

  RETURN greatest(coalesce(v_available, 0) - v_reserved, 0);
END;
$$;

-- Charge the circle fee for a fully paid contribution, or record it as owed.
-- Never raises for a short wallet; never charges or records the same fee twice.
CREATE OR REPLACE FUNCTION private.charge_circle_fee(p_contribution_id UUID, p_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  v_c public.contributions%ROWTYPE;
  v_j public.jamiyas%ROWTYPE;
  v_fee NUMERIC;
  v_tx UUID;
  v_owed public.fees_owed%ROWTYPE;
BEGIN
  SELECT * INTO v_c FROM public.contributions WHERE id = p_contribution_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('fee_status', 'none');
  END IF;
  -- The fee is due once the contribution is fully paid, not before.
  IF v_c.status <> 'paid' THEN
    RETURN jsonb_build_object('fee_status', 'not_due');
  END IF;

  SELECT * INTO v_j FROM public.jamiyas WHERE id = v_c.jamiya_id;
  v_fee := coalesce(v_j.transaction_fee_amount, 0);
  IF v_fee <= 0 THEN
    RETURN jsonb_build_object('fee_status', 'none');
  END IF;

  SELECT id INTO v_tx
  FROM public.transactions t
  WHERE t.user_id = p_user_id
    AND t.reference = 'contrib_fee:' || v_c.id::text
    AND t.status = 'completed'
  LIMIT 1;
  IF FOUND THEN
    RETURN jsonb_build_object('fee_status', 'charged', 'already', true, 'transaction_id', v_tx);
  END IF;

  SELECT * INTO v_owed
  FROM public.fees_owed
  WHERE contribution_id = v_c.id AND kind = 'contribution_fee';
  IF FOUND THEN
    RETURN jsonb_build_object('fee_status', v_owed.status, 'already', true, 'fee', v_owed.amount);
  END IF;

  IF private.wallet_spendable(p_user_id, v_j.currency) >= v_fee THEN
    v_tx := private.ledger_debit(
      p_user_id,
      v_j.currency,
      v_fee,
      'fee'::public.transaction_type,
      v_j.id,
      'contrib_fee:' || v_c.id::text,
      v_c.id::text,
      jsonb_build_object('kind', 'contribution_fee', 'contribution_id', v_c.id)
    );
    RETURN jsonb_build_object('fee_status', 'charged', 'fee', v_fee, 'transaction_id', v_tx);
  END IF;

  INSERT INTO public.fees_owed (user_id, jamiya_id, contribution_id, kind, amount, currency)
  VALUES (p_user_id, v_j.id, v_c.id, 'contribution_fee', v_fee, v_j.currency);

  INSERT INTO public.notifications (user_id, type, channel, title, body, data)
  VALUES (
    p_user_id,
    'system',
    'in_app',
    'Circle fee owed',
    'Your ' || v_fee::text || ' ' || v_j.currency || ' fee for ' || v_j.name || ', cycle '
      || v_c.cycle_number || ', will be taken from your next deposit.',
    jsonb_build_object(
      'kind', 'contribution_fee_owed',
      'jamiya_id', v_j.id,
      'contribution_id', v_c.id,
      'amount', v_fee
    )
  );

  RETURN jsonb_build_object('fee_status', 'owed', 'fee', v_fee);
END;
$$;

-- Take owed fees, oldest first, while the spendable balance covers them.
CREATE OR REPLACE FUNCTION private.collect_fees_owed(p_user_id UUID, p_currency CHAR(3))
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  r public.fees_owed%ROWTYPE;
  v_tx UUID;
  v_collected INT := 0;
BEGIN
  FOR r IN
    SELECT * FROM public.fees_owed
    WHERE user_id = p_user_id AND currency = p_currency AND status = 'owed'
    ORDER BY created_at, id
    FOR UPDATE SKIP LOCKED
  LOOP
    IF private.wallet_spendable(p_user_id, p_currency) < r.amount THEN
      CONTINUE;
    END IF;

    v_tx := private.ledger_debit(
      p_user_id,
      r.currency,
      r.amount,
      'fee'::public.transaction_type,
      r.jamiya_id,
      'contrib_fee:' || r.contribution_id::text,
      coalesce(r.contribution_id::text, 'fees_owed:' || r.id::text),
      jsonb_build_object(
        'kind', 'contribution_fee',
        'contribution_id', r.contribution_id,
        'fees_owed_id', r.id
      )
    );

    UPDATE public.fees_owed
    SET status = 'collected', transaction_id = v_tx, collected_at = NOW(), updated_at = NOW()
    WHERE id = r.id;

    v_collected := v_collected + 1;
  END LOOP;

  RETURN v_collected;
END;
$$;

REVOKE ALL ON FUNCTION private.wallet_spendable(UUID, CHAR(3)) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION private.charge_circle_fee(UUID, UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION private.collect_fees_owed(UUID, CHAR(3)) FROM PUBLIC, anon, authenticated;

-- ---------------------------------------------------------------------------
-- complete_payment_intent: charge via the helper; collect owed fees after money comes in
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.complete_payment_intent(p_intent_id uuid, p_provider_reference text DEFAULT NULL::text, p_checkout_request_id text DEFAULT NULL::text, p_metadata jsonb DEFAULT '{}'::jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $$
DECLARE
  v_intent public.payment_intents%ROWTYPE;
  v_tx UUID;
  v_kind TEXT;
  v_tip_id UUID;
BEGIN
  IF coalesce(auth.role(), '') NOT IN ('service_role', 'authenticated') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'FORBIDDEN');
  END IF;

  SELECT * INTO v_intent FROM public.payment_intents WHERE id = p_intent_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'NOT_FOUND');
  END IF;

  IF v_intent.status = 'completed' THEN
    PERFORM private.post_journal_for_payment_intent(v_intent.id);
    RETURN jsonb_build_object(
      'ok', true,
      'already_completed', true,
      'transaction_id', v_intent.transaction_id
    );
  END IF;

  IF v_intent.status NOT IN ('pending', 'processing') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'NOT_COMPLETABLE');
  END IF;

  IF auth.role() = 'authenticated' THEN
    IF auth.uid() IS DISTINCT FROM v_intent.user_id OR v_intent.provider <> 'simulated' THEN
      RETURN jsonb_build_object('ok', false, 'error', 'FORBIDDEN');
    END IF;
  END IF;

  v_kind := coalesce(v_intent.metadata->>'kind', 'wallet_top_up');

  IF v_kind = 'contribution' THEN
    DECLARE
      v_contribution_id UUID := nullif(v_intent.metadata->>'contribution_id', '')::uuid;
      v_c public.contributions%ROWTYPE;
      v_member public.members%ROWTYPE;
      v_j public.jamiyas%ROWTYPE;
      v_remaining NUMERIC;
      v_pay NUMERIC;
      v_new_paid NUMERIC;
      v_new_status public.contribution_status;
      v_credit_tx UUID;
      v_debit_tx UUID;
      v_fee NUMERIC;
    BEGIN
      IF v_contribution_id IS NULL OR v_intent.user_id IS NULL THEN
        RETURN jsonb_build_object('ok', false, 'error', 'CONTRIBUTION_REQUIRED');
      END IF;

      SELECT * INTO v_c FROM public.contributions WHERE id = v_contribution_id FOR UPDATE;
      IF NOT FOUND THEN
        RETURN jsonb_build_object('ok', false, 'error', 'NOT_FOUND');
      END IF;

      IF v_c.status NOT IN ('pending', 'late', 'partial') THEN
        RETURN jsonb_build_object('ok', false, 'error', 'NOT_PAYABLE');
      END IF;

      SELECT * INTO v_member FROM public.members WHERE id = v_c.member_id;
      IF v_member.user_id IS DISTINCT FROM v_intent.user_id THEN
        RETURN jsonb_build_object('ok', false, 'error', 'FORBIDDEN');
      END IF;

      IF v_c.currency IS DISTINCT FROM v_intent.currency THEN
        RETURN jsonb_build_object('ok', false, 'error', 'CURRENCY_MISMATCH');
      END IF;

      v_remaining := v_c.amount - coalesce(v_c.amount_paid, 0);
      IF v_remaining <= 0 THEN
        RETURN jsonb_build_object('ok', false, 'error', 'ALREADY_PAID');
      END IF;

      v_pay := LEAST(v_intent.amount, v_remaining);

      v_credit_tx := private.ledger_credit(
        v_intent.user_id,
        v_intent.currency,
        v_intent.amount,
        'wallet_top_up',
        NULL,
        coalesce(p_provider_reference, 'payment_intent:' || v_intent.id::text),
        'payment_intent:' || v_intent.id::text,
        jsonb_build_object(
          'payment_intent_id', v_intent.id,
          'provider', v_intent.provider,
          'kind', 'contribution'
        ) || coalesce(p_metadata, '{}'::jsonb)
      );

      v_debit_tx := private.ledger_debit(
        v_intent.user_id,
        v_c.currency,
        v_pay,
        'contribution',
        v_c.jamiya_id,
        'contribution:' || v_c.id::text || ':' || v_intent.id::text,
        'pay_contribution_stk:' || v_intent.id::text,
        jsonb_build_object(
          'contribution_id', v_c.id,
          'cycle', v_c.cycle_number,
          'payment_intent_id', v_intent.id,
          'amount', v_pay
        )
      );

      v_new_paid := coalesce(v_c.amount_paid, 0) + v_pay;
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
        transaction_id = v_debit_tx,
        updated_at = NOW()
      WHERE id = v_c.id;

      INSERT INTO public.contribution_payments (
        contribution_id, transaction_id, amount, currency, created_by, payment_method, notes
      ) VALUES (
        v_c.id,
        v_debit_tx,
        v_pay,
        v_c.currency,
        v_intent.user_id,
        'external',
        'STK via payment_intent ' || v_intent.id::text
      );

      IF v_new_status = 'paid' THEN
        PERFORM private.charge_circle_fee(v_c.id, v_intent.user_id);
      END IF;

      UPDATE public.payment_intents
      SET
        status = 'completed',
        provider_reference = coalesce(p_provider_reference, provider_reference),
        checkout_request_id = coalesce(p_checkout_request_id, checkout_request_id),
        transaction_id = v_credit_tx,
        completed_at = NOW(),
        settlement_status = 'unsettled',
        reconcile_status = 'open',
        metadata = metadata || coalesce(p_metadata, '{}'::jsonb) ||
          jsonb_build_object(
            'contribution_id', v_c.id,
            'debit_transaction_id', v_debit_tx,
            'contribution_status', v_new_status,
            'jamiya_id', v_c.jamiya_id
          ),
        updated_at = NOW()
      WHERE id = v_intent.id;

      PERFORM private.bridge_contribution_to_cashbook(
        v_c.id, v_pay, v_intent.id, v_debit_tx
      );
      PERFORM private.post_journal_for_payment_intent(v_intent.id);

      INSERT INTO public.notifications (user_id, type, channel, title, body, data)
      VALUES (
        v_intent.user_id,
        'system',
        'in_app',
        CASE WHEN v_new_status = 'paid' THEN 'Contribution paid' ELSE 'Partial contribution paid' END,
        'Cycle ' || v_c.cycle_number || ': ' || v_pay::text || ' ' || v_c.currency
          || ' paid (' || v_new_paid::text || '/' || v_c.amount::text || ').',
        jsonb_build_object(
          'jamiya_id', v_c.jamiya_id,
          'contribution_id', v_c.id,
          'payment_intent_id', v_intent.id,
          'status', v_new_status
        )
      );

      INSERT INTO public.notifications (user_id, type, channel, title, body, data)
      SELECT
        m.user_id,
        'contribution_received',
        'in_app',
        CASE WHEN v_new_status = 'paid' THEN 'Contribution fully paid' ELSE 'Partial contribution received' END,
        'Cycle ' || v_c.cycle_number || ': ' || v_pay::text || ' ' || v_c.currency
          || ' paid (' || v_new_paid::text || '/' || v_c.amount::text || ').',
        jsonb_build_object(
          'jamiya_id', v_c.jamiya_id,
          'contribution_id', v_c.id,
          'amount', v_pay,
          'amount_paid', v_new_paid,
          'status', v_new_status
        )
      FROM public.members m
      WHERE m.jamiya_id = v_c.jamiya_id
        AND m.role = 'circle_admin'
        AND m.status = 'active';

      PERFORM private.collect_fees_owed(v_intent.user_id, v_intent.currency);

      RETURN jsonb_build_object(
        'ok', true,
        'kind', 'contribution',
        'contribution_id', v_c.id,
        'transaction_id', v_credit_tx,
        'debit_transaction_id', v_debit_tx,
        'status', v_new_status,
        'amount_paid', v_new_paid
      );
    END;
  END IF;

  IF v_kind = 'sponsorship' THEN
    DECLARE
      v_charge_id UUID := nullif(v_intent.metadata->>'charge_id', '')::uuid;
      v_sponsorship_id UUID := nullif(v_intent.metadata->>'sponsorship_id', '')::uuid;
    BEGIN
      IF v_charge_id IS NOT NULL THEN
        UPDATE public.sponsorship_charges
        SET status = 'paid', charged_at = NOW()
        WHERE id = v_charge_id AND status IN ('pending', 'failed');
      END IF;
      IF v_sponsorship_id IS NOT NULL THEN
        UPDATE public.sponsorships
        SET next_charge_date = CURRENT_DATE + 30,
            updated_at = NOW()
        WHERE id = v_sponsorship_id AND status = 'active';
      END IF;

      UPDATE public.payment_intents
      SET
        status = 'completed',
        provider_reference = coalesce(p_provider_reference, provider_reference),
        checkout_request_id = coalesce(p_checkout_request_id, checkout_request_id),
        completed_at = NOW(),
        settlement_status = 'unsettled',
        reconcile_status = 'open',
        metadata = metadata || coalesce(p_metadata, '{}'::jsonb),
        updated_at = NOW()
      WHERE id = v_intent.id;

      PERFORM private.post_journal_for_payment_intent(v_intent.id);

      IF v_intent.user_id IS NOT NULL THEN
        INSERT INTO public.notifications (user_id, type, channel, title, body, data)
        VALUES (
          v_intent.user_id, 'system', 'in_app',
          'Sponsorship payment received',
          'JazakAllah khair. Your monthly sponsorship of ' ||
            v_intent.amount::text || ' ' || v_intent.currency || ' was recorded.',
          jsonb_build_object(
            'sponsorship_id', v_sponsorship_id,
            'charge_id', v_charge_id
          )
        );
      END IF;

      RETURN jsonb_build_object(
        'ok', true,
        'kind', 'sponsorship',
        'charge_id', v_charge_id,
        'sponsorship_id', v_sponsorship_id
      );
    END;
  END IF;

  IF v_kind = 'sadaka' THEN
    IF v_intent.metadata->>'campaign_id' IS NULL THEN
      RETURN jsonb_build_object('ok', false, 'error', 'CAMPAIGN_REQUIRED');
    END IF;

    DECLARE
      v_c public.charity_campaigns%ROWTYPE;
      v_fee NUMERIC := 0;
      v_net NUMERIC;
      v_receipt TEXT;
      v_donation_id UUID;
      v_campaign_id UUID := (v_intent.metadata->>'campaign_id')::uuid;
    BEGIN
      SELECT * INTO v_c FROM public.charity_campaigns WHERE id = v_campaign_id FOR UPDATE;
      IF NOT FOUND OR v_c.status <> 'live' THEN
        RETURN jsonb_build_object('ok', false, 'error', 'CAMPAIGN_UNAVAILABLE');
      END IF;

      IF v_c.fee_mode = 'donation_addon' THEN
        v_fee := round(v_intent.amount * v_c.fee_bps / 10000.0, 2);
        v_net := v_intent.amount;
      ELSIF v_c.fee_mode = 'donation_deduct' THEN
        v_fee := round(v_intent.amount * v_c.fee_bps / 10000.0, 2);
        v_net := v_intent.amount - v_fee;
      ELSE
        v_net := v_intent.amount;
      END IF;

      v_receipt := 'AMA-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 10));

      INSERT INTO public.charity_donations (
        campaign_id, donor_user_id, donor_name, donor_phone, donor_email,
        amount, fee_amount, currency, receipt_code, is_anonymous, payment_intent_id
      ) VALUES (
        v_campaign_id, v_intent.user_id,
        v_intent.metadata->>'donor_name',
        coalesce(v_intent.phone, v_intent.metadata->>'donor_phone'),
        v_intent.metadata->>'donor_email',
        v_net, v_fee, v_c.currency, v_receipt,
        coalesce((v_intent.metadata->>'is_anonymous')::boolean, false),
        v_intent.id
      ) RETURNING id INTO v_donation_id;

      UPDATE public.charity_campaigns
      SET raised_amount = raised_amount + v_net
      WHERE id = v_campaign_id;

      UPDATE public.payment_intents
      SET
        status = 'completed',
        provider_reference = coalesce(p_provider_reference, provider_reference),
        checkout_request_id = coalesce(p_checkout_request_id, checkout_request_id),
        completed_at = NOW(),
        settlement_status = 'unsettled',
        reconcile_status = 'open',
        metadata = metadata || coalesce(p_metadata, '{}'::jsonb) ||
          jsonb_build_object('donation_id', v_donation_id, 'receipt_code', v_receipt),
        updated_at = NOW()
      WHERE id = v_intent.id;

      PERFORM private.post_journal_for_payment_intent(v_intent.id);

      IF v_intent.user_id IS NOT NULL THEN
        INSERT INTO public.notifications (user_id, type, channel, title, body, data)
        VALUES (
          v_intent.user_id, 'system', 'in_app',
          'Donation receipt ' || v_receipt,
          'JazakAllah khair. Your gift of ' || v_net || ' ' || v_c.currency ||
            ' to ' || v_c.title || ' was recorded.',
          jsonb_build_object('donation_id', v_donation_id, 'receipt', v_receipt)
        );
      END IF;

      RETURN jsonb_build_object(
        'ok', true,
        'kind', 'sadaka',
        'donation_id', v_donation_id,
        'receipt_code', v_receipt
      );
    END;
  END IF;

  IF v_kind = 'platform_tip' THEN
    INSERT INTO public.platform_tips (user_id, amount, currency, phone, payment_intent_id)
    VALUES (v_intent.user_id, v_intent.amount, v_intent.currency, v_intent.phone, v_intent.id)
    RETURNING id INTO v_tip_id;

    UPDATE public.payment_intents
    SET
      status = 'completed',
      provider_reference = coalesce(p_provider_reference, provider_reference),
      checkout_request_id = coalesce(p_checkout_request_id, checkout_request_id),
      completed_at = NOW(),
      settlement_status = 'unsettled',
      reconcile_status = 'open',
      metadata = metadata || coalesce(p_metadata, '{}'::jsonb) || jsonb_build_object('tip_id', v_tip_id),
      updated_at = NOW()
    WHERE id = v_intent.id;

    PERFORM private.post_journal_for_payment_intent(v_intent.id);

    RETURN jsonb_build_object('ok', true, 'kind', 'platform_tip', 'tip_id', v_tip_id);
  END IF;

  v_tx := private.ledger_credit(
    v_intent.user_id,
    v_intent.currency,
    v_intent.amount,
    'wallet_top_up',
    NULL,
    coalesce(p_provider_reference, 'payment_intent:' || v_intent.id::text),
    'payment_intent:' || v_intent.id::text,
    jsonb_build_object(
      'payment_intent_id', v_intent.id,
      'provider', v_intent.provider
    ) || coalesce(p_metadata, '{}'::jsonb)
  );

  UPDATE public.payment_intents
  SET
    status = 'completed',
    provider_reference = coalesce(p_provider_reference, provider_reference),
    checkout_request_id = coalesce(p_checkout_request_id, checkout_request_id),
    transaction_id = v_tx,
    completed_at = NOW(),
    settlement_status = 'unsettled',
    reconcile_status = 'open',
    metadata = metadata || coalesce(p_metadata, '{}'::jsonb),
    updated_at = NOW()
  WHERE id = v_intent.id;

  PERFORM private.post_journal_for_payment_intent(v_intent.id);

  INSERT INTO public.notifications (user_id, type, channel, title, body, data)
  VALUES (
    v_intent.user_id,
    'system',
    'in_app',
    'Wallet topped up',
    'Your wallet was credited after a successful payment.',
    jsonb_build_object('payment_intent_id', v_intent.id, 'transaction_id', v_tx)
  );

  PERFORM private.collect_fees_owed(v_intent.user_id, v_intent.currency);

  RETURN jsonb_build_object('ok', true, 'transaction_id', v_tx);
END;
$$;

-- ---------------------------------------------------------------------------
-- pay_contribution (and pay_contribution_ahead, which calls it): charge the fee here,
-- so the mobile API gets it too
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.pay_contribution(p_contribution_id uuid, p_amount numeric DEFAULT NULL::numeric)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
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

  IF v_new_status = 'paid' THEN
    PERFORM private.charge_circle_fee(v_c.id, v_uid);
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'transaction_id', v_tx,
    'status', v_new_status,
    'amount_paid', v_new_paid,
    'remaining', v_c.amount - v_new_paid
  );
END;
$$;

-- ---------------------------------------------------------------------------
-- charge_contribution_fee (web, after a wallet payment): same helper
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.charge_contribution_fee(p_contribution_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_c public.contributions%ROWTYPE;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'UNAUTHENTICATED');
  END IF;

  SELECT * INTO v_c FROM public.contributions WHERE id = p_contribution_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'NOT_FOUND');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.members m
    WHERE m.id = v_c.member_id AND m.user_id = v_uid
  ) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'FORBIDDEN');
  END IF;

  -- Charged now if the wallet covers it, otherwise recorded as owed.
  RETURN jsonb_build_object('ok', true) || private.charge_circle_fee(p_contribution_id, v_uid);
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('ok', false, 'error', SQLERRM);
END;
$$;

-- ---------------------------------------------------------------------------
-- request_withdrawal: collect owed fees first
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.request_withdrawal(p_amount numeric, p_currency character DEFAULT 'KES'::bpchar, p_destination_type text DEFAULT 'mpesa'::text, p_destination_phone text DEFAULT NULL::text, p_bank_name text DEFAULT NULL::text, p_bank_account_name text DEFAULT NULL::text, p_bank_account_number text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_req public.withdrawal_requests%ROWTYPE;
  v_kyc TEXT;
  v_risk INT := 0;
  v_dest public.user_payout_destinations%ROWTYPE;
  v_phone TEXT;
  v_available NUMERIC := 0;
  v_reserved NUMERIC := 0;
  v_left NUMERIC := 0;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'UNAUTHENTICATED');
  END IF;
  IF p_amount IS NULL OR p_amount < 100 OR p_amount > 5000000 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'INVALID_AMOUNT');
  END IF;
  IF p_destination_type NOT IN ('mpesa', 'bank') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'INVALID_DESTINATION');
  END IF;

  -- Fees the member already owes come out before money leaves the platform.
  PERFORM private.collect_fees_owed(v_uid, p_currency);

  IF p_destination_type = 'mpesa' THEN
    SELECT * INTO v_dest
    FROM public.user_payout_destinations
    WHERE user_id = v_uid
      AND kind = 'mpesa'
      AND verified_at IS NOT NULL
      AND (
        (p_destination_phone IS NOT NULL AND phone = p_destination_phone)
        OR (p_destination_phone IS NULL AND is_default)
      )
    ORDER BY is_default DESC, verified_at DESC
    LIMIT 1;

    IF NOT FOUND THEN
      SELECT coalesce(nullif(trim(mpesa_phone), ''), nullif(trim(phone), ''))
      INTO v_phone
      FROM public.profiles
      WHERE id = v_uid;

      IF v_phone IS NULL OR v_phone !~ '^[+][1-9][0-9]{7,14}$' THEN
        RETURN jsonb_build_object('ok', false, 'error', 'DESTINATION_REQUIRED');
      END IF;

      IF p_destination_phone IS NOT NULL AND p_destination_phone IS DISTINCT FROM v_phone THEN
        RETURN jsonb_build_object('ok', false, 'error', 'DESTINATION_MISMATCH');
      END IF;

      INSERT INTO public.user_payout_destinations (
        user_id, kind, label, phone, is_default, verified_at
      )
      VALUES (v_uid, 'mpesa', 'Primary M-Pesa', v_phone, true, NOW())
      RETURNING * INTO v_dest;
    ELSE
      v_phone := v_dest.phone;
      IF p_destination_phone IS NOT NULL AND p_destination_phone IS DISTINCT FROM v_phone THEN
        RETURN jsonb_build_object('ok', false, 'error', 'DESTINATION_MISMATCH');
      END IF;
    END IF;
  END IF;

  IF p_destination_type = 'bank' AND (
    p_bank_name IS NULL OR p_bank_account_number IS NULL OR p_bank_account_name IS NULL
  ) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'BANK_DETAILS_REQUIRED');
  END IF;

  SELECT kyc_status INTO v_kyc FROM public.profiles WHERE id = v_uid;
  IF v_kyc IS DISTINCT FROM 'approved' AND p_amount >= 20000 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'KYC_REQUIRED', 'kyc_status', v_kyc);
  END IF;

  SELECT score INTO v_risk FROM public.member_risk_scores WHERE user_id = v_uid;
  IF coalesce(v_risk, 0) >= 80 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'RISK_BLOCKED', 'score', v_risk);
  END IF;

  -- Serialize requests on this wallet. Open requests are not debited yet.
  SELECT available_balance INTO v_available
  FROM public.wallets
  WHERE user_id = v_uid AND currency = p_currency
  FOR UPDATE;

  SELECT coalesce(sum(amount), 0) INTO v_reserved
  FROM public.withdrawal_requests
  WHERE user_id = v_uid
    AND currency = p_currency
    AND status IN ('pending', 'processing');

  v_left := greatest(coalesce(v_available, 0) - v_reserved, 0);
  IF p_amount > v_left THEN
    RETURN jsonb_build_object(
      'ok', false,
      'error', 'INSUFFICIENT_FUNDS',
      'available', v_left
    );
  END IF;

  INSERT INTO public.withdrawal_requests (
    user_id, amount, currency, status, destination_type,
    destination_phone, bank_name, bank_account_name, bank_account_number,
    destination_id, metadata
  )
  VALUES (
    v_uid, p_amount, p_currency, 'pending', p_destination_type,
    CASE WHEN p_destination_type = 'mpesa' THEN v_phone ELSE p_destination_phone END,
    p_bank_name, p_bank_account_name, p_bank_account_number,
    CASE WHEN p_destination_type = 'mpesa' THEN v_dest.id ELSE NULL END,
    CASE
      WHEN p_destination_type = 'mpesa' THEN
        jsonb_build_object(
          'destination_locked', true,
          'destination_id', v_dest.id,
          'destination_phone', v_phone
        )
      ELSE '{}'::jsonb
    END
  )
  RETURNING * INTO v_req;

  INSERT INTO public.audit_logs (actor_id, action, entity_type, entity_id, metadata)
  VALUES (
    v_uid, 'create', 'withdrawal_request', v_req.id,
    jsonb_build_object(
      'amount', p_amount,
      'destination_type', p_destination_type,
      'destination_id', v_req.destination_id,
      'destination_phone', v_req.destination_phone
    )
  );

  INSERT INTO public.notifications (user_id, type, channel, title, body, data)
  VALUES (
    v_uid, 'system', 'in_app', 'Withdrawal requested',
    CASE
      WHEN p_destination_type = 'mpesa' THEN 'A Jameiyah admin sends this to your M-Pesa.'
      ELSE 'Your withdrawal request is pending processing.'
    END,
    jsonb_build_object('withdrawal_id', v_req.id)
  );

  RETURN jsonb_build_object(
    'ok', true,
    'withdrawal_id', v_req.id,
    'status', v_req.status,
    'destination_phone', v_req.destination_phone,
    'available', v_left - p_amount
  );
END;
$$;
