-- Sadaka Option B ops: custody hooks, auto-disburse on target,
-- recurring sponsorship charges, B2C completion RPCs.

-- ---------------------------------------------------------------------------
-- Custody + auto-disburse columns (Option A hooks reserved)
-- ---------------------------------------------------------------------------
ALTER TABLE public.charity_campaigns
  ADD COLUMN IF NOT EXISTS custody_mode TEXT NOT NULL DEFAULT 'amanah_pass_through',
  ADD COLUMN IF NOT EXISTS psp_subaccount_ref TEXT,
  ADD COLUMN IF NOT EXISTS psp_provider TEXT,
  ADD COLUMN IF NOT EXISTS auto_disburse BOOLEAN NOT NULL DEFAULT true;

DO $$ BEGIN
  ALTER TABLE public.charity_campaigns
    ADD CONSTRAINT charity_campaigns_custody_mode_check
    CHECK (custody_mode IN ('amanah_pass_through', 'psp_subaccount'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ---------------------------------------------------------------------------
-- Enqueue auto-disburse when campaign hits goal (short pass-through)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION private.enqueue_auto_disburse_on_funded()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_available NUMERIC;
  v_id UUID;
BEGIN
  IF NEW.status IS DISTINCT FROM 'funded' THEN
    RETURN NEW;
  END IF;
  IF OLD.status IS NOT DISTINCT FROM 'funded' THEN
    RETURN NEW;
  END IF;
  IF NOT COALESCE(NEW.auto_disburse, true) THEN
    RETURN NEW;
  END IF;
  -- Option A (psp_subaccount): funds sit at PSP — do not auto B2C from Amanah float
  IF COALESCE(NEW.custody_mode, 'amanah_pass_through') <> 'amanah_pass_through' THEN
    RETURN NEW;
  END IF;
  IF btrim(COALESCE(NEW.beneficiary_phone, '')) = '' THEN
    RETURN NEW;
  END IF;

  v_available := GREATEST(
    NEW.raised_amount - COALESCE(NEW.disbursed_amount, 0) - COALESCE((
      SELECT SUM(d.net_amount)
      FROM public.charity_disbursements d
      WHERE d.campaign_id = NEW.id
        AND d.status IN ('pending', 'processing')
    ), 0),
    0
  );
  IF v_available <= 0 THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.charity_disbursements (
    campaign_id, amount, fee_deducted, net_amount, currency,
    beneficiary_phone, status, notes
  ) VALUES (
    NEW.id, v_available, 0, v_available, NEW.currency,
    NEW.beneficiary_phone, 'pending',
    'Auto-queued on target reached (Option B short pass-through)'
  )
  RETURNING id INTO v_id;

  IF NEW.created_by IS NOT NULL THEN
    INSERT INTO public.notifications (user_id, type, channel, title, body, data)
    VALUES (
      NEW.created_by, 'system', 'in_app',
      'Campaign funded — disbursement queued',
      'Target reached. KES ' || v_available::text || ' queued for beneficiary M-Pesa.',
      jsonb_build_object('campaign_id', NEW.id, 'disbursement_id', v_id)
    );
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS charity_campaigns_enqueue_auto_disburse ON public.charity_campaigns;
CREATE TRIGGER charity_campaigns_enqueue_auto_disburse
  AFTER UPDATE OF status ON public.charity_campaigns
  FOR EACH ROW
  EXECUTE FUNCTION private.enqueue_auto_disburse_on_funded();

-- ---------------------------------------------------------------------------
-- Claim / complete disbursements (service + admin finalize)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.claim_pending_sadaka_disbursements(p_limit INT DEFAULT 20)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_rows JSONB;
BEGIN
  IF coalesce(auth.role(), '') <> 'service_role' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'FORBIDDEN');
  END IF;

  WITH picked AS (
    SELECT d.id
    FROM public.charity_disbursements d
    WHERE d.status = 'pending'
    ORDER BY d.created_at ASC
    LIMIT GREATEST(COALESCE(p_limit, 20), 1)
    FOR UPDATE SKIP LOCKED
  ),
  upd AS (
    UPDATE public.charity_disbursements d
    SET status = 'processing'
    FROM picked
    WHERE d.id = picked.id
    RETURNING d.id, d.campaign_id, d.net_amount, d.currency, d.beneficiary_phone
  )
  SELECT COALESCE(jsonb_agg(to_jsonb(upd)), '[]'::jsonb) INTO v_rows FROM upd;

  RETURN jsonb_build_object('ok', true, 'disbursements', v_rows);
END;
$$;

REVOKE ALL ON FUNCTION public.claim_pending_sadaka_disbursements(INT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.claim_pending_sadaka_disbursements(INT) TO service_role;

CREATE OR REPLACE FUNCTION public.complete_sadaka_disbursement(
  p_disbursement_id UUID,
  p_success BOOLEAN,
  p_mpesa_b2c_id TEXT DEFAULT NULL,
  p_error TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_d public.charity_disbursements%ROWTYPE;
  v_c public.charity_campaigns%ROWTYPE;
BEGIN
  IF coalesce(auth.role(), '') NOT IN ('service_role')
     AND NOT private.is_compliance_or_admin() THEN
    RETURN jsonb_build_object('ok', false, 'error', 'FORBIDDEN');
  END IF;

  SELECT * INTO v_d FROM public.charity_disbursements WHERE id = p_disbursement_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'NOT_FOUND');
  END IF;
  IF v_d.status = 'paid' THEN
    RETURN jsonb_build_object('ok', true, 'already_paid', true);
  END IF;
  IF v_d.status NOT IN ('pending', 'processing') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'NOT_COMPLETABLE', 'status', v_d.status);
  END IF;

  IF NOT p_success THEN
    UPDATE public.charity_disbursements
    SET status = 'failed',
        notes = COALESCE(notes || E'\n', '') || COALESCE(p_error, 'B2C failed')
    WHERE id = p_disbursement_id;
    RETURN jsonb_build_object('ok', true, 'status', 'failed');
  END IF;

  SELECT * INTO v_c FROM public.charity_campaigns WHERE id = v_d.campaign_id FOR UPDATE;

  UPDATE public.charity_disbursements
  SET status = 'paid',
      mpesa_b2c_id = COALESCE(p_mpesa_b2c_id, mpesa_b2c_id),
      paid_at = NOW()
  WHERE id = p_disbursement_id;

  UPDATE public.charity_campaigns
  SET disbursed_amount = COALESCE(disbursed_amount, 0) + v_d.net_amount,
      last_disbursed_at = NOW(),
      status = CASE
        WHEN COALESCE(disbursed_amount, 0) + v_d.net_amount >= raised_amount
          THEN 'disbursed'::public.campaign_status
        WHEN raised_amount >= goal_amount THEN 'funded'::public.campaign_status
        ELSE status
      END,
      updated_at = NOW()
  WHERE id = v_d.campaign_id;

  IF v_c.created_by IS NOT NULL THEN
    INSERT INTO public.notifications (user_id, type, channel, title, body, data)
    VALUES (
      v_c.created_by, 'system', 'in_app',
      'Campaign disbursed',
      'KES ' || v_d.net_amount::text || ' sent to beneficiary M-Pesa.',
      jsonb_build_object('campaign_id', v_d.campaign_id, 'disbursement_id', p_disbursement_id)
    );
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'status', 'paid',
    'net', v_d.net_amount,
    'mpesa_b2c_id', COALESCE(p_mpesa_b2c_id, 'n/a')
  );
