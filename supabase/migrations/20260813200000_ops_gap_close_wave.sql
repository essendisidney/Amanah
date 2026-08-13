-- Ops gap close: SMS/WhatsApp invoice reminders, dual-approval, platform plans.
-- PDF branding is web print templates (no DB).

-- ---------------------------------------------------------------------------
-- 1) Delivery: allow WhatsApp + invoice SMS/WhatsApp fan-out
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION private.enqueue_delivery(
  p_channel public.notification_channel,
  p_recipient TEXT,
  p_subject TEXT,
  p_body TEXT,
  p_user_id UUID DEFAULT NULL,
  p_notification_id UUID DEFAULT NULL,
  p_metadata JSONB DEFAULT '{}'::jsonb
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_id UUID;
BEGIN
  IF p_channel NOT IN ('email', 'sms', 'push', 'whatsapp') THEN
    RAISE EXCEPTION 'INVALID_CHANNEL';
  END IF;
  IF p_recipient IS NULL OR length(trim(p_recipient)) = 0 THEN
    RETURN NULL;
  END IF;

  INSERT INTO public.notification_outbox (
    notification_id, user_id, channel, recipient, subject, body, metadata
  )
  VALUES (
    p_notification_id, p_user_id, p_channel, trim(p_recipient), p_subject, p_body,
    coalesce(p_metadata, '{}'::jsonb)
  )
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.enqueue_user_reminder(
  p_user_id UUID,
  p_type TEXT,
  p_title TEXT,
  p_body TEXT,
  p_dedupe_key TEXT,
  p_data JSONB DEFAULT '{}'::jsonb
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_profile public.profiles%ROWTYPE;
  v_claimed BOOLEAN;
  v_channels INT := 0;
  v_type public.notification_type;
  v_phone TEXT;
BEGIN
  IF coalesce(auth.role(), '') <> 'service_role' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'FORBIDDEN');
  END IF;

  BEGIN
    v_type := p_type::public.notification_type;
  EXCEPTION WHEN OTHERS THEN
    v_type := 'system'::public.notification_type;
  END;

  v_claimed := public.claim_reminder_dedupe(p_dedupe_key);
  IF NOT v_claimed THEN
    RETURN jsonb_build_object('ok', true, 'skipped', true);
  END IF;

  SELECT * INTO v_profile FROM public.profiles WHERE id = p_user_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'NO_PROFILE');
  END IF;

  INSERT INTO public.notifications (user_id, type, channel, title, body, data)
  VALUES (p_user_id, v_type, 'in_app', p_title, p_body, coalesce(p_data, '{}'::jsonb));

  IF nullif(trim(coalesce(v_profile.email, '')), '') IS NOT NULL
     AND v_profile.email NOT LIKE '%@amanah.internal' THEN
    PERFORM private.enqueue_delivery(
      'email'::public.notification_channel, v_profile.email, p_title, p_body, p_user_id, NULL,
      coalesce(p_data, '{}'::jsonb) || jsonb_build_object('dedupe_key', p_dedupe_key)
    );
    v_channels := v_channels + 1;
  END IF;

  v_phone := nullif(trim(coalesce(v_profile.mpesa_phone, v_profile.phone, '')), '');
  IF v_phone IS NOT NULL THEN
    PERFORM private.enqueue_delivery(
      'sms'::public.notification_channel,
      v_phone, p_title, p_body, p_user_id, NULL,
      coalesce(p_data, '{}'::jsonb) || jsonb_build_object('dedupe_key', p_dedupe_key)
    );
    PERFORM private.enqueue_delivery(
      'whatsapp'::public.notification_channel,
      v_phone, p_title, p_body, p_user_id, NULL,
      coalesce(p_data, '{}'::jsonb) || jsonb_build_object('dedupe_key', p_dedupe_key, 'via', 'whatsapp')
    );
    v_channels := v_channels + 2;
  END IF;

  PERFORM public.queue_push_for_user(p_user_id, p_title, p_body, p_data);
  v_channels := v_channels + 1;

  RETURN jsonb_build_object('ok', true, 'channels', v_channels);
END;
$$;

