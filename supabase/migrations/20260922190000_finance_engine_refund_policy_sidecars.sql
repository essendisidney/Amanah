-- Finance engine wave: refund maker-checker + contribution/sadaka sidecar reverse.

ALTER TABLE public.charity_donations
  ADD COLUMN IF NOT EXISTS metadata JSONB NOT NULL DEFAULT '{}'::jsonb;

INSERT INTO public.platform_settings (key, value)
VALUES (
  'dual_approval_refunds',
  '{"enabled": true, "threshold": 10000}'::jsonb
)
ON CONFLICT (key) DO NOTHING;

ALTER TABLE public.dual_approval_requests
  DROP CONSTRAINT IF EXISTS dual_approval_requests_kind_check;

ALTER TABLE public.dual_approval_requests
  ADD CONSTRAINT dual_approval_requests_kind_check
  CHECK (kind IN (
    'withdrawal',
    'payout_settle',
    'qard_decide',
    'treasury_b2b_payout',
    'refund'
  ));

CREATE OR REPLACE FUNCTION private.platform_refund_dual_required(p_amount NUMERIC)
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
  SELECT value INTO v FROM public.platform_settings WHERE key = 'dual_approval_refunds';
  IF v IS NULL THEN
    RETURN coalesce(p_amount, 0) >= 10000;
  END IF;
  v_enabled := coalesce((v->>'enabled')::boolean, true);
  v_threshold := coalesce((v->>'threshold')::numeric, 10000);
  RETURN v_enabled AND coalesce(p_amount, 0) >= v_threshold;
END;
$$;

-- ---------------------------------------------------------------------------
-- Sidecar reverse helpers (never edit posted journal lines)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION private.reverse_contribution_for_refund(
  p_intent public.payment_intents,
  p_refund public.refunds
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_contribution_id UUID := nullif(p_intent.metadata->>'contribution_id', '')::uuid;
  v_c public.contributions%ROWTYPE;
  v_member public.members%ROWTYPE;
  v_new_paid NUMERIC;
  v_new_status public.contribution_status;
  v_bank UUID;
  v_tx UUID;
  v_key TEXT;
BEGIN
  IF v_contribution_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'NO_CONTRIBUTION');
  END IF;

  SELECT * INTO v_c FROM public.contributions WHERE id = v_contribution_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'CONTRIBUTION_NOT_FOUND');
  END IF;

  v_new_paid := greatest(coalesce(v_c.amount_paid, 0) - p_refund.amount, 0);
  IF v_new_paid <= 0 THEN
    v_new_status := 'pending';
  ELSIF v_new_paid < v_c.amount THEN
    v_new_status := 'partial';
  ELSE
    v_new_status := 'paid';
  END IF;

  UPDATE public.contributions
  SET
    amount_paid = v_new_paid,
    status = v_new_status,
    paid_at = CASE WHEN v_new_status = 'paid' THEN paid_at ELSE NULL END,
    updated_at = NOW()
  WHERE id = v_c.id;

  -- Return funds to member wallet (contribution path had netted to zero).
  v_tx := private.ledger_credit(
    p_intent.user_id,
    p_refund.currency,
    p_refund.amount,
    'refund'::public.transaction_type,
    v_c.jamiya_id,
    'refund_contribution:' || p_refund.id::text,
    'refund_contribution:' || p_refund.id::text,
    jsonb_build_object(
      'refund_id', p_refund.id,
      'contribution_id', v_c.id,
      'payment_intent_id', p_intent.id
    )
  );

  SELECT id INTO v_bank
  FROM public.circle_bank_accounts
  WHERE jamiya_id = v_c.jamiya_id AND is_active
  ORDER BY CASE WHEN account_kind = 'mpesa' THEN 0 ELSE 1 END, created_at
  LIMIT 1;

  IF v_bank IS NOT NULL THEN
    UPDATE public.circle_bank_accounts
    SET balance = balance - p_refund.amount, updated_at = NOW()
    WHERE id = v_bank;
  END IF;

  SELECT * INTO v_member FROM public.members WHERE id = v_c.member_id;

  v_key := 'refund:' || p_refund.id::text;
  IF NOT EXISTS (
    SELECT 1 FROM public.book_entries b
    WHERE b.jamiya_id = v_c.jamiya_id AND b.metadata->>'bridge_key' = v_key
  ) THEN
    INSERT INTO public.book_entries (
      jamiya_id, member_id, entry_type, amount, currency, effective_date,
      entered_by, notes, bank_account_id, metadata
    ) VALUES (
      v_c.jamiya_id,
      v_c.member_id,
      'adjustment',
      p_refund.amount,
      p_refund.currency,
      CURRENT_DATE,
      p_intent.user_id,
      'Refund: reverse contribution payment',
      v_bank,
      jsonb_build_object(
        'bridge_key', v_key,
        'refund_id', p_refund.id,
        'contribution_id', v_c.id,
        'payment_intent_id', p_intent.id,
        'direction', 'reversal',
        'source', 'finance_refund'
      )
    );
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'contribution_id', v_c.id,
    'wallet_tx_id', v_tx,
    'new_status', v_new_status,
    'new_paid', v_new_paid
  );
