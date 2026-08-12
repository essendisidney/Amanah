-- Peer kafala: circle members can guarantee each other's Qard loans.
-- Guarantors must accept before officer approval. Record + notify on default (no auto-debit).

DO $$ BEGIN
  CREATE TYPE public.qard_guarantee_status AS ENUM (
    'pending', 'accepted', 'declined', 'released', 'exposed'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS public.qard_guarantees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  loan_id UUID NOT NULL REFERENCES public.qard_loans (id) ON DELETE CASCADE,
  jamiya_id UUID NOT NULL REFERENCES public.jamiyas (id) ON DELETE CASCADE,
  borrower_id UUID NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  guarantor_user_id UUID NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  status public.qard_guarantee_status NOT NULL DEFAULT 'pending',
  notes TEXT,
  decided_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT qard_guarantees_not_self CHECK (guarantor_user_id <> borrower_id),
  UNIQUE (loan_id, guarantor_user_id)
);

CREATE INDEX IF NOT EXISTS qard_guarantees_guarantor_idx
  ON public.qard_guarantees (guarantor_user_id, status);
CREATE INDEX IF NOT EXISTS qard_guarantees_loan_idx
  ON public.qard_guarantees (loan_id, status);

ALTER TABLE public.qard_guarantees ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS qard_guarantees_select ON public.qard_guarantees;
CREATE POLICY qard_guarantees_select
  ON public.qard_guarantees FOR SELECT TO authenticated
  USING (
    borrower_id = auth.uid()
    OR guarantor_user_id = auth.uid()
    OR private.is_circle_officer(jamiya_id)
    OR private.is_platform_admin()
  );

GRANT SELECT ON public.qard_guarantees TO authenticated;

-- ---------------------------------------------------------------------------
-- Request Qard with optional guarantor nominations (recommend ≥1)
-- ---------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.request_qard(UUID, NUMERIC, TEXT, INT);

CREATE OR REPLACE FUNCTION public.request_qard(
  p_jamiya_id UUID,
  p_amount NUMERIC,
  p_purpose TEXT,
  p_installments INT DEFAULT 4,
  p_guarantor_user_ids UUID[] DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_paid NUMERIC := 0;
  v_cap NUMERIC;
  v_id UUID;
  v_g UUID;
  v_count INT := 0;
  v_name TEXT;
BEGIN
  IF v_uid IS NULL OR NOT private.is_active_jamiya_member(p_jamiya_id) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'FORBIDDEN');
  END IF;
  IF p_amount IS NULL OR p_amount < 100 OR char_length(trim(p_purpose)) < 5 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'INVALID');
  END IF;

  SELECT coalesce(sum(c.amount), 0) INTO v_paid
  FROM public.contributions c
  JOIN public.members m ON m.id = c.member_id
  WHERE m.user_id = v_uid AND m.jamiya_id = p_jamiya_id AND c.status = 'paid';

  v_cap := greatest(v_paid * 0.5, 0);
  IF v_cap = 0 THEN v_cap := 5000; END IF;
  IF p_amount > v_cap THEN
    RETURN jsonb_build_object('ok', false, 'error', 'ABOVE_CAP', 'cap', v_cap);
  END IF;

  INSERT INTO public.qard_loans (
    jamiya_id, borrower_id, amount, currency, purpose, installment_count
  )
  SELECT p_jamiya_id, v_uid, p_amount, j.currency, trim(p_purpose),
         least(greatest(coalesce(p_installments, 4), 1), 24)
  FROM public.jamiyas j WHERE j.id = p_jamiya_id
  RETURNING id INTO v_id;

  SELECT coalesce(full_name, email, 'A member') INTO v_name
  FROM public.profiles WHERE id = v_uid;

  IF p_guarantor_user_ids IS NOT NULL THEN
    FOREACH v_g IN ARRAY p_guarantor_user_ids LOOP
      IF v_g IS NULL OR v_g = v_uid THEN
        CONTINUE;
      END IF;
      IF NOT EXISTS (
        SELECT 1 FROM public.members m
        WHERE m.jamiya_id = p_jamiya_id
          AND m.user_id = v_g
          AND m.status = 'active'
      ) THEN
        CONTINUE;
      END IF;

      INSERT INTO public.qard_guarantees (
        loan_id, jamiya_id, borrower_id, guarantor_user_id, status
      )
      VALUES (v_id, p_jamiya_id, v_uid, v_g, 'pending')
      ON CONFLICT (loan_id, guarantor_user_id) DO NOTHING;

      IF EXISTS (
        SELECT 1 FROM public.qard_guarantees
        WHERE loan_id = v_id AND guarantor_user_id = v_g AND status = 'pending'
      ) THEN
        v_count := v_count + 1;
        INSERT INTO public.notifications (user_id, type, channel, title, body, data)
        VALUES (
          v_g,
          'system',
          'in_app',
          'Guarantee requested',
          v_name || ' asked you to guarantee their circle loan (Qard Hassan).',
          jsonb_build_object(
            'kind', 'qard_guarantee',
            'loan_id', v_id,
            'jamiya_id', p_jamiya_id
          )
        );
      END IF;
    END LOOP;
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'loan_id', v_id,
    'cap', v_cap,
    'guarantors_nominated', v_count
  );
