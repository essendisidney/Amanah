-- Chamasoft settle/match wave: pay dividends to wallets, auto-match bank alerts,
-- officer journal snapshot.

-- ---------------------------------------------------------------------------
-- Pay an allocated dividend (debit circle cash, credit member wallets)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.pay_circle_dividend(
  p_dividend_id UUID,
  p_bank_account_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_div public.circle_dividends%ROWTYPE;
  v_bal NUMERIC;
  v_paid INT := 0;
  v_alloc RECORD;
  v_user UUID;
  v_tx UUID;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'UNAUTHENTICATED');
  END IF;

  SELECT * INTO v_div FROM public.circle_dividends WHERE id = p_dividend_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'NOT_FOUND');
  END IF;
  IF NOT (private.is_circle_officer(v_div.jamiya_id) OR private.is_platform_admin()) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'FORBIDDEN');
  END IF;
  IF v_div.status NOT IN ('allocated', 'paid') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'INVALID_STATUS');
  END IF;

  SELECT balance INTO v_bal
  FROM public.circle_bank_accounts
  WHERE id = p_bank_account_id AND jamiya_id = v_div.jamiya_id AND is_active
  FOR UPDATE;
  IF v_bal IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'ACCOUNT_NOT_FOUND');
  END IF;

  IF v_bal < (
    SELECT COALESCE(sum(amount), 0)
    FROM public.circle_dividend_allocations
    WHERE dividend_id = p_dividend_id AND status = 'allocated'
  ) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'INSUFFICIENT_BALANCE');
  END IF;

  FOR v_alloc IN
    SELECT *
    FROM public.circle_dividend_allocations
    WHERE dividend_id = p_dividend_id AND status = 'allocated'
    FOR UPDATE
  LOOP
    SELECT user_id INTO v_user
    FROM public.members
    WHERE id = v_alloc.member_id AND jamiya_id = v_div.jamiya_id;
    IF v_user IS NULL OR v_alloc.amount <= 0 THEN
      CONTINUE;
    END IF;

    UPDATE public.circle_bank_accounts
    SET balance = balance - v_alloc.amount, updated_at = NOW()
    WHERE id = p_bank_account_id;

    v_tx := private.ledger_credit(
      v_user,
      v_alloc.currency,
      v_alloc.amount,
      'payout'::public.transaction_type,
      v_div.jamiya_id,
      'dividend:' || v_alloc.id::text,
      'dividend:' || v_alloc.id::text,
      jsonb_build_object(
        'kind', 'circle_dividend',
        'dividend_id', p_dividend_id,
        'allocation_id', v_alloc.id,
        'label', v_div.label
      )
    );

    INSERT INTO public.book_entries (
      jamiya_id, member_id, entry_type, amount, currency, effective_date, entered_by, notes,
      bank_account_id, metadata
    ) VALUES (
      v_div.jamiya_id, v_alloc.member_id, 'expense', v_alloc.amount, v_alloc.currency,
      CURRENT_DATE, v_uid, 'Dividend: ' || v_div.label,
      p_bank_account_id,
      jsonb_build_object(
        'source', 'dividend_payout',
        'dividend_id', p_dividend_id,
        'allocation_id', v_alloc.id,
        'wallet_tx', v_tx
      )
    );

    UPDATE public.circle_dividend_allocations
    SET status = 'paid'
    WHERE id = v_alloc.id;

    INSERT INTO public.notifications (user_id, type, channel, title, body, data)
    VALUES (
      v_user,
      'payout_paid'::public.notification_type,
      'in_app'::public.notification_channel,
      'Dividend paid',
      format('Your dividend of %s from %s was credited to your wallet.', v_alloc.amount::text, v_div.label),
      jsonb_build_object('jamiya_id', v_div.jamiya_id, 'dividend_id', p_dividend_id)
    );

    v_paid := v_paid + 1;
  END LOOP;

  IF NOT EXISTS (
    SELECT 1 FROM public.circle_dividend_allocations
    WHERE dividend_id = p_dividend_id AND status = 'allocated'
  ) THEN
    UPDATE public.circle_dividends SET status = 'paid' WHERE id = p_dividend_id;
  END IF;

  RETURN jsonb_build_object('ok', true, 'paid', v_paid, 'status', (
    SELECT status FROM public.circle_dividends WHERE id = p_dividend_id
  ));