END;
$$;

REVOKE ALL ON FUNCTION public.complete_sadaka_disbursement(UUID, BOOLEAN, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.complete_sadaka_disbursement(UUID, BOOLEAN, TEXT, TEXT) TO authenticated, service_role;

-- Admin manual disburse: queue pending (cron/edge completes via B2C or sim)
CREATE OR REPLACE FUNCTION public.disburse_sadaka_campaign(
  p_campaign_id UUID,
  p_amount NUMERIC DEFAULT NULL,
  p_notes TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_c public.charity_campaigns%ROWTYPE;
  v_gross NUMERIC;
  v_available NUMERIC;
  v_pending NUMERIC;
  v_id UUID;
BEGIN
  IF v_uid IS NULL OR NOT private.is_compliance_or_admin() THEN
    RETURN jsonb_build_object('ok', false, 'error', 'FORBIDDEN');
  END IF;

  SELECT * INTO v_c FROM public.charity_campaigns WHERE id = p_campaign_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'NOT_FOUND');
  END IF;
  IF v_c.status NOT IN ('live', 'funded', 'disbursed') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'NOT_DISBURSABLE');
  END IF;
  IF COALESCE(v_c.custody_mode, 'amanah_pass_through') <> 'amanah_pass_through' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'PSP_CUSTODY_USE_PSP_PORTAL');
  END IF;
  IF btrim(COALESCE(v_c.beneficiary_phone, '')) = '' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'NO_BENEFICIARY_PHONE');
  END IF;

  SELECT COALESCE(SUM(net_amount), 0) INTO v_pending
  FROM public.charity_disbursements
  WHERE campaign_id = p_campaign_id AND status IN ('pending', 'processing');

  v_available := GREATEST(v_c.raised_amount - COALESCE(v_c.disbursed_amount, 0) - v_pending, 0);
  IF v_available <= 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'NOTHING_TO_DISBURSE');
  END IF;

  v_gross := COALESCE(p_amount, v_available);
  IF v_gross <= 0 OR v_gross > v_available THEN
    RETURN jsonb_build_object('ok', false, 'error', 'INVALID_AMOUNT', 'available', v_available);
  END IF;

  INSERT INTO public.charity_disbursements (
    campaign_id, amount, fee_deducted, net_amount, currency,
    beneficiary_phone, status, approved_by, notes
  ) VALUES (
    p_campaign_id, v_gross, 0, v_gross, v_c.currency,
    v_c.beneficiary_phone, 'pending', v_uid,
    COALESCE(p_notes, 'Admin-queued B2C disbursement (Option B)')
  )
  RETURNING id INTO v_id;

  RETURN jsonb_build_object(
    'ok', true,
    'disbursement_id', v_id,
    'net', v_gross,
    'status', 'pending',
    'note', 'Queued for B2C (or simulated completion by sadaka-ops cron).'
  );