END;
$$;

CREATE OR REPLACE FUNCTION private.reverse_sadaka_for_refund(
  p_intent public.payment_intents,
  p_refund public.refunds
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_donation_id UUID := nullif(p_intent.metadata->>'donation_id', '')::uuid;
  v_campaign_id UUID := nullif(p_intent.metadata->>'campaign_id', '')::uuid;
  v_d public.charity_donations%ROWTYPE;
  v_net NUMERIC;
  v_tx UUID;
BEGIN
  IF v_donation_id IS NULL THEN
    SELECT id INTO v_donation_id
    FROM public.charity_donations
    WHERE payment_intent_id = p_intent.id
    LIMIT 1;
  END IF;

  IF v_donation_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'NO_DONATION');
  END IF;

  SELECT * INTO v_d FROM public.charity_donations WHERE id = v_donation_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'DONATION_NOT_FOUND');
  END IF;

  IF coalesce((v_d.metadata->>'refunded')::boolean, false) THEN
    RETURN jsonb_build_object('ok', true, 'idempotent', true, 'donation_id', v_d.id);
  END IF;

  v_net := least(p_refund.amount, v_d.amount);
  v_campaign_id := coalesce(v_campaign_id, v_d.campaign_id);

  UPDATE public.charity_campaigns
  SET raised_amount = greatest(raised_amount - v_net, 0)
  WHERE id = v_campaign_id;

  UPDATE public.charity_donations
  SET metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object(
    'refunded', true,
    'refund_id', p_refund.id,
    'refunded_amount', v_net,
    'refunded_at', NOW()
  )
  WHERE id = v_d.id;

  v_tx := private.ledger_credit(
    p_intent.user_id,
    p_refund.currency,
    v_net,
    'refund'::public.transaction_type,
    NULL,
    'refund_sadaka:' || p_refund.id::text,
    'refund_sadaka:' || p_refund.id::text,
    jsonb_build_object(
      'refund_id', p_refund.id,
      'donation_id', v_d.id,
      'campaign_id', v_campaign_id,
      'payment_intent_id', p_intent.id
    )
  );

  RETURN jsonb_build_object(
    'ok', true,
    'donation_id', v_d.id,
    'campaign_id', v_campaign_id,
    'wallet_tx_id', v_tx,
    'amount', v_net
  );
END;
$$;