CREATE OR REPLACE FUNCTION public.remind_contribution_invoices(p_jamiya_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_count INT := 0;
  v_sms INT := 0;
  v_wa INT := 0;
  v_row RECORD;
  v_phone TEXT;
  v_title TEXT;
  v_body TEXT;
  v_circle TEXT;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'UNAUTHENTICATED');
  END IF;
  IF NOT (private.is_circle_officer(p_jamiya_id) OR private.is_platform_admin()) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'FORBIDDEN');
  END IF;

  SELECT name INTO v_circle FROM public.jamiyas WHERE id = p_jamiya_id;

  FOR v_row IN
    SELECT i.*, p.phone AS profile_phone, p.mpesa_phone
    FROM public.circle_contribution_invoices i
    LEFT JOIN public.profiles p ON p.id = i.user_id
    WHERE i.jamiya_id = p_jamiya_id AND i.status = 'open'
    ORDER BY i.due_date NULLS LAST
  LOOP
    v_title := 'Reminder: ' || v_row.invoice_number;
    v_body := format(
      'Amanah · %s — please pay invoice %s (%s %s)%s. Open the app to pay.',
      coalesce(v_circle, 'your circle'),
      v_row.invoice_number,
      v_row.currency,
      v_row.amount_due::text,
      CASE WHEN v_row.due_date IS NOT NULL THEN ' due ' || v_row.due_date::text ELSE '' END
    );

    INSERT INTO public.notifications (user_id, type, channel, title, body, data)
    VALUES (
      v_row.user_id,
      'contribution_due'::public.notification_type,
      'in_app'::public.notification_channel,
      v_title,
      v_body,
      jsonb_build_object(
        'jamiya_id', p_jamiya_id,
        'contribution_id', v_row.contribution_id,
        'invoice_number', v_row.invoice_number,
        'reminder', true
      )
    );

    v_phone := nullif(trim(coalesce(v_row.mpesa_phone, v_row.profile_phone, '')), '');
    IF v_phone IS NOT NULL THEN
      PERFORM private.enqueue_delivery(
        'sms'::public.notification_channel, v_phone, v_title, v_body, v_row.user_id, NULL,
        jsonb_build_object('jamiya_id', p_jamiya_id, 'invoice_number', v_row.invoice_number, 'kind', 'invoice_reminder')
      );
      v_sms := v_sms + 1;
      PERFORM private.enqueue_delivery(
        'whatsapp'::public.notification_channel, v_phone, v_title, v_body, v_row.user_id, NULL,
        jsonb_build_object('jamiya_id', p_jamiya_id, 'invoice_number', v_row.invoice_number, 'kind', 'invoice_reminder')
      );
      v_wa := v_wa + 1;
    END IF;

    UPDATE public.circle_contribution_invoices
    SET reminded_at = NOW()
    WHERE id = v_row.id;

    v_count := v_count + 1;
  END LOOP;

  RETURN jsonb_build_object(
    'ok', true,
    'reminded', v_count,
    'sms_queued', v_sms,
    'whatsapp_queued', v_wa
  );
END;
$$;

-- ---------------------------------------------------------------------------
-- 2) Dual approval (withdrawals / payouts / loans above threshold)
-- ---------------------------------------------------------------------------
ALTER TABLE public.jamiyas
  ADD COLUMN IF NOT EXISTS dual_approval_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS dual_approval_threshold NUMERIC(14, 2) NOT NULL DEFAULT 10000;

CREATE TABLE IF NOT EXISTS public.platform_settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO public.platform_settings (key, value) VALUES
  ('dual_approval_withdrawals', '{"enabled": true, "threshold": 5000}'::jsonb)
ON CONFLICT (key) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.dual_approval_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  jamiya_id UUID REFERENCES public.jamiyas (id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('withdrawal', 'payout_settle', 'qard_decide')),
  entity_id UUID NOT NULL,
  amount NUMERIC(14, 2) NOT NULL DEFAULT 0,
  currency CHAR(3) NOT NULL DEFAULT 'KES',
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'rejected', 'cancelled', 'executed')),
  requested_by UUID NOT NULL REFERENCES auth.users (id),
  first_approver_id UUID REFERENCES auth.users (id),
  second_approver_id UUID REFERENCES auth.users (id),
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  result JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (kind, entity_id, status)
);

-- Allow multiple historical rows: drop unique on status, use partial unique for pending
ALTER TABLE public.dual_approval_requests
  DROP CONSTRAINT IF EXISTS dual_approval_requests_kind_entity_id_status_key;

CREATE UNIQUE INDEX IF NOT EXISTS dual_approval_requests_pending_uq
  ON public.dual_approval_requests (kind, entity_id)
  WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS dual_approval_requests_jamiya_idx
  ON public.dual_approval_requests (jamiya_id, status, created_at DESC);

GRANT SELECT ON public.dual_approval_requests TO authenticated;

