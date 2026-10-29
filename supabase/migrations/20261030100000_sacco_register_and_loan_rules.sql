-- SACCO features for larger circles.
--
-- 1. One definition of each member's money, used everywhere below:
--      shares    = share capital bought (circle_share_lots). Locked: not lent against directly.
--      deposits  = savings paid in: cashbook contributions (which include everything paid through
--                  the wallet or M-Pesa) + contributions an officer marked paid by cash or from a
--                  bank statement (those have no cashbook row) − cashbook withdrawals.
--      loans     = Qard Hassan still owed + officer-kept loan facilities still outstanding.
-- 2. A member register for officers: every member's shares, deposits, loans, guarantees given and
--    borrowing limit, searchable and paged, with circle totals.
-- 3. Loan rules a circle can set (officers): borrow up to N × deposits, a minimum number of
--    guarantors, guarantors whose free deposits must cover what a loan exceeds the borrower's own
--    deposits, and two officers to approve every loan.
-- 4. Loans by how late they are (current, 1–30, 31–60, 61–90, over 90 days).

-- ---------------------------------------------------------------------------
-- Loan rules on the circle
-- ---------------------------------------------------------------------------
ALTER TABLE public.jamiyas
  ADD COLUMN IF NOT EXISTS loan_multiplier NUMERIC(5, 2),
  ADD COLUMN IF NOT EXISTS loan_min_guarantors INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS loan_guarantor_cover BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS loan_approvals_required INT NOT NULL DEFAULT 1;

ALTER TABLE public.jamiyas DROP CONSTRAINT IF EXISTS jamiyas_loan_rules_check;
ALTER TABLE public.jamiyas ADD CONSTRAINT jamiyas_loan_rules_check CHECK (
  (loan_multiplier IS NULL OR (loan_multiplier > 0 AND loan_multiplier <= 10))
  AND loan_min_guarantors BETWEEN 0 AND 5
  AND loan_approvals_required IN (1, 2)
);

