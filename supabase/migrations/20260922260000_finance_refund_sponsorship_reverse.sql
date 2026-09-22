-- Refund reverse coverage: sponsorship sidecar + fail-closed unsupported kinds.
-- wallet_top_up (incl. blank kind) always ledger_debits; tip reverses income only.

ALTER TABLE public.sponsorship_charges
  ADD COLUMN IF NOT EXISTS metadata JSONB NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE public.sponsorships
  ADD COLUMN IF NOT EXISTS metadata JSONB NOT NULL DEFAULT '{}'::jsonb;

CREATE OR REPLACE FUNCTION private.reverse_sponsorship_for_refund(
  p_intent public.payment_intents,
  p_refund public.refunds
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_charge_id UUID := nullif(p_intent.metadata->>'charge_id', '')::uuid;
  v_sponsorship_id UUID := nullif(p_intent.metadata->>'sponsorship_id', '')::uuid;
  v_charge public.sponsorship_charges%ROWTYPE;
  v_net NUMERIC;
  v_tx UUID;
BEGIN
  IF v_charge_id IS NULL THEN
    SELECT id INTO v_charge_id
    FROM public.sponsorship_charges
    WHERE payment_intent_id = p_intent.id
    LIMIT 1;
  END IF;

  IF v_charge_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'NO_SPONSORSHIP_CHARGE');
  END IF;

  SELECT * INTO v_charge
  FROM public.sponsorship_charges
  WHERE id = v_charge_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'CHARGE_NOT_FOUND');
  END IF;

  IF coalesce((v_charge.metadata->>'refunded')::boolean, false) THEN
    RETURN jsonb_build_object(
      'ok', true,
      'idempotent', true,
      'charge_id', v_charge.id,
      'sponsorship_id', coalesce(v_sponsorship_id, v_charge.sponsorship_id)
    );
  END IF;

  v_net := least(p_refund.amount, v_charge.amount);
  v_sponsorship_id := coalesce(v_sponsorship_id, v_charge.sponsorship_id);

  -- Keep status in {pending,paid,failed}; mark refund in metadata (no 'refunded' status).
  UPDATE public.sponsorship_charges
  SET
    metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object(
      'refunded', true,
      'refund_id', p_refund.id,
      'refunded_amount', v_net,
      'refunded_at', NOW(),
      'prior_status', status
    ),
    status = CASE WHEN status = 'paid' THEN 'failed' ELSE status END
  WHERE id = v_charge.id;

  IF v_sponsorship_id IS NOT NULL THEN
    UPDATE public.sponsorships
    SET
      metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object(
        'last_refund_id', p_refund.id,
        'last_refund_at', NOW(),
        'last_refund_charge_id', v_charge.id
      ),
      updated_at = NOW()
    WHERE id = v_sponsorship_id;
  END IF;

  v_tx := private.ledger_credit(
    p_intent.user_id,
    p_refund.currency,
    v_net,
    'refund'::public.transaction_type,
    NULL,
    'refund_sponsorship:' || p_refund.id::text,
    'refund_sponsorship:' || p_refund.id::text,
    jsonb_build_object(
      'refund_id', p_refund.id,
      'charge_id', v_charge.id,
      'sponsorship_id', v_sponsorship_id,
      'payment_intent_id', p_intent.id
    )
  );

  RETURN jsonb_build_object(
    'ok', true,
    'charge_id', v_charge.id,
    'sponsorship_id', v_sponsorship_id,
    'wallet_tx_id', v_tx,
    'amount', v_net
  );
END;
$$;

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

  IF v_kind NOT IN (
    'wallet_top_up', 'contribution', 'sadaka', 'sponsorship', 'platform_tip'
  ) THEN
    UPDATE public.refunds
    SET
      status = 'failed',
      updated_at = NOW(),
      metadata = metadata || jsonb_build_object(
        'complete_error', 'UNSUPPORTED_KIND',
        'kind', v_kind,
        'failed_at', NOW()
      )
    WHERE id = p_refund_id;
    RETURN jsonb_build_object('ok', false, 'error', 'UNSUPPORTED_KIND', 'kind', v_kind);
  END IF;

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
      -- wallet_top_up
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
    ELSIF v_kind = 'sponsorship' THEN
      v_sidecar := private.reverse_sponsorship_for_refund(v_intent, v_refund);
      IF coalesce((v_sidecar->>'ok')::boolean, false) IS NOT TRUE THEN
        RAISE EXCEPTION '%', coalesce(v_sidecar->>'error', 'SPONSORSHIP_REVERSE_FAILED');
      END IF;
      v_tx := nullif(v_sidecar->>'wallet_tx_id', '')::uuid;
    END IF;
    -- platform_tip: journal-only reverse of tip income (never hit wallet liability)
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
    'sidecar', v_sidecar,
    'kind', v_kind
  );
END;
$$;
