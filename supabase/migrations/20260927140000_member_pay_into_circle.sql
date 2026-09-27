-- A share-group member can open their own Contribution or Maulid due and pay it
-- with the existing wallet / M-Pesa contribution path. Officers stay the only
-- people who can record someone else's books.

CREATE OR REPLACE FUNCTION public.open_member_circle_payment(
  p_jamiya_id UUID,
  p_purpose TEXT,
  p_amount NUMERIC
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_member public.members%ROWTYPE;
  v_j public.jamiyas%ROWTYPE;
  v_purpose TEXT;
  v_label TEXT;
  v_amount NUMERIC;
  v_existing public.contributions%ROWTYPE;
  v_id UUID;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'UNAUTHENTICATED');
  END IF;

  v_purpose := lower(btrim(coalesce(p_purpose, '')));
  IF v_purpose = 'maulid' THEN
    v_label := 'Maulid';
  ELSIF v_purpose = 'contribution' THEN
    v_label := 'Contribution';
  ELSE
    RETURN jsonb_build_object('ok', false, 'error', 'UNKNOWN_PURPOSE');
  END IF;

  SELECT * INTO v_j FROM public.jamiyas WHERE id = p_jamiya_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'NOT_FOUND');
  END IF;

  IF v_j.status IS DISTINCT FROM 'active' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'CIRCLE_NOT_ACTIVE');
  END IF;

  IF v_j.challenge_kind IS DISTINCT FROM 'share_dividend' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'NOT_SHARE_DIVIDEND');
  END IF;

  SELECT * INTO v_member
  FROM public.members
  WHERE jamiya_id = p_jamiya_id
    AND user_id = v_uid
    AND status = 'active';
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'FORBIDDEN');
  END IF;

  IF p_amount IS NULL THEN
    v_amount := v_j.contribution_amount;
  ELSE
    v_amount := round(p_amount, 2);
  END IF;

  IF v_amount IS NULL OR v_amount <= 0 OR v_amount > 500000 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'INVALID_AMOUNT');
  END IF;

  SELECT * INTO v_existing
  FROM public.contributions
  WHERE jamiya_id = p_jamiya_id
    AND member_id = v_member.id
    AND status IN ('pending', 'late', 'partial')
    AND notes = v_label
  ORDER BY created_at DESC
  LIMIT 1
  FOR UPDATE;

  IF FOUND THEN
    IF v_amount >= coalesce(v_existing.amount_paid, 0)
      AND v_existing.amount IS DISTINCT FROM v_amount THEN
      UPDATE public.contributions
      SET amount = v_amount, due_date = CURRENT_DATE, updated_at = NOW()
      WHERE id = v_existing.id;
    END IF;
    RETURN jsonb_build_object(
      'ok', true,
      'contribution_id', v_existing.id,
      'reused', true
    );
  END IF;

  INSERT INTO public.contributions (
    jamiya_id, member_id, cycle_number, amount, currency, status, due_date, notes, amount_paid
  ) VALUES (
    p_jamiya_id,
    v_member.id,
    GREATEST(coalesce(v_j.current_cycle, 1), 1),
    v_amount,
    coalesce(v_j.currency, 'KES'),
    'pending',
    CURRENT_DATE,
    v_label,
    0
  )
  RETURNING id INTO v_id;

  RETURN jsonb_build_object(
    'ok', true,
    'contribution_id', v_id,
    'reused', false
  );
EXCEPTION
  WHEN check_violation THEN
    RETURN jsonb_build_object('ok', false, 'error', 'INVALID_AMOUNT');
END;
$$;

REVOKE ALL ON FUNCTION public.open_member_circle_payment(UUID, TEXT, NUMERIC) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.open_member_circle_payment(UUID, TEXT, NUMERIC) TO authenticated;

-- Book line should say Contribution or Maulid when the due has that note.
CREATE OR REPLACE FUNCTION private.bridge_contribution_to_cashbook(
  p_contribution_id UUID,
  p_amount NUMERIC,
  p_payment_intent_id UUID DEFAULT NULL,
  p_transaction_id UUID DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_c public.contributions%ROWTYPE;
  v_member public.members%ROWTYPE;
  v_bank UUID;
  v_entry UUID;
  v_key TEXT;
  v_notes TEXT;
BEGIN
  IF p_contribution_id IS NULL OR p_amount IS NULL OR p_amount <= 0 THEN
    RETURN NULL;
  END IF;

  SELECT * INTO v_c FROM public.contributions WHERE id = p_contribution_id;
  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  SELECT * INTO v_member FROM public.members WHERE id = v_c.member_id;

  v_key := coalesce(
    'payment_intent:' || p_payment_intent_id::text,
    'transaction:' || p_transaction_id::text,
    'contribution:' || p_contribution_id::text
  );

  IF EXISTS (
    SELECT 1 FROM public.book_entries b
    WHERE b.jamiya_id = v_c.jamiya_id
      AND b.entry_type = 'contribution'
      AND (
        b.metadata->>'bridge_key' = v_key
        OR (p_payment_intent_id IS NOT NULL AND b.metadata->>'payment_intent_id' = p_payment_intent_id::text)
      )
  ) THEN
    SELECT id INTO v_entry FROM public.book_entries b
    WHERE b.jamiya_id = v_c.jamiya_id
      AND b.entry_type = 'contribution'
      AND (
        b.metadata->>'bridge_key' = v_key
        OR (p_payment_intent_id IS NOT NULL AND b.metadata->>'payment_intent_id' = p_payment_intent_id::text)
      )
    LIMIT 1;
    RETURN v_entry;
  END IF;

  SELECT id INTO v_bank
  FROM public.circle_bank_accounts
  WHERE jamiya_id = v_c.jamiya_id AND is_active AND account_kind = 'mpesa'
  ORDER BY created_at
  LIMIT 1;

  IF v_bank IS NULL THEN
    SELECT id INTO v_bank
    FROM public.circle_bank_accounts
    WHERE jamiya_id = v_c.jamiya_id AND is_active
    ORDER BY created_at
    LIMIT 1;
  END IF;

  IF v_bank IS NOT NULL THEN
    UPDATE public.circle_bank_accounts
    SET balance = balance + p_amount, updated_at = NOW()
    WHERE id = v_bank;
  END IF;

  v_notes := nullif(btrim(coalesce(v_c.notes, '')), '');

  INSERT INTO public.book_entries (
    jamiya_id, member_id, entry_type, amount, currency, effective_date,
    entered_by, notes, bank_account_id, metadata
  ) VALUES (
    v_c.jamiya_id,
    v_c.member_id,
    'contribution',
    p_amount,
    v_c.currency,
    CURRENT_DATE,
    v_member.user_id,
    coalesce(v_notes, 'Auto: contribution payment bridge'),
    v_bank,
    jsonb_build_object(
      'bridge_key', v_key,
      'contribution_id', p_contribution_id,
      'payment_intent_id', p_payment_intent_id,
      'transaction_id', p_transaction_id,
      'source', 'finance_bridge'
    )
  )
  RETURNING id INTO v_entry;

  RETURN v_entry;
EXCEPTION
  WHEN OTHERS THEN
    RETURN NULL;
END;
$$;