-- ---------------------------------------------------------------------------
-- Each member's money
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION private.member_money(p_jamiya_id UUID, p_member_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  v_user UUID;
  v_shares NUMERIC;
  v_book NUMERIC;
  v_offbook NUMERIC;
  v_withdrawn NUMERIC;
  v_qard NUMERIC;
  v_qard_pending NUMERIC;
  v_facility NUMERIC;
BEGIN
  SELECT user_id INTO v_user FROM public.members WHERE id = p_member_id AND jamiya_id = p_jamiya_id;

  SELECT coalesce(sum(amount), 0) INTO v_shares
  FROM public.circle_share_lots WHERE jamiya_id = p_jamiya_id AND member_id = p_member_id;

  SELECT coalesce(sum(amount) FILTER (WHERE entry_type = 'contribution'), 0),
         coalesce(sum(amount) FILTER (WHERE entry_type = 'withdrawal'), 0)
  INTO v_book, v_withdrawn
  FROM public.book_entries WHERE jamiya_id = p_jamiya_id AND member_id = p_member_id;

  SELECT coalesce(sum(cp.amount), 0) INTO v_offbook
  FROM public.contribution_payments cp
  JOIN public.contributions c ON c.id = cp.contribution_id
  WHERE c.jamiya_id = p_jamiya_id AND c.member_id = p_member_id
    AND cp.payment_method IN ('cash', 'external');

  SELECT coalesce(sum(greatest(q.amount - coalesce(q.amount_repaid, 0), 0))
                    FILTER (WHERE q.status IN ('approved', 'active', 'defaulted')), 0),
         coalesce(sum(q.amount) FILTER (WHERE q.status = 'requested'), 0)
  INTO v_qard, v_qard_pending
  FROM public.qard_loans q
  WHERE q.jamiya_id = p_jamiya_id AND q.borrower_id = v_user;

  SELECT coalesce(sum(f.principal_outstanding), 0) INTO v_facility
  FROM public.member_loan_facilities f
  WHERE f.jamiya_id = p_jamiya_id AND f.member_id = p_member_id AND f.status = 'active';

  RETURN jsonb_build_object(
    'shares', v_shares,
    'deposits', greatest(v_book + v_offbook - v_withdrawn, 0),
    'qard_owed', v_qard,
    'qard_requested', v_qard_pending,
    'facility_owed', v_facility,
    'loans_outstanding', v_qard + v_facility
  );
END;
$$;

-- What a member has pledged as guarantor: for each live loan they accepted to guarantee, their
-- share of the part of the loan the borrower's own deposits do not cover.
CREATE OR REPLACE FUNCTION private.member_guarantee_exposure(p_jamiya_id UUID, p_user_id UUID)
RETURNS NUMERIC
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO ''
AS $$
  SELECT coalesce(sum(
    greatest(
      greatest(q.amount - coalesce(q.amount_repaid, 0), 0)
        - coalesce((private.member_money(q.jamiya_id, bm.id)->>'deposits')::numeric, 0),
      0
    ) / greatest((SELECT count(*) FROM public.qard_guarantees g2
                  WHERE g2.loan_id = q.id AND g2.status = 'accepted'), 1)
  ), 0)
  FROM public.qard_guarantees g
  JOIN public.qard_loans q ON q.id = g.loan_id
  LEFT JOIN public.members bm ON bm.jamiya_id = q.jamiya_id AND bm.user_id = q.borrower_id
  WHERE g.jamiya_id = p_jamiya_id
    AND g.guarantor_user_id = p_user_id
    AND g.status = 'accepted'
    AND q.status IN ('approved', 'active', 'defaulted');
$$;

-- Deposits not already behind the member's own loans or pledged for someone else's.
CREATE OR REPLACE FUNCTION private.member_free_deposits(p_jamiya_id UUID, p_member_id UUID)
RETURNS NUMERIC
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  v_money JSONB := private.member_money(p_jamiya_id, p_member_id);
  v_user UUID;
BEGIN
  SELECT user_id INTO v_user FROM public.members WHERE id = p_member_id;
  RETURN greatest(
    (v_money->>'deposits')::numeric
      - (v_money->>'loans_outstanding')::numeric
      - private.member_guarantee_exposure(p_jamiya_id, v_user),
    0
  );
END;
$$;

-- How much more this member may borrow under the circle's multiplier (NULL when none is set).
CREATE OR REPLACE FUNCTION private.member_borrowing_limit(p_jamiya_id UUID, p_member_id UUID)
RETURNS NUMERIC
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  v_mult NUMERIC;
  v_money JSONB;
BEGIN
  SELECT loan_multiplier INTO v_mult FROM public.jamiyas WHERE id = p_jamiya_id;
  IF v_mult IS NULL THEN
    RETURN NULL;
  END IF;
  v_money := private.member_money(p_jamiya_id, p_member_id);
  RETURN greatest(
    round(v_mult * (v_money->>'deposits')::numeric, 2)
      - (v_money->>'loans_outstanding')::numeric
      - (v_money->>'qard_requested')::numeric,
    0
  );
END;
$$;

-- ---------------------------------------------------------------------------
-- Officers set the rules
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.set_circle_loan_policy(
  p_jamiya_id UUID,
  p_multiplier NUMERIC,
  p_min_guarantors INT,
  p_guarantor_cover BOOLEAN,
  p_approvals_required INT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  v_uid UUID := auth.uid();
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'UNAUTHENTICATED');
  END IF;
  IF NOT (private.is_circle_officer(p_jamiya_id) OR private.is_platform_admin()) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'FORBIDDEN');
  END IF;
  IF (p_multiplier IS NOT NULL AND (p_multiplier <= 0 OR p_multiplier > 10))
     OR coalesce(p_min_guarantors, 0) NOT BETWEEN 0 AND 5
     OR coalesce(p_approvals_required, 1) NOT IN (1, 2) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'INVALID');
  END IF;

  UPDATE public.jamiyas
  SET loan_multiplier = p_multiplier,
      loan_min_guarantors = coalesce(p_min_guarantors, 0),
      loan_guarantor_cover = coalesce(p_guarantor_cover, false),
      loan_approvals_required = coalesce(p_approvals_required, 1),
      updated_at = NOW()
  WHERE id = p_jamiya_id;

  INSERT INTO public.audit_logs (actor_id, action, entity_type, entity_id, jamiya_id, metadata)
  VALUES (v_uid, 'update', 'jamiya', p_jamiya_id, p_jamiya_id,
          jsonb_build_object('kind', 'loan_policy', 'multiplier', p_multiplier,
                             'min_guarantors', p_min_guarantors, 'guarantor_cover', p_guarantor_cover,
                             'approvals_required', p_approvals_required));

  RETURN jsonb_build_object('ok', true);