END;
$$;

REVOKE ALL ON FUNCTION public.disburse_sadaka_campaign(UUID, NUMERIC, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.disburse_sadaka_campaign(UUID, NUMERIC, TEXT) TO authenticated;

-- ---------------------------------------------------------------------------
-- Recurring sponsorship charges
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.queue_due_sponsorship_charges(p_limit INT DEFAULT 50)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  r RECORD;
  v_fee NUMERIC;
  v_charge UUID;
  v_intent UUID;
  v_provider public.payment_provider;
  v_queued INT := 0;
  v_items JSONB := '[]'::jsonb;
BEGIN
  IF coalesce(auth.role(), '') <> 'service_role' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'FORBIDDEN');
  END IF;

  FOR r IN
    SELECT s.*, ap.fee_bps
    FROM public.sponsorships s
    JOIN public.adoption_profiles ap ON ap.id = s.adoption_profile_id
    WHERE s.status = 'active'
      AND s.next_charge_date <= CURRENT_DATE
      AND NOT EXISTS (
        SELECT 1 FROM public.sponsorship_charges c
        WHERE c.sponsorship_id = s.id AND c.status = 'pending'
      )
    ORDER BY s.next_charge_date ASC
    LIMIT GREATEST(COALESCE(p_limit, 50), 1)
    FOR UPDATE OF s SKIP LOCKED
  LOOP
    v_fee := round(r.monthly_amount * r.fee_bps / 10000.0, 2);
    v_provider := CASE
      WHEN btrim(COALESCE(r.phone, '')) <> '' THEN 'mpesa'::public.payment_provider
      ELSE 'simulated'::public.payment_provider
    END;

    INSERT INTO public.sponsorship_charges (
      sponsorship_id, amount, fee_amount, currency, status, charged_at
    ) VALUES (
      r.id, r.monthly_amount, v_fee, r.currency, 'pending', NOW()
    )
    RETURNING id INTO v_charge;

    INSERT INTO public.payment_intents (
      user_id, provider, status, amount, currency, phone, metadata
    ) VALUES (
      r.sponsor_user_id,
      v_provider,
      'pending',
      r.monthly_amount,
      r.currency,
      r.phone,
      jsonb_build_object(
        'kind', 'sponsorship',
        'sponsorship_id', r.id,
        'charge_id', v_charge,
        'adoption_profile_id', r.adoption_profile_id
      )
    )
    RETURNING id INTO v_intent;

    UPDATE public.sponsorship_charges
    SET payment_intent_id = v_intent
    WHERE id = v_charge;

    -- Hold the due date until paid; bump a day to avoid tight re-queue loops on fail
    UPDATE public.sponsorships
    SET updated_at = NOW()
    WHERE id = r.id;

    v_queued := v_queued + 1;
    v_items := v_items || jsonb_build_array(jsonb_build_object(
      'sponsorship_id', r.id,
      'charge_id', v_charge,
      'intent_id', v_intent,
      'amount', r.monthly_amount,
      'phone', r.phone,
      'provider', v_provider
    ));
  END LOOP;

  RETURN jsonb_build_object('ok', true, 'queued', v_queued, 'items', v_items);