END;
$$;

REVOKE ALL ON FUNCTION public.pay_circle_dividend(UUID, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.pay_circle_dividend(UUID, UUID) TO authenticated;

-- ---------------------------------------------------------------------------
-- Auto-match pending bank alerts to cashbook rows
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.match_bank_alerts(
  p_jamiya_id UUID,
  p_limit INT DEFAULT 50
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_alert public.circle_bank_alerts%ROWTYPE;
  v_entry UUID;
  v_matched INT := 0;
  v_wanted TEXT[];
  v_lim INT := greatest(1, least(coalesce(p_limit, 50), 200));
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'UNAUTHENTICATED');
  END IF;
  IF NOT (private.is_circle_officer(p_jamiya_id) OR private.is_platform_admin()) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'FORBIDDEN');
  END IF;

  FOR v_alert IN
    SELECT *
    FROM public.circle_bank_alerts
    WHERE jamiya_id = p_jamiya_id AND status = 'pending' AND amount IS NOT NULL AND amount > 0
    ORDER BY created_at
    LIMIT v_lim
    FOR UPDATE SKIP LOCKED
  LOOP
    IF v_alert.direction = 'debit' THEN
      v_wanted := ARRAY['bank_withdrawal', 'expense', 'investment', 'withdrawal'];
    ELSE
      v_wanted := ARRAY['bank_deposit', 'income', 'opening_balance', 'contribution'];
    END IF;

    SELECT b.id INTO v_entry
    FROM public.book_entries b
    WHERE b.jamiya_id = p_jamiya_id
      AND b.amount = v_alert.amount
      AND b.entry_type = ANY (v_wanted)
      AND (v_alert.bank_account_id IS NULL OR b.bank_account_id IS NULL OR b.bank_account_id = v_alert.bank_account_id)
      AND b.effective_date BETWEEN
        COALESCE((v_alert.occurred_at AT TIME ZONE 'UTC')::date - 3, CURRENT_DATE - 30)
        AND COALESCE((v_alert.occurred_at AT TIME ZONE 'UTC')::date + 3, CURRENT_DATE + 3)
      AND NOT EXISTS (
        SELECT 1 FROM public.circle_bank_alerts x
        WHERE x.matched_book_entry_id = b.id AND x.status = 'matched'
      )
    ORDER BY abs(extract(epoch FROM (b.entered_at - coalesce(v_alert.occurred_at, b.entered_at))))
    LIMIT 1;

    IF v_entry IS NOT NULL THEN
      UPDATE public.circle_bank_alerts
      SET status = 'matched',
          matched_book_entry_id = v_entry
      WHERE id = v_alert.id;
      v_matched := v_matched + 1;
    END IF;
  END LOOP;

  RETURN jsonb_build_object('ok', true, 'matched', v_matched);
END;
$$;