-- ---------------------------------------------------------------------------
-- complete_refund: dual gate + sidecar reverse
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.complete_refund(
  p_refund_id UUID,
  p_provider_reference TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_refund public.refunds%ROWTYPE;
  v_intent public.payment_intents%ROWTYPE;
  v_kind TEXT;
  v_domain TEXT;
  v_debit TEXT;
  v_credit TEXT;
  v_desc TEXT;
  v_entry UUID;
  v_tx UUID;
  v_dual JSONB;
  v_sidecar JSONB := '{}'::jsonb;
  v_uid UUID := auth.uid();
BEGIN
  IF coalesce(auth.role(), '') <> 'service_role'
     AND NOT private.is_platform_admin() THEN
    RETURN jsonb_build_object('ok', false, 'error', 'FORBIDDEN');
  END IF;

  SELECT * INTO v_refund FROM public.refunds WHERE id = p_refund_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'NOT_FOUND');
  END IF;

  IF v_refund.status = 'completed' THEN
    RETURN jsonb_build_object('ok', true, 'refund_id', v_refund.id, 'idempotent', true);
  END IF;

  IF v_refund.status NOT IN ('pending', 'processing') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'INVALID_STATUS', 'status', v_refund.status);
  END IF;

  -- Maker-checker for large refunds (platform setting)
  IF private.platform_refund_dual_required(v_refund.amount)
     AND NOT coalesce((v_refund.metadata->>'dual_approved')::boolean, false) THEN
    IF v_uid IS NULL THEN
      RETURN jsonb_build_object('ok', false, 'error', 'DUAL_REQUIRED');
    END IF;
    v_dual := public.propose_dual_approval(
      'refund',
      v_refund.id,
      v_refund.amount,
      v_refund.currency,
      NULL,
      jsonb_build_object(
        'refund_id', v_refund.id,
        'payment_intent_id', v_refund.payment_intent_id,
        'reason', v_refund.reason
      )
    );
    UPDATE public.refunds
    SET
      metadata = metadata || jsonb_build_object(
        'dual_pending', true,
        'dual_request_id', v_dual->>'request_id'
      ),
      updated_at = NOW()
    WHERE id = p_refund_id;
    RETURN jsonb_build_object(
      'ok', true,
      'pending_dual_approval', true,
      'request_id', v_dual->>'request_id',
      'refund_id', p_refund_id
    );
  END IF;

  UPDATE public.refunds
  SET status = 'processing', updated_at = NOW()
  WHERE id = p_refund_id AND status = 'pending';

  SELECT * INTO v_intent
  FROM public.payment_intents
  WHERE id = v_refund.payment_intent_id;

  IF NOT FOUND THEN
    UPDATE public.refunds SET
      status = 'failed',
      updated_at = NOW(),
      metadata = metadata || jsonb_build_object(
        'complete_error', 'INTENT_MISSING', 'failed_at', NOW()
      )
    WHERE id = p_refund_id;
    RETURN jsonb_build_object('ok', false, 'error', 'INTENT_MISSING');
  END IF;

  v_kind := coalesce(nullif(trim(v_intent.metadata->>'kind'), ''), 'wallet_top_up');

  CASE v_kind
    WHEN 'contribution' THEN
      v_domain := 'CONTRIBUTIONS';
      v_debit := '3000';
      v_credit := '1000';
      v_desc := 'Contribution refund';
    WHEN 'sadaka' THEN
      v_domain := 'SADAKA';
      v_debit := '5000';
      v_credit := '1000';
      v_desc := 'Sadaka refund';
    WHEN 'sponsorship' THEN
      v_domain := 'TAKAFUL';
      v_debit := '6000';
      v_credit := '1000';
      v_desc := 'Sponsorship refund';
    WHEN 'platform_tip' THEN
      v_domain := 'OPERATING';
      v_debit := '2100';
      v_credit := '1000';
      v_desc := 'Platform tip refund';
    ELSE
      v_domain := 'OPERATING';
      v_debit := '2000';
      v_credit := '1000';
      v_desc := 'Wallet top-up refund';
  END CASE;

  BEGIN
    IF v_kind = 'wallet_top_up' THEN
      v_tx := private.ledger_debit(
        v_intent.user_id,
        v_refund.currency,
        v_refund.amount,
        'refund'::public.transaction_type,
        NULL,
        'refund:' || v_refund.id::text,
        'refund:' || v_refund.id::text,
        jsonb_build_object(
          'refund_id', v_refund.id,
          'payment_intent_id', v_intent.id,
          'kind', v_kind
        )
      );
    ELSIF v_kind = 'contribution' THEN
      v_sidecar := private.reverse_contribution_for_refund(v_intent, v_refund);
      IF coalesce((v_sidecar->>'ok')::boolean, false) IS NOT TRUE THEN
        RAISE EXCEPTION '%', coalesce(v_sidecar->>'error', 'CONTRIBUTION_REVERSE_FAILED');
      END IF;
      v_tx := nullif(v_sidecar->>'wallet_tx_id', '')::uuid;
    ELSIF v_kind = 'sadaka' THEN
      v_sidecar := private.reverse_sadaka_for_refund(v_intent, v_refund);
      IF coalesce((v_sidecar->>'ok')::boolean, false) IS NOT TRUE THEN
        RAISE EXCEPTION '%', coalesce(v_sidecar->>'error', 'SADAKA_REVERSE_FAILED');
      END IF;
      v_tx := nullif(v_sidecar->>'wallet_tx_id', '')::uuid;
    END IF;
  EXCEPTION
    WHEN OTHERS THEN
      UPDATE public.refunds
      SET
        status = 'failed',
        updated_at = NOW(),
        metadata = metadata || jsonb_build_object(
          'complete_error', SQLERRM,
          'failed_at', NOW()
        )
      WHERE id = p_refund_id;
      RETURN jsonb_build_object('ok', false, 'error', SQLERRM);
  END;

  v_entry := private.post_balanced_journal(
    'refund',
    v_refund.id::text,
    v_domain,
    v_desc,
    v_refund.currency,
    v_debit,
    v_credit,
    v_refund.amount,
    v_intent.id,
    NULL,
    v_intent.user_id,
    jsonb_build_object(
      'refund_id', v_refund.id,
      'kind', v_kind,
      'original_source', 'payment_intent',
      'wallet_tx_id', v_tx,
      'sidecar', v_sidecar
    )
  );

  UPDATE public.refunds
  SET
    status = 'completed',
    journal_entry_id = v_entry,
    provider_reference = coalesce(nullif(trim(p_provider_reference), ''), provider_reference),
    completed_at = NOW(),
    updated_at = NOW(),
    metadata = metadata || jsonb_build_object(
      'completed_at', NOW(),
      'wallet_tx_id', v_tx,
      'journal_entry_id', v_entry,
      'sidecar', v_sidecar,
      'dual_pending', false
    )
  WHERE id = p_refund_id;

  UPDATE public.payment_intents
  SET
    settlement_status = CASE
      WHEN settlement_status IN ('settled', 'disputed') THEN 'disputed'
      ELSE settlement_status
    END,
    reconcile_status = 'exception',
    metadata = metadata || jsonb_build_object(
      'refund_completed_id', p_refund_id,
      'refund_completed_at', NOW()
    ),
    updated_at = NOW()
  WHERE id = v_intent.id;

  RETURN jsonb_build_object(
    'ok', true,
    'refund_id', p_refund_id,
    'journal_entry_id', v_entry,
    'transaction_id', v_tx,
    'sidecar', v_sidecar
  );
