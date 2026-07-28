-- Phase 11: polish without Daraja (auto payout cashout, tawarruq partner, push tokens)

-- Auto-complete simulated M-Pesa cashout when PAYOUT_AUTO_SIMULATE is not a DB setting —
-- instead: RPC that processes payout_cashout withdrawals as simulated B2C.
CREATE OR REPLACE FUNCTION public.process_payout_cashout(
  p_withdrawal_id UUID,
  p_simulate BOOLEAN DEFAULT true
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_w public.withdrawal_requests%ROWTYPE;
  v_result JSONB;
BEGIN
  IF v_uid IS NULL OR NOT private.is_compliance_or_admin() THEN
    RETURN jsonb_build_object('ok', false, 'error', 'FORBIDDEN');
  END IF;

  SELECT * INTO v_w FROM public.withdrawal_requests WHERE id = p_withdrawal_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'NOT_FOUND');
  END IF;

  IF coalesce(v_w.metadata->>'kind', '') <> 'payout_cashout' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'NOT_PAYOUT_CASHOUT');
  END IF;

  IF v_w.status NOT IN ('pending', 'processing') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'NOT_PENDING');
  END IF;

  -- Until Daraja B2C: simulated complete via existing process_withdrawal
  v_result := public.process_withdrawal(
    p_withdrawal_id,
    true,
    CASE WHEN p_simulate THEN 'sim-b2c:' || p_withdrawal_id::text ELSE NULL END,
    NULL
  );

  RETURN coalesce(v_result, jsonb_build_object('ok', false, 'error', 'PROCESS_FAILED'))
    || jsonb_build_object('simulated', p_simulate);
END;
$$;

REVOKE ALL ON FUNCTION public.process_payout_cashout(UUID, BOOLEAN) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.process_payout_cashout(UUID, BOOLEAN) TO authenticated;

-- Update settle_payout_to_mpesa to optionally auto-sim-process when no live B2C
CREATE OR REPLACE FUNCTION public.settle_payout_to_mpesa(
  p_payout_id UUID,
  p_phone TEXT DEFAULT NULL,
  p_auto_simulate BOOLEAN DEFAULT true
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_p public.payouts%ROWTYPE;
  v_member public.members%ROWTYPE;
  v_phone TEXT;
  v_settle JSONB;
  v_wd UUID;
  v_profile public.profiles%ROWTYPE;
  v_proc JSONB;
  v_tx UUID;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'UNAUTHENTICATED');
  END IF;

  SELECT * INTO v_p FROM public.payouts WHERE id = p_payout_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'NOT_FOUND');
  END IF;

  IF NOT private.is_circle_admin(v_p.jamiya_id) AND NOT private.is_compliance_or_admin() THEN
    RETURN jsonb_build_object('ok', false, 'error', 'FORBIDDEN');
  END IF;

  SELECT * INTO v_member FROM public.members WHERE id = v_p.member_id;
  SELECT * INTO v_profile FROM public.profiles WHERE id = v_member.user_id;

  v_phone := coalesce(
    nullif(trim(p_phone), ''),
    nullif(trim(coalesce(v_profile.mpesa_phone, '')), ''),
    nullif(trim(coalesce(v_profile.phone, '')), '')
  );

  IF v_phone IS NULL OR v_phone !~ '^\+[1-9]\d{7,14}$' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'PHONE_REQUIRED');
  END IF;

  IF v_p.status NOT IN ('paid') THEN
    v_settle := public.settle_payout(p_payout_id);
    IF coalesce(v_settle->>'ok', 'false') <> 'true' THEN
      RETURN v_settle;
    END IF;
  END IF;

  INSERT INTO public.withdrawal_requests (
    user_id, amount, currency, status, destination_type, destination_phone, metadata
  ) VALUES (
    v_member.user_id, v_p.amount, v_p.currency, 'pending', 'mpesa', v_phone,
    jsonb_build_object('kind', 'payout_cashout', 'payout_id', p_payout_id, 'queued_by', v_uid)
  ) RETURNING id INTO v_wd;

  IF p_auto_simulate THEN
    BEGIN
      v_tx := private.ledger_debit(
        v_member.user_id, v_p.currency, v_p.amount, 'wallet_withdrawal', NULL,
        'sim-b2c:' || v_wd::text,
        'withdrawal:' || v_wd::text,
        jsonb_build_object('withdrawal_id', v_wd, 'kind', 'payout_cashout', 'simulated', true)
      );
      UPDATE public.withdrawal_requests
      SET status = 'completed',
          transaction_id = v_tx,
          provider_reference = 'sim-b2c:' || v_wd::text,
          processed_at = NOW(),
          updated_at = NOW()
      WHERE id = v_wd;
      v_proc := jsonb_build_object('ok', true, 'status', 'completed', 'simulated', true, 'transaction_id', v_tx);
    EXCEPTION WHEN OTHERS THEN
      UPDATE public.withdrawal_requests
      SET status = 'failed', error_message = SQLERRM, updated_at = NOW()
      WHERE id = v_wd;
      v_proc := jsonb_build_object('ok', false, 'error', SQLERRM);
    END;
  END IF;

  UPDATE public.payouts
  SET notes = coalesce(notes || ' | ', '') || 'M-Pesa cashout: ' || v_wd::text,
      updated_at = NOW()
  WHERE id = p_payout_id;

  RETURN jsonb_build_object(
    'ok', true,
    'payout_id', p_payout_id,
    'withdrawal_id', v_wd,
    'phone', v_phone,
    'auto_simulated', p_auto_simulate,
    'process', v_proc
  );
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('ok', false, 'error', SQLERRM);
END;
$$;

