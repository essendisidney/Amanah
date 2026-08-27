-- Merry-go-round: officers mark monthly contributions paid in cash (no wallet debit).
-- Aligns what officers capture with the contribution calendar members see.

ALTER TABLE public.contribution_payments
  ALTER COLUMN transaction_id DROP NOT NULL;

ALTER TABLE public.contribution_payments
  ADD COLUMN IF NOT EXISTS payment_method TEXT NOT NULL DEFAULT 'wallet'
    CHECK (payment_method IN ('wallet', 'cash', 'external'));

ALTER TABLE public.contribution_payments
  ADD COLUMN IF NOT EXISTS notes TEXT;

CREATE OR REPLACE FUNCTION public.officer_record_contribution_payment(
  p_contribution_id UUID,
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
  v_c public.contributions%ROWTYPE;
  v_remaining NUMERIC;
  v_credit NUMERIC;
  v_new_paid NUMERIC;
  v_new_status public.contribution_status;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'UNAUTHENTICATED');
  END IF;

  SELECT * INTO v_c FROM public.contributions WHERE id = p_contribution_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'NOT_FOUND');
  END IF;

  IF NOT (
    private.is_circle_officer(v_c.jamiya_id)
    OR private.is_platform_admin()
  ) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'FORBIDDEN');
  END IF;

  IF v_c.status NOT IN ('pending', 'late', 'partial') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'NOT_PAYABLE');
  END IF;

  v_remaining := v_c.amount - coalesce(v_c.amount_paid, 0);
  IF v_remaining <= 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'ALREADY_PAID');
  END IF;

  IF p_amount IS NULL THEN
    v_credit := v_remaining;
  ELSE
    IF p_amount <= 0 THEN
      RETURN jsonb_build_object('ok', false, 'error', 'INVALID_AMOUNT');
    END IF;
    v_credit := LEAST(p_amount, v_remaining);
  END IF;

  v_new_paid := coalesce(v_c.amount_paid, 0) + v_credit;
  IF v_new_paid >= v_c.amount THEN
    v_new_status := 'paid';
  ELSE
    v_new_status := 'partial';
  END IF;

  UPDATE public.contributions
  SET
    amount_paid = v_new_paid,
    status = v_new_status,
    paid_at = CASE WHEN v_new_status = 'paid' THEN NOW() ELSE paid_at END,
    updated_at = NOW()
  WHERE id = v_c.id;

  INSERT INTO public.contribution_payments (
    contribution_id, transaction_id, amount, currency, created_by, payment_method, notes
  ) VALUES (
    v_c.id,
    NULL,
    v_credit,
    v_c.currency,
    v_uid,
    'cash',
    NULLIF(trim(COALESCE(p_notes, '')), '')
  );

  RETURN jsonb_build_object(
    'ok', true,
    'amount_paid', v_new_paid,
    'status', v_new_status,
    'recorded', v_credit
  );
END;
$$;

REVOKE ALL ON FUNCTION public.officer_record_contribution_payment(UUID, NUMERIC, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.officer_record_contribution_payment(UUID, NUMERIC, TEXT) TO authenticated;
