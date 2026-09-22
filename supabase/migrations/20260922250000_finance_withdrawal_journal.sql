-- Money-out journal: completed withdrawals debit wallet liability (2000)
-- and credit cash at platform (1100). Idempotent on (withdrawal_request, id).

CREATE OR REPLACE FUNCTION private.post_journal_for_withdrawal(p_withdrawal_id UUID)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_req public.withdrawal_requests%ROWTYPE;
  v_entry UUID;
  v_kind TEXT;
BEGIN
  SELECT * INTO v_req FROM public.withdrawal_requests WHERE id = p_withdrawal_id;
  IF NOT FOUND THEN
    RETURN NULL;
  END IF;
  IF v_req.status <> 'completed' THEN
    RETURN NULL;
  END IF;

  v_kind := coalesce(
    nullif(v_req.metadata->>'kind', ''),
    CASE
      WHEN v_req.destination_type ILIKE '%payout%' THEN 'payout_cashout'
      ELSE 'withdrawal'
    END
  );

  v_entry := private.post_balanced_journal(
    'withdrawal_request',
    v_req.id::text,
    'OPERATING',
    'Wallet withdrawal',
    v_req.currency,
    '2000',
    '1100',
    v_req.amount,
    NULL,
    NULL,
    v_req.user_id,
    jsonb_build_object(
      'kind', v_kind,
      'destination_type', v_req.destination_type,
      'provider_reference', v_req.provider_reference,
      'transaction_id', v_req.transaction_id
    ) || coalesce(v_req.metadata, '{}'::jsonb)
  );

  RETURN v_entry;
END;
$$;

CREATE OR REPLACE FUNCTION public.process_withdrawal(
  p_withdrawal_id UUID,
  p_approve BOOLEAN DEFAULT true,
  p_provider_reference TEXT DEFAULT NULL,
  p_error_message TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_req public.withdrawal_requests%ROWTYPE;
  v_tx UUID;
  v_journal UUID;
BEGIN
  IF coalesce(auth.role(), '') <> 'service_role' AND NOT private.is_compliance_or_admin() THEN
    RETURN jsonb_build_object('ok', false, 'error', 'FORBIDDEN');
  END IF;

  SELECT * INTO v_req FROM public.withdrawal_requests WHERE id = p_withdrawal_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'NOT_FOUND');
  END IF;
  IF v_req.status NOT IN ('pending', 'processing') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'NOT_PROCESSABLE');
  END IF;

  IF NOT p_approve THEN
    UPDATE public.withdrawal_requests
    SET status = 'cancelled', error_message = coalesce(p_error_message, 'Cancelled'), updated_at = NOW()
    WHERE id = v_req.id;
    RETURN jsonb_build_object('ok', true, 'status', 'cancelled');
  END IF;

  BEGIN
    v_tx := private.ledger_debit(
      v_req.user_id, v_req.currency, v_req.amount, 'wallet_withdrawal', NULL,
      coalesce(p_provider_reference, 'withdrawal:' || v_req.id::text),
      'withdrawal:' || v_req.id::text,
      jsonb_build_object('withdrawal_id', v_req.id, 'destination_type', v_req.destination_type)
    );
  EXCEPTION
    WHEN OTHERS THEN
      IF SQLERRM = 'INSUFFICIENT_FUNDS' THEN
        UPDATE public.withdrawal_requests
        SET status = 'failed', error_message = 'INSUFFICIENT_FUNDS', updated_at = NOW()
        WHERE id = v_req.id;
        RETURN jsonb_build_object('ok', false, 'error', 'INSUFFICIENT_FUNDS');
      END IF;
      RAISE;
  END;

  UPDATE public.withdrawal_requests
  SET
    status = 'completed',
    transaction_id = v_tx,
    provider_reference = coalesce(p_provider_reference, provider_reference),
    processed_at = NOW(),
    updated_at = NOW()
  WHERE id = v_req.id;

  v_journal := private.post_journal_for_withdrawal(v_req.id);

  INSERT INTO public.notifications (user_id, type, channel, title, body, data)
  VALUES (
    v_req.user_id, 'system', 'in_app', 'Withdrawal completed',
    'Funds have been sent to your destination.',
    jsonb_build_object('withdrawal_id', v_req.id, 'transaction_id', v_tx)
  );

  INSERT INTO public.audit_logs (actor_id, action, entity_type, entity_id, metadata)
  VALUES (
    v_uid, 'approve', 'withdrawal_request', v_req.id,
    jsonb_build_object('transaction_id', v_tx, 'journal_entry_id', v_journal)
  );

  RETURN jsonb_build_object(
    'ok', true,
    'transaction_id', v_tx,
    'journal_entry_id', v_journal,
    'status', 'completed'
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.backfill_withdrawal_journal(p_withdrawal_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_req public.withdrawal_requests%ROWTYPE;
  v_existing UUID;
  v_entry UUID;
BEGIN
  IF coalesce(auth.role(), '') <> 'service_role'
     AND (v_uid IS NULL OR NOT private.is_platform_admin()) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'FORBIDDEN');
  END IF;

  SELECT * INTO v_req FROM public.withdrawal_requests WHERE id = p_withdrawal_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'NOT_FOUND');
  END IF;
  IF v_req.status <> 'completed' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'NOT_COMPLETED', 'status', v_req.status);
  END IF;

  SELECT id INTO v_existing
  FROM public.journal_entries
  WHERE source_type = 'withdrawal_request' AND source_id = p_withdrawal_id::text;

  IF v_existing IS NOT NULL THEN
    RETURN jsonb_build_object(
      'ok', true,
      'action', 'already_posted',
      'journal_entry_id', v_existing,
      'withdrawal_id', p_withdrawal_id
    );
  END IF;

  v_entry := private.post_journal_for_withdrawal(p_withdrawal_id);
  IF v_entry IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'POST_FAILED');
  END IF;

  INSERT INTO public.audit_logs (actor_id, action, entity_type, entity_id, metadata)
  VALUES (
    v_uid,
    'update',
    'withdrawal_request',
    p_withdrawal_id,
    jsonb_build_object('event', 'finance.withdrawal_journal_backfill', 'journal_entry_id', v_entry)
  );

  RETURN jsonb_build_object(
    'ok', true,
    'action', 'posted',
    'journal_entry_id', v_entry,
    'withdrawal_id', p_withdrawal_id
  );
