-- Circle-wide At a glance: aggregate member books / facilities / fines for officers.

CREATE OR REPLACE FUNCTION public.circle_books_glance(p_jamiya_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_members INT := 0;
  v_share NUMERIC := 0;
  v_book_contrib NUMERIC := 0;
  v_schedule_paid NUMERIC := 0;
  v_schedule_outstanding NUMERIC := 0;
  v_facility_disbursed NUMERIC := 0;
  v_facility_repaid NUMERIC := 0;
  v_facility_outstanding NUMERIC := 0;
  v_fines_open NUMERIC := 0;
  v_fines_paid NUMERIC := 0;
  v_qard_outstanding NUMERIC := 0;
  v_profit_paid NUMERIC := 0;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'UNAUTHENTICATED');
  END IF;
  IF NOT (
    private.is_circle_officer(p_jamiya_id)
    OR private.is_platform_admin()
  ) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'FORBIDDEN');
  END IF;

  SELECT count(*)::INT INTO v_members
  FROM public.members
  WHERE jamiya_id = p_jamiya_id AND status IN ('active', 'suspended');

  SELECT COALESCE(sum(amount), 0) INTO v_share
  FROM public.circle_share_lots
  WHERE jamiya_id = p_jamiya_id;

  SELECT COALESCE(sum(amount), 0) INTO v_book_contrib
  FROM public.book_entries
  WHERE jamiya_id = p_jamiya_id AND entry_type = 'contribution';

  SELECT
    COALESCE(sum(CASE WHEN status = 'paid' THEN amount ELSE COALESCE(amount_paid, 0) END), 0),
    COALESCE(sum(
      CASE
        WHEN status IN ('pending', 'late', 'partial')
          THEN GREATEST(amount - COALESCE(amount_paid, 0), 0)
        ELSE 0
      END
    ), 0)
  INTO v_schedule_paid, v_schedule_outstanding
  FROM public.contributions
  WHERE jamiya_id = p_jamiya_id;

  -- Prefer loan-ledger facilities; also count book loan lines for older data.
  SELECT COALESCE(sum(principal_outstanding), 0) INTO v_facility_outstanding
  FROM public.member_loan_facilities
  WHERE jamiya_id = p_jamiya_id;

  SELECT COALESCE(sum(amount), 0) INTO v_facility_disbursed
  FROM public.member_loan_events
  WHERE jamiya_id = p_jamiya_id AND event_type = 'disbursement';

  IF v_facility_disbursed = 0 THEN
    SELECT COALESCE(sum(amount), 0) INTO v_facility_disbursed
    FROM public.book_entries
    WHERE jamiya_id = p_jamiya_id AND entry_type = 'loan';
  END IF;

  SELECT COALESCE(sum(GREATEST(amount - COALESCE(profit_amount, 0), 0)), 0)
  INTO v_facility_repaid
  FROM public.member_loan_events
  WHERE jamiya_id = p_jamiya_id AND event_type = 'repayment';

  IF v_facility_repaid = 0 THEN
    SELECT COALESCE(sum(amount), 0) INTO v_facility_repaid
    FROM public.book_entries
    WHERE jamiya_id = p_jamiya_id AND entry_type = 'loan_repayment';
  END IF;

  SELECT COALESCE(sum(profit_amount), 0) INTO v_profit_paid
  FROM public.member_loan_events
  WHERE jamiya_id = p_jamiya_id AND event_type IN ('profit', 'repayment', 'rollover');

  SELECT COALESCE(sum(amount), 0) INTO v_fines_open
  FROM public.penalties
  WHERE jamiya_id = p_jamiya_id AND status = 'open';

  SELECT COALESCE(sum(amount), 0) INTO v_fines_paid
  FROM public.penalties
  WHERE jamiya_id = p_jamiya_id AND status = 'paid';

  SELECT COALESCE(sum(GREATEST(amount - COALESCE(amount_repaid, 0), 0)), 0)
  INTO v_qard_outstanding
  FROM public.qard_loans
  WHERE jamiya_id = p_jamiya_id
    AND status::text IN ('active', 'approved', 'defaulted');

  RETURN jsonb_build_object(
    'ok', true,
    'members_active', v_members,
    'share_capital', v_share,
    'book_contributions', v_book_contrib,
    'schedule_contributions_paid', v_schedule_paid,
    'schedule_contributions_outstanding', v_schedule_outstanding,
    'facility_disbursed', v_facility_disbursed,
    'facility_repaid', v_facility_repaid,
    'facility_outstanding', v_facility_outstanding,
    'profit_paid', v_profit_paid,
    'fines_open', v_fines_open,
    'fines_paid', v_fines_paid,
    'fines_total', v_fines_open + v_fines_paid,
    'qard_outstanding', v_qard_outstanding
  );
END;
$$;

REVOKE ALL ON FUNCTION public.circle_books_glance(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.circle_books_glance(UUID) TO authenticated;
