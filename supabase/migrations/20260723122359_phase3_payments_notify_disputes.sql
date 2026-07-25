-- Phase 3: Payment intents (M-Pesa), notification outbox, disputes, KYC payout gate

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------
CREATE TYPE public.payment_provider AS ENUM ('simulated', 'mpesa', 'bank');
CREATE TYPE public.payment_intent_status AS ENUM (
  'pending',
  'processing',
  'completed',
  'failed',
  'cancelled',
  'expired'
);
CREATE TYPE public.delivery_status AS ENUM (
  'pending',
  'processing',
  'sent',
  'failed',
  'skipped'
);
CREATE TYPE public.dispute_status AS ENUM (
  'open',
  'under_review',
  'resolved',
  'rejected',
  'cancelled'
);
CREATE TYPE public.dispute_type AS ENUM (
  'missed_contribution',
  'payout_delay',
  'incorrect_amount',
  'membership',
  'other'
);

-- ---------------------------------------------------------------------------
-- payment_intents
-- ---------------------------------------------------------------------------
CREATE TABLE public.payment_intents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  provider public.payment_provider NOT NULL DEFAULT 'simulated',
  status public.payment_intent_status NOT NULL DEFAULT 'pending',
  amount NUMERIC(14, 2) NOT NULL CHECK (amount > 0),
  currency CHAR(3) NOT NULL DEFAULT 'KES',
  phone TEXT,
  provider_reference TEXT,
  checkout_request_id TEXT,
  merchant_request_id TEXT,
  transaction_id UUID REFERENCES public.transactions (id) ON DELETE SET NULL,
  idempotency_key TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  error_message TEXT,
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '15 minutes'),
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX payment_intents_idempotency_unique_idx
  ON public.payment_intents (idempotency_key)
  WHERE idempotency_key IS NOT NULL;

CREATE INDEX payment_intents_user_created_idx
  ON public.payment_intents (user_id, created_at DESC);

CREATE INDEX payment_intents_provider_ref_idx
  ON public.payment_intents (provider_reference)
  WHERE provider_reference IS NOT NULL;

CREATE INDEX payment_intents_checkout_idx
  ON public.payment_intents (checkout_request_id)
  WHERE checkout_request_id IS NOT NULL;

CREATE TRIGGER payment_intents_set_updated_at
  BEFORE UPDATE ON public.payment_intents
  FOR EACH ROW EXECUTE FUNCTION private.set_updated_at();

ALTER TABLE public.payment_intents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "payment_intents_select_own"
  ON public.payment_intents FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR private.is_compliance_or_admin());

CREATE POLICY "payment_intents_insert_own"
  ON public.payment_intents FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

-- Updates via SECURITY DEFINER / service role only
REVOKE UPDATE, DELETE ON public.payment_intents FROM authenticated, anon;
GRANT SELECT, INSERT ON public.payment_intents TO authenticated;

-- ---------------------------------------------------------------------------
-- notification_outbox (email/sms delivery queue)
-- ---------------------------------------------------------------------------
CREATE TABLE public.notification_outbox (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  notification_id UUID REFERENCES public.notifications (id) ON DELETE SET NULL,
  user_id UUID REFERENCES public.profiles (id) ON DELETE SET NULL,
  channel public.notification_channel NOT NULL,
  recipient TEXT NOT NULL,
  subject TEXT,
  body TEXT NOT NULL,
  status public.delivery_status NOT NULL DEFAULT 'pending',
  attempts INT NOT NULL DEFAULT 0,
  last_error TEXT,
  scheduled_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  sent_at TIMESTAMPTZ,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT notification_outbox_channel_delivery CHECK (channel IN ('email', 'sms'))
);

CREATE INDEX notification_outbox_pending_idx
  ON public.notification_outbox (status, scheduled_at)
  WHERE status IN ('pending', 'failed');

CREATE TRIGGER notification_outbox_set_updated_at
  BEFORE UPDATE ON public.notification_outbox
  FOR EACH ROW EXECUTE FUNCTION private.set_updated_at();

ALTER TABLE public.notification_outbox ENABLE ROW LEVEL SECURITY;

CREATE POLICY "notification_outbox_select_admin"
  ON public.notification_outbox FOR SELECT TO authenticated
  USING (private.is_compliance_or_admin());

REVOKE INSERT, UPDATE, DELETE ON public.notification_outbox FROM authenticated, anon;
GRANT SELECT ON public.notification_outbox TO authenticated;