END;
$$;

REVOKE ALL ON FUNCTION public.request_qard(UUID, NUMERIC, TEXT, INT, UUID[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.request_qard(UUID, NUMERIC, TEXT, INT, UUID[]) TO authenticated;

-- ---------------------------------------------------------------------------
-- Guarantor accept / decline
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.respond_qard_guarantee(
  p_guarantee_id UUID,
  p_accept BOOLEAN,
  p_notes TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_g public.qard_guarantees%ROWTYPE;
  v_loan public.qard_loans%ROWTYPE;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'UNAUTHENTICATED');
  END IF;

  SELECT * INTO v_g FROM public.qard_guarantees WHERE id = p_guarantee_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'NOT_FOUND');
  END IF;
  IF v_g.guarantor_user_id <> v_uid THEN
    RETURN jsonb_build_object('ok', false, 'error', 'FORBIDDEN');
  END IF;
  IF v_g.status <> 'pending' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'ALREADY_DECIDED', 'status', v_g.status);
  END IF;

  SELECT * INTO v_loan FROM public.qard_loans WHERE id = v_g.loan_id;
  IF NOT FOUND OR v_loan.status <> 'requested' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'LOAN_NOT_REQUESTED');
  END IF;

  UPDATE public.qard_guarantees
  SET
    status = CASE WHEN p_accept THEN 'accepted'::public.qard_guarantee_status
                  ELSE 'declined'::public.qard_guarantee_status END,
    notes = NULLIF(btrim(coalesce(p_notes, '')), ''),
    decided_at = NOW(),
    updated_at = NOW()
  WHERE id = p_guarantee_id;

  INSERT INTO public.notifications (user_id, type, channel, title, body, data)
  VALUES (
    v_g.borrower_id,
    'system',
    'in_app',
    CASE WHEN p_accept THEN 'Guarantee accepted' ELSE 'Guarantee declined' END,
    CASE WHEN p_accept
      THEN 'A circle member accepted your loan guarantee request.'
      ELSE 'A circle member declined your loan guarantee request.'
    END,
    jsonb_build_object(
      'kind', 'qard_guarantee_response',
      'loan_id', v_g.loan_id,
      'guarantee_id', p_guarantee_id,
      'accepted', p_accept
    )
  );

  RETURN jsonb_build_object(
    'ok', true,
    'status', CASE WHEN p_accept THEN 'accepted' ELSE 'declined' END
  );
END;
$$;

