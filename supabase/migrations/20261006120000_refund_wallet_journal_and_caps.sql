-- Refunds: post what actually moved, and never refund more than was taken.
--
-- 1. Contribution, sadaka and sponsorship refunds credit the member's wallet, but
--    complete_refund journaled them as cash leaving M-Pesa (Cr 1000). They now credit
--    2000 wallet liability. Wallet top-up and platform tip refunds are unchanged.
-- 2. Sadaka and sponsorship reversals credit at most the donation / charge, but the
--    journal used the requested amount. The journal now uses the amount credited, and a
--    second refund the reversal ignores ("already refunded") fails instead of posting
--    a journal with no money behind it.
-- 3. request_refund only checked one refund against the intent amount. Refunds on an
--    intent now add up to at most what is refundable: for a contribution, what was
--    applied to dues (the overpayment change is already in the wallet); for sadaka the
--    donation; for sponsorship the charge; otherwise the intent amount. complete_refund
--    re-checks under a lock on the intent.
-- 4. Completed refunds from before this migration get correcting entries.

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION private.refundable_amount(p_intent public.payment_intents)
RETURNS NUMERIC
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  v_kind TEXT := coalesce(nullif(trim(p_intent.metadata->>'kind'), ''), 'wallet_top_up');
  v_amount NUMERIC;
BEGIN
  IF v_kind = 'contribution' THEN
    SELECT t.amount INTO v_amount
    FROM public.transactions t
    WHERE t.id = nullif(p_intent.metadata->>'debit_transaction_id', '')::uuid
      AND t.type = 'contribution'
      AND t.direction = 'debit';
  ELSIF v_kind = 'sadaka' THEN
    SELECT d.amount INTO v_amount
    FROM public.charity_donations d
    WHERE d.id = coalesce(
      nullif(p_intent.metadata->>'donation_id', '')::uuid,
      (SELECT x.id FROM public.charity_donations x WHERE x.payment_intent_id = p_intent.id LIMIT 1)
    );
  ELSIF v_kind = 'sponsorship' THEN
    SELECT c.amount INTO v_amount
    FROM public.sponsorship_charges c
    WHERE c.id = coalesce(
      nullif(p_intent.metadata->>'charge_id', '')::uuid,
      (SELECT x.id FROM public.sponsorship_charges x WHERE x.payment_intent_id = p_intent.id LIMIT 1)
    );
  ELSE
    v_amount := p_intent.amount;
  END IF;

  RETURN least(coalesce(v_amount, 0), p_intent.amount);
END;
$$;

-- Refunds already taken against an intent (queued, in flight or done).
CREATE OR REPLACE FUNCTION private.refunds_against_intent(
  p_intent_id UUID,
  p_statuses TEXT[],
  p_exclude_refund_id UUID DEFAULT NULL
)
RETURNS NUMERIC
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO ''
AS $$
  SELECT coalesce(sum(r.amount), 0)
  FROM public.refunds r
  WHERE r.payment_intent_id = p_intent_id
    AND r.status = ANY (p_statuses)
    AND r.id IS DISTINCT FROM p_exclude_refund_id
$$;

REVOKE ALL ON FUNCTION private.refundable_amount(public.payment_intents) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION private.refunds_against_intent(UUID, TEXT[], UUID) FROM PUBLIC, anon, authenticated;