END;
$$;

-- ---------------------------------------------------------------------------
-- The borrowing cap follows the multiplier when the circle has one
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.qard_cap_for_jamiya(p_jamiya_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_fig JSONB;
  v_circle NUMERIC := 0;
  v_personal NUMERIC := 0;
  v_cap NUMERIC := 0;
  v_overdue BOOLEAN := FALSE;
  v_limit NUMERIC;
  v_money JSONB;
BEGIN
  IF v_uid IS NULL OR NOT private.is_active_jamiya_member(p_jamiya_id) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'FORBIDDEN');
  END IF;

  v_fig := private.facility_member_circle(p_jamiya_id, v_uid);
  IF NOT coalesce((v_fig->>'ok')::boolean, false) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'FORBIDDEN');
  END IF;

  v_overdue := private.facility_member_overdue(v_uid);
  v_circle := private.facility_circle_room(p_jamiya_id);
  v_personal := coalesce((v_fig->>'personal_room')::numeric, 0);

  -- A circle with a multiplier lends up to N × deposits, less what the member already owes.
  v_limit := private.member_borrowing_limit(p_jamiya_id, (v_fig->>'member_id')::uuid);
  IF v_limit IS NOT NULL THEN
    v_personal := v_limit;
  END IF;
  v_money := private.member_money(p_jamiya_id, (v_fig->>'member_id')::uuid);

  v_cap := CASE WHEN v_overdue THEN 0 ELSE least(v_personal, v_circle) END;

  RETURN jsonb_build_object(
    'ok', true,
    'paid_total', coalesce((v_fig->>'schedule_paid')::numeric, 0),
    'cap', v_cap,
    'currency', 'KES',
    'overdue', v_overdue,
    'is_share', coalesce((v_fig->>'is_share')::boolean, false),
    'schedule_paid', coalesce((v_fig->>'schedule_paid')::numeric, 0),
    'book_contributions', coalesce((v_fig->>'book_contributions')::numeric, 0),
    'shares', coalesce((v_fig->>'shares')::numeric, 0),
    'qard_owed', coalesce((v_fig->>'qard_owed')::numeric, 0),
    'personal_room', v_personal,
    'circle_room', v_circle,
    'deposits', (v_money->>'deposits')::numeric,
    'multiplier', (SELECT loan_multiplier FROM public.jamiyas WHERE id = p_jamiya_id)
  );
END;
$$;