ALTER TABLE public.dual_approval_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS dual_approval_select ON public.dual_approval_requests;
CREATE POLICY dual_approval_select ON public.dual_approval_requests
  FOR SELECT TO authenticated
  USING (
    private.is_platform_admin()
    OR private.is_compliance_or_admin()
    OR (jamiya_id IS NOT NULL AND private.is_circle_officer(jamiya_id))
    OR requested_by = auth.uid()
  );

CREATE OR REPLACE FUNCTION private.platform_withdrawal_dual_required(p_amount NUMERIC)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v JSONB;
  v_enabled BOOLEAN;
  v_threshold NUMERIC;
BEGIN
  SELECT value INTO v FROM public.platform_settings WHERE key = 'dual_approval_withdrawals';
  IF v IS NULL THEN
    RETURN p_amount >= 5000;
  END IF;
  v_enabled := coalesce((v->>'enabled')::boolean, true);
  v_threshold := coalesce((v->>'threshold')::numeric, 5000);
  RETURN v_enabled AND p_amount >= v_threshold;
END;
$$;

CREATE OR REPLACE FUNCTION private.circle_dual_required(p_jamiya_id UUID, p_amount NUMERIC)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT coalesce(dual_approval_enabled, false)
    AND p_amount >= coalesce(dual_approval_threshold, 10000)
  FROM public.jamiyas
  WHERE id = p_jamiya_id;
$$;

CREATE OR REPLACE FUNCTION public.set_circle_dual_approval(
  p_jamiya_id UUID,
  p_enabled BOOLEAN,
  p_threshold NUMERIC DEFAULT 10000
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'UNAUTHENTICATED');
  END IF;
  IF NOT (private.is_circle_officer(p_jamiya_id) OR private.is_platform_admin()) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'FORBIDDEN');
  END IF;
  IF p_threshold IS NULL OR p_threshold < 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'INVALID_THRESHOLD');
  END IF;

  UPDATE public.jamiyas
  SET
    dual_approval_enabled = coalesce(p_enabled, false),
    dual_approval_threshold = p_threshold,
    updated_at = NOW()
  WHERE id = p_jamiya_id;

  RETURN jsonb_build_object(
    'ok', true,
    'enabled', coalesce(p_enabled, false),
    'threshold', p_threshold
  );
END;
$$;

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
    -- Second distinct approver → mark ready for confirm path
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

  RETURN jsonb_build_object(
    'ok', true,
    'pending_dual_approval', true,
    'request_id', v_id
  );
END;
$$;

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

  -- Execute underlying action
  IF v_req.kind = 'withdrawal' THEN
    v_result := public.process_withdrawal(
      v_req.entity_id,
      coalesce((v_req.payload->>'approve')::boolean, true),
      v_req.payload->>'provider_reference',
      v_req.payload->>'error_message'
    );
  ELSIF v_req.kind = 'payout_settle' THEN
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

-- Gate process_withdrawal proposals via wrapper used by app
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

  -- Rejects never need dual
  IF NOT p_approve THEN
    RETURN public.process_withdrawal(p_withdrawal_id, false, p_provider_reference, p_error_message);
  END IF;

  IF coalesce(auth.role(), '') = 'service_role'
     OR NOT private.platform_withdrawal_dual_required(v_req.amount) THEN
    RETURN public.process_withdrawal(p_withdrawal_id, true, p_provider_reference, p_error_message);
  END IF;

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
END;
$$;