END;
$$;

REVOKE ALL ON FUNCTION public.backfill_withdrawal_journal(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.backfill_withdrawal_journal(UUID) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.backfill_missing_withdrawal_journals(p_limit INT DEFAULT 50)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_lim INT := greatest(1, least(coalesce(p_limit, 50), 200));
  v_row RECORD;
  v_posted INT := 0;
  v_skipped INT := 0;
  v_failed INT := 0;
  v_result JSONB;
  v_ids UUID[] := ARRAY[]::UUID[];
BEGIN
  IF coalesce(auth.role(), '') <> 'service_role'
     AND (v_uid IS NULL OR NOT private.is_platform_admin()) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'FORBIDDEN');
  END IF;

  FOR v_row IN
    SELECT wr.id
    FROM public.withdrawal_requests wr
    WHERE wr.status = 'completed'
      AND NOT EXISTS (
        SELECT 1 FROM public.journal_entries je
        WHERE je.source_type = 'withdrawal_request'
          AND je.source_id = wr.id::text
      )
    ORDER BY wr.processed_at ASC NULLS LAST, wr.created_at ASC
    LIMIT v_lim
  LOOP
    v_result := public.backfill_withdrawal_journal(v_row.id);
    IF coalesce((v_result->>'ok')::boolean, false) THEN
      IF v_result->>'action' = 'posted' THEN
        v_posted := v_posted + 1;
        v_ids := array_append(v_ids, v_row.id);
      ELSE
        v_skipped := v_skipped + 1;
      END IF;
    ELSE
      v_failed := v_failed + 1;
    END IF;
  END LOOP;

  RETURN jsonb_build_object(
    'ok', true,
    'posted', v_posted,
    'skipped', v_skipped,
    'failed', v_failed,
    'limit', v_lim,
    'withdrawal_ids', to_jsonb(v_ids)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.backfill_missing_withdrawal_journals(INT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.backfill_missing_withdrawal_journals(INT)
  TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.record_disbursement_settlement(
  p_withdrawal_id UUID,
  p_provider TEXT DEFAULT NULL,
  p_provider_reference TEXT DEFAULT NULL,
  p_metadata JSONB DEFAULT '{}'::jsonb
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_req public.withdrawal_requests%ROWTYPE;
  v_settlement_id UUID;
  v_provider TEXT;
  v_ref TEXT;
  v_minor BIGINT;
BEGIN
  IF coalesce(auth.role(), '') NOT IN ('service_role', 'authenticated') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'FORBIDDEN');
  END IF;
  IF auth.role() = 'authenticated' AND NOT private.is_platform_admin() THEN
    RETURN jsonb_build_object('ok', false, 'error', 'FORBIDDEN');
  END IF;

  SELECT * INTO v_req FROM public.withdrawal_requests WHERE id = p_withdrawal_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'NOT_FOUND');
  END IF;
  IF v_req.status <> 'completed' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'NOT_COMPLETED');
  END IF;

  v_provider := coalesce(
    nullif(trim(p_provider), ''),
    nullif(trim(v_req.metadata->>'disburse_provider'), ''),
    'simulated'
  );
  v_ref := nullif(trim(coalesce(p_provider_reference, v_req.provider_reference, '')), '');
  IF v_ref IS NULL THEN
    v_ref := 'withdrawal:' || v_req.id::text;
  END IF;
  v_minor := round(v_req.amount * 100)::bigint;

  SELECT id INTO v_settlement_id
  FROM public.settlements
  WHERE provider = v_provider AND provider_reference = v_ref
  LIMIT 1;

  IF FOUND THEN
    UPDATE public.settlements
    SET
      status = 'settled',
      settled_at = coalesce(settled_at, NOW()),
      metadata = metadata || jsonb_build_object('withdrawal_id', p_withdrawal_id)
        || coalesce(p_metadata, '{}'::jsonb),
      updated_at = NOW()
    WHERE id = v_settlement_id;
  ELSE
    INSERT INTO public.settlements (
      payment_intent_id, provider, provider_reference,
      amount, amount_minor, currency, status, settled_at, metadata
    ) VALUES (
      NULL, v_provider, v_ref,
      v_req.amount, v_minor, v_req.currency, 'settled', NOW(),
      jsonb_build_object('withdrawal_id', p_withdrawal_id, 'direction', 'disbursement')
        || coalesce(p_metadata, '{}'::jsonb)
    )
    RETURNING id INTO v_settlement_id;
  END IF;

  INSERT INTO public.provider_transactions (
    provider, provider_reference, payment_intent_id, direction,
    amount, amount_minor, currency, status, raw, observed_at
  ) VALUES (
    v_provider, v_ref, NULL, 'disbursement',
    v_req.amount, v_minor, v_req.currency, 'settled',
    jsonb_build_object('withdrawal_id', p_withdrawal_id) || coalesce(p_metadata, '{}'::jsonb),
    NOW()
  )
  ON CONFLICT (provider, provider_reference) DO UPDATE
  SET
    direction = 'disbursement',
    status = EXCLUDED.status,
    raw = EXCLUDED.raw,
    observed_at = NOW();

  RETURN jsonb_build_object('ok', true, 'settlement_id', v_settlement_id);