-- ---------------------------------------------------------------------------
-- request_refund: cumulative cap
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.request_refund(
  p_payment_intent_id uuid,
  p_amount numeric,
  p_reason text DEFAULT NULL::text,
  p_metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  v_intent public.payment_intents%ROWTYPE;
  v_refund_id UUID;
  v_minor BIGINT;
  v_remaining NUMERIC;
BEGIN
  IF auth.uid() IS NULL AND coalesce(auth.role(), '') <> 'service_role' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'UNAUTHENTICATED');
  END IF;

  IF coalesce(auth.role(), '') <> 'service_role'
     AND NOT private.is_platform_admin() THEN
    RETURN jsonb_build_object('ok', false, 'error', 'FORBIDDEN');
  END IF;

  IF p_amount IS NULL OR p_amount <= 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'INVALID_AMOUNT');
  END IF;

  SELECT * INTO v_intent
  FROM public.payment_intents
  WHERE id = p_payment_intent_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'NOT_FOUND');
  END IF;

  IF v_intent.status <> 'completed' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'INTENT_NOT_COMPLETED');
  END IF;

  v_remaining := private.refundable_amount(v_intent)
    - private.refunds_against_intent(v_intent.id, ARRAY['pending', 'processing', 'completed']);
  IF p_amount > v_remaining THEN
    RETURN jsonb_build_object(
      'ok', false,
      'error', 'AMOUNT_EXCEEDS_REFUNDABLE',
      'refundable', greatest(v_remaining, 0)
    );
  END IF;

  v_minor := round(p_amount * 100)::bigint;

  INSERT INTO public.refunds (
    payment_intent_id,
    amount,
    amount_minor,
    currency,
    reason,
    status,
    created_by,
    metadata
  ) VALUES (
    p_payment_intent_id,
    p_amount,
    v_minor,
    v_intent.currency,
    p_reason,
    'pending',
    CASE WHEN auth.uid() IS NOT NULL THEN auth.uid() ELSE NULL END,
    coalesce(p_metadata, '{}'::jsonb) || jsonb_build_object('requested_at', NOW())
  )
  RETURNING id INTO v_refund_id;

  UPDATE public.payment_intents
  SET
    settlement_status = CASE
      WHEN settlement_status = 'settled' THEN 'disputed'
      ELSE settlement_status
    END,
    reconcile_status = CASE
      WHEN reconcile_status = 'matched' THEN 'exception'
      ELSE reconcile_status
    END,
    metadata = metadata || jsonb_build_object(
      'refund_requested_id', v_refund_id,
      'refund_requested_at', NOW()
    ),
    updated_at = NOW()
  WHERE id = p_payment_intent_id;

  RETURN jsonb_build_object('ok', true, 'refund_id', v_refund_id);
END;
$$;