CREATE OR REPLACE FUNCTION public.propose_settle_payout(p_payout_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_p public.payouts%ROWTYPE;
  v_pending public.dual_approval_requests%ROWTYPE;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'UNAUTHENTICATED');
  END IF;

  SELECT * INTO v_p FROM public.payouts WHERE id = p_payout_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'NOT_FOUND');
  END IF;

  IF NOT private.circle_dual_required(v_p.jamiya_id, v_p.amount) THEN
    RETURN public.settle_payout(p_payout_id);
  END IF;

  SELECT * INTO v_pending
  FROM public.dual_approval_requests
  WHERE kind = 'payout_settle' AND entity_id = p_payout_id AND status = 'pending'
  LIMIT 1;

  IF FOUND AND v_pending.first_approver_id IS DISTINCT FROM v_uid THEN
    RETURN public.confirm_dual_approval(v_pending.id, true);
  END IF;

  RETURN public.propose_dual_approval(
    'payout_settle', p_payout_id, v_p.amount, v_p.currency, v_p.jamiya_id, '{}'::jsonb
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.propose_decide_qard(p_loan_id UUID, p_approve BOOLEAN)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_loan public.qard_loans%ROWTYPE;
  v_pending public.dual_approval_requests%ROWTYPE;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'UNAUTHENTICATED');
  END IF;

  SELECT * INTO v_loan FROM public.qard_loans WHERE id = p_loan_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'NOT_FOUND');
  END IF;

  IF NOT p_approve OR NOT private.circle_dual_required(v_loan.jamiya_id, v_loan.amount) THEN
    RETURN public.decide_qard(p_loan_id, p_approve);
  END IF;

  SELECT * INTO v_pending
  FROM public.dual_approval_requests
  WHERE kind = 'qard_decide' AND entity_id = p_loan_id AND status = 'pending'
  LIMIT 1;

  IF FOUND AND v_pending.first_approver_id IS DISTINCT FROM v_uid THEN
    RETURN public.confirm_dual_approval(v_pending.id, true);
  END IF;

  RETURN public.propose_dual_approval(
    'qard_decide', p_loan_id, v_loan.amount, v_loan.currency, v_loan.jamiya_id,
    jsonb_build_object('approve', true)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.set_circle_dual_approval(UUID, BOOLEAN, NUMERIC) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.propose_dual_approval(TEXT, UUID, NUMERIC, TEXT, UUID, JSONB) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.confirm_dual_approval(UUID, BOOLEAN) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.propose_process_withdrawal(UUID, BOOLEAN, TEXT, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.propose_settle_payout(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.propose_decide_qard(UUID, BOOLEAN) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.set_circle_dual_approval(UUID, BOOLEAN, NUMERIC) TO authenticated;
GRANT EXECUTE ON FUNCTION public.propose_dual_approval(TEXT, UUID, NUMERIC, TEXT, UUID, JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION public.confirm_dual_approval(UUID, BOOLEAN) TO authenticated;
GRANT EXECUTE ON FUNCTION public.propose_process_withdrawal(UUID, BOOLEAN, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.propose_process_withdrawal(UUID, BOOLEAN, TEXT, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.propose_settle_payout(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.propose_decide_qard(UUID, BOOLEAN) TO authenticated;

-- ---------------------------------------------------------------------------
-- 3) Group SaaS pricing plans
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.platform_plans (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  price_kes NUMERIC(14, 2) NOT NULL DEFAULT 0,
  max_members INT NOT NULL DEFAULT 15,
  sms_credits_month INT NOT NULL DEFAULT 0,
  whatsapp_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  dual_approval_included BOOLEAN NOT NULL DEFAULT FALSE,
  exports_included BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order INT NOT NULL DEFAULT 0,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO public.platform_plans (
  id, name, description, price_kes, max_members, sms_credits_month,
  whatsapp_enabled, dual_approval_included, exports_included, sort_order
) VALUES
  (
    'free',
    'Free',
    'Small circles getting started — in-app reminders and basic books.',
    0, 12, 0, false, false, true, 10
  ),
  (
    'starter',
    'Starter',
    'Growing chamas — SMS reminders, dual approval, and printable statements.',
    1000, 30, 200, true, true, true, 20
  ),
  (
    'pro',
    'Pro',
    'Investment groups — WhatsApp + SMS, higher seats, full treasurer pack.',
    2500, 50, 600, true, true, true, 30
  )
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  price_kes = EXCLUDED.price_kes,
  max_members = EXCLUDED.max_members,
  sms_credits_month = EXCLUDED.sms_credits_month,
  whatsapp_enabled = EXCLUDED.whatsapp_enabled,
  dual_approval_included = EXCLUDED.dual_approval_included,
  exports_included = EXCLUDED.exports_included,
  sort_order = EXCLUDED.sort_order,
  active = TRUE;

CREATE TABLE IF NOT EXISTS public.circle_subscriptions (
  jamiya_id UUID PRIMARY KEY REFERENCES public.jamiyas (id) ON DELETE CASCADE,
  plan_id TEXT NOT NULL REFERENCES public.platform_plans (id),
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'past_due', 'cancelled')),
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  renews_at TIMESTAMPTZ,
  notes TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

GRANT SELECT ON public.platform_plans TO anon, authenticated;
GRANT SELECT ON public.circle_subscriptions TO authenticated;
GRANT SELECT ON public.platform_settings TO authenticated;

ALTER TABLE public.platform_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.circle_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.platform_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS platform_plans_read ON public.platform_plans;
CREATE POLICY platform_plans_read ON public.platform_plans
  FOR SELECT TO authenticated, anon
  USING (active = true);

DROP POLICY IF EXISTS circle_subs_select ON public.circle_subscriptions;
CREATE POLICY circle_subs_select ON public.circle_subscriptions
  FOR SELECT TO authenticated
  USING (
    private.is_platform_admin()
    OR private.is_circle_officer(jamiya_id)
    OR EXISTS (
      SELECT 1 FROM public.members m
      WHERE m.jamiya_id = circle_subscriptions.jamiya_id
        AND m.user_id = auth.uid()
        AND m.status = 'active'
    )
  );

DROP POLICY IF EXISTS platform_settings_admin ON public.platform_settings;
CREATE POLICY platform_settings_admin ON public.platform_settings
  FOR SELECT TO authenticated
  USING (private.is_platform_admin() OR private.is_compliance_or_admin());

CREATE OR REPLACE FUNCTION public.set_circle_plan(
  p_jamiya_id UUID,
  p_plan_id TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_plan public.platform_plans%ROWTYPE;
  v_members INT;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'UNAUTHENTICATED');
  END IF;
  IF NOT (private.is_circle_officer(p_jamiya_id) OR private.is_platform_admin()) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'FORBIDDEN');
  END IF;

  SELECT * INTO v_plan FROM public.platform_plans WHERE id = p_plan_id AND active;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'PLAN_NOT_FOUND');
  END IF;

  SELECT member_count INTO v_members FROM public.jamiyas WHERE id = p_jamiya_id;
  IF coalesce(v_members, 0) > v_plan.max_members THEN
    RETURN jsonb_build_object(
      'ok', false,
      'error', 'MEMBER_LIMIT',
      'members', v_members,
      'max_members', v_plan.max_members
    );
  END IF;

  INSERT INTO public.circle_subscriptions (jamiya_id, plan_id, status, started_at, renews_at, updated_at)
  VALUES (
    p_jamiya_id, p_plan_id, 'active', NOW(),
    CASE WHEN v_plan.price_kes > 0 THEN NOW() + INTERVAL '30 days' ELSE NULL END,
    NOW()
  )
  ON CONFLICT (jamiya_id) DO UPDATE SET
    plan_id = EXCLUDED.plan_id,
    status = 'active',
    renews_at = EXCLUDED.renews_at,
    updated_at = NOW();

  -- Starter/Pro unlock dual-approval defaults when included
  IF v_plan.dual_approval_included THEN
    UPDATE public.jamiyas
    SET dual_approval_enabled = TRUE, updated_at = NOW()
    WHERE id = p_jamiya_id AND dual_approval_enabled = FALSE;
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'plan_id', p_plan_id,
    'price_kes', v_plan.price_kes,
    'max_members', v_plan.max_members
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.get_circle_plan(p_jamiya_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_sub public.circle_subscriptions%ROWTYPE;
  v_plan public.platform_plans%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'UNAUTHENTICATED');
  END IF;

  SELECT * INTO v_sub FROM public.circle_subscriptions WHERE jamiya_id = p_jamiya_id;
  IF NOT FOUND THEN
    SELECT * INTO v_plan FROM public.platform_plans WHERE id = 'free';
    RETURN jsonb_build_object(
      'ok', true,
      'plan_id', 'free',
      'plan', to_jsonb(v_plan),
      'status', 'active',
      'implicit', true
    );
  END IF;

  SELECT * INTO v_plan FROM public.platform_plans WHERE id = v_sub.plan_id;
  RETURN jsonb_build_object(
    'ok', true,
    'plan_id', v_sub.plan_id,
    'plan', to_jsonb(v_plan),
    'status', v_sub.status,
    'renews_at', v_sub.renews_at,
    'implicit', false
  );
END;
$$;

REVOKE ALL ON FUNCTION public.set_circle_plan(UUID, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_circle_plan(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_circle_plan(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_circle_plan(UUID) TO authenticated;

-- Seed free plan for existing circles
INSERT INTO public.circle_subscriptions (jamiya_id, plan_id, status)
SELECT j.id, 'free', 'active'
FROM public.jamiyas j
WHERE NOT EXISTS (
  SELECT 1 FROM public.circle_subscriptions s WHERE s.jamiya_id = j.id
);

-- ---------------------------------------------------------------------------
-- 4) Align settle_payout with officer roles (chair/treasurer dual-approve)
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
  v_mode TEXT;
  v_unpaid INT;
  v_arrears NUMERIC := 0;
  v_open_penalties NUMERIC := 0;
  v_deduct NUMERIC := 0;
  v_pay NUMERIC;
  v_tx UUID;
  v_kyc TEXT;
  v_open_disputes INT;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'UNAUTHENTICATED');
  END IF;

  SELECT * INTO v_p FROM public.payouts WHERE id = p_payout_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'NOT_FOUND');
  END IF;

  IF NOT (private.is_circle_officer(v_p.jamiya_id) OR private.is_platform_admin()) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'FORBIDDEN');
  END IF;

  IF v_p.status NOT IN ('scheduled', 'processing') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'NOT_SETTLEABLE');
  END IF;

  SELECT COALESCE(payout_compliance_mode, 'block') INTO v_mode
  FROM public.jamiyas WHERE id = v_p.jamiya_id;

  SELECT COUNT(*) INTO v_unpaid
  FROM public.contributions
  WHERE jamiya_id = v_p.jamiya_id
    AND cycle_number = v_p.cycle_number
    AND status NOT IN ('paid', 'waived');

  IF v_unpaid > 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'CYCLE_INCOMPLETE', 'unpaid', v_unpaid);
  END IF;

  SELECT * INTO v_member FROM public.members WHERE id = v_p.member_id;

  SELECT COALESCE(SUM(GREATEST(amount - COALESCE(amount_paid, 0), 0)), 0) INTO v_arrears
  FROM public.contributions
  WHERE member_id = v_p.member_id
    AND status IN ('pending', 'late', 'partial');

  SELECT COALESCE(SUM(amount), 0) INTO v_open_penalties
  FROM public.penalties
  WHERE member_id = v_p.member_id AND status = 'open';

  IF v_mode = 'block' AND (v_arrears > 0 OR v_open_penalties > 0) THEN
    RETURN jsonb_build_object(
      'ok', false,
      'error', 'MEMBER_NONCOMPLIANT',
      'arrears', v_arrears,
      'penalties', v_open_penalties
    );
  END IF;

  IF v_mode = 'deduct' THEN
    v_deduct := LEAST(v_p.amount, v_arrears + v_open_penalties);
  END IF;

  v_pay := GREATEST(v_p.amount - v_deduct, 0);

  SELECT kyc_status INTO v_kyc FROM public.profiles WHERE id = v_member.user_id;
  IF v_kyc IS DISTINCT FROM 'approved' AND v_p.amount >= 50000 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'KYC_REQUIRED', 'kyc_status', v_kyc);
  END IF;

  SELECT COUNT(*) INTO v_open_disputes
  FROM public.disputes
  WHERE jamiya_id = v_p.jamiya_id
    AND status IN ('open', 'under_review');

  IF v_open_disputes > 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'OPEN_DISPUTES', 'count', v_open_disputes);
  END IF;

  UPDATE public.payouts SET status = 'processing', updated_at = NOW() WHERE id = v_p.id;

  IF v_pay > 0 THEN
    v_tx := private.ledger_credit(
      v_member.user_id, v_p.currency, v_pay, 'payout', v_p.jamiya_id,
      'payout:' || v_p.id::text,
      'settle_payout:' || v_p.id::text,
      jsonb_build_object(
        'payout_id', v_p.id,
        'cycle', v_p.cycle_number,
        'gross', v_p.amount,
        'deducted', v_deduct,
        'compliance_mode', v_mode
      )
    );
  END IF;

  IF v_deduct > 0 AND v_open_penalties > 0 THEN
    UPDATE public.penalties
    SET status = 'paid', paid_at = NOW(), updated_at = NOW()
    WHERE member_id = v_p.member_id AND status = 'open';
  END IF;

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
    jsonb_build_object(
      'payout_id', v_p.id,
      'jamiya_id', v_p.jamiya_id,
      'net', v_pay,
      'deducted', v_deduct
    )
  );

  INSERT INTO public.audit_logs (actor_id, action, entity_type, entity_id, jamiya_id, metadata)
  VALUES (
    v_uid, 'approve', 'payout', v_p.id, v_p.jamiya_id,
    jsonb_build_object(
      'transaction_id', v_tx,
      'compliance_mode', v_mode,
      'deducted', v_deduct,
      'arrears', v_arrears,
      'penalties', v_open_penalties
    )
  );

  RETURN jsonb_build_object(
    'ok', true,
    'transaction_id', v_tx,
    'net', v_pay,
    'deducted', v_deduct,
    'compliance_mode', v_mode
  );
END;
$$;