END;
$$;

REVOKE ALL ON FUNCTION public.queue_due_sponsorship_charges(INT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.queue_due_sponsorship_charges(INT) TO service_role;

-- First month: prefer STK intent when phone present; else simulate
CREATE OR REPLACE FUNCTION public.start_sponsorship(
  p_adoption_profile_id UUID,
  p_monthly_amount NUMERIC,
  p_phone TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_ap public.adoption_profiles%ROWTYPE;
  v_id UUID;
  v_charge UUID;
  v_intent UUID;
  v_fee NUMERIC;
  v_phone TEXT;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'UNAUTHENTICATED');
  END IF;
  SELECT * INTO v_ap FROM public.adoption_profiles WHERE id = p_adoption_profile_id;
  IF NOT FOUND OR v_ap.status <> 'active' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'NOT_AVAILABLE');
  END IF;
  IF p_monthly_amount IS NULL OR p_monthly_amount < 100 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'INVALID_AMOUNT');
  END IF;

  v_phone := nullif(btrim(COALESCE(p_phone, '')), '');
  v_fee := round(p_monthly_amount * v_ap.fee_bps / 10000.0, 2);

  INSERT INTO public.sponsorships (
    adoption_profile_id, sponsor_user_id, monthly_amount, currency, phone, next_charge_date
  ) VALUES (
    p_adoption_profile_id, v_uid, p_monthly_amount, v_ap.currency,
    v_phone,
    CURRENT_DATE + 30
  )
  RETURNING id INTO v_id;

  IF v_phone IS NOT NULL THEN
    INSERT INTO public.sponsorship_charges (
      sponsorship_id, amount, fee_amount, currency, status, charged_at
    ) VALUES (v_id, p_monthly_amount, v_fee, v_ap.currency, 'pending', NOW())
    RETURNING id INTO v_charge;

    INSERT INTO public.payment_intents (
      user_id, provider, status, amount, currency, phone, metadata
    ) VALUES (
      v_uid, 'mpesa', 'pending', p_monthly_amount, v_ap.currency, v_phone,
      jsonb_build_object(
        'kind', 'sponsorship',
        'sponsorship_id', v_id,
        'charge_id', v_charge,
        'adoption_profile_id', p_adoption_profile_id
      )
    )
    RETURNING id INTO v_intent;

    UPDATE public.sponsorship_charges SET payment_intent_id = v_intent WHERE id = v_charge;

    RETURN jsonb_build_object(
      'ok', true,
      'sponsorship_id', v_id,
      'charge_id', v_charge,
      'intent_id', v_intent,
      'needs_stk', true,
      'amount', p_monthly_amount,
      'phone', v_phone
    );
  END IF;

  INSERT INTO public.sponsorship_charges (
    sponsorship_id, amount, fee_amount, currency, status
  ) VALUES (v_id, p_monthly_amount, v_fee, v_ap.currency, 'paid')
  RETURNING id INTO v_charge;

  RETURN jsonb_build_object(
    'ok', true,
    'sponsorship_id', v_id,
    'first_charge_id', v_charge,
    'needs_stk', false,
    'note', 'First month recorded (simulated - add M-Pesa phone for live STK).'
  );
END;
$$;

