-- Same withdrawal rules, with a phone pattern that does not use backslashes.
-- A Kenya number such as +2547… still matches.

CREATE OR REPLACE FUNCTION public.request_withdrawal(
  p_amount NUMERIC,
  p_currency CHAR(3) DEFAULT 'KES',
  p_destination_type TEXT DEFAULT 'mpesa',
  p_destination_phone TEXT DEFAULT NULL,
  p_bank_name TEXT DEFAULT NULL,
  p_bank_account_name TEXT DEFAULT NULL,
  p_bank_account_number TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
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

CREATE OR REPLACE FUNCTION public.pay_circle_dividend(
  p_dividend_id UUID,
  p_bank_account_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_div public.circle_dividends%ROWTYPE;
  v_bal NUMERIC;
  v_paid INT := 0;
  v_alloc RECORD;
  v_user UUID;
  v_tx UUID;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'UNAUTHENTICATED');
  END IF;

  SELECT * INTO v_div FROM public.circle_dividends WHERE id = p_dividend_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'NOT_FOUND');
  END IF;
  IF NOT (private.is_circle_officer(v_div.jamiya_id) OR private.is_platform_admin()) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'FORBIDDEN');
  END IF;
  IF v_div.status NOT IN ('allocated', 'paid') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'INVALID_STATUS');
  END IF;

  SELECT balance INTO v_bal
  FROM public.circle_bank_accounts
  WHERE id = p_bank_account_id AND jamiya_id = v_div.jamiya_id AND is_active
  FOR UPDATE;
  IF v_bal IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'ACCOUNT_NOT_FOUND');
  END IF;

  IF v_bal < (
    SELECT COALESCE(sum(amount), 0)
    FROM public.circle_dividend_allocations
    WHERE dividend_id = p_dividend_id AND status = 'allocated'
  ) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'INSUFFICIENT_BALANCE');
  END IF;

  FOR v_alloc IN
    SELECT *
    FROM public.circle_dividend_allocations
    WHERE dividend_id = p_dividend_id AND status = 'allocated'
    FOR UPDATE
  LOOP
    SELECT user_id INTO v_user
    FROM public.members
    WHERE id = v_alloc.member_id AND jamiya_id = v_div.jamiya_id;
    IF v_user IS NULL OR v_alloc.amount <= 0 THEN
      CONTINUE;
    END IF;

    UPDATE public.circle_bank_accounts
    SET balance = balance - v_alloc.amount, updated_at = NOW()
    WHERE id = p_bank_account_id;

    v_tx := private.ledger_credit(
      v_user,
      v_alloc.currency,
      v_alloc.amount,
      'payout'::public.transaction_type,
      v_div.jamiya_id,
      'dividend:' || v_alloc.id::text,
      'dividend:' || v_alloc.id::text,
      jsonb_build_object(
        'kind', 'circle_dividend',
        'dividend_id', p_dividend_id,
        'allocation_id', v_alloc.id,
        'label', v_div.label,
        'declared_total', v_div.total_amount
      )
    );

    INSERT INTO public.book_entries (
      jamiya_id, member_id, entry_type, amount, currency, effective_date, entered_by, notes,
      bank_account_id, metadata
    ) VALUES (
      v_div.jamiya_id, v_alloc.member_id, 'expense', v_alloc.amount, v_alloc.currency,
      CURRENT_DATE, v_uid, 'Dividend: ' || v_div.label,
      p_bank_account_id,
      jsonb_build_object(
        'source', 'dividend_payout',
        'dividend_id', p_dividend_id,
        'allocation_id', v_alloc.id,
        'wallet_tx', v_tx
      )
    );

    UPDATE public.circle_dividend_allocations
    SET status = 'paid'
    WHERE id = v_alloc.id;

    INSERT INTO public.notifications (user_id, type, channel, title, body, data)
    VALUES (
      v_user,
      'payout_paid'::public.notification_type,
      'in_app'::public.notification_channel,
      'Dividend paid',
      format(
        'Your share of %s is %s. The declared total was %s. No fee was taken.',
        v_div.label,
        v_alloc.amount::text,
        v_div.total_amount::text
      ),
      jsonb_build_object('jamiya_id', v_div.jamiya_id, 'dividend_id', p_dividend_id)
    );

    v_paid := v_paid + 1;
  END LOOP;

  IF NOT EXISTS (
    SELECT 1 FROM public.circle_dividend_allocations
    WHERE dividend_id = p_dividend_id AND status = 'allocated'
  ) THEN
    UPDATE public.circle_dividends SET status = 'paid' WHERE id = p_dividend_id;
  END IF;

  RETURN jsonb_build_object('ok', true, 'paid', v_paid, 'status', (
    SELECT status FROM public.circle_dividends WHERE id = p_dividend_id
  ));
END;
$$;