REVOKE ALL ON FUNCTION public.match_bank_alerts(UUID, INT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.match_bank_alerts(UUID, INT) TO authenticated;

CREATE OR REPLACE FUNCTION public.set_bank_alert_status(
  p_alert_id UUID,
  p_status TEXT,
  p_book_entry_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_alert public.circle_bank_alerts%ROWTYPE;
  v_status TEXT := lower(btrim(COALESCE(p_status, '')));
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'UNAUTHENTICATED');
  END IF;

  SELECT * INTO v_alert FROM public.circle_bank_alerts WHERE id = p_alert_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'NOT_FOUND');
  END IF;
  IF NOT (private.is_circle_officer(v_alert.jamiya_id) OR private.is_platform_admin()) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'FORBIDDEN');
  END IF;
  IF v_status NOT IN ('pending', 'matched', 'ignored') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'INVALID_STATUS');
  END IF;
  IF v_status = 'matched' AND p_book_entry_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'BOOK_ENTRY_REQUIRED');
  END IF;

  UPDATE public.circle_bank_alerts
  SET status = v_status,
      matched_book_entry_id = CASE
        WHEN v_status = 'matched' THEN p_book_entry_id
        WHEN v_status = 'ignored' THEN NULL
        ELSE matched_book_entry_id
      END
  WHERE id = p_alert_id;

  RETURN jsonb_build_object('ok', true, 'status', v_status);
END;
$$;

REVOKE ALL ON FUNCTION public.set_bank_alert_status(UUID, TEXT, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_bank_alert_status(UUID, TEXT, UUID) TO authenticated;

-- ---------------------------------------------------------------------------
-- Journal snapshot (cashbook presented as simple double-entry lines)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.circle_journal(
  p_jamiya_id UUID,
  p_limit INT DEFAULT 100
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_lim INT := greatest(1, least(coalesce(p_limit, 100), 500));
  v_rows JSONB;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'UNAUTHENTICATED');
  END IF;
  IF NOT (
    private.is_jamiya_member(p_jamiya_id)
    OR private.is_circle_officer(p_jamiya_id)
    OR private.is_platform_admin()
  ) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'FORBIDDEN');
  END IF;

  SELECT COALESCE(jsonb_agg(row_data ORDER BY sort_date DESC, id DESC), '[]'::jsonb)
  INTO v_rows
  FROM (
    SELECT
      b.id,
      b.effective_date AS sort_date,
      jsonb_build_object(
        'id', b.id,
        'effective_date', b.effective_date,
        'entry_type', b.entry_type,
        'amount', b.amount,
        'currency', b.currency,
        'notes', b.notes,
        'member_id', b.member_id,
        'bank_account_id', b.bank_account_id,
        'category_id', b.category_id,
        'debit_account', CASE
          WHEN b.entry_type IN ('bank_deposit', 'income', 'opening_balance', 'contribution')
            THEN coalesce(a.name, 'Cash')
          WHEN b.entry_type IN ('bank_withdrawal', 'expense', 'investment', 'penalty')
            THEN coalesce(c.name, initcap(replace(b.entry_type, '_', ' ')))
          WHEN b.entry_type = 'bank_transfer' THEN coalesce(a2.name, 'Transfer to')
          ELSE 'Suspense'
        END,
        'credit_account', CASE
          WHEN b.entry_type IN ('bank_deposit', 'income', 'opening_balance', 'contribution')
            THEN coalesce(c.name, initcap(replace(b.entry_type, '_', ' ')))
          WHEN b.entry_type IN ('bank_withdrawal', 'expense', 'investment', 'penalty')
            THEN coalesce(a.name, 'Cash')
          WHEN b.entry_type = 'bank_transfer' THEN coalesce(a.name, 'Transfer from')
          ELSE 'Suspense'
        END,
        'metadata', b.metadata
      ) AS row_data
    FROM public.book_entries b
    LEFT JOIN public.circle_bank_accounts a ON a.id = b.bank_account_id
    LEFT JOIN public.circle_bank_accounts a2 ON a2.id = b.counterparty_account_id
    LEFT JOIN public.circle_ledger_categories c ON c.id = b.category_id
    WHERE b.jamiya_id = p_jamiya_id
    ORDER BY b.effective_date DESC, b.created_at DESC
    LIMIT v_lim
  ) x;

  RETURN jsonb_build_object('ok', true, 'entries', v_rows);
END;
$$;

REVOKE ALL ON FUNCTION public.circle_journal(UUID, INT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.circle_journal(UUID, INT) TO authenticated;