REVOKE ALL ON FUNCTION public.start_sponsorship(UUID, NUMERIC, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.start_sponsorship(UUID, NUMERIC, TEXT) TO authenticated;

-- Allow sponsorship kind on create_payment_intent
CREATE OR REPLACE FUNCTION public.create_payment_intent(
  p_amount NUMERIC,
  p_currency CHAR(3) DEFAULT 'KES',
  p_phone TEXT DEFAULT NULL,
  p_provider public.payment_provider DEFAULT 'simulated',
  p_idempotency_key TEXT DEFAULT NULL,
  p_metadata JSONB DEFAULT '{}'::jsonb
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_intent public.payment_intents%ROWTYPE;
  v_min NUMERIC := 100;
  v_kind TEXT := coalesce(p_metadata->>'kind', 'wallet_top_up');
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'UNAUTHENTICATED');
  END IF;

  IF v_kind IN ('sadaka', 'platform_tip') THEN
    v_min := 10;
  ELSIF v_kind = 'sponsorship' THEN
    v_min := 100;
  END IF;

  IF p_amount IS NULL OR p_amount < v_min OR p_amount > 10000000 THEN
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
    jsonb_build_object('initiated_at', NOW(), 'kind', v_kind) || coalesce(p_metadata, '{}'::jsonb)
  )
  RETURNING * INTO v_intent;

  INSERT INTO public.audit_logs (actor_id, action, entity_type, entity_id, metadata)
  VALUES (
    v_uid, 'create', 'payment_intent', v_intent.id,
    jsonb_build_object('provider', p_provider, 'amount', p_amount, 'kind', v_kind)
  );

  RETURN jsonb_build_object(
    'ok', true,
    'intent_id', v_intent.id,
    'status', v_intent.status,
    'provider', v_intent.provider,
    'amount', v_intent.amount,
    'currency', v_intent.currency,
    'kind', v_kind
  );
END;
$$;

