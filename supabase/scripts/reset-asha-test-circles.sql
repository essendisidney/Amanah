-- One-off reset: Asha's test circles (run in Supabase SQL editor as postgres)
-- Circles: table-banking-slot-3, sisters-circle, ahlul-mwinzi
-- Keeps Asha Rashid (+254721437888) as sole admin on each circle.

BEGIN;

CREATE TEMP TABLE _reset_jamiyas ON COMMIT DROP AS
SELECT id, slug FROM jamiyas
WHERE slug IN ('table-banking-slot-3', 'sisters-circle', 'ahlul-mwinzi');

CREATE TEMP TABLE _reset_test_users ON COMMIT DROP AS
SELECT DISTINCT m.user_id
FROM members m
WHERE m.jamiya_id IN (SELECT id FROM _reset_jamiyas)
  AND m.user_id <> 'a8fbe02c-3c2b-4618-b037-2fd5e8d39878'::uuid;

-- Reassign circle ownership before deleting test auth users
UPDATE jamiyas
SET created_by = 'a8fbe02c-3c2b-4618-b037-2fd5e8d39878'::uuid
WHERE id IN (SELECT id FROM _reset_jamiyas)
  AND created_by IN (SELECT user_id FROM _reset_test_users);

DELETE FROM circle_votes
WHERE election_id IN (
  SELECT id FROM circle_elections WHERE jamiya_id IN (SELECT id FROM _reset_jamiyas)
);

DELETE FROM circle_election_candidates
WHERE election_id IN (
  SELECT id FROM circle_elections WHERE jamiya_id IN (SELECT id FROM _reset_jamiyas)
);

DELETE FROM circle_elections WHERE jamiya_id IN (SELECT id FROM _reset_jamiyas);

DELETE FROM member_loan_events WHERE jamiya_id IN (SELECT id FROM _reset_jamiyas);
DELETE FROM member_loan_facilities WHERE jamiya_id IN (SELECT id FROM _reset_jamiyas);
DELETE FROM circle_dividend_allocations WHERE jamiya_id IN (SELECT id FROM _reset_jamiyas);
DELETE FROM circle_dividends WHERE jamiya_id IN (SELECT id FROM _reset_jamiyas);
DELETE FROM circle_share_lots WHERE jamiya_id IN (SELECT id FROM _reset_jamiyas);
DELETE FROM book_entries WHERE jamiya_id IN (SELECT id FROM _reset_jamiyas);
DELETE FROM penalties WHERE jamiya_id IN (SELECT id FROM _reset_jamiyas);
DELETE FROM contributions WHERE jamiya_id IN (SELECT id FROM _reset_jamiyas);
DELETE FROM payouts WHERE jamiya_id IN (SELECT id FROM _reset_jamiyas);
DELETE FROM circle_contribution_invoices WHERE jamiya_id IN (SELECT id FROM _reset_jamiyas);
DELETE FROM savings_goal_contributions WHERE jamiya_id IN (SELECT id FROM _reset_jamiyas);
DELETE FROM savings_goals WHERE jamiya_id IN (SELECT id FROM _reset_jamiyas);
DELETE FROM savings_pockets WHERE jamiya_id IN (SELECT id FROM _reset_jamiyas);
DELETE FROM member_next_of_kin WHERE jamiya_id IN (SELECT id FROM _reset_jamiyas);
DELETE FROM qard_loans WHERE jamiya_id IN (SELECT id FROM _reset_jamiyas);
DELETE FROM qard_guarantees WHERE jamiya_id IN (SELECT id FROM _reset_jamiyas);
DELETE FROM disputes WHERE jamiya_id IN (SELECT id FROM _reset_jamiyas);
DELETE FROM collection_cases WHERE jamiya_id IN (SELECT id FROM _reset_jamiyas);
DELETE FROM member_vouches WHERE jamiya_id IN (SELECT id FROM _reset_jamiyas);
DELETE FROM announcements WHERE jamiya_id IN (SELECT id FROM _reset_jamiyas);
DELETE FROM circle_messages WHERE jamiya_id IN (SELECT id FROM _reset_jamiyas);
DELETE FROM circle_meetings WHERE jamiya_id IN (SELECT id FROM _reset_jamiyas);
DELETE FROM circle_bank_alerts WHERE jamiya_id IN (SELECT id FROM _reset_jamiyas);
DELETE FROM circle_investments WHERE jamiya_id IN (SELECT id FROM _reset_jamiyas);
DELETE FROM dual_approval_requests WHERE jamiya_id IN (SELECT id FROM _reset_jamiyas);
DELETE FROM circle_subscriptions WHERE jamiya_id IN (SELECT id FROM _reset_jamiyas);
DELETE FROM jamiya_kyc_documents WHERE jamiya_id IN (SELECT id FROM _reset_jamiyas);
DELETE FROM welfare_claims WHERE jamiya_id IN (SELECT id FROM _reset_jamiyas);
DELETE FROM welfare_funds WHERE jamiya_id IN (SELECT id FROM _reset_jamiyas);
DELETE FROM grace_period_requests WHERE jamiya_id IN (SELECT id FROM _reset_jamiyas);
DELETE FROM tawarruq_applications WHERE jamiya_id IN (SELECT id FROM _reset_jamiyas);
DELETE FROM circle_bank_accounts WHERE jamiya_id IN (SELECT id FROM _reset_jamiyas);
DELETE FROM fine_categories WHERE jamiya_id IN (SELECT id FROM _reset_jamiyas);
DELETE FROM circle_ledger_categories WHERE jamiya_id IN (SELECT id FROM _reset_jamiyas);
DELETE FROM audit_logs WHERE jamiya_id IN (SELECT id FROM _reset_jamiyas);
DELETE FROM invitations WHERE jamiya_id IN (SELECT id FROM _reset_jamiyas);
DELETE FROM members WHERE jamiya_id IN (SELECT id FROM _reset_jamiyas);

INSERT INTO members (jamiya_id, user_id, role, status, member_code, joined_at)
SELECT j.id,
  'a8fbe02c-3c2b-4618-b037-2fd5e8d39878'::uuid,
  'circle_admin',
  'active',
  CASE j.slug
    WHEN 'table-banking-slot-3' THEN 'TABLE001'
    WHEN 'sisters-circle' THEN 'SISTE001'
    WHEN 'ahlul-mwinzi' THEN 'AHLUL001'
  END,
  NOW()
FROM _reset_jamiyas j;

DELETE FROM auth.users WHERE id IN (SELECT user_id FROM _reset_test_users);

COMMIT;

-- Verify
SELECT j.slug,
  (SELECT count(*) FROM members m WHERE m.jamiya_id = j.id) AS members,
  (SELECT count(*) FROM invitations i WHERE i.jamiya_id = j.id) AS invitations,
  (SELECT count(*) FROM book_entries b WHERE b.jamiya_id = j.id) AS book_entries
FROM jamiyas j
WHERE j.slug IN ('table-banking-slot-3', 'sisters-circle', 'ahlul-mwinzi')
ORDER BY j.slug;