-- ---------------------------------------------------------------------------
-- disputes
-- ---------------------------------------------------------------------------
CREATE TABLE public.disputes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  jamiya_id UUID NOT NULL REFERENCES public.jamiyas (id) ON DELETE CASCADE,
  opened_by UUID NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  against_user_id UUID REFERENCES public.profiles (id) ON DELETE SET NULL,
  type public.dispute_type NOT NULL DEFAULT 'other',
  status public.dispute_status NOT NULL DEFAULT 'open',
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  resolution_notes TEXT,
  resolved_by UUID REFERENCES public.profiles (id) ON DELETE SET NULL,
  resolved_at TIMESTAMPTZ,
  risk_score INT NOT NULL DEFAULT 0 CHECK (risk_score BETWEEN 0 AND 100),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT disputes_title_length CHECK (char_length(trim(title)) BETWEEN 3 AND 200),
  CONSTRAINT disputes_description_length CHECK (char_length(trim(description)) BETWEEN 10 AND 4000)
);

CREATE INDEX disputes_jamiya_status_idx ON public.disputes (jamiya_id, status);
CREATE INDEX disputes_opened_by_idx ON public.disputes (opened_by);
CREATE INDEX disputes_status_created_idx ON public.disputes (status, created_at DESC);

CREATE TRIGGER disputes_set_updated_at
  BEFORE UPDATE ON public.disputes
  FOR EACH ROW EXECUTE FUNCTION private.set_updated_at();

ALTER TABLE public.disputes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "disputes_select_member_or_admin"
  ON public.disputes FOR SELECT TO authenticated
  USING (
    private.is_compliance_or_admin()
    OR opened_by = auth.uid()
    OR private.is_active_jamiya_member(jamiya_id)
  );

CREATE POLICY "disputes_insert_member"
  ON public.disputes FOR INSERT TO authenticated
  WITH CHECK (
    opened_by = auth.uid()
    AND private.is_active_jamiya_member(jamiya_id)
  );

CREATE POLICY "disputes_update_admin"
  ON public.disputes FOR UPDATE TO authenticated
  USING (private.is_compliance_or_admin())
  WITH CHECK (private.is_compliance_or_admin());

GRANT SELECT, INSERT ON public.disputes TO authenticated;
GRANT UPDATE ON public.disputes TO authenticated;

-- ---------------------------------------------------------------------------
-- Helper: enqueue email/sms outbox row
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
  IF p_channel NOT IN ('email', 'sms') THEN
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

-- ---------------------------------------------------------------------------
-- Create payment intent (M-Pesa STK or simulated)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.create_payment_intent(
  p_amount NUMERIC,
  p_currency CHAR(3) DEFAULT 'KES',
  p_phone TEXT DEFAULT NULL,
  p_provider public.payment_provider DEFAULT 'simulated',
  p_idempotency_key TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_intent public.payment_intents%ROWTYPE;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'UNAUTHENTICATED');
  END IF;
  IF p_amount IS NULL OR p_amount < 100 OR p_amount > 10000000 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'INVALID_AMOUNT');
  END IF;
  IF p_provider = 'mpesa' AND (p_phone IS NULL OR p_phone !~ '^\+[1-9]\d{7,14}$') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'PHONE_REQUIRED');
  END IF;

  IF p_idempotency_key IS NOT NULL THEN
    SELECT * INTO v_intent FROM public.payment_intents WHERE idempotency_key = p_idempotency_key;
    IF FOUND THEN
      RETURN jsonb_build_object(
        'ok', true,
        'intent_id', v_intent.id,
        'status', v_intent.status,
        'provider', v_intent.provider,
        'amount', v_intent.amount,
        'currency', v_intent.currency,
        'idempotent', true
      );
    END IF;
  END IF;

  INSERT INTO public.payment_intents (
    user_id, provider, status, amount, currency, phone, idempotency_key, metadata
  )
  VALUES (
    v_uid, p_provider, 'pending', p_amount, p_currency, p_phone, p_idempotency_key,
    jsonb_build_object('initiated_at', NOW())
  )
  RETURNING * INTO v_intent;

  INSERT INTO public.audit_logs (actor_id, action, entity_type, entity_id, metadata)
  VALUES (
    v_uid, 'create', 'payment_intent', v_intent.id,
    jsonb_build_object('provider', p_provider, 'amount', p_amount)
  );

  RETURN jsonb_build_object(
    'ok', true,
    'intent_id', v_intent.id,
    'status', v_intent.status,
    'provider', v_intent.provider,
    'amount', v_intent.amount,
    'currency', v_intent.currency
  );
END;
$$;