REVOKE ALL ON FUNCTION public.create_payment_intent(NUMERIC, CHAR, TEXT, public.payment_provider, TEXT, JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_payment_intent(NUMERIC, CHAR, TEXT, public.payment_provider, TEXT, JSONB) TO authenticated;

-- Complete payment: add sponsorship fulfillment
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
  v_kind TEXT;
  v_tip_id UUID;
BEGIN
  IF coalesce(auth.role(), '') NOT IN ('service_role', 'authenticated') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'FORBIDDEN');
  END IF;

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

  v_kind := coalesce(v_intent.metadata->>'kind', 'wallet_top_up');

  IF v_kind = 'sponsorship' THEN
    DECLARE
      v_charge_id UUID := nullif(v_intent.metadata->>'charge_id', '')::uuid;
      v_sponsorship_id UUID := nullif(v_intent.metadata->>'sponsorship_id', '')::uuid;
    BEGIN
      IF v_charge_id IS NOT NULL THEN
        UPDATE public.sponsorship_charges
        SET status = 'paid', charged_at = NOW()
        WHERE id = v_charge_id AND status IN ('pending', 'failed');
      END IF;
      IF v_sponsorship_id IS NOT NULL THEN
        UPDATE public.sponsorships
        SET next_charge_date = CURRENT_DATE + 30,
            updated_at = NOW()
        WHERE id = v_sponsorship_id AND status = 'active';
      END IF;

      UPDATE public.payment_intents
      SET
        status = 'completed',
        provider_reference = coalesce(p_provider_reference, provider_reference),
        checkout_request_id = coalesce(p_checkout_request_id, checkout_request_id),
        completed_at = NOW(),
        metadata = metadata || coalesce(p_metadata, '{}'::jsonb),
        updated_at = NOW()
      WHERE id = v_intent.id;

      IF v_intent.user_id IS NOT NULL THEN
        INSERT INTO public.notifications (user_id, type, channel, title, body, data)
        VALUES (
          v_intent.user_id, 'system', 'in_app',
          'Sponsorship payment received',
          'JazakAllah khair. Your monthly sponsorship of ' ||
            v_intent.amount::text || ' ' || v_intent.currency || ' was recorded.',
          jsonb_build_object(
            'sponsorship_id', v_sponsorship_id,
            'charge_id', v_charge_id
          )
        );
      END IF;

      RETURN jsonb_build_object(
        'ok', true,
        'kind', 'sponsorship',
        'charge_id', v_charge_id,
        'sponsorship_id', v_sponsorship_id
      );
    END;
  END IF;

  IF v_kind = 'sadaka' THEN
    IF v_intent.metadata->>'campaign_id' IS NULL THEN
      RETURN jsonb_build_object('ok', false, 'error', 'CAMPAIGN_REQUIRED');
    END IF;

    DECLARE
      v_c public.charity_campaigns%ROWTYPE;
      v_fee NUMERIC := 0;
      v_net NUMERIC;
      v_receipt TEXT;
      v_donation_id UUID;
      v_campaign_id UUID := (v_intent.metadata->>'campaign_id')::uuid;
    BEGIN
      SELECT * INTO v_c FROM public.charity_campaigns WHERE id = v_campaign_id FOR UPDATE;
      IF NOT FOUND OR v_c.status <> 'live' THEN
        RETURN jsonb_build_object('ok', false, 'error', 'CAMPAIGN_UNAVAILABLE');
      END IF;

      IF v_c.fee_mode = 'donation_addon' THEN
        v_fee := round(v_intent.amount * v_c.fee_bps / 10000.0, 2);
        v_net := v_intent.amount;
      ELSIF v_c.fee_mode = 'donation_deduct' THEN
        v_fee := round(v_intent.amount * v_c.fee_bps / 10000.0, 2);
        v_net := v_intent.amount - v_fee;
      ELSE
        v_net := v_intent.amount;
      END IF;

      v_receipt := 'AMA-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 10));

      INSERT INTO public.charity_donations (
        campaign_id, donor_user_id, donor_name, donor_phone, donor_email,
        amount, fee_amount, currency, receipt_code, is_anonymous, payment_intent_id
      ) VALUES (
        v_campaign_id, v_intent.user_id,
        v_intent.metadata->>'donor_name',
        coalesce(v_intent.phone, v_intent.metadata->>'donor_phone'),
        v_intent.metadata->>'donor_email',
        v_net, v_fee, v_c.currency, v_receipt,
        coalesce((v_intent.metadata->>'is_anonymous')::boolean, false),
        v_intent.id
      ) RETURNING id INTO v_donation_id;

      UPDATE public.charity_campaigns
      SET raised_amount = raised_amount + v_net
      WHERE id = v_campaign_id;

      UPDATE public.payment_intents
      SET
        status = 'completed',
        provider_reference = coalesce(p_provider_reference, provider_reference),
        checkout_request_id = coalesce(p_checkout_request_id, checkout_request_id),
        completed_at = NOW(),
        metadata = metadata || coalesce(p_metadata, '{}'::jsonb) ||
          jsonb_build_object('donation_id', v_donation_id, 'receipt_code', v_receipt),
        updated_at = NOW()
      WHERE id = v_intent.id;

      IF v_intent.user_id IS NOT NULL THEN
        INSERT INTO public.notifications (user_id, type, channel, title, body, data)
        VALUES (
          v_intent.user_id, 'system', 'in_app',
          'Donation receipt ' || v_receipt,
          'JazakAllah khair. Your gift of ' || v_net || ' ' || v_c.currency ||
            ' to ' || v_c.title || ' was recorded.',
          jsonb_build_object('donation_id', v_donation_id, 'receipt', v_receipt)
        );
      END IF;

      RETURN jsonb_build_object(
        'ok', true,
        'kind', 'sadaka',
        'donation_id', v_donation_id,
        'receipt_code', v_receipt
      );
    END;
  END IF;

  IF v_kind = 'platform_tip' THEN
    INSERT INTO public.platform_tips (user_id, amount, currency, phone, payment_intent_id)
    VALUES (v_intent.user_id, v_intent.amount, v_intent.currency, v_intent.phone, v_intent.id)
    RETURNING id INTO v_tip_id;

    UPDATE public.payment_intents
    SET
      status = 'completed',
      provider_reference = coalesce(p_provider_reference, provider_reference),
      checkout_request_id = coalesce(p_checkout_request_id, checkout_request_id),
      completed_at = NOW(),
      metadata = metadata || coalesce(p_metadata, '{}'::jsonb) || jsonb_build_object('tip_id', v_tip_id),
      updated_at = NOW()
    WHERE id = v_intent.id;

    RETURN jsonb_build_object('ok', true, 'kind', 'platform_tip', 'tip_id', v_tip_id);
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

REVOKE ALL ON FUNCTION public.complete_payment_intent(UUID, TEXT, TEXT, JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.complete_payment_intent(UUID, TEXT, TEXT, JSONB) TO authenticated, service_role;

-- Mark sponsorship charge failed when STK fails
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
  v_charge_id UUID;
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

  IF coalesce(v_intent.metadata->>'kind', '') = 'sponsorship' THEN
    v_charge_id := nullif(v_intent.metadata->>'charge_id', '')::uuid;
    IF v_charge_id IS NOT NULL THEN
      UPDATE public.sponsorship_charges
      SET status = 'failed'
      WHERE id = v_charge_id AND status = 'pending';
    END IF;
  END IF;

  RETURN jsonb_build_object('ok', true);
END;
$$;

REVOKE ALL ON FUNCTION public.fail_payment_intent(UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.fail_payment_intent(UUID, TEXT) TO authenticated, service_role;
