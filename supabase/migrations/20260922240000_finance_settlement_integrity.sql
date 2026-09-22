-- Settlement integrity: extend snapshot, batch backfill RPC, sync resolve → settlements.

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
  v_missing_journal INT := 0;
  v_missing_settlement INT := 0;
  v_settlements_pending INT := 0;
  v_settlements_disputed INT := 0;
  v_unbalanced INT := 0;
  v_account_2000 UUID;
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
    'completed_intents_missing_journal', v_missing_journal,
    'completed_intents_missing_settlement', v_missing_settlement,
    'settlements_pending', v_settlements_pending,
    'settlements_disputed', v_settlements_disputed,
    'unbalanced_journal_entries', v_unbalanced,
    'checked_at', NOW()
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.backfill_missing_settlements(p_limit INT DEFAULT 50)
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
  v_failed INT := 0;
  v_result JSONB;
  v_ids UUID[] := ARRAY[]::UUID[];
BEGIN
  IF coalesce(auth.role(), '') <> 'service_role'
     AND (v_uid IS NULL OR NOT private.is_platform_admin()) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'FORBIDDEN');
  END IF;

  FOR v_row IN
    SELECT pi.id
    FROM public.payment_intents pi
    WHERE pi.status = 'completed'
      AND NOT EXISTS (
        SELECT 1 FROM public.settlements s
        WHERE s.payment_intent_id = pi.id
      )
    ORDER BY pi.completed_at ASC NULLS LAST, pi.created_at ASC
    LIMIT v_lim
  LOOP
    v_result := public.record_settlement_for_intent(
      v_row.id,
      NULL,
      NULL,
      jsonb_build_object('source', 'settlement_backfill')
    );
    IF coalesce((v_result->>'ok')::boolean, false) THEN
      v_posted := v_posted + 1;
      v_ids := array_append(v_ids, v_row.id);
    ELSE
      v_failed := v_failed + 1;
    END IF;
  END LOOP;

  RETURN jsonb_build_object(
    'ok', true,
    'posted', v_posted,
    'failed', v_failed,
    'limit', v_lim,
    'payment_intent_ids', to_jsonb(v_ids)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.backfill_missing_settlements(INT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.backfill_missing_settlements(INT) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.resolve_payment_intent_exception(
  p_intent_id UUID,
  p_action TEXT DEFAULT 'match',
  p_note TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_row public.payment_intents%ROWTYPE;
  v_next_reconcile TEXT;
  v_next_settle TEXT;
  v_settlement_result JSONB;
  v_settlement_id UUID;
BEGIN
  IF coalesce(auth.role(), '') <> 'service_role'
     AND NOT private.is_platform_admin() THEN
    RETURN jsonb_build_object('ok', false, 'error', 'FORBIDDEN');
  END IF;

  IF p_action NOT IN ('match', 'manual', 'waive') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'INVALID_ACTION');
  END IF;

  SELECT * INTO v_row FROM public.payment_intents WHERE id = p_intent_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'NOT_FOUND');
  END IF;

  IF p_action = 'match' THEN
    v_next_reconcile := 'matched';
    v_next_settle := CASE
      WHEN v_row.settlement_status IN ('unsettled', 'disputed') THEN 'settled'
      ELSE v_row.settlement_status
    END;
  ELSIF p_action = 'manual' THEN
    v_next_reconcile := 'manual';
    v_next_settle := v_row.settlement_status;
  ELSE
    v_next_reconcile := 'manual';
    v_next_settle := 'waived';
  END IF;

  PERFORM private.assert_reconcile_status_transition(
    v_row.reconcile_status,
    v_next_reconcile
  );
  IF v_next_settle IS DISTINCT FROM v_row.settlement_status THEN
    PERFORM private.assert_settlement_status_transition(
      v_row.settlement_status,
      v_next_settle
    );
  END IF;

  UPDATE public.payment_intents
  SET
    reconcile_status = v_next_reconcile,
    settlement_status = v_next_settle,
    metadata = metadata || jsonb_build_object(
      'exception_resolved_at', NOW(),
      'exception_resolve_action', p_action,
      'exception_resolve_note', coalesce(p_note, p_action)
    ),
    updated_at = NOW()
  WHERE id = p_intent_id;

  -- Keep settlements / provider_transactions in sync with intent resolve.
  IF p_action = 'match' AND v_row.status = 'completed' THEN
    v_settlement_result := public.record_settlement_for_intent(
      p_intent_id,
      NULL,
      NULL,
      jsonb_build_object('source', 'resolve_match', 'note', coalesce(p_note, p_action))
    );
  ELSIF p_action = 'waive' THEN
    SELECT id INTO v_settlement_id
    FROM public.settlements
    WHERE payment_intent_id = p_intent_id
    ORDER BY created_at DESC
    LIMIT 1;

    IF v_settlement_id IS NOT NULL THEN
      UPDATE public.settlements
      SET
        status = CASE
          WHEN status IN ('pending', 'settled') THEN 'disputed'
          ELSE status
        END,
        metadata = metadata || jsonb_build_object(
          'waived_at', NOW(),
          'waive_note', coalesce(p_note, 'waive')
        ),
        updated_at = NOW()
      WHERE id = v_settlement_id;
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'reconcile_status', v_next_reconcile,
    'settlement_status', v_next_settle,
    'settlement_sync', v_settlement_result
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.mark_settlement_status(
  p_settlement_id UUID,
  p_status TEXT,
  p_note TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_row public.settlements%ROWTYPE;
BEGIN
  IF v_uid IS NULL OR NOT private.is_platform_admin() THEN
    RETURN jsonb_build_object('ok', false, 'error', 'FORBIDDEN');
  END IF;

  IF p_status NOT IN ('settled', 'failed', 'disputed') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'INVALID_STATUS');
  END IF;

  SELECT * INTO v_row FROM public.settlements WHERE id = p_settlement_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'NOT_FOUND');
  END IF;

  IF v_row.status = p_status THEN
    RETURN jsonb_build_object('ok', true, 'status', p_status, 'noop', true);
  END IF;

  -- Align with app state-machine: pending→*, settled→disputed, disputed→settled
  IF NOT (
    (v_row.status = 'pending' AND p_status IN ('settled', 'failed', 'disputed'))
    OR (v_row.status = 'settled' AND p_status = 'disputed')
    OR (v_row.status = 'disputed' AND p_status = 'settled')
  ) THEN
    RETURN jsonb_build_object(
      'ok', false,
      'error', 'ILLEGAL_TRANSITION',
      'from', v_row.status,
      'to', p_status
    );
  END IF;

  UPDATE public.settlements
  SET
    status = p_status,
    settled_at = CASE
      WHEN p_status = 'settled' THEN coalesce(settled_at, NOW())
      ELSE settled_at
    END,
    metadata = metadata || jsonb_build_object(
      'status_changed_at', NOW(),
      'status_changed_by', v_uid,
      'status_note', coalesce(p_note, p_status)
    ),
    updated_at = NOW()
  WHERE id = p_settlement_id;

  IF v_row.provider_reference IS NOT NULL THEN
    UPDATE public.provider_transactions
    SET status = p_status, observed_at = NOW()
    WHERE provider = v_row.provider
      AND provider_reference = v_row.provider_reference;
  END IF;

  INSERT INTO public.audit_logs (actor_id, action, entity_type, entity_id, metadata)
  VALUES (
    v_uid,
    'update',
    'settlement',
    p_settlement_id,
    jsonb_build_object(
      'event', 'finance.settlement_status',
      'from', v_row.status,
      'to', p_status,
      'note', coalesce(p_note, p_status)
    )
  );

  RETURN jsonb_build_object('ok', true, 'status', p_status, 'settlement_id', p_settlement_id);
END;
$$;

REVOKE ALL ON FUNCTION public.mark_settlement_status(UUID, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.mark_settlement_status(UUID, TEXT, TEXT)
  TO authenticated, service_role;