-- ---------------------------------------------------------------------------
-- Complete payment intent (service role / webhook) → ledger credit
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.complete_payment_intent(
  p_intent_id UUID,
  p_provider_reference TEXT DEFAULT NULL,
  p_checkout_request_id TEXT DEFAULT NULL,
  p_metadata JSONB DEFAULT '{}'::jsonb
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_intent public.payment_intents%ROWTYPE;
  v_tx UUID;
BEGIN
  IF coalesce(auth.role(), '') NOT IN ('service_role', 'authenticated') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'FORBIDDEN');
  END IF;

  -- Members may complete only their own simulated intents; service_role any
  SELECT * INTO v_intent FROM public.payment_intents WHERE id = p_intent_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'NOT_FOUND');
  END IF;

  IF v_intent.status = 'completed' THEN
    RETURN jsonb_build_object('ok', true, 'already_completed', true, 'transaction_id', v_intent.transaction_id);
  END IF;

  IF v_intent.status NOT IN ('pending', 'processing') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'NOT_COMPLETABLE');
  END IF;

  IF auth.role() = 'authenticated' THEN
    IF auth.uid() IS DISTINCT FROM v_intent.user_id OR v_intent.provider <> 'simulated' THEN
      RETURN jsonb_build_object('ok', false, 'error', 'FORBIDDEN');
    END IF;
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
    metadata = metadata || coalesce(p_metadata, '{}'::jsonb),
    updated_at = NOW()
  WHERE id = v_intent.id;

  INSERT INTO public.notifications (user_id, type, channel, title, body, data)
  VALUES (
    v_intent.user_id,
    'system',
    'in_app',
    'Wallet topped up',
    'Your wallet was credited after a successful payment.',
    jsonb_build_object('payment_intent_id', v_intent.id, 'transaction_id', v_tx)
  );

  RETURN jsonb_build_object('ok', true, 'transaction_id', v_tx);
END;
$$;

CREATE OR REPLACE FUNCTION public.fail_payment_intent(
  p_intent_id UUID,
  p_error_message TEXT DEFAULT 'Payment failed'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_intent public.payment_intents%ROWTYPE;
BEGIN
  IF coalesce(auth.role(), '') <> 'service_role' AND auth.uid() IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'UNAUTHENTICATED');
  END IF;

  SELECT * INTO v_intent FROM public.payment_intents WHERE id = p_intent_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'NOT_FOUND');
  END IF;

  IF v_intent.status = 'completed' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'ALREADY_COMPLETED');
  END IF;

  UPDATE public.payment_intents
  SET status = 'failed', error_message = p_error_message, updated_at = NOW()
  WHERE id = v_intent.id;

  RETURN jsonb_build_object('ok', true);
END;
$$;

-- ---------------------------------------------------------------------------
-- Mark payment processing + store STK ids (service)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.mark_payment_intent_processing(
  p_intent_id UUID,
  p_checkout_request_id TEXT DEFAULT NULL,
  p_merchant_request_id TEXT DEFAULT NULL,
  p_provider_reference TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF coalesce(auth.role(), '') <> 'service_role' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'FORBIDDEN');
  END IF;

  UPDATE public.payment_intents
  SET
    status = 'processing',
    checkout_request_id = coalesce(p_checkout_request_id, checkout_request_id),
    merchant_request_id = coalesce(p_merchant_request_id, merchant_request_id),
    provider_reference = coalesce(p_provider_reference, provider_reference),
    updated_at = NOW()
  WHERE id = p_intent_id
    AND status IN ('pending', 'processing');

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'NOT_FOUND');
  END IF;

  RETURN jsonb_build_object('ok', true);
END;
$$;

-- ---------------------------------------------------------------------------
-- KYC gate on settle_payout (recipient must be approved or exempt)
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
  v_unpaid INT;
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

  IF NOT (private.is_circle_admin(v_p.jamiya_id) OR private.is_platform_admin()) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'FORBIDDEN');
  END IF;

  IF v_p.status NOT IN ('scheduled', 'processing') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'NOT_SETTLEABLE');
  END IF;

  SELECT COUNT(*) INTO v_unpaid
  FROM public.contributions
  WHERE jamiya_id = v_p.jamiya_id
    AND cycle_number = v_p.cycle_number
    AND status NOT IN ('paid', 'waived');

  IF v_unpaid > 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'CYCLE_INCOMPLETE', 'unpaid', v_unpaid);
  END IF;

  SELECT * INTO v_member FROM public.members WHERE id = v_p.member_id;

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

  v_tx := private.ledger_credit(
    v_member.user_id, v_p.currency, v_p.amount, 'payout', v_p.jamiya_id,
    'payout:' || v_p.id::text,
    'settle_payout:' || v_p.id::text,
    jsonb_build_object('payout_id', v_p.id, 'cycle', v_p.cycle_number)
  );

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
    jsonb_build_object('payout_id', v_p.id, 'jamiya_id', v_p.jamiya_id)
  );

  INSERT INTO public.audit_logs (actor_id, action, entity_type, entity_id, jamiya_id, metadata)
  VALUES (v_uid, 'approve', 'payout', v_p.id, v_p.jamiya_id, jsonb_build_object('transaction_id', v_tx));

  RETURN jsonb_build_object('ok', true, 'transaction_id', v_tx);
