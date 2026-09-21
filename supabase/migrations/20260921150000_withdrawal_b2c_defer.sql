-- Phase 3: Defer withdrawal ledger settle until after disbursePayment (B2C).

CREATE OR REPLACE FUNCTION public.confirm_dual_approval(
  p_request_id UUID,
  p_approve BOOLEAN DEFAULT TRUE
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_req public.dual_approval_requests%ROWTYPE;
  v_result JSONB;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'UNAUTHENTICATED');
  END IF;

  SELECT * INTO v_req
  FROM public.dual_approval_requests
  WHERE id = p_request_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'NOT_FOUND');
  END IF;
  IF v_req.status <> 'pending' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'NOT_PENDING', 'status', v_req.status);
  END IF;
  IF v_req.first_approver_id = v_uid THEN
    RETURN jsonb_build_object('ok', false, 'error', 'SECOND_APPROVER_MUST_DIFFER');
  END IF;

  IF v_req.kind = 'withdrawal' THEN
    IF NOT private.is_compliance_or_admin() THEN
      RETURN jsonb_build_object('ok', false, 'error', 'FORBIDDEN');
    END IF;
  ELSIF v_req.jamiya_id IS NOT NULL THEN
    IF NOT (private.is_circle_officer(v_req.jamiya_id) OR private.is_platform_admin()) THEN
      RETURN jsonb_build_object('ok', false, 'error', 'FORBIDDEN');
    END IF;
  ELSE
    RETURN jsonb_build_object('ok', false, 'error', 'FORBIDDEN');
  END IF;

  IF NOT p_approve THEN
    UPDATE public.dual_approval_requests
    SET status = 'rejected', second_approver_id = v_uid, updated_at = NOW(),
        result = jsonb_build_object('rejected', true)
    WHERE id = v_req.id;
    RETURN jsonb_build_object('ok', true, 'status', 'rejected');
  END IF;

  -- Withdrawals: approve dual control, but do not debit until B2C settles.
  IF v_req.kind = 'withdrawal' THEN
    UPDATE public.withdrawal_requests
    SET metadata = coalesce(metadata, '{}'::jsonb) ||
          jsonb_build_object(
            'dual_approved', true,
            'dual_approval_request_id', v_req.id
          ),
        updated_at = NOW()
    WHERE id = v_req.entity_id;

    v_result := jsonb_build_object(
      'ok', true,
      'ready_to_disburse', true,
      'withdrawal_id', v_req.entity_id
    );

    UPDATE public.dual_approval_requests
    SET
      status = 'approved',
      second_approver_id = v_uid,
      result = v_result,
      updated_at = NOW()
    WHERE id = v_req.id;

    INSERT INTO public.audit_logs (actor_id, action, entity_type, entity_id, metadata)
    VALUES (
      v_uid, 'approve', 'dual_approval_request', v_req.id,
      jsonb_build_object('result', v_result, 'deferred_b2c', true)
    );

    RETURN jsonb_build_object(
      'ok', true,
      'status', 'approved',
      'ready_to_disburse', true,
      'withdrawal_id', v_req.entity_id,
      'result', v_result,
      'request_id', v_req.id
    );
  END IF;

  IF v_req.kind = 'payout_settle' THEN
    v_result := public.settle_payout(v_req.entity_id);
  ELSIF v_req.kind = 'qard_decide' THEN
    v_result := public.decide_qard(
      v_req.entity_id,
      coalesce((v_req.payload->>'approve')::boolean, true)
    );
  ELSE
    RETURN jsonb_build_object('ok', false, 'error', 'INVALID_KIND');
  END IF;

  UPDATE public.dual_approval_requests
  SET
    status = CASE WHEN coalesce((v_result->>'ok')::boolean, false) THEN 'executed' ELSE 'approved' END,
    second_approver_id = v_uid,
    result = v_result,
    updated_at = NOW()
  WHERE id = v_req.id;

  INSERT INTO public.audit_logs (actor_id, action, entity_type, entity_id, metadata)
  VALUES (
    v_uid, 'approve', 'dual_approval_request', v_req.id,
    jsonb_build_object('result', v_result)
  );

  RETURN jsonb_build_object(
    'ok', coalesce((v_result->>'ok')::boolean, false),
    'status', 'executed',
    'result', v_result,
    'request_id', v_req.id
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.propose_process_withdrawal(
  p_withdrawal_id UUID,
  p_approve BOOLEAN DEFAULT TRUE,
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
  v_pending public.dual_approval_requests%ROWTYPE;
  v_dual JSONB;
BEGIN
  IF coalesce(auth.role(), '') <> 'service_role' AND NOT private.is_compliance_or_admin() THEN
    RETURN jsonb_build_object('ok', false, 'error', 'FORBIDDEN');
  END IF;

  SELECT * INTO v_req FROM public.withdrawal_requests WHERE id = p_withdrawal_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'NOT_FOUND');
  END IF;

  IF NOT p_approve THEN
    RETURN public.process_withdrawal(p_withdrawal_id, false, p_provider_reference, p_error_message);
  END IF;

  -- Webhook / service settle with a real provider reference.
  IF coalesce(auth.role(), '') = 'service_role'
     AND p_provider_reference IS NOT NULL
     AND p_provider_reference !~ '^(manual|b2c-pending):' THEN
    RETURN public.process_withdrawal(p_withdrawal_id, true, p_provider_reference, p_error_message);
  END IF;

  IF private.platform_withdrawal_dual_required(v_req.amount) THEN
    SELECT * INTO v_pending
    FROM public.dual_approval_requests
    WHERE kind = 'withdrawal' AND entity_id = p_withdrawal_id AND status = 'pending'
    LIMIT 1;

    IF FOUND AND v_pending.first_approver_id IS DISTINCT FROM v_uid THEN
      RETURN public.confirm_dual_approval(v_pending.id, true);
    END IF;

    v_dual := public.propose_dual_approval(
      'withdrawal',
      p_withdrawal_id,
      v_req.amount,
      v_req.currency,
      NULL,
      jsonb_build_object(
        'approve', true,
        'provider_reference', p_provider_reference,
        'error_message', p_error_message
      )
    );
    RETURN v_dual;
  END IF;

  -- No dual: M-Pesa cashouts are settled by the app via disbursePayment.
  IF v_req.destination_type = 'mpesa' THEN
    RETURN jsonb_build_object(
      'ok', true,
      'ready_to_disburse', true,
      'withdrawal_id', v_req.id
    );
  END IF;

  RETURN public.process_withdrawal(p_withdrawal_id, true, p_provider_reference, p_error_message);
END;
$$;
