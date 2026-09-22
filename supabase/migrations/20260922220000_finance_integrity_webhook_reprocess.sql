-- Finance integrity helpers + webhook requeue for admin ops.

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

  -- Credit-normal liability: credits increase liability owed to members.
  v_liability_net := v_liability_credit - v_liability_debit;

  SELECT count(*)::int INTO v_missing_journal
  FROM public.payment_intents pi
  WHERE pi.status = 'completed'
    AND NOT EXISTS (
      SELECT 1 FROM public.journal_entries je
      WHERE je.source_type = 'payment_intent'
        AND je.source_id = pi.id::text
    );

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
    'unbalanced_journal_entries', v_unbalanced,
    'checked_at', NOW()
  );
END;
$$;

REVOKE ALL ON FUNCTION public.finance_integrity_snapshot() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.finance_integrity_snapshot() TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.requeue_webhook_event(p_event_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_row public.webhook_events%ROWTYPE;
BEGIN
  IF coalesce(auth.role(), '') <> 'service_role'
     AND NOT private.is_platform_admin() THEN
    RETURN jsonb_build_object('ok', false, 'error', 'FORBIDDEN');
  END IF;

  SELECT * INTO v_row FROM public.webhook_events WHERE id = p_event_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'NOT_FOUND');
  END IF;

  IF v_row.status NOT IN ('failed', 'received', 'ignored') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'NOT_REQUEUEABLE', 'status', v_row.status);
  END IF;

  UPDATE public.webhook_events
  SET
    status = 'received',
    error_message = NULL,
    processed_at = NULL
  WHERE id = p_event_id;

  RETURN jsonb_build_object('ok', true, 'id', p_event_id, 'provider', v_row.provider);
END;
$$;

REVOKE ALL ON FUNCTION public.requeue_webhook_event(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.requeue_webhook_event(UUID) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.reprocess_webhook_event(p_event_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_row public.webhook_events%ROWTYPE;
  v_state TEXT;
  v_intent UUID;
  v_ref TEXT;
  v_result JSONB;
BEGIN
  IF coalesce(auth.role(), '') <> 'service_role'
     AND NOT private.is_platform_admin() THEN
    RETURN jsonb_build_object('ok', false, 'error', 'FORBIDDEN');
  END IF;

  SELECT * INTO v_row FROM public.webhook_events WHERE id = p_event_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'NOT_FOUND');
  END IF;

  v_state := upper(coalesce(
    v_row.payload #>> '{invoice,state}',
    v_row.payload #>> '{invoice,status}',
    v_row.payload #>> '{data,state}',
    v_row.payload #>> '{data,status}',
    v_row.payload->>'state',
    v_row.payload->>'status',
    v_row.event_type,
    ''
  ));

  v_ref := coalesce(
    nullif(v_row.payload->>'reference', ''),
    nullif(v_row.payload->>'provider_reference', ''),
    nullif(v_row.payload #>> '{invoice,invoice_id}', ''),
    nullif(v_row.payload #>> '{invoice,id}', ''),
    nullif(v_row.external_id, ''),
    nullif(v_row.payload->>'invoice_id', ''),
    nullif(v_row.payload->>'tracking_id', '')
  );

  v_intent := coalesce(
    v_row.payment_intent_id,
    nullif(v_row.payload->>'intent_id', '')::uuid,
    nullif(v_row.payload->>'api_ref', '')::uuid,
    nullif(v_row.payload #>> '{invoice,api_ref}', '')::uuid
  );

  IF v_intent IS NULL THEN
    UPDATE public.webhook_events
    SET status = 'ignored', error_message = 'NO_INTENT', processed_at = NOW()
    WHERE id = p_event_id;
    RETURN jsonb_build_object('ok', false, 'error', 'NO_INTENT');
  END IF;

  IF v_state IN ('COMPLETE', 'COMPLETED', 'SUCCESS', 'PAID', 'SETTLED') THEN
    v_result := public.complete_payment_intent(
      v_intent,
      v_ref,
      v_ref,
      jsonb_build_object('source', 'webhook_reprocess', 'webhook_event_id', p_event_id)
    );
    IF coalesce((v_result->>'ok')::boolean, false)
       OR coalesce(v_result->>'error', '') IN ('ALREADY_COMPLETED', 'NOT_COMPLETABLE') THEN
      -- NOT_COMPLETABLE often means already settled; still mark matched when completed.
      IF EXISTS (
        SELECT 1 FROM public.payment_intents
        WHERE id = v_intent AND status = 'completed'
      ) THEN
        PERFORM public.mark_payment_intent_reconciled(v_intent, true);
      END IF;
      UPDATE public.webhook_events
      SET status = 'processed', error_message = NULL, processed_at = NOW(),
          payment_intent_id = v_intent
      WHERE id = p_event_id;
      RETURN jsonb_build_object('ok', true, 'action', 'settled', 'result', v_result);
    END IF;
    UPDATE public.webhook_events
    SET status = 'failed', error_message = coalesce(v_result->>'error', 'COMPLETE_FAILED'),
        processed_at = NOW()
    WHERE id = p_event_id;
    RETURN jsonb_build_object('ok', false, 'error', v_result->>'error', 'result', v_result);
  END IF;

  IF v_state IN ('FAILED', 'CANCELLED', 'CANCELED', 'REJECTED') THEN
    v_result := public.fail_payment_intent(v_intent, 'Webhook reprocess: ' || v_state);
    UPDATE public.webhook_events
    SET status = 'processed', error_message = NULL, processed_at = NOW(),
        payment_intent_id = v_intent
    WHERE id = p_event_id;
    RETURN jsonb_build_object('ok', true, 'action', 'failed', 'result', v_result);
  END IF;

  UPDATE public.webhook_events
  SET status = 'ignored', error_message = 'UNKNOWN_STATE:' || v_state, processed_at = NOW()
  WHERE id = p_event_id;
  RETURN jsonb_build_object('ok', false, 'error', 'UNKNOWN_STATE', 'state', v_state);
END;
$$;

REVOKE ALL ON FUNCTION public.reprocess_webhook_event(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.reprocess_webhook_event(UUID) TO authenticated, service_role;
