-- Platform admin: wipe circle ledger/membership data for retest, keep one admin member.

CREATE OR REPLACE FUNCTION public.platform_admin_reset_circle_data(
  p_jamiya_id UUID,
  p_keep_user_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_keep UUID;
  v_slug TEXT;
  v_member_code TEXT;
  v_removed_members INT := 0;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'UNAUTHENTICATED');
  END IF;
  IF NOT private.is_platform_admin() THEN
    RETURN jsonb_build_object('ok', false, 'error', 'FORBIDDEN');
  END IF;

  SELECT slug INTO v_slug FROM public.jamiyas WHERE id = p_jamiya_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'NOT_FOUND');
  END IF;

  v_keep := p_keep_user_id;
  IF v_keep IS NULL THEN
    SELECT m.user_id INTO v_keep
    FROM public.members m
    WHERE m.jamiya_id = p_jamiya_id
      AND m.role = 'circle_admin'
      AND m.status = 'active'
    ORDER BY m.joined_at NULLS LAST, m.created_at
    LIMIT 1;
  END IF;
  IF v_keep IS NULL THEN
    SELECT created_by INTO v_keep FROM public.jamiyas WHERE id = p_jamiya_id;
  END IF;
  IF v_keep IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'NO_KEEP_USER');
  END IF;

  SELECT m.member_code INTO v_member_code
  FROM public.members m
  WHERE m.jamiya_id = p_jamiya_id AND m.user_id = v_keep
  LIMIT 1;

  SELECT count(*)::INT INTO v_removed_members
  FROM public.members m
  WHERE m.jamiya_id = p_jamiya_id AND m.user_id <> v_keep;

  UPDATE public.jamiyas
  SET created_by = v_keep, updated_at = NOW()
  WHERE id = p_jamiya_id AND created_by IS DISTINCT FROM v_keep;

  DELETE FROM public.circle_votes
  WHERE election_id IN (
    SELECT id FROM public.circle_elections WHERE jamiya_id = p_jamiya_id
  );
  DELETE FROM public.circle_election_candidates
  WHERE election_id IN (
    SELECT id FROM public.circle_elections WHERE jamiya_id = p_jamiya_id
  );
  DELETE FROM public.circle_elections WHERE jamiya_id = p_jamiya_id;

  DELETE FROM public.member_loan_events WHERE jamiya_id = p_jamiya_id;
  DELETE FROM public.member_loan_facilities WHERE jamiya_id = p_jamiya_id;
  DELETE FROM public.circle_dividend_allocations WHERE jamiya_id = p_jamiya_id;
  DELETE FROM public.circle_dividends WHERE jamiya_id = p_jamiya_id;
  DELETE FROM public.circle_share_lots WHERE jamiya_id = p_jamiya_id;
  DELETE FROM public.book_entries WHERE jamiya_id = p_jamiya_id;
  DELETE FROM public.penalties WHERE jamiya_id = p_jamiya_id;
  DELETE FROM public.contributions WHERE jamiya_id = p_jamiya_id;
  DELETE FROM public.payouts WHERE jamiya_id = p_jamiya_id;
  DELETE FROM public.circle_contribution_invoices WHERE jamiya_id = p_jamiya_id;
  DELETE FROM public.savings_goal_contributions WHERE jamiya_id = p_jamiya_id;
  DELETE FROM public.savings_goals WHERE jamiya_id = p_jamiya_id;
  DELETE FROM public.savings_pockets WHERE jamiya_id = p_jamiya_id;
  DELETE FROM public.member_next_of_kin WHERE jamiya_id = p_jamiya_id;
  DELETE FROM public.qard_loans WHERE jamiya_id = p_jamiya_id;
  DELETE FROM public.qard_guarantees WHERE jamiya_id = p_jamiya_id;
  DELETE FROM public.disputes WHERE jamiya_id = p_jamiya_id;
  DELETE FROM public.collection_cases WHERE jamiya_id = p_jamiya_id;
  DELETE FROM public.member_vouches WHERE jamiya_id = p_jamiya_id;
  DELETE FROM public.announcements WHERE jamiya_id = p_jamiya_id;
  DELETE FROM public.circle_messages WHERE jamiya_id = p_jamiya_id;
  DELETE FROM public.circle_meetings WHERE jamiya_id = p_jamiya_id;
  DELETE FROM public.circle_bank_alerts WHERE jamiya_id = p_jamiya_id;
  DELETE FROM public.circle_investments WHERE jamiya_id = p_jamiya_id;
  DELETE FROM public.dual_approval_requests WHERE jamiya_id = p_jamiya_id;
  DELETE FROM public.circle_subscriptions WHERE jamiya_id = p_jamiya_id;
  DELETE FROM public.jamiya_kyc_documents WHERE jamiya_id = p_jamiya_id;
  DELETE FROM public.welfare_claims WHERE jamiya_id = p_jamiya_id;
  DELETE FROM public.welfare_funds WHERE jamiya_id = p_jamiya_id;
  DELETE FROM public.grace_period_requests WHERE jamiya_id = p_jamiya_id;
  DELETE FROM public.tawarruq_applications WHERE jamiya_id = p_jamiya_id;
  DELETE FROM public.circle_bank_accounts WHERE jamiya_id = p_jamiya_id;
  DELETE FROM public.fine_categories WHERE jamiya_id = p_jamiya_id;
  DELETE FROM public.circle_ledger_categories WHERE jamiya_id = p_jamiya_id;
  DELETE FROM public.audit_logs WHERE jamiya_id = p_jamiya_id;
  DELETE FROM public.invitations WHERE jamiya_id = p_jamiya_id;
  DELETE FROM public.members WHERE jamiya_id = p_jamiya_id;

  INSERT INTO public.members (jamiya_id, user_id, role, status, member_code, joined_at)
  VALUES (p_jamiya_id, v_keep, 'circle_admin', 'active', v_member_code, NOW());

  INSERT INTO public.audit_logs (actor_id, action, entity_type, entity_id, jamiya_id, metadata)
  VALUES (
    v_uid,
    'platform_reset_circle_data',
    'jamiya',
    p_jamiya_id,
    p_jamiya_id,
    jsonb_build_object(
      'slug', v_slug,
      'keep_user_id', v_keep,
      'removed_members', v_removed_members
    )
  );

  RETURN jsonb_build_object(
    'ok', true,
    'slug', v_slug,
    'keep_user_id', v_keep,
    'removed_members', v_removed_members
  );
END;
$$;

REVOKE ALL ON FUNCTION public.platform_admin_reset_circle_data(UUID, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.platform_admin_reset_circle_data(UUID, UUID) TO authenticated;