END;
$$;

-- ---------------------------------------------------------------------------
-- Extend propose / confirm for refund kind
-- ---------------------------------------------------------------------------
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
  v_payload JSONB := coalesce(p_payload, '{}'::jsonb);
  v_w public.withdrawal_requests%ROWTYPE;
  v_tp public.treasury_payout_requests%ROWTYPE;
  v_rf public.refunds%ROWTYPE;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'UNAUTHENTICATED');
  END IF;
  IF p_kind NOT IN (
    'withdrawal', 'payout_settle', 'qard_decide', 'treasury_b2b_payout', 'refund'
  ) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'INVALID_KIND');
  END IF;

  IF p_kind = 'withdrawal' THEN
    SELECT * INTO v_w FROM public.withdrawal_requests WHERE id = p_entity_id;
    IF FOUND THEN
      v_payload := v_payload || jsonb_build_object(
        'destination_type', v_w.destination_type,
        'destination_phone', v_w.destination_phone,
        'destination_id', v_w.destination_id,
        'bank_name', v_w.bank_name,
        'bank_account_number', v_w.bank_account_number,
        'user_id', v_w.user_id
      );
    END IF;
  ELSIF p_kind = 'treasury_b2b_payout' THEN
    SELECT * INTO v_tp FROM public.treasury_payout_requests WHERE id = p_entity_id;
    IF FOUND THEN
      v_payload := v_payload || coalesce(v_tp.metadata, '{}'::jsonb) || jsonb_build_object(
        'payout_id', v_tp.id,
        'jamiya_id', v_tp.jamiya_id
      );
    END IF;
  ELSIF p_kind = 'refund' THEN
    IF NOT private.is_platform_admin() THEN
      RETURN jsonb_build_object('ok', false, 'error', 'FORBIDDEN');
    END IF;
    SELECT * INTO v_rf FROM public.refunds WHERE id = p_entity_id;
    IF FOUND THEN
      v_payload := v_payload || jsonb_build_object(
        'refund_id', v_rf.id,
        'payment_intent_id', v_rf.payment_intent_id,
        'reason', v_rf.reason,
        'status', v_rf.status
      );
    END IF;
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
    'pending', v_uid, v_uid, v_payload
  )
  RETURNING id INTO v_id;

  INSERT INTO public.audit_logs (actor_id, action, entity_type, entity_id, metadata)
  VALUES (
    v_uid, 'create', 'dual_approval_request', v_id,
    jsonb_build_object('kind', p_kind, 'entity_id', p_entity_id, 'amount', p_amount)
  );

  IF p_kind IN ('withdrawal', 'refund') THEN
    INSERT INTO public.notifications (user_id, type, channel, title, body, data)
    SELECT
      p.id, 'system', 'in_app',
      CASE
        WHEN p_kind = 'refund' THEN 'Refund needs second approval'
        ELSE 'Withdrawal needs second approval'
      END,
      'KES ' || coalesce(p_amount, 0)::text || ' awaits a second approver.',
      jsonb_build_object(
        'dual_approval_id', v_id,
        'kind', p_kind,
        'entity_id', p_entity_id
      )
    FROM public.profiles p
    WHERE p.platform_role IN ('compliance_officer', 'platform_admin', 'super_admin')
      AND p.id IS DISTINCT FROM v_uid;
  END IF;

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

  IF v_req.kind IN ('withdrawal', 'refund') THEN
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

    IF v_req.kind = 'treasury_b2b_payout' THEN
      UPDATE public.treasury_payout_requests
      SET status = 'cancelled',
          error_message = 'Rejected by second officer',
          updated_at = NOW()
      WHERE id = v_req.entity_id AND status = 'pending';
    ELSIF v_req.kind = 'refund' THEN
      UPDATE public.refunds
      SET metadata = metadata || jsonb_build_object(
            'dual_pending', false,
            'dual_rejected', true,
            'dual_rejected_at', NOW()
          ),
          updated_at = NOW()
      WHERE id = v_req.entity_id;
    END IF;

    RETURN jsonb_build_object('ok', true, 'status', 'rejected');
  END IF;

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

  IF v_req.kind = 'treasury_b2b_payout' THEN
    UPDATE public.treasury_payout_requests
    SET status = 'approved',
        metadata = coalesce(metadata, '{}'::jsonb) ||
          jsonb_build_object(
            'ready_to_disburse', true,
            'dual_approval_request_id', v_req.id
          ),
        updated_at = NOW()
    WHERE id = v_req.entity_id AND status = 'pending';

    v_result := jsonb_build_object(
      'ok', true,
      'ready_to_disburse', true,
      'payout_id', v_req.entity_id
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
      jsonb_build_object('result', v_result, 'deferred_b2b', true)
    );

    RETURN jsonb_build_object(
      'ok', true,
      'status', 'approved',
      'ready_to_disburse', true,
      'payout_id', v_req.entity_id,
      'result', v_result,
      'request_id', v_req.id
    );
  END IF;

  IF v_req.kind = 'refund' THEN
    UPDATE public.refunds
    SET metadata = coalesce(metadata, '{}'::jsonb) ||
          jsonb_build_object(
            'dual_approved', true,
            'dual_approval_request_id', v_req.id,
            'dual_pending', false
          ),
        updated_at = NOW()
    WHERE id = v_req.entity_id;

    v_result := public.complete_refund(v_req.entity_id, NULL);

    UPDATE public.dual_approval_requests
    SET
      status = CASE
        WHEN coalesce((v_result->>'ok')::boolean, false)
             AND coalesce((v_result->>'pending_dual_approval')::boolean, false) IS NOT TRUE
        THEN 'executed'
        ELSE 'approved'
      END,
      second_approver_id = v_uid,
      result = v_result,
      updated_at = NOW()
    WHERE id = v_req.id;

    INSERT INTO public.audit_logs (actor_id, action, entity_type, entity_id, metadata)
    VALUES (
      v_uid, 'approve', 'dual_approval_request', v_req.id,
      jsonb_build_object('result', v_result, 'kind', 'refund')
    );

    RETURN jsonb_build_object(
      'ok', coalesce((v_result->>'ok')::boolean, false),
      'status', 'executed',
      'refund_id', v_req.entity_id,
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
