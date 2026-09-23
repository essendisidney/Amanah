-- Cleanup after invite E2E: remove test circle + accidental Family savings seat.

-- 1) Undo accidental steal: phone-Sidney joined Family savings via Yusuf's invite.
DELETE FROM public.members
WHERE id = 'd9216b2a-8de6-4115-b19d-294ce85e5b40';

-- 2) Wipe and delete E2E Test Circle Sidney.
DO $$
DECLARE
  v_id UUID;
BEGIN
  SELECT id INTO v_id FROM public.jamiyas WHERE slug = 'e2e-test-circle-sidney';
  IF v_id IS NULL THEN
    RETURN;
  END IF;

  DELETE FROM public.circle_votes
  WHERE election_id IN (SELECT id FROM public.circle_elections WHERE jamiya_id = v_id);
  DELETE FROM public.circle_election_candidates
  WHERE election_id IN (SELECT id FROM public.circle_elections WHERE jamiya_id = v_id);
  DELETE FROM public.circle_elections WHERE jamiya_id = v_id;

  DELETE FROM public.member_loan_events WHERE jamiya_id = v_id;
  DELETE FROM public.member_loan_facilities WHERE jamiya_id = v_id;
  DELETE FROM public.circle_dividend_allocations WHERE jamiya_id = v_id;
  DELETE FROM public.circle_dividends WHERE jamiya_id = v_id;
  DELETE FROM public.circle_share_lots WHERE jamiya_id = v_id;
  DELETE FROM public.book_entries WHERE jamiya_id = v_id;
  DELETE FROM public.penalties WHERE jamiya_id = v_id;
  DELETE FROM public.contributions WHERE jamiya_id = v_id;
  DELETE FROM public.payouts WHERE jamiya_id = v_id;
  DELETE FROM public.circle_contribution_invoices WHERE jamiya_id = v_id;
  DELETE FROM public.savings_goal_contributions WHERE jamiya_id = v_id;
  DELETE FROM public.savings_goals WHERE jamiya_id = v_id;
  DELETE FROM public.savings_pockets WHERE jamiya_id = v_id;
  DELETE FROM public.member_next_of_kin WHERE jamiya_id = v_id;
  DELETE FROM public.qard_loans WHERE jamiya_id = v_id;
  DELETE FROM public.qard_guarantees WHERE jamiya_id = v_id;
  DELETE FROM public.disputes WHERE jamiya_id = v_id;
  DELETE FROM public.collection_cases WHERE jamiya_id = v_id;
  DELETE FROM public.member_vouches WHERE jamiya_id = v_id;
  DELETE FROM public.announcements WHERE jamiya_id = v_id;
  DELETE FROM public.circle_messages WHERE jamiya_id = v_id;
  DELETE FROM public.circle_meetings WHERE jamiya_id = v_id;
  DELETE FROM public.circle_bank_alerts WHERE jamiya_id = v_id;
  DELETE FROM public.circle_investments WHERE jamiya_id = v_id;
  DELETE FROM public.dual_approval_requests WHERE jamiya_id = v_id;
  DELETE FROM public.circle_subscriptions WHERE jamiya_id = v_id;
  DELETE FROM public.jamiya_kyc_documents WHERE jamiya_id = v_id;
  DELETE FROM public.welfare_claims WHERE jamiya_id = v_id;
  DELETE FROM public.welfare_funds WHERE jamiya_id = v_id;
  DELETE FROM public.grace_period_requests WHERE jamiya_id = v_id;
  DELETE FROM public.tawarruq_applications WHERE jamiya_id = v_id;
  DELETE FROM public.circle_bank_accounts WHERE jamiya_id = v_id;
  DELETE FROM public.fine_categories WHERE jamiya_id = v_id;
  DELETE FROM public.circle_ledger_categories WHERE jamiya_id = v_id;
  DELETE FROM public.audit_logs WHERE jamiya_id = v_id;
  DELETE FROM public.invitations WHERE jamiya_id = v_id;
  DELETE FROM public.notifications WHERE (data->>'jamiya_id') = v_id::text;
  DELETE FROM public.members WHERE jamiya_id = v_id;
  DELETE FROM public.jamiyas WHERE id = v_id;
END $$;
