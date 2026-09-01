-- Allow officers to void a mistaken monthly contribution (MGR / savings grids).

CREATE OR REPLACE FUNCTION public.officer_void_ledger_line(
  p_kind TEXT,
  p_id UUID,
  p_reason TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_kind TEXT := lower(trim(COALESCE(p_kind, '')));
  v_reason TEXT := NULLIF(trim(COALESCE(p_reason, '')), '');
  v_jamiya_id UUID;
  v_member_id UUID;
  v_entry public.book_entries%ROWTYPE;
  v_lot public.circle_share_lots%ROWTYPE;
  v_event public.member_loan_events%ROWTYPE;
  v_facility public.member_loan_facilities%ROWTYPE;
  v_contrib public.contributions%ROWTYPE;
  v_loan_event_id UUID;
  v_new_principal NUMERIC(18, 2);
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'UNAUTHENTICATED');
  END IF;

  IF v_kind NOT IN ('book_entry', 'share_lot', 'loan_event', 'contribution') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'INVALID_KIND');
  END IF;

  IF p_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'NOT_FOUND');
  END IF;

  IF v_kind = 'contribution' THEN
    SELECT * INTO v_contrib FROM public.contributions WHERE id = p_id FOR UPDATE;
    IF NOT FOUND THEN
      RETURN jsonb_build_object('ok', false, 'error', 'NOT_FOUND');
    END IF;
    v_jamiya_id := v_contrib.jamiya_id;
    v_member_id := v_contrib.member_id;

    IF NOT (
      private.is_circle_officer(v_jamiya_id)
      OR private.is_platform_admin()
      OR EXISTS (
        SELECT 1 FROM public.members m
        WHERE m.jamiya_id = v_jamiya_id
          AND m.user_id = v_uid
          AND m.status = 'active'
          AND m.role::text = 'secretary'
      )
    ) THEN
      RETURN jsonb_build_object('ok', false, 'error', 'FORBIDDEN');
    END IF;

    DELETE FROM public.contribution_payments
    WHERE contribution_id = v_contrib.id;

    UPDATE public.contributions
    SET
      amount_paid = 0,
      status = 'pending',
      paid_at = NULL,
      updated_at = NOW()
    WHERE id = v_contrib.id;

    INSERT INTO public.audit_logs (actor_id, action, entity_type, entity_id, jamiya_id, metadata)
    VALUES (
      v_uid, 'update', 'contribution', v_contrib.id, v_jamiya_id,
      jsonb_build_object(
        'voided', true,
        'cycle_number', v_contrib.cycle_number,
        'previous_amount_paid', v_contrib.amount_paid,
        'member_id', v_member_id,
        'reason', v_reason
      )
    );

    RETURN jsonb_build_object(
      'ok', true,
      'kind', 'contribution',
      'id', v_contrib.id,
      'member_id', v_member_id
    );
  END IF;

  IF v_kind = 'book_entry' THEN
    SELECT * INTO v_entry FROM public.book_entries WHERE id = p_id FOR UPDATE;
    IF NOT FOUND THEN
      RETURN jsonb_build_object('ok', false, 'error', 'NOT_FOUND');
    END IF;
    v_jamiya_id := v_entry.jamiya_id;
    v_member_id := v_entry.member_id;

    IF NOT (
      private.is_circle_officer(v_jamiya_id)
      OR private.is_platform_admin()
      OR EXISTS (
        SELECT 1 FROM public.members m
        WHERE m.jamiya_id = v_jamiya_id
          AND m.user_id = v_uid
          AND m.status = 'active'
          AND m.role::text = 'secretary'
      )
    ) THEN
      RETURN jsonb_build_object('ok', false, 'error', 'FORBIDDEN');
    END IF;

    v_loan_event_id := NULLIF(v_entry.metadata->>'loan_event_id', '')::UUID;
    IF v_loan_event_id IS NOT NULL THEN
      RETURN public.officer_void_ledger_line('loan_event', v_loan_event_id, v_reason);
    END IF;

    DELETE FROM public.book_entries WHERE id = v_entry.id;

    INSERT INTO public.audit_logs (actor_id, action, entity_type, entity_id, jamiya_id, metadata)
    VALUES (
      v_uid, 'update', 'book_entry', v_entry.id, v_jamiya_id,
      jsonb_build_object(
        'voided', true,
        'entry_type', v_entry.entry_type,
        'amount', v_entry.amount,
        'member_id', v_member_id,
        'reason', v_reason
      )
    );

    RETURN jsonb_build_object(
      'ok', true,
      'kind', 'book_entry',
      'id', v_entry.id,
      'member_id', v_member_id
    );
  END IF;

  IF v_kind = 'share_lot' THEN
    SELECT * INTO v_lot FROM public.circle_share_lots WHERE id = p_id FOR UPDATE;
    IF NOT FOUND THEN
      RETURN jsonb_build_object('ok', false, 'error', 'NOT_FOUND');
    END IF;
    v_jamiya_id := v_lot.jamiya_id;
    v_member_id := v_lot.member_id;

    IF NOT (
      private.is_circle_officer(v_jamiya_id)
      OR private.is_platform_admin()
      OR EXISTS (
        SELECT 1 FROM public.members m
        WHERE m.jamiya_id = v_jamiya_id
          AND m.user_id = v_uid
          AND m.status = 'active'
          AND m.role::text = 'secretary'
      )
    ) THEN
      RETURN jsonb_build_object('ok', false, 'error', 'FORBIDDEN');
    END IF;

    DELETE FROM public.circle_share_lots WHERE id = v_lot.id;

    INSERT INTO public.audit_logs (actor_id, action, entity_type, entity_id, jamiya_id, metadata)
    VALUES (
      v_uid, 'update', 'share_lot', v_lot.id, v_jamiya_id,
      jsonb_build_object(
        'voided', true,
        'shares', v_lot.shares,
        'amount', v_lot.amount,
        'member_id', v_member_id,
        'reason', v_reason
      )
    );

    RETURN jsonb_build_object(
      'ok', true,
      'kind', 'share_lot',
      'id', v_lot.id,
      'member_id', v_member_id
    );
  END IF;

  SELECT * INTO v_event FROM public.member_loan_events WHERE id = p_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'NOT_FOUND');
  END IF;
  v_jamiya_id := v_event.jamiya_id;
  v_member_id := v_event.member_id;

  IF NOT (
    private.is_circle_officer(v_jamiya_id)
    OR private.is_platform_admin()
    OR EXISTS (
      SELECT 1 FROM public.members m
      WHERE m.jamiya_id = v_jamiya_id
        AND m.user_id = v_uid
        AND m.status = 'active'
        AND m.role::text = 'secretary'
    )
  ) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'FORBIDDEN');
  END IF;

  SELECT * INTO v_facility
  FROM public.member_loan_facilities
  WHERE id = v_event.facility_id
  FOR UPDATE;

  IF FOUND THEN
    v_new_principal := GREATEST(v_facility.principal_outstanding - COALESCE(v_event.principal_delta, 0), 0);
    UPDATE public.member_loan_facilities
    SET
      principal_outstanding = v_new_principal,
      status = CASE
        WHEN v_new_principal > 0 THEN 'active'
        ELSE status
      END,
      closed_on = CASE
        WHEN v_new_principal > 0 THEN NULL
        ELSE closed_on
      END,
      updated_at = NOW()
    WHERE id = v_facility.id;
  ELSE
    v_new_principal := NULL;
  END IF;

  DELETE FROM public.book_entries
  WHERE jamiya_id = v_jamiya_id
    AND (
      id = v_event.book_entry_id
      OR (metadata->>'loan_event_id') = v_event.id::text
    );

  DELETE FROM public.member_loan_events WHERE id = v_event.id;

  INSERT INTO public.audit_logs (actor_id, action, entity_type, entity_id, jamiya_id, metadata)
  VALUES (
    v_uid, 'update', 'loan_event', v_event.id, v_jamiya_id,
    jsonb_build_object(
      'voided', true,
      'event_type', v_event.event_type,
      'amount', v_event.amount,
      'principal_delta', v_event.principal_delta,
      'member_id', v_member_id,
      'reason', v_reason,
      'principal_outstanding', v_new_principal
    )
  );

  RETURN jsonb_build_object(
    'ok', true,
    'kind', 'loan_event',
    'id', v_event.id,
    'member_id', v_member_id,
    'principal_outstanding', v_new_principal
  );
END;
$$;

REVOKE ALL ON FUNCTION public.officer_void_ledger_line(TEXT, UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.officer_void_ledger_line(TEXT, UUID, TEXT) TO authenticated;