-- ---------------------------------------------------------------------------
-- Two officers when the circle asks for it
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.propose_decide_qard(p_loan_id uuid, p_approve boolean)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_loan public.qard_loans%ROWTYPE;
  v_pending public.dual_approval_requests%ROWTYPE;
  v_two BOOLEAN;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'UNAUTHENTICATED');
  END IF;

  SELECT * INTO v_loan FROM public.qard_loans WHERE id = p_loan_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'NOT_FOUND');
  END IF;

  v_two := private.circle_dual_required(v_loan.jamiya_id, v_loan.amount)
    OR coalesce((SELECT loan_approvals_required FROM public.jamiyas WHERE id = v_loan.jamiya_id), 1) >= 2;

  IF NOT p_approve OR NOT v_two THEN
    RETURN public.decide_qard(p_loan_id, p_approve);
  END IF;

  SELECT * INTO v_pending
  FROM public.dual_approval_requests
  WHERE kind = 'qard_decide' AND entity_id = p_loan_id AND status = 'pending'
  LIMIT 1;

  IF FOUND AND v_pending.first_approver_id IS DISTINCT FROM v_uid THEN
    RETURN public.confirm_dual_approval(v_pending.id, true);
  END IF;

  RETURN public.propose_dual_approval(
    'qard_decide', p_loan_id, v_loan.amount, v_loan.currency, v_loan.jamiya_id,
    jsonb_build_object('approve', true)
  );
END;
$$;

-- ---------------------------------------------------------------------------
-- Guarantor rules when a loan is approved
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.decide_qard(p_loan_id uuid, p_approve boolean)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_l public.qard_loans%ROWTYPE;
  v_j public.jamiyas%ROWTYPE;
  v_pending INT := 0;
  v_accepted INT := 0;
  v_total INT := 0;
  v_fee NUMERIC := 0;
  v_borrower_member UUID;
  v_needed NUMERIC := 0;
  v_cover NUMERIC := 0;
BEGIN
  SELECT * INTO v_l FROM public.qard_loans WHERE id = p_loan_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'error', 'NOT_FOUND'); END IF;
  IF NOT private.is_circle_officer(v_l.jamiya_id) THEN
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

  -- The circle's own loan rules.
  SELECT * INTO v_j FROM public.jamiyas WHERE id = v_l.jamiya_id;
  IF v_accepted < coalesce(v_j.loan_min_guarantors, 0) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'GUARANTORS_REQUIRED',
                              'accepted', v_accepted, 'required', v_j.loan_min_guarantors);
  END IF;

  IF coalesce(v_j.loan_guarantor_cover, false) THEN
    SELECT id INTO v_borrower_member FROM public.members
    WHERE jamiya_id = v_l.jamiya_id AND user_id = v_l.borrower_id;
    v_needed := greatest(v_l.amount - private.member_free_deposits(v_l.jamiya_id, v_borrower_member), 0);
    IF v_needed > 0 THEN
      SELECT coalesce(sum(private.member_free_deposits(v_l.jamiya_id, gm.id)), 0) INTO v_cover
      FROM public.qard_guarantees g
      JOIN public.members gm ON gm.jamiya_id = v_l.jamiya_id AND gm.user_id = g.guarantor_user_id
      WHERE g.loan_id = p_loan_id AND g.status = 'accepted';
      IF v_cover < v_needed THEN
        RETURN jsonb_build_object('ok', false, 'error', 'GUARANTEE_COVER_SHORT',
                                  'needed', v_needed, 'covered', v_cover);
      END IF;
    END IF;
  END IF;

  PERFORM private.ledger_credit(
    v_l.borrower_id, v_l.currency, v_l.amount, 'payout'::public.transaction_type, v_l.jamiya_id,
    'qard', p_loan_id::text, jsonb_build_object('kind', 'qard_disbursement')
  );
  -- The circle's fixed loan facilitation fee, if the borrower accepted it in the circle's terms.
  -- A flat amount, never a percentage or a charge for time, so the loan stays interest-free.
  v_fee := least(private.agreed_circle_fee(v_l.borrower_id, v_l.jamiya_id, 'qard_fee_amount'), v_l.amount);
  IF v_fee > 0 THEN
    PERFORM private.ledger_debit(
      v_l.borrower_id, v_l.currency, v_fee, 'fee'::public.transaction_type, v_l.jamiya_id,
      'qard_fee:' || p_loan_id::text, 'qard_fee:' || p_loan_id::text,
      jsonb_build_object('kind', 'qard_fee', 'loan_id', p_loan_id)
    );
  END IF;
  UPDATE public.qard_loans
  SET status = 'active', approved_by = v_uid, decided_at = NOW(),
      due_date = CURRENT_DATE + (v_l.installment_count * 30),
      fee_amount = v_fee
  WHERE id = p_loan_id;
  RETURN jsonb_build_object('ok', true, 'status', 'active', 'guarantors_accepted', v_accepted, 'fee', v_fee);
