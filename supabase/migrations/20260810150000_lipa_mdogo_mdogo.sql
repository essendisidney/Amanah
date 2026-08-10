-- Lipa mdogo mdogo: partial contribution payments toward a cycle due.

ALTER TYPE public.contribution_status ADD VALUE IF NOT EXISTS 'partial';

ALTER TABLE public.contributions
  ADD COLUMN IF NOT EXISTS amount_paid NUMERIC(18, 2) NOT NULL DEFAULT 0;

ALTER TABLE public.contributions
  DROP CONSTRAINT IF EXISTS contributions_amount_paid_range;

ALTER TABLE public.contributions
  ADD CONSTRAINT contributions_amount_paid_range
  CHECK (amount_paid >= 0 AND amount_paid <= amount);

CREATE TABLE IF NOT EXISTS public.contribution_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contribution_id UUID NOT NULL REFERENCES public.contributions (id) ON DELETE CASCADE,
  transaction_id UUID NOT NULL REFERENCES public.transactions (id),
  amount NUMERIC(18, 2) NOT NULL CHECK (amount > 0),
  currency CHAR(3) NOT NULL,
  paid_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID NOT NULL REFERENCES public.profiles (id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS contribution_payments_contribution_idx
  ON public.contribution_payments (contribution_id, paid_at DESC);

ALTER TABLE public.contribution_payments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS contribution_payments_select ON public.contribution_payments;
CREATE POLICY contribution_payments_select
  ON public.contribution_payments FOR SELECT TO authenticated
  USING (
    created_by = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.contributions c
      JOIN public.members m ON m.id = c.member_id
      WHERE c.id = contribution_id
        AND (
          m.user_id = auth.uid()
          OR private.is_circle_admin(c.jamiya_id)
          OR private.is_platform_admin()
        )
    )
  );

GRANT SELECT, INSERT ON public.contribution_payments TO authenticated;

-- Replace pay_contribution to accept optional partial amount.
DROP FUNCTION IF EXISTS public.pay_contribution(UUID);
DROP FUNCTION IF EXISTS public.pay_contribution(UUID, NUMERIC);

CREATE OR REPLACE FUNCTION public.pay_contribution(
  p_contribution_id UUID,
  p_amount NUMERIC DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_c public.contributions%ROWTYPE;
  v_member public.members%ROWTYPE;
  v_tx UUID;
  v_remaining NUMERIC;
  v_debit NUMERIC;
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

  IF v_c.status NOT IN ('pending', 'late', 'partial') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'NOT_PAYABLE');
  END IF;

  SELECT * INTO v_member FROM public.members WHERE id = v_c.member_id;
  IF v_member.user_id <> v_uid THEN
    RETURN jsonb_build_object('ok', false, 'error', 'FORBIDDEN');
  END IF;

  v_remaining := v_c.amount - coalesce(v_c.amount_paid, 0);
  IF v_remaining <= 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'ALREADY_PAID');
  END IF;

  IF p_amount IS NULL THEN
    v_debit := v_remaining;
  ELSE
    IF p_amount <= 0 THEN
      RETURN jsonb_build_object('ok', false, 'error', 'INVALID_AMOUNT');
    END IF;
    v_debit := LEAST(p_amount, v_remaining);
  END IF;

  BEGIN
    v_tx := private.ledger_debit(
      v_uid, v_c.currency, v_debit, 'contribution', v_c.jamiya_id,
      'contribution:' || v_c.id::text || ':' || gen_random_uuid()::text,
      'pay_contribution:' || v_c.id::text || ':' || gen_random_uuid()::text,
      jsonb_build_object(
        'contribution_id', v_c.id,
        'cycle', v_c.cycle_number,
        'partial', v_debit < v_remaining,
        'amount', v_debit
      )
    );
  EXCEPTION
    WHEN OTHERS THEN
      IF SQLERRM = 'INSUFFICIENT_FUNDS' THEN
        RETURN jsonb_build_object('ok', false, 'error', 'INSUFFICIENT_FUNDS');
      END IF;
      RAISE;
  END;

  v_new_paid := coalesce(v_c.amount_paid, 0) + v_debit;
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
    transaction_id = v_tx,
    updated_at = NOW()
  WHERE id = v_c.id;

  INSERT INTO public.contribution_payments (
    contribution_id, transaction_id, amount, currency, created_by
  ) VALUES (
    v_c.id, v_tx, v_debit, v_c.currency, v_uid
  );

  INSERT INTO public.notifications (user_id, type, channel, title, body, data)
  SELECT
    m.user_id,
    'contribution_received',
    'in_app',
    CASE WHEN v_new_status = 'paid' THEN 'Contribution fully paid' ELSE 'Partial contribution received' END,
    'Cycle ' || v_c.cycle_number || ': ' || v_debit::text || ' ' || v_c.currency
      || ' paid (' || v_new_paid::text || '/' || v_c.amount::text || ').',
    jsonb_build_object(
      'jamiya_id', v_c.jamiya_id,
      'contribution_id', v_c.id,
      'amount', v_debit,
      'amount_paid', v_new_paid,
      'status', v_new_status
    )
  FROM public.members m
  WHERE m.jamiya_id = v_c.jamiya_id
    AND m.role = 'circle_admin'
    AND m.status = 'active';

  RETURN jsonb_build_object(
    'ok', true,
    'transaction_id', v_tx,
    'amount', v_debit,
    'amount_paid', v_new_paid,
    'amount_due', v_c.amount,
    'remaining', v_c.amount - v_new_paid,
    'status', v_new_status
  );
END;
$$;

REVOKE ALL ON FUNCTION public.pay_contribution(UUID, NUMERIC) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.pay_contribution(UUID, NUMERIC) TO authenticated;

-- Ahead pay also supports partials.
CREATE OR REPLACE FUNCTION public.pay_contribution_ahead(
  p_contribution_id UUID,
  p_amount NUMERIC DEFAULT NULL
)
RETURNS JSONB
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT public.pay_contribution(p_contribution_id, p_amount);
$$;

REVOKE ALL ON FUNCTION public.pay_contribution_ahead(UUID, NUMERIC) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.pay_contribution_ahead(UUID, NUMERIC) TO authenticated;
