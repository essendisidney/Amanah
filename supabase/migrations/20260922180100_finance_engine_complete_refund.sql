-- Complete/cancel refund: reverse journal + wallet debit for top-ups.

ALTER TABLE public.refunds
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

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
      'wallet_tx_id', v_tx
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
      'journal_entry_id', v_entry
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
    'transaction_id', v_tx
  );
END;
$$;

REVOKE ALL ON FUNCTION public.complete_refund(UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.complete_refund(UUID, TEXT)
  TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.cancel_refund(
  p_refund_id UUID,
  p_reason TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_refund public.refunds%ROWTYPE;
BEGIN
  IF coalesce(auth.role(), '') <> 'service_role'
     AND NOT private.is_platform_admin() THEN
    RETURN jsonb_build_object('ok', false, 'error', 'FORBIDDEN');
  END IF;

  SELECT * INTO v_refund FROM public.refunds WHERE id = p_refund_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'NOT_FOUND');
  END IF;

  IF v_refund.status = 'cancelled' THEN
    RETURN jsonb_build_object('ok', true, 'idempotent', true);
  END IF;

  IF v_refund.status NOT IN ('pending', 'processing', 'failed') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'INVALID_STATUS', 'status', v_refund.status);
  END IF;

  UPDATE public.refunds
  SET
    status = 'cancelled',
    updated_at = NOW(),
    metadata = metadata || jsonb_build_object(
      'cancelled_at', NOW(),
      'cancel_reason', coalesce(p_reason, 'admin_cancel')
    )
  WHERE id = p_refund_id;

  RETURN jsonb_build_object('ok', true, 'refund_id', p_refund_id);
END;
$$;

REVOKE ALL ON FUNCTION public.cancel_refund(UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.cancel_refund(UUID, TEXT)
  TO authenticated, service_role;
