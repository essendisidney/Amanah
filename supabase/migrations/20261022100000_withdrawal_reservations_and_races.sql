-- Found by scripts/stress/run.mjs (many simultaneous calls against the money paths).
--
-- 1. Money set aside for a withdrawal could be spent again. request_withdrawal only reserves
--    (open requests are counted, not debited) but ledger_debit ignored reservations, so a
--    member could request a withdrawal of their whole balance and then pay a contribution,
--    welfare or a loan repayment from the same money. The payout sends M-Pesa first and
--    debits after (runWithdrawalDisbursement), so that debit then failed with the cash gone:
--    32 of 50 members in the stress run. ledger_debit now treats open withdrawals as spent,
--    like private.wallet_spendable already did for fees.
-- 2. Two withdrawal requests at once both tried to create the member's default M-Pesa
--    destination and one crashed on the unique index. The wallet is now locked first.
-- 3. Two members claiming the same payout slot at once: the loser got a raw unique-key error;
--    it now gets SLOT_TAKEN.

CREATE OR REPLACE FUNCTION private.ledger_debit(p_user_id uuid, p_currency character, p_amount numeric, p_type transaction_type, p_jamiya_id uuid DEFAULT NULL::uuid, p_reference text DEFAULT NULL::text, p_idempotency_key text DEFAULT NULL::text, p_metadata jsonb DEFAULT '{}'::jsonb)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v_wallet public.wallets%ROWTYPE;
  v_tx_id UUID;
  v_reserved NUMERIC := 0;
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

  -- Money set aside by open withdrawal requests is not spendable: the payout sends M-Pesa
  -- first and debits after, so spending it elsewhere would pay it out twice. Only the
  -- withdrawal's own debit may use it.
  IF p_type <> 'wallet_withdrawal' THEN
    SELECT coalesce(sum(amount), 0) INTO v_reserved
    FROM public.withdrawal_requests
    WHERE user_id = p_user_id
      AND currency = p_currency
      AND status IN ('pending', 'processing');
  END IF;

  IF v_wallet.available_balance - v_reserved < p_amount THEN
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
$function$;

CREATE OR REPLACE FUNCTION public.request_withdrawal(p_amount numeric, p_currency character DEFAULT 'KES'::bpchar, p_destination_type text DEFAULT 'mpesa'::text, p_destination_phone text DEFAULT NULL::text, p_bank_name text DEFAULT NULL::text, p_bank_account_name text DEFAULT NULL::text, p_bank_account_number text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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

  -- One request at a time per wallet, from the start: two taps on Withdraw must not both
  -- create the default M-Pesa destination (a unique-key crash) or both pass the balance check.
  PERFORM 1 FROM public.wallets WHERE user_id = v_uid AND currency = p_currency FOR UPDATE;

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
$function$;

CREATE OR REPLACE FUNCTION public.claim_payout_slot(p_jamiya_id uuid, p_payout_position integer)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v_uid UUID := auth.uid();
  v_jamiya public.jamiyas%ROWTYPE;
  v_member public.members%ROWTYPE;
  v_max_slot INTEGER;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'UNAUTHENTICATED');
  END IF;

  SELECT * INTO v_jamiya FROM public.jamiyas WHERE id = p_jamiya_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'NOT_FOUND');
  END IF;

  IF v_jamiya.status = 'active' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'CIRCLE_ALREADY_ACTIVE');
  END IF;

  IF COALESCE(v_jamiya.challenge_kind, 'rotating') IN ('savings', 'share_dividend') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'NOT_ROTATING');
  END IF;

  SELECT * INTO v_member
  FROM public.members
  WHERE jamiya_id = p_jamiya_id AND user_id = v_uid AND status = 'active'
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'NOT_MEMBER');
  END IF;

  v_max_slot := GREATEST(
    COALESCE(v_jamiya.cycle_count, v_jamiya.max_members),
    v_jamiya.max_members,
    1
  );

  IF p_payout_position IS NULL OR p_payout_position < 1 OR p_payout_position > v_max_slot THEN
    RETURN jsonb_build_object('ok', false, 'error', 'INVALID_SLOT');
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.members
    WHERE jamiya_id = p_jamiya_id
      AND payout_position = p_payout_position
      AND status = 'active'
      AND id <> v_member.id
  ) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'SLOT_TAKEN');
  END IF;

  -- Two members can pass the check above at once; the unique index decides, and the loser
  -- hears the slot is taken rather than getting a database error.
  BEGIN
    UPDATE public.members
    SET payout_position = p_payout_position, updated_at = NOW()
    WHERE id = v_member.id;
  EXCEPTION WHEN unique_violation THEN
    RETURN jsonb_build_object('ok', false, 'error', 'SLOT_TAKEN');
  END;

  RETURN jsonb_build_object(
    'ok', true,
    'payout_position', p_payout_position,
    'member_id', v_member.id
  );
END;
$function$;