END;
$$;

-- ---------------------------------------------------------------------------
-- Member register
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.circle_member_register(
  p_jamiya_id UUID,
  p_search TEXT DEFAULT NULL,
  p_limit INT DEFAULT 50,
  p_offset INT DEFAULT 0
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  v_q TEXT := nullif(btrim(coalesce(p_search, '')), '');
  v_limit INT := least(greatest(coalesce(p_limit, 50), 1), 200);
  v_offset INT := greatest(coalesce(p_offset, 0), 0);
  v_result JSONB;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'UNAUTHENTICATED');
  END IF;
  IF NOT (private.is_circle_officer(p_jamiya_id) OR private.is_platform_admin()) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'FORBIDDEN');
  END IF;

  WITH base AS (
    SELECT m.id, m.user_id, m.member_code, m.role, m.status, m.joined_at,
           p.full_name, p.phone
    FROM public.members m
    LEFT JOIN public.profiles p ON p.id = m.user_id
    WHERE m.jamiya_id = p_jamiya_id
      AND m.status IN ('active', 'suspended')
      AND (v_q IS NULL
           OR p.full_name ILIKE '%' || v_q || '%'
           OR p.phone ILIKE '%' || v_q || '%'
           OR m.member_code ILIKE '%' || v_q || '%')
  ),
  money AS (
    SELECT b.*, private.member_money(p_jamiya_id, b.id) AS mm,
           private.member_guarantee_exposure(p_jamiya_id, b.user_id) AS pledged,
           private.member_borrowing_limit(p_jamiya_id, b.id) AS can_borrow,
           (SELECT coalesce(sum(c.amount - coalesce(c.amount_paid, 0)), 0)
            FROM public.contributions c
            WHERE c.jamiya_id = p_jamiya_id AND c.member_id = b.id
              AND c.status IN ('pending', 'late', 'partial') AND c.due_date < CURRENT_DATE) AS arrears
    FROM base b
  )
  SELECT jsonb_build_object(
    'ok', true,
    'total', (SELECT count(*) FROM money),
    'multiplier', (SELECT loan_multiplier FROM public.jamiyas WHERE id = p_jamiya_id),
    'totals', (SELECT jsonb_build_object(
                 'shares', coalesce(sum((mm->>'shares')::numeric), 0),
                 'deposits', coalesce(sum((mm->>'deposits')::numeric), 0),
                 'loans_outstanding', coalesce(sum((mm->>'loans_outstanding')::numeric), 0),
                 'arrears', coalesce(sum(arrears), 0))
               FROM money),
    'rows', coalesce((
      SELECT jsonb_agg(jsonb_build_object(
               'member_id', x.id, 'member_code', x.member_code, 'name', x.full_name,
               'phone', x.phone, 'role', x.role, 'status', x.status,
               'shares', (x.mm->>'shares')::numeric,
               'deposits', (x.mm->>'deposits')::numeric,
               'loans_outstanding', (x.mm->>'loans_outstanding')::numeric,
               'pledged', round(x.pledged, 2),
               'can_borrow', x.can_borrow,
               'arrears', x.arrears) ORDER BY x.full_name NULLS LAST, x.id)
      FROM (SELECT * FROM money ORDER BY full_name NULLS LAST, id LIMIT v_limit OFFSET v_offset) x
    ), '[]'::jsonb)
  ) INTO v_result;

  RETURN v_result;