END;
$$;

-- ---------------------------------------------------------------------------
-- Resolve dispute (compliance+)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.resolve_dispute(
  p_dispute_id UUID,
  p_status public.dispute_status,
  p_resolution_notes TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid UUID := auth.uid();
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'UNAUTHENTICATED');
  END IF;
  IF NOT private.is_compliance_or_admin() THEN
    RETURN jsonb_build_object('ok', false, 'error', 'FORBIDDEN');
  END IF;
  IF p_status NOT IN ('resolved', 'rejected', 'under_review') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'INVALID_STATUS');
  END IF;

  UPDATE public.disputes
  SET
    status = p_status,
    resolution_notes = coalesce(p_resolution_notes, resolution_notes),
    resolved_by = CASE WHEN p_status IN ('resolved', 'rejected') THEN v_uid ELSE resolved_by END,
    resolved_at = CASE WHEN p_status IN ('resolved', 'rejected') THEN NOW() ELSE resolved_at END,
    updated_at = NOW()
  WHERE id = p_dispute_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'NOT_FOUND');
  END IF;

  INSERT INTO public.audit_logs (actor_id, action, entity_type, entity_id, metadata)
  VALUES (
    v_uid,
    CASE WHEN p_status = 'rejected' THEN 'reject'::public.audit_action ELSE 'approve'::public.audit_action END,
    'dispute',
    p_dispute_id,
    jsonb_build_object('status', p_status)
  );

  RETURN jsonb_build_object('ok', true);
END;
$$;

-- ---------------------------------------------------------------------------
-- Claim pending outbox rows (service)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.claim_notification_outbox(p_limit INT DEFAULT 50)
RETURNS SETOF public.notification_outbox
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF coalesce(auth.role(), '') <> 'service_role' THEN
    RAISE EXCEPTION 'FORBIDDEN';
  END IF;

  RETURN QUERY
  WITH picked AS (
    SELECT id
    FROM public.notification_outbox
    WHERE status IN ('pending', 'failed')
      AND scheduled_at <= NOW()
      AND attempts < 5
    ORDER BY scheduled_at
    LIMIT GREATEST(p_limit, 1)
    FOR UPDATE SKIP LOCKED
  )
  UPDATE public.notification_outbox o
  SET status = 'processing', attempts = attempts + 1, updated_at = NOW()
  FROM picked
  WHERE o.id = picked.id
  RETURNING o.*;
END;
$$;