REVOKE ALL ON FUNCTION public.respond_qard_guarantee(UUID, BOOLEAN, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.respond_qard_guarantee(UUID, BOOLEAN, TEXT) TO authenticated;

-- ---------------------------------------------------------------------------
-- Gate officer approval: no pending guarantors; if any nominated, ≥1 accepted
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.decide_qard(p_loan_id UUID, p_approve BOOLEAN)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_l public.qard_loans%ROWTYPE;
  v_pending INT := 0;
  v_accepted INT := 0;
  v_total INT := 0;
BEGIN
  SELECT * INTO v_l FROM public.qard_loans WHERE id = p_loan_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'error', 'NOT_FOUND'); END IF;
  IF NOT (
    private.is_circle_admin(v_l.jamiya_id)
    OR EXISTS (
      SELECT 1 FROM public.members m
      WHERE m.jamiya_id = v_l.jamiya_id AND m.user_id = v_uid
        AND m.role::text IN ('treasurer', 'chair', 'circle_admin') AND m.status = 'active'
    )
  ) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'FORBIDDEN');
  END IF;
  IF v_l.status <> 'requested' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'NOT_REQUESTED');
  END IF;

  IF NOT p_approve THEN
    UPDATE public.qard_loans SET status = 'rejected', approved_by = v_uid, decided_at = NOW()
    WHERE id = p_loan_id;
    UPDATE public.qard_guarantees
    SET status = 'released', updated_at = NOW()
    WHERE loan_id = p_loan_id AND status = 'pending';
    RETURN jsonb_build_object('ok', true, 'status', 'rejected');
  END IF;

  IF v_l.agreement_accepted_at IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'AGREEMENT_REQUIRED');
  END IF;

  SELECT
    count(*)::INT,
    count(*) FILTER (WHERE status = 'pending')::INT,
    count(*) FILTER (WHERE status = 'accepted')::INT
  INTO v_total, v_pending, v_accepted
  FROM public.qard_guarantees
  WHERE loan_id = p_loan_id;

  IF v_pending > 0 THEN
    RETURN jsonb_build_object(
      'ok', false,
      'error', 'GUARANTEES_PENDING',
      'pending', v_pending,
      'accepted', v_accepted
    );
  END IF;

  IF v_total > 0 AND v_accepted < 1 THEN
    RETURN jsonb_build_object(
      'ok', false,
      'error', 'GUARANTEE_REQUIRED',
      'accepted', v_accepted
    );
  END IF;

  PERFORM private.ledger_credit(
    v_l.borrower_id, v_l.currency, v_l.amount, 'payout'::public.transaction_type, v_l.jamiya_id,
    'qard', p_loan_id::text, jsonb_build_object('kind', 'qard_disbursement')
  );
  UPDATE public.qard_loans
  SET status = 'active', approved_by = v_uid, decided_at = NOW(),
      due_date = CURRENT_DATE + (v_l.installment_count * 30)
  WHERE id = p_loan_id;
  RETURN jsonb_build_object('ok', true, 'status', 'active', 'guarantors_accepted', v_accepted);
END;
$$;

-- ---------------------------------------------------------------------------
-- Mark defaulted: expose accepted guarantors + notify (no wallet debit)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.mark_qard_defaulted(p_loan_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_l public.qard_loans%ROWTYPE;
  v_count INT := 0;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'UNAUTHENTICATED');
  END IF;

  SELECT * INTO v_l FROM public.qard_loans WHERE id = p_loan_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'NOT_FOUND');
  END IF;
  IF NOT private.is_circle_officer(v_l.jamiya_id) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'FORBIDDEN');
  END IF;
  IF v_l.status <> 'active' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'NOT_ACTIVE');
  END IF;

  UPDATE public.qard_loans
  SET status = 'defaulted'
  WHERE id = p_loan_id;

  UPDATE public.qard_guarantees
  SET status = 'exposed', updated_at = NOW()
  WHERE loan_id = p_loan_id AND status = 'accepted';

  GET DIAGNOSTICS v_count = ROW_COUNT;

  INSERT INTO public.notifications (user_id, type, channel, title, body, data)
  SELECT
    g.guarantor_user_id,
    'system',
    'in_app',
    'Guarantee exposed',
    'A loan you guaranteed has been marked defaulted. Contact your circle officers.',
    jsonb_build_object('kind', 'qard_guarantee_exposed', 'loan_id', p_loan_id, 'jamiya_id', v_l.jamiya_id)
  FROM public.qard_guarantees g
  WHERE g.loan_id = p_loan_id AND g.status = 'exposed';

  RETURN jsonb_build_object('ok', true, 'status', 'defaulted', 'guarantors_exposed', v_count);
END;
$$;

REVOKE ALL ON FUNCTION public.mark_qard_defaulted(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.mark_qard_defaulted(UUID) TO authenticated;
