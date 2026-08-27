-- Enrich member statements with share capital, contribution/penalty totals, and share lots.

CREATE OR REPLACE FUNCTION public.member_circle_statement(
  p_jamiya_id UUID,
  p_member_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_member RECORD;
  v_is_self BOOLEAN;
  v_contrib JSONB;
  v_pens JSONB;
  v_loans JSONB;
  v_books JSONB;
  v_pockets JSONB;
  v_share_lots JSONB;
  v_share_capital NUMERIC := 0;
  v_share_units NUMERIC := 0;
  v_contrib_due NUMERIC := 0;
  v_contrib_paid NUMERIC := 0;
  v_book_contrib NUMERIC := 0;
  v_pen_total NUMERIC := 0;
  v_pen_open NUMERIC := 0;
  v_pen_paid NUMERIC := 0;
  v_loan_principal NUMERIC := 0;
  v_loan_repaid NUMERIC := 0;
  v_savings_total NUMERIC := 0;
  v_cycles_paid INT := 0;
  v_cycles_open INT := 0;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'UNAUTHENTICATED');
  END IF;

  SELECT * INTO v_member
  FROM public.members m
  WHERE m.id = p_member_id AND m.jamiya_id = p_jamiya_id;
  IF v_member.id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'MEMBER_NOT_FOUND');
  END IF;

  v_is_self := v_member.user_id = v_uid;
  IF NOT (
    v_is_self
    OR private.is_circle_officer(p_jamiya_id)
    OR private.is_platform_admin()
  ) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'FORBIDDEN');
  END IF;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', c.id,
    'cycle', c.cycle_number,
    'amount', c.amount,
    'amount_paid', COALESCE(c.amount_paid, 0),
    'status', c.status,
    'due_date', c.due_date,
    'paid_at', c.paid_at
  ) ORDER BY c.due_date DESC), '[]'::jsonb)
  INTO v_contrib
  FROM public.contributions c
  WHERE c.jamiya_id = p_jamiya_id AND c.member_id = p_member_id;

  SELECT
    COALESCE(sum(c.amount), 0),
    COALESCE(sum(COALESCE(c.amount_paid, 0)), 0),
    COALESCE(sum(CASE WHEN c.status = 'paid' THEN 1 ELSE 0 END), 0)::INT,
    COALESCE(sum(CASE WHEN c.status IN ('pending', 'late', 'partial') THEN 1 ELSE 0 END), 0)::INT
  INTO v_contrib_due, v_contrib_paid, v_cycles_paid, v_cycles_open
  FROM public.contributions c
  WHERE c.jamiya_id = p_jamiya_id AND c.member_id = p_member_id;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', p.id,
    'kind', p.kind,
    'amount', p.amount,
    'status', p.status,
    'notes', p.notes,
    'assessed_at', p.assessed_at,
    'paid_at', p.paid_at
  ) ORDER BY p.assessed_at DESC), '[]'::jsonb)
  INTO v_pens
  FROM public.penalties p
  WHERE p.jamiya_id = p_jamiya_id AND p.member_id = p_member_id;

  SELECT
    COALESCE(sum(p.amount), 0),
    COALESCE(sum(CASE WHEN p.status = 'open' THEN p.amount ELSE 0 END), 0),
    COALESCE(sum(CASE WHEN p.status = 'paid' THEN p.amount ELSE 0 END), 0)
  INTO v_pen_total, v_pen_open, v_pen_paid
  FROM public.penalties p
  WHERE p.jamiya_id = p_jamiya_id AND p.member_id = p_member_id;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', q.id,
    'amount', q.amount,
    'amount_repaid', q.amount_repaid,
    'status', q.status,
    'purpose', q.purpose,
    'due_date', q.due_date
  ) ORDER BY q.created_at DESC), '[]'::jsonb)
  INTO v_loans
  FROM public.qard_loans q
  WHERE q.jamiya_id = p_jamiya_id AND q.borrower_id = v_member.user_id;

  SELECT
    COALESCE(sum(q.amount), 0),
    COALESCE(sum(q.amount_repaid), 0)
  INTO v_loan_principal, v_loan_repaid
  FROM public.qard_loans q
  WHERE q.jamiya_id = p_jamiya_id AND q.borrower_id = v_member.user_id;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', b.id,
    'entry_type', b.entry_type,
    'amount', b.amount,
    'effective_date', b.effective_date,
    'notes', b.notes,
    'source', b.metadata->>'source'
  ) ORDER BY b.effective_date DESC, b.created_at DESC), '[]'::jsonb)
  INTO v_books
  FROM public.book_entries b
  WHERE b.jamiya_id = p_jamiya_id AND b.member_id = p_member_id;

  SELECT COALESCE(sum(b.amount), 0) INTO v_book_contrib
  FROM public.book_entries b
  WHERE b.jamiya_id = p_jamiya_id
    AND b.member_id = p_member_id
    AND b.entry_type = 'contribution';

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', s.id,
    'category', s.category,
    'label', s.label,
    'balance', s.balance,
    'target_amount', s.target_amount
  )), '[]'::jsonb)
  INTO v_pockets
  FROM public.savings_pockets s
  WHERE s.jamiya_id = p_jamiya_id AND s.member_id = p_member_id;

  SELECT COALESCE(sum(s.balance), 0) INTO v_savings_total
  FROM public.savings_pockets s
  WHERE s.jamiya_id = p_jamiya_id AND s.member_id = p_member_id;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', l.id,
    'shares', l.shares,
    'unit_price', l.unit_price,
    'amount', l.amount,
    'purchased_on', l.purchased_on,
    'notes', l.notes
  ) ORDER BY l.purchased_on DESC, l.created_at DESC), '[]'::jsonb)
  INTO v_share_lots
  FROM public.circle_share_lots l
  WHERE l.jamiya_id = p_jamiya_id AND l.member_id = p_member_id;

  SELECT COALESCE(sum(l.amount), 0), COALESCE(sum(l.shares), 0)
  INTO v_share_capital, v_share_units
  FROM public.circle_share_lots l
  WHERE l.jamiya_id = p_jamiya_id AND l.member_id = p_member_id;

  RETURN jsonb_build_object(
    'ok', true,
    'member_id', v_member.id,
    'member_code', v_member.member_code,
    'role', v_member.role,
    'status', v_member.status,
    'payout_position', v_member.payout_position,
    'joined_at', v_member.joined_at,
    'summary', jsonb_build_object(
      'share_capital', v_share_capital,
      'share_units', v_share_units,
      'schedule_contributions_due', v_contrib_due,
      'schedule_contributions_paid', v_contrib_paid,
      'schedule_contributions_outstanding', GREATEST(v_contrib_due - v_contrib_paid, 0),
      'cycles_paid', v_cycles_paid,
      'cycles_open', v_cycles_open,
      'book_contributions', v_book_contrib,
      'contributions_so_far', v_contrib_paid + v_book_contrib,
      'penalties_total', v_pen_total,
      'penalties_open', v_pen_open,
      'penalties_paid', v_pen_paid,
      'loan_principal', v_loan_principal,
      'loan_repaid', v_loan_repaid,
      'loan_outstanding', GREATEST(v_loan_principal - v_loan_repaid, 0),
      'savings_total', v_savings_total
    ),
    'share_lots', v_share_lots,
    'contributions', v_contrib,
    'penalties', v_pens,
    'loans', v_loans,
    'book_entries', v_books,
    'savings_pockets', v_pockets
  );
END;
$$;