CREATE OR REPLACE FUNCTION public.mark_outbox_sent(p_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF coalesce(auth.role(), '') <> 'service_role' THEN
    RAISE EXCEPTION 'FORBIDDEN';
  END IF;
  UPDATE public.notification_outbox
  SET status = 'sent', sent_at = NOW(), updated_at = NOW()
  WHERE id = p_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.mark_outbox_failed(p_id UUID, p_error TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF coalesce(auth.role(), '') <> 'service_role' THEN
    RAISE EXCEPTION 'FORBIDDEN';
  END IF;
  UPDATE public.notification_outbox
  SET
    status = CASE WHEN attempts >= 5 THEN 'failed' ELSE 'pending' END,
    last_error = p_error,
    scheduled_at = NOW() + (INTERVAL '2 minutes' * attempts),
    updated_at = NOW()
  WHERE id = p_id;
END;
$$;

-- ---------------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------------
REVOKE ALL ON FUNCTION public.create_payment_intent(NUMERIC, CHAR, TEXT, public.payment_provider, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.complete_payment_intent(UUID, TEXT, TEXT, JSONB) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.fail_payment_intent(UUID, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.mark_payment_intent_processing(UUID, TEXT, TEXT, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.resolve_dispute(UUID, public.dispute_status, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.claim_notification_outbox(INT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.mark_outbox_sent(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.mark_outbox_failed(UUID, TEXT) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.create_payment_intent(NUMERIC, CHAR, TEXT, public.payment_provider, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.complete_payment_intent(UUID, TEXT, TEXT, JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION public.complete_payment_intent(UUID, TEXT, TEXT, JSONB) TO service_role;
GRANT EXECUTE ON FUNCTION public.fail_payment_intent(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.fail_payment_intent(UUID, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.mark_payment_intent_processing(UUID, TEXT, TEXT, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.resolve_dispute(UUID, public.dispute_status, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.claim_notification_outbox(INT) TO service_role;
GRANT EXECUTE ON FUNCTION public.mark_outbox_sent(UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.mark_outbox_failed(UUID, TEXT) TO service_role;

-- ---------------------------------------------------------------------------
-- Queue invite delivery (email and/or SMS)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.queue_invitation_delivery(
  p_invitation_id UUID,
  p_invite_url TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_inv public.invitations%ROWTYPE;
  v_name TEXT;
  v_queued INT := 0;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'UNAUTHENTICATED');
  END IF;

  SELECT * INTO v_inv FROM public.invitations WHERE id = p_invitation_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'NOT_FOUND');
  END IF;

  IF NOT private.is_circle_admin(v_inv.jamiya_id) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'FORBIDDEN');
  END IF;

  SELECT name INTO v_name FROM public.jamiyas WHERE id = v_inv.jamiya_id;

  IF v_inv.email IS NOT NULL THEN
    PERFORM private.enqueue_delivery(
      'email',
      v_inv.email,
      'You are invited to join ' || coalesce(v_name, 'a circle'),
      'You have been invited to join ' || coalesce(v_name, 'a savings circle on Amanah') ||
        '. Open this link to accept: ' || p_invite_url,
      v_inv.invitee_user_id,
      NULL,
      jsonb_build_object('invitation_id', v_inv.id, 'kind', 'invitation')
    );
    v_queued := v_queued + 1;
  END IF;

  IF v_inv.phone IS NOT NULL THEN
    PERFORM private.enqueue_delivery(
      'sms',
      v_inv.phone,
      NULL,
      'Amanah invite: join ' || coalesce(v_name, 'a circle') || ' — ' || p_invite_url,
      v_inv.invitee_user_id,
      NULL,
      jsonb_build_object('invitation_id', v_inv.id, 'kind', 'invitation')
    );
    v_queued := v_queued + 1;
  END IF;

  RETURN jsonb_build_object('ok', true, 'queued', v_queued);
END;
$$;

REVOKE ALL ON FUNCTION public.queue_invitation_delivery(UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.queue_invitation_delivery(UUID, TEXT) TO authenticated;

-- ---------------------------------------------------------------------------
-- Service settle with Phase 3 KYC + open-dispute gates
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.service_settle_payout(p_payout_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_p public.payouts%ROWTYPE;
  v_member public.members%ROWTYPE;
  v_unpaid INT;
  v_tx UUID;
  v_kyc TEXT;
  v_open_disputes INT;
BEGIN
  IF coalesce(auth.role(), '') <> 'service_role' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'FORBIDDEN');
  END IF;

  SELECT * INTO v_p FROM public.payouts WHERE id = p_payout_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'NOT_FOUND');
  END IF;

  IF v_p.status NOT IN ('scheduled', 'processing') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'NOT_SETTLEABLE');
  END IF;

  SELECT COUNT(*) INTO v_unpaid
  FROM public.contributions
  WHERE jamiya_id = v_p.jamiya_id
    AND cycle_number = v_p.cycle_number
    AND status NOT IN ('paid', 'waived');

  IF v_unpaid > 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'CYCLE_INCOMPLETE', 'unpaid', v_unpaid);
  END IF;

  SELECT * INTO v_member FROM public.members WHERE id = v_p.member_id;

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

  v_tx := private.ledger_credit(
    v_member.user_id, v_p.currency, v_p.amount, 'payout', v_p.jamiya_id,
    'payout:' || v_p.id::text,
    'settle_payout:' || v_p.id::text,
    jsonb_build_object('payout_id', v_p.id, 'cycle', v_p.cycle_number, 'source', 'service')
  );

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
    jsonb_build_object('payout_id', v_p.id, 'jamiya_id', v_p.jamiya_id)
  );

  INSERT INTO public.audit_logs (actor_id, action, entity_type, entity_id, jamiya_id, metadata)
  VALUES (NULL, 'approve', 'payout', v_p.id, v_p.jamiya_id, jsonb_build_object('transaction_id', v_tx, 'source', 'service'));

  RETURN jsonb_build_object('ok', true, 'transaction_id', v_tx);
END;
$$;