END;
$$;

-- ---------------------------------------------------------------------------
-- Loans by how late they are
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.circle_loan_aging(p_jamiya_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO ''
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'UNAUTHENTICATED');
  END IF;
  IF NOT (private.is_circle_officer(p_jamiya_id) OR private.is_platform_admin()) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'FORBIDDEN');
  END IF;

  RETURN (
    WITH loans AS (
      -- Qard Hassan: late by days past the due date.
      SELECT 'qard'::text AS kind, q.id, m.id AS member_id, p.full_name AS name,
             greatest(q.amount - coalesce(q.amount_repaid, 0), 0) AS outstanding,
             q.due_date,
             greatest(CURRENT_DATE - q.due_date, 0) AS days_late
      FROM public.qard_loans q
      JOIN public.members m ON m.jamiya_id = q.jamiya_id AND m.user_id = q.borrower_id
      LEFT JOIN public.profiles p ON p.id = q.borrower_id
      WHERE q.jamiya_id = p_jamiya_id AND q.status IN ('active', 'defaulted', 'approved')
        AND q.amount > coalesce(q.amount_repaid, 0)
      UNION ALL
      -- Officer-kept facilities have no due date: late by days since the last repayment
      -- (or the disbursement), counting a month as on time.
      SELECT 'facility', f.id, f.member_id, p.full_name,
             f.principal_outstanding,
             NULL::date,
             greatest(CURRENT_DATE - coalesce(
               (SELECT max(e.effective_date) FROM public.member_loan_events e
                WHERE e.facility_id = f.id AND e.event_type IN ('repayment', 'disbursement')),
               f.opened_on) - 30, 0)
      FROM public.member_loan_facilities f
      JOIN public.members m ON m.id = f.member_id
      LEFT JOIN public.profiles p ON p.id = m.user_id
      WHERE f.jamiya_id = p_jamiya_id AND f.status = 'active' AND f.principal_outstanding > 0
    ),
    bucketed AS (
      SELECT l.*, CASE WHEN days_late = 0 THEN 'current'
                       WHEN days_late <= 30 THEN '1_30'
                       WHEN days_late <= 60 THEN '31_60'
                       WHEN days_late <= 90 THEN '61_90'
                       ELSE 'over_90' END AS bucket
      FROM loans l
    )
    SELECT jsonb_build_object(
      'ok', true,
      'total_outstanding', coalesce((SELECT sum(outstanding) FROM bucketed), 0),
      'at_risk', coalesce((SELECT sum(outstanding) FROM bucketed WHERE days_late > 30), 0),
      'buckets', (SELECT coalesce(jsonb_object_agg(b.bucket, jsonb_build_object('count', b.n, 'amount', b.amt)), '{}'::jsonb)
                  FROM (SELECT bucket, count(*) AS n, sum(outstanding) AS amt FROM bucketed GROUP BY bucket) b),
      'loans', coalesce((SELECT jsonb_agg(jsonb_build_object(
                  'kind', kind, 'id', id, 'member_id', member_id, 'name', name,
                  'outstanding', outstanding, 'due_date', due_date, 'days_late', days_late,
                  'bucket', bucket) ORDER BY days_late DESC, outstanding DESC)
                FROM bucketed), '[]'::jsonb)
    )
  );
END;
$$;

REVOKE ALL ON FUNCTION private.member_money(UUID, UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION private.member_guarantee_exposure(UUID, UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION private.member_free_deposits(UUID, UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION private.member_borrowing_limit(UUID, UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.set_circle_loan_policy(UUID, NUMERIC, INT, BOOLEAN, INT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.circle_member_register(UUID, TEXT, INT, INT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.circle_loan_aging(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_circle_loan_policy(UUID, NUMERIC, INT, BOOLEAN, INT) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.circle_member_register(UUID, TEXT, INT, INT) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.circle_loan_aging(UUID) TO authenticated, service_role;