-- ---------------------------------------------------------------------------
-- complete_refund: lock + re-check cap, journal what moved, wallet refunds credit 2000
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.complete_refund(
  p_refund_id uuid,
  p_provider_reference text DEFAULT NULL::text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
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
  v_journal_amount NUMERIC;
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

  -- Lock the intent so two refunds on it cannot complete side by side.
  SELECT * INTO v_intent
  FROM public.payment_intents
  WHERE id = v_refund.payment_intent_id
  FOR UPDATE;

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

  IF v_refund.amount + private.refunds_against_intent(
       v_intent.id, ARRAY['processing', 'completed'], v_refund.id
     ) > private.refundable_amount(v_intent) THEN
    UPDATE public.refunds
    SET
      status = 'failed',
      updated_at = NOW(),
      metadata = metadata || jsonb_build_object(
        'complete_error', 'AMOUNT_EXCEEDS_REFUNDABLE',
        'failed_at', NOW()
      )
    WHERE id = p_refund_id;
    RETURN jsonb_build_object('ok', false, 'error', 'AMOUNT_EXCEEDS_REFUNDABLE');
  END IF;

  -- Contribution, sadaka and sponsorship refunds go back to the member's wallet (Cr 2000).
  -- Wallet top-up and tip refunds leave the platform (Cr 1000).
  CASE v_kind
    WHEN 'contribution' THEN
      v_domain := 'CONTRIBUTIONS';
      v_debit := '3000';
      v_credit := '2000';
      v_desc := 'Contribution refund to wallet';
    WHEN 'sadaka' THEN
      v_domain := 'SADAKA';
      v_debit := '5000';
      v_credit := '2000';
      v_desc := 'Sadaka refund to wallet';
    WHEN 'sponsorship' THEN
      v_domain := 'TAKAFUL';
      v_debit := '6000';
      v_credit := '2000';
      v_desc := 'Sponsorship refund to wallet';
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

  v_journal_amount := v_refund.amount;

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
    ELSIF v_kind IN ('sadaka', 'sponsorship') THEN
      IF v_kind = 'sadaka' THEN
        v_sidecar := private.reverse_sadaka_for_refund(v_intent, v_refund);
      ELSE
        v_sidecar := private.reverse_sponsorship_for_refund(v_intent, v_refund);
      END IF;
      IF coalesce((v_sidecar->>'ok')::boolean, false) IS NOT TRUE THEN
        RAISE EXCEPTION '%', coalesce(v_sidecar->>'error', upper(v_kind) || '_REVERSE_FAILED');
      END IF;
      -- The reversal only ever runs once per donation / charge.
      IF coalesce((v_sidecar->>'idempotent')::boolean, false) THEN
        RAISE EXCEPTION 'ALREADY_REFUNDED';
      END IF;
      v_tx := nullif(v_sidecar->>'wallet_tx_id', '')::uuid;
      v_journal_amount := (v_sidecar->>'amount')::numeric;
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
    v_journal_amount,
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

-- ---------------------------------------------------------------------------
-- Correct refunds completed before this migration
-- ---------------------------------------------------------------------------
-- Old wallet-refund entries are Dr <domain account> / Cr 1000 for the requested amount.
-- Move what reached the wallet from 1000 to 2000, and reverse any part of the journal
-- that no money backed. Idempotent on (source_type, source_id).
CREATE OR REPLACE FUNCTION private.correct_wallet_refund_journal(p_refund_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  v_refund public.refunds%ROWTYPE;
  v_entry public.journal_entries%ROWTYPE;
  v_debit_code TEXT;
  v_posted NUMERIC;
  v_wallet NUMERIC;
BEGIN
  SELECT * INTO v_refund FROM public.refunds WHERE id = p_refund_id;
  IF NOT FOUND OR v_refund.status <> 'completed' OR v_refund.journal_entry_id IS NULL THEN
    RETURN;
  END IF;

  SELECT * INTO v_entry FROM public.journal_entries WHERE id = v_refund.journal_entry_id;
  IF NOT FOUND OR coalesce(v_entry.metadata->>'kind', '') NOT IN ('contribution', 'sadaka', 'sponsorship') THEN
    RETURN;
  END IF;

  -- Only entries that credited cash; new-style entries already credit 2000.
  IF NOT EXISTS (
    SELECT 1 FROM public.journal_lines l
    JOIN public.ledger_accounts a ON a.id = l.ledger_account_id
    WHERE l.journal_entry_id = v_entry.id AND l.side = 'credit' AND a.code = '1000'
  ) THEN
    RETURN;
  END IF;

  SELECT a.code, l.amount INTO v_debit_code, v_posted
  FROM public.journal_lines l
  JOIN public.ledger_accounts a ON a.id = l.ledger_account_id
  WHERE l.journal_entry_id = v_entry.id AND l.side = 'debit';

  SELECT coalesce(sum(t.amount), 0) INTO v_wallet
  FROM public.transactions t
  WHERE t.id = nullif(v_refund.metadata->>'wallet_tx_id', '')::uuid
    AND t.direction = 'credit'
    AND t.status = 'completed';

  IF v_wallet > 0 THEN
    PERFORM private.post_balanced_journal(
      'refund_wallet_fix',
      v_refund.id::text,
      v_entry.domain,
      'Refund went to wallet, not cash',
      v_refund.currency,
      '1000',
      '2000',
      least(v_wallet, v_posted),
      v_refund.payment_intent_id,
      v_entry.jamiya_id,
      v_entry.user_id,
      jsonb_build_object('refund_id', v_refund.id, 'corrects', v_entry.id)
    );
  END IF;

  IF v_posted > v_wallet THEN
    PERFORM private.post_balanced_journal(
      'refund_overpost_fix',
      v_refund.id::text,
      v_entry.domain,
      'Reverse refund amount no money backed',
      v_refund.currency,
      '1000',
      v_debit_code,
      v_posted - v_wallet,
      v_refund.payment_intent_id,
      v_entry.jamiya_id,
      v_entry.user_id,
      jsonb_build_object('refund_id', v_refund.id, 'corrects', v_entry.id)
    );
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION private.correct_wallet_refund_journal(UUID) FROM PUBLIC, anon, authenticated;

DO $$
DECLARE
  r record;
BEGIN
  FOR r IN SELECT id FROM public.refunds WHERE status = 'completed' LOOP
    PERFORM private.correct_wallet_refund_journal(r.id);
  END LOOP;
END;
$$;