REVOKE ALL ON FUNCTION public.settle_payout_to_mpesa(UUID, TEXT, BOOLEAN) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.settle_payout_to_mpesa(UUID, TEXT, BOOLEAN) TO authenticated;

-- Keep 2-arg wrapper
CREATE OR REPLACE FUNCTION public.settle_payout_to_mpesa(
  p_payout_id UUID,
  p_phone TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  RETURN public.settle_payout_to_mpesa(p_payout_id, p_phone, true);
END;
$$;

-- Tawarruq partner handoff / status update (compliance)
CREATE OR REPLACE FUNCTION public.update_tawarruq_partner_status(
  p_application_id UUID,
  p_status TEXT,
  p_partner_reference TEXT DEFAULT NULL,
  p_partner_status TEXT DEFAULT NULL,
  p_notes TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_app public.tawarruq_applications%ROWTYPE;
  v_status public.tawarruq_status;
BEGIN
  IF v_uid IS NULL OR NOT private.is_compliance_or_admin() THEN
    RETURN jsonb_build_object('ok', false, 'error', 'FORBIDDEN');
  END IF;

  BEGIN
    v_status := p_status::public.tawarruq_status;
  EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('ok', false, 'error', 'INVALID_STATUS');
  END;

  SELECT * INTO v_app FROM public.tawarruq_applications WHERE id = p_application_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'NOT_FOUND');
  END IF;

  UPDATE public.tawarruq_applications
  SET
    status = v_status,
    partner_reference = coalesce(nullif(trim(p_partner_reference), ''), partner_reference),
    partner_status = coalesce(nullif(trim(p_partner_status), ''), partner_status),
    metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object(
      'updated_by', v_uid,
      'notes', p_notes,
      'updated_at', NOW()
    ),
    updated_at = NOW()
  WHERE id = p_application_id;

  INSERT INTO public.notifications (user_id, type, channel, title, body, data)
  VALUES (
    v_app.user_id, 'system', 'in_app',
    'Tawarruq update',
    'Your financing application is now: ' || v_status::text,
    jsonb_build_object('application_id', p_application_id, 'status', v_status)
  );

  RETURN jsonb_build_object('ok', true, 'status', v_status);
END;
$$;

REVOKE ALL ON FUNCTION public.update_tawarruq_partner_status(UUID, TEXT, TEXT, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.update_tawarruq_partner_status(UUID, TEXT, TEXT, TEXT, TEXT) TO authenticated;

CREATE OR REPLACE FUNCTION public.submit_tawarruq_to_partner(p_application_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_app public.tawarruq_applications%ROWTYPE;
  v_ref TEXT;
BEGIN
  IF v_uid IS NULL OR NOT private.is_compliance_or_admin() THEN
    RETURN jsonb_build_object('ok', false, 'error', 'FORBIDDEN');
  END IF;

  SELECT * INTO v_app FROM public.tawarruq_applications WHERE id = p_application_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'NOT_FOUND');
  END IF;
  IF v_app.status <> 'requested' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'NOT_REQUESTED');
  END IF;

  v_ref := 'PTR-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 10));

  UPDATE public.tawarruq_applications
  SET
    status = 'submitted_to_partner',
    partner_reference = v_ref,
    partner_status = 'queued',
    metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object(
      'submitted_by', v_uid,
      'submitted_at', NOW(),
      'handoff', 'simulated_partner_api'
    ),
    updated_at = NOW()
  WHERE id = p_application_id;

  RETURN jsonb_build_object('ok', true, 'partner_reference', v_ref, 'status', 'submitted_to_partner');
END;
$$;

REVOKE ALL ON FUNCTION public.submit_tawarruq_to_partner(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.submit_tawarruq_to_partner(UUID) TO authenticated;

-- Device push tokens
CREATE TABLE IF NOT EXISTS public.device_push_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  token TEXT NOT NULL,
  platform TEXT NOT NULL DEFAULT 'expo' CHECK (platform IN ('expo', 'fcm', 'apns', 'web')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, token)
);

CREATE INDEX IF NOT EXISTS device_push_tokens_user_idx ON public.device_push_tokens (user_id);

ALTER TABLE public.device_push_tokens ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "push_tokens_select_own" ON public.device_push_tokens;
CREATE POLICY "push_tokens_select_own" ON public.device_push_tokens
  FOR SELECT TO authenticated USING (user_id = auth.uid());
DROP POLICY IF EXISTS "push_tokens_upsert_own" ON public.device_push_tokens;
CREATE POLICY "push_tokens_insert_own" ON public.device_push_tokens
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "push_tokens_update_own" ON public.device_push_tokens
  FOR UPDATE TO authenticated USING (user_id = auth.uid());
CREATE POLICY "push_tokens_delete_own" ON public.device_push_tokens
  FOR DELETE TO authenticated USING (user_id = auth.uid());
GRANT SELECT, INSERT, UPDATE, DELETE ON public.device_push_tokens TO authenticated;

CREATE OR REPLACE FUNCTION public.register_push_token(
  p_token TEXT,
  p_platform TEXT DEFAULT 'expo'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid UUID := auth.uid();
BEGIN
  IF v_uid IS NULL OR char_length(trim(p_token)) < 10 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'INVALID');
  END IF;
  INSERT INTO public.device_push_tokens (user_id, token, platform)
  VALUES (v_uid, trim(p_token), coalesce(nullif(trim(p_platform), ''), 'expo'))
  ON CONFLICT (user_id, token) DO UPDATE
    SET platform = EXCLUDED.platform, updated_at = NOW();
  RETURN jsonb_build_object('ok', true);
END;
$$;

REVOKE ALL ON FUNCTION public.register_push_token(TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.register_push_token(TEXT, TEXT) TO authenticated;

-- Allow push channel on notification outbox + enqueue helper
ALTER TABLE public.notification_outbox
  DROP CONSTRAINT IF EXISTS notification_outbox_channel_delivery;
ALTER TABLE public.notification_outbox
  ADD CONSTRAINT notification_outbox_channel_delivery
  CHECK (channel IN ('email', 'sms', 'push'));

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
  IF p_channel NOT IN ('email', 'sms', 'push') THEN
    RAISE EXCEPTION 'INVALID_CHANNEL';
  END IF;
  IF p_recipient IS NULL OR length(trim(p_recipient)) = 0 THEN
    RETURN NULL;
  END IF;

  INSERT INTO public.notification_outbox (
    notification_id, user_id, channel, recipient, subject, body, metadata
  )
  VALUES (
    p_notification_id, p_user_id, p_channel, trim(p_recipient),
    p_subject, p_body, COALESCE(p_metadata, '{}'::jsonb)
  )
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

-- Queue Expo push for a user (all registered tokens)
CREATE OR REPLACE FUNCTION public.queue_push_for_user(
  p_user_id UUID,
  p_title TEXT,
  p_body TEXT,
  p_data JSONB DEFAULT '{}'::jsonb
)
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_count INT := 0;
  v_tok RECORD;
BEGIN
  IF v_uid IS NULL AND coalesce(auth.role(), '') <> 'service_role' THEN
    RAISE EXCEPTION 'FORBIDDEN';
  END IF;
  IF coalesce(auth.role(), '') <> 'service_role'
     AND v_uid IS DISTINCT FROM p_user_id
     AND NOT private.is_compliance_or_admin() THEN
    RAISE EXCEPTION 'FORBIDDEN';
  END IF;

  FOR v_tok IN
    SELECT token FROM public.device_push_tokens WHERE user_id = p_user_id
  LOOP
    PERFORM private.enqueue_delivery(
      'push'::public.notification_channel,
      v_tok.token,
      p_title,
      p_body,
      p_user_id,
      NULL,
      coalesce(p_data, '{}'::jsonb)
    );
    v_count := v_count + 1;
  END LOOP;

  RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.queue_push_for_user(UUID, TEXT, TEXT, JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.queue_push_for_user(UUID, TEXT, TEXT, JSONB) TO authenticated, service_role;
