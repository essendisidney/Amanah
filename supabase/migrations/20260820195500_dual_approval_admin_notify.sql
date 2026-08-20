-- Notify other platform admins when dual approval is requested.
CREATE OR REPLACE FUNCTION public.propose_dual_approval(
  p_kind TEXT,
  p_entity_id UUID,
  p_amount NUMERIC,
  p_currency TEXT DEFAULT 'KES',
  p_jamiya_id UUID DEFAULT NULL,
  p_payload JSONB DEFAULT '{}'::jsonb
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_id UUID;
  v_existing public.dual_approval_requests%ROWTYPE;
  v_title TEXT;
  v_body TEXT;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'UNAUTHENTICATED');
  END IF;
  IF p_kind NOT IN ('withdrawal', 'payout_settle', 'qard_decide') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'INVALID_KIND');
  END IF;

  SELECT * INTO v_existing
  FROM public.dual_approval_requests
  WHERE kind = p_kind AND entity_id = p_entity_id AND status = 'pending'
  LIMIT 1;

  IF FOUND THEN
    IF v_existing.first_approver_id = v_uid OR v_existing.requested_by = v_uid THEN
      RETURN jsonb_build_object(
        'ok', true,
        'pending_dual_approval', true,
        'request_id', v_existing.id,
        'error', 'AWAITING_SECOND_APPROVER'
      );
    END IF;
    RETURN jsonb_build_object(
      'ok', true,
      'ready_for_second', true,
      'request_id', v_existing.id,
      'first_approver_id', v_existing.first_approver_id
    );
  END IF;

  INSERT INTO public.dual_approval_requests (
    jamiya_id, kind, entity_id, amount, currency, status,
    requested_by, first_approver_id, payload
  )
  VALUES (
    p_jamiya_id, p_kind, p_entity_id, coalesce(p_amount, 0),
    left(upper(coalesce(nullif(btrim(p_currency), ''), 'KES')), 3),
    'pending', v_uid, v_uid, coalesce(p_payload, '{}'::jsonb)
  )
  RETURNING id INTO v_id;

  INSERT INTO public.audit_logs (actor_id, action, entity_type, entity_id, metadata)
  VALUES (
    v_uid, 'create', 'dual_approval_request', v_id,
    jsonb_build_object('kind', p_kind, 'entity_id', p_entity_id, 'amount', p_amount)
  );

  v_title := CASE p_kind
    WHEN 'withdrawal' THEN 'Withdrawal needs second approval'
    WHEN 'payout_settle' THEN 'Payout settle needs second approval'
    ELSE 'Action needs second approval'
  END;
  v_body := format(
    'KES %s · open Money out to second-approve.',
    coalesce(p_amount, 0)::text
  );

  INSERT INTO public.notifications (user_id, type, channel, title, body, data)
  SELECT p.id, 'admin', 'in_app', v_title, v_body,
    jsonb_build_object(
      'dual_approval_id', v_id,
      'kind', p_kind,
      'entity_id', p_entity_id,
      'href', '/admin/withdrawals'
    )
  FROM public.profiles p
  WHERE p.platform_role IN ('platform_admin', 'super_admin', 'compliance_officer')
    AND p.id <> v_uid;

  RETURN jsonb_build_object(
    'ok', true,
    'pending_dual_approval', true,
    'request_id', v_id
  );
END;
$$;