END;
$$;

REVOKE ALL ON FUNCTION public.record_disbursement_settlement(UUID, TEXT, TEXT, JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.record_disbursement_settlement(UUID, TEXT, TEXT, JSONB)
  TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.finance_integrity_snapshot()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_wallet_kes NUMERIC := 0;
  v_liability_credit NUMERIC := 0;
  v_liability_debit NUMERIC := 0;
  v_liability_net NUMERIC := 0;
  v_cash_1100_net NUMERIC := 0;
  v_missing_journal INT := 0;
  v_missing_settlement INT := 0;
  v_missing_wd_journal INT := 0;
  v_settlements_pending INT := 0;
  v_settlements_disputed INT := 0;
  v_unbalanced INT := 0;
  v_account_2000 UUID;
  v_account_1100 UUID;
BEGIN
  IF coalesce(auth.role(), '') <> 'service_role'
     AND NOT private.is_platform_admin() THEN
    RETURN jsonb_build_object('ok', false, 'error', 'FORBIDDEN');
  END IF;

  SELECT coalesce(sum(balance), 0)
  INTO v_wallet_kes
  FROM public.wallets
  WHERE currency = 'KES';

  SELECT id INTO v_account_2000
  FROM public.ledger_accounts
  WHERE code = '2000' AND is_active
  LIMIT 1;

  SELECT id INTO v_account_1100
  FROM public.ledger_accounts
  WHERE code = '1100' AND is_active
  LIMIT 1;

  IF v_account_2000 IS NOT NULL THEN
    SELECT
      coalesce(sum(CASE WHEN jl.side = 'credit' THEN jl.amount ELSE 0 END), 0),
      coalesce(sum(CASE WHEN jl.side = 'debit' THEN jl.amount ELSE 0 END), 0)
    INTO v_liability_credit, v_liability_debit
    FROM public.journal_lines jl
    WHERE jl.ledger_account_id = v_account_2000
      AND jl.currency = 'KES';
  END IF;

  v_liability_net := v_liability_credit - v_liability_debit;

  IF v_account_1100 IS NOT NULL THEN
    SELECT
      coalesce(sum(CASE WHEN jl.side = 'debit' THEN jl.amount ELSE 0 END), 0)
      - coalesce(sum(CASE WHEN jl.side = 'credit' THEN jl.amount ELSE 0 END), 0)
    INTO v_cash_1100_net
    FROM public.journal_lines jl
    WHERE jl.ledger_account_id = v_account_1100
      AND jl.currency = 'KES';
  END IF;

  SELECT count(*)::int INTO v_missing_journal
  FROM public.payment_intents pi
  WHERE pi.status = 'completed'
    AND NOT EXISTS (
      SELECT 1 FROM public.journal_entries je
      WHERE je.source_type = 'payment_intent'
        AND je.source_id = pi.id::text
    );

  SELECT count(*)::int INTO v_missing_settlement
  FROM public.payment_intents pi
  WHERE pi.status = 'completed'
    AND NOT EXISTS (
      SELECT 1 FROM public.settlements s
      WHERE s.payment_intent_id = pi.id
    );

  SELECT count(*)::int INTO v_missing_wd_journal
  FROM public.withdrawal_requests wr
  WHERE wr.status = 'completed'
    AND NOT EXISTS (
      SELECT 1 FROM public.journal_entries je
      WHERE je.source_type = 'withdrawal_request'
        AND je.source_id = wr.id::text
    );

  SELECT count(*)::int INTO v_settlements_pending
  FROM public.settlements WHERE status = 'pending';

  SELECT count(*)::int INTO v_settlements_disputed
  FROM public.settlements WHERE status = 'disputed';

  SELECT count(*)::int INTO v_unbalanced
  FROM (
    SELECT je.id
    FROM public.journal_entries je
    JOIN public.journal_lines jl ON jl.journal_entry_id = je.id
    GROUP BY je.id
    HAVING abs(
      coalesce(sum(CASE WHEN jl.side = 'debit' THEN jl.amount ELSE 0 END), 0)
      - coalesce(sum(CASE WHEN jl.side = 'credit' THEN jl.amount ELSE 0 END), 0)
    ) > 0.009
  ) bad;

  RETURN jsonb_build_object(
    'ok', true,
    'wallet_balances_kes', v_wallet_kes,
    'wallet_liability_journal_net_kes', v_liability_net,
    'wallet_vs_journal_delta_kes', round(v_wallet_kes - v_liability_net, 2),
    'cash_at_platform_1100_net_kes', round(v_cash_1100_net, 2),
    'completed_intents_missing_journal', v_missing_journal,
    'completed_intents_missing_settlement', v_missing_settlement,
    'completed_withdrawals_missing_journal', v_missing_wd_journal,
    'settlements_pending', v_settlements_pending,
    'settlements_disputed', v_settlements_disputed,
    'unbalanced_journal_entries', v_unbalanced,
    'checked_at', NOW()
  );
END;
$$;
