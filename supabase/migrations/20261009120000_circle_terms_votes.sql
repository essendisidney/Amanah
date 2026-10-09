-- Members vote on raised fees and penalties; payout deductions and pocket deposits need consent.
--
-- 1. Raising a fee or penalty (or switching on auto-fines, early-slot pricing or deducting from
--    payouts) now needs a members' vote. An officer proposes the change; members who were active
--    when it was proposed vote yes or no within 7 days. It passes with a quorum of half the
--    members and more yes than no votes, and takes effect 7 days after it passes. Members keep
--    the terms they accepted until they accept the new ones (step 1), so anyone who voted no can
--    stay on the old terms. Lowering a fee needs no vote, and neither does a circle where no
--    other member has accepted terms yet. Through the API, the database refuses any other
--    increase that does not come from a passed proposal.
-- 2. Dues and penalties are taken from a payout ('deduct' mode) only for members whose accepted
--    terms include it; for others the payout waits, as in 'block' mode.
-- 3. Only the member can move money from their wallet into a savings pocket.

-- ---------------------------------------------------------------------------
-- Which money terms a change raises
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION private.terms_increases(p_old public.jamiyas, p_new public.jamiyas)
RETURNS TEXT[]
LANGUAGE plpgsql
STABLE
SET search_path TO ''
AS $$
DECLARE
  v_o JSONB := private.circle_terms(p_old);
  v_n JSONB := private.circle_terms(p_new);
  v_key TEXT;
  v_out TEXT[] := ARRAY[]::TEXT[];
BEGIN
  FOREACH v_key IN ARRAY ARRAY['join_fee_amount', 'transaction_fee_amount', 'early_slot_fee_pct',
                               'late_contribution_penalty', 'missed_contribution_penalty',
                               'late_loan_penalty_fixed', 'late_loan_penalty_pct'] LOOP
    IF coalesce((v_n->>v_key)::numeric, 0) > coalesce((v_o->>v_key)::numeric, 0) THEN
      v_out := v_out || v_key;
    END IF;
  END LOOP;
  IF (v_n->>'auto_fine_enabled')::boolean AND NOT (v_o->>'auto_fine_enabled')::boolean THEN
    v_out := v_out || 'auto_fine_enabled'::text;
  END IF;
  IF v_n->>'payout_compliance_mode' = 'deduct'
     AND v_o->>'payout_compliance_mode' IS DISTINCT FROM 'deduct' THEN
    v_out := v_out || 'payout_compliance_mode'::text;
  END IF;
  RETURN v_out;
END;
$$;

-- The circle row with a proposal's changes applied (validates every key and value).
CREATE OR REPLACE FUNCTION private.with_terms_changes(p_j public.jamiyas, p_changes JSONB)
RETURNS public.jamiyas
LANGUAGE plpgsql
STABLE
SET search_path TO ''
AS $$
DECLARE
  v_j public.jamiyas := p_j;
  v_key TEXT;
BEGIN
  IF p_changes IS NULL OR jsonb_typeof(p_changes) <> 'object' THEN
    RAISE EXCEPTION 'INVALID_CHANGE';
  END IF;
  FOR v_key IN SELECT jsonb_object_keys(p_changes) LOOP
    IF v_key NOT IN ('join_fee_amount', 'transaction_fee_amount', 'slot_pricing_enabled',
                     'early_slot_fee_pct', 'late_contribution_penalty',
                     'missed_contribution_penalty', 'late_loan_penalty_fixed',
                     'late_loan_penalty_pct', 'auto_fine_enabled', 'payout_compliance_mode') THEN
      RAISE EXCEPTION 'INVALID_CHANGE' USING DETAIL = v_key;
    END IF;
  END LOOP;

  BEGIN
    v_j.join_fee_amount := coalesce((p_changes->>'join_fee_amount')::numeric, v_j.join_fee_amount);
    v_j.transaction_fee_amount := coalesce((p_changes->>'transaction_fee_amount')::numeric, v_j.transaction_fee_amount);
    v_j.slot_pricing_enabled := coalesce((p_changes->>'slot_pricing_enabled')::boolean, v_j.slot_pricing_enabled);
    v_j.early_slot_fee_pct := coalesce((p_changes->>'early_slot_fee_pct')::numeric, v_j.early_slot_fee_pct);
    v_j.late_contribution_penalty := coalesce((p_changes->>'late_contribution_penalty')::numeric, v_j.late_contribution_penalty);
    v_j.missed_contribution_penalty := coalesce((p_changes->>'missed_contribution_penalty')::numeric, v_j.missed_contribution_penalty);
    v_j.late_loan_penalty_fixed := coalesce((p_changes->>'late_loan_penalty_fixed')::numeric, v_j.late_loan_penalty_fixed);
    v_j.late_loan_penalty_pct := coalesce((p_changes->>'late_loan_penalty_pct')::numeric, v_j.late_loan_penalty_pct);
    v_j.auto_fine_enabled := coalesce((p_changes->>'auto_fine_enabled')::boolean, v_j.auto_fine_enabled);
    v_j.payout_compliance_mode := coalesce(p_changes->>'payout_compliance_mode', v_j.payout_compliance_mode);
  EXCEPTION WHEN invalid_text_representation OR numeric_value_out_of_range THEN
    RAISE EXCEPTION 'INVALID_CHANGE';
  END;

  IF least(coalesce(v_j.join_fee_amount, 0), coalesce(v_j.transaction_fee_amount, 0),
           coalesce(v_j.early_slot_fee_pct, 0), coalesce(v_j.late_contribution_penalty, 0),
           coalesce(v_j.missed_contribution_penalty, 0), coalesce(v_j.late_loan_penalty_fixed, 0),
           coalesce(v_j.late_loan_penalty_pct, 0)) < 0
     OR coalesce(v_j.early_slot_fee_pct, 0) > 100
     OR coalesce(v_j.late_loan_penalty_pct, 0) > 100
     OR v_j.payout_compliance_mode NOT IN ('block', 'approve', 'deduct', 'allow') THEN
    RAISE EXCEPTION 'INVALID_CHANGE';
  END IF;
  RETURN v_j;
END;
$$;

-- A vote protects members who accepted the circle's terms. With nobody else having accepted
-- them (a circle still being set up), there is no one to ask: anyone who joins later accepts
-- the terms as they then are.
CREATE OR REPLACE FUNCTION private.circle_terms_have_other_members(p_jamiya_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.member_consents c
    JOIN public.members m ON m.jamiya_id = c.jamiya_id AND m.user_id = c.user_id
    WHERE c.jamiya_id = p_jamiya_id AND c.kind = 'circle_terms'
      AND m.status = 'active'
      AND c.user_id IS DISTINCT FROM auth.uid()
  );
$$;

-- Through the API (members, officers), raising a money term needs a passed proposal.
CREATE OR REPLACE FUNCTION private.trg_circle_terms_increase_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
BEGIN
  IF coalesce(auth.role(), '') = 'authenticated'
     AND current_setting('jamiya.applying_terms_proposal', true) IS DISTINCT FROM NEW.id::text
     AND cardinality(private.terms_increases(OLD, NEW)) > 0
     AND private.circle_terms_have_other_members(NEW.id) THEN
    RAISE EXCEPTION 'TERMS_INCREASE_NEEDS_VOTE'
      USING HINT = 'Propose the change (propose_circle_terms_change) and let members vote.';
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE TRIGGER circle_terms_increase_guard
BEFORE UPDATE ON public.jamiyas
FOR EACH ROW
EXECUTE FUNCTION private.trg_circle_terms_increase_guard();

-- ---------------------------------------------------------------------------
-- Proposals and votes
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.circle_terms_proposals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  jamiya_id UUID NOT NULL REFERENCES public.jamiyas(id) ON DELETE CASCADE,
  proposed_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  changes JSONB NOT NULL,
  terms_before JSONB NOT NULL,
  terms_after JSONB NOT NULL,
  reason TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open'
    CHECK (status IN ('open', 'passed', 'rejected', 'applied', 'cancelled')),
  eligible_voters INT NOT NULL,
  quorum_pct INT NOT NULL DEFAULT 50,
  yes_votes INT NOT NULL DEFAULT 0,
  no_votes INT NOT NULL DEFAULT 0,
  voting_closes_at TIMESTAMPTZ NOT NULL,
  decided_at TIMESTAMPTZ,
  effective_at TIMESTAMPTZ,
  applied_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- One live proposal per circle at a time.
CREATE UNIQUE INDEX IF NOT EXISTS circle_terms_proposals_one_live
  ON public.circle_terms_proposals (jamiya_id) WHERE status IN ('open', 'passed');

CREATE TABLE IF NOT EXISTS public.circle_terms_votes (
  proposal_id UUID NOT NULL REFERENCES public.circle_terms_proposals(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  vote BOOLEAN NOT NULL,
  voted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (proposal_id, user_id)
);

ALTER TABLE public.circle_terms_proposals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.circle_terms_votes ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.circle_terms_proposals, public.circle_terms_votes FROM anon;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.circle_terms_proposals, public.circle_terms_votes FROM authenticated;

CREATE POLICY circle_terms_proposals_select ON public.circle_terms_proposals
  FOR SELECT TO authenticated
  USING (
    private.is_active_jamiya_member(jamiya_id)
    OR private.is_circle_officer(jamiya_id)
    OR private.is_platform_admin()
  );

-- Ballots are private: a member sees only their own vote; tallies are on the proposal.
CREATE POLICY circle_terms_votes_select_own ON public.circle_terms_votes
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR private.is_platform_admin());

-- Members who may vote on a proposal: active members who had joined when it was made.
CREATE OR REPLACE FUNCTION private.terms_proposal_voters(p_proposal public.circle_terms_proposals)
RETURNS SETOF UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO ''
AS $$
  SELECT m.user_id
  FROM public.members m
  WHERE m.jamiya_id = p_proposal.jamiya_id
    AND m.status = 'active'
    AND m.user_id IS NOT NULL
    AND (m.joined_at IS NULL OR m.joined_at <= p_proposal.created_at);
$$;

CREATE OR REPLACE FUNCTION private.notify_circle_members(
  p_jamiya_id UUID, p_title TEXT, p_body TEXT, p_data JSONB
)
RETURNS VOID
LANGUAGE sql
SECURITY DEFINER
SET search_path TO ''
AS $$
  INSERT INTO public.notifications (user_id, type, channel, title, body, data)
  SELECT m.user_id, 'system', 'in_app', p_title, p_body, p_data
  FROM public.members m
  WHERE m.jamiya_id = p_jamiya_id AND m.status = 'active' AND m.user_id IS NOT NULL;
$$;

-- Decide a proposal once the outcome is certain, or when voting has closed.
CREATE OR REPLACE FUNCTION private.decide_terms_proposal(p_proposal_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  v_p public.circle_terms_proposals%ROWTYPE;
  v_quorum INT;
  v_cast INT;
  v_left INT;
  v_status TEXT;
  v_name TEXT;
BEGIN
  SELECT * INTO v_p FROM public.circle_terms_proposals WHERE id = p_proposal_id FOR UPDATE;
  IF NOT FOUND OR v_p.status <> 'open' THEN
    RETURN v_p.status;
  END IF;

  v_quorum := ceil(v_p.eligible_voters * v_p.quorum_pct / 100.0);
  v_cast := v_p.yes_votes + v_p.no_votes;
  v_left := greatest(v_p.eligible_voters - v_cast, 0);

  IF v_cast >= v_quorum AND v_p.yes_votes > v_p.no_votes + v_left THEN
    v_status := 'passed';                    -- the remaining votes cannot change it
  ELSIF v_p.yes_votes + v_left <= v_p.no_votes
        OR (NOW() >= v_p.voting_closes_at AND (v_cast < v_quorum OR v_p.yes_votes <= v_p.no_votes)) THEN
    v_status := 'rejected';
  ELSIF NOW() >= v_p.voting_closes_at THEN
    v_status := 'passed';
  ELSE
    RETURN 'open';
  END IF;

  UPDATE public.circle_terms_proposals
  SET status = v_status,
      decided_at = NOW(),
      effective_at = CASE WHEN v_status = 'passed' THEN NOW() + INTERVAL '7 days' END
  WHERE id = v_p.id;

  SELECT name INTO v_name FROM public.jamiyas WHERE id = v_p.jamiya_id;
  PERFORM private.notify_circle_members(
    v_p.jamiya_id,
    CASE WHEN v_status = 'passed' THEN 'Fee change approved' ELSE 'Fee change not approved' END,
    CASE WHEN v_status = 'passed'
      THEN 'Members of ' || v_name || ' approved the proposed fee change (' || v_p.yes_votes || ' yes, '
           || v_p.no_votes || ' no). It takes effect on ' || to_char(NOW() + INTERVAL '7 days', 'DD Mon YYYY')
           || '. You keep your current terms until you accept the new ones.'
      ELSE 'The proposed fee change for ' || v_name || ' was not approved (' || v_p.yes_votes || ' yes, '
           || v_p.no_votes || ' no). Nothing changes.'
    END,
    jsonb_build_object('kind', 'circle_terms_vote_result', 'jamiya_id', v_p.jamiya_id,
                       'proposal_id', v_p.id, 'status', v_status)
  );
  INSERT INTO public.audit_logs (actor_id, action, entity_type, entity_id, jamiya_id, metadata)
  VALUES (auth.uid(), 'update', 'circle_terms_proposal', v_p.id, v_p.jamiya_id,
          jsonb_build_object('event', 'circle.terms_vote_' || v_status,
                             'yes', v_p.yes_votes, 'no', v_p.no_votes, 'eligible', v_p.eligible_voters));
  RETURN v_status;
END;
$$;

-- Apply a passed proposal whose notice period is over.
CREATE OR REPLACE FUNCTION private.apply_terms_proposal(p_proposal_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  v_p public.circle_terms_proposals%ROWTYPE;
  v_j public.jamiyas%ROWTYPE;
  v_new public.jamiyas%ROWTYPE;
BEGIN
  SELECT * INTO v_p FROM public.circle_terms_proposals WHERE id = p_proposal_id FOR UPDATE;
  IF NOT FOUND OR v_p.status <> 'passed' OR v_p.effective_at > NOW() THEN
    RETURN false;
  END IF;

  SELECT * INTO v_j FROM public.jamiyas WHERE id = v_p.jamiya_id FOR UPDATE;
  v_new := private.with_terms_changes(v_j, v_p.changes);

  PERFORM set_config('jamiya.applying_terms_proposal', v_j.id::text, true);
  UPDATE public.jamiyas
  SET join_fee_amount = v_new.join_fee_amount,
      transaction_fee_amount = v_new.transaction_fee_amount,
      slot_pricing_enabled = v_new.slot_pricing_enabled,
      early_slot_fee_pct = v_new.early_slot_fee_pct,
      late_contribution_penalty = v_new.late_contribution_penalty,
      missed_contribution_penalty = v_new.missed_contribution_penalty,
      late_loan_penalty_fixed = v_new.late_loan_penalty_fixed,
      late_loan_penalty_pct = v_new.late_loan_penalty_pct,
      auto_fine_enabled = v_new.auto_fine_enabled,
      payout_compliance_mode = v_new.payout_compliance_mode,
      updated_at = NOW()
  WHERE id = v_j.id;
  PERFORM set_config('jamiya.applying_terms_proposal', '', true);

  UPDATE public.circle_terms_proposals SET status = 'applied', applied_at = NOW() WHERE id = v_p.id;

  PERFORM private.notify_circle_members(
    v_j.id,
    'New circle fees in effect',
    'The fee change members approved for ' || v_j.name || ' is now in effect. Open the circle to '
      || 'review and accept it; until you do, you keep paying the fees you accepted before.',
    jsonb_build_object('kind', 'circle_terms_applied', 'jamiya_id', v_j.id, 'proposal_id', v_p.id)
  );
  RETURN true;
END;
$$;

CREATE OR REPLACE FUNCTION public.propose_circle_terms_change(
  p_jamiya_id UUID,
  p_changes JSONB,
  p_reason TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_j public.jamiyas%ROWTYPE;
  v_new public.jamiyas%ROWTYPE;
  v_reason TEXT := nullif(btrim(coalesce(p_reason, '')), '');
  v_id UUID;
  v_p public.circle_terms_proposals%ROWTYPE;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'UNAUTHENTICATED');
  END IF;
  IF NOT private.is_circle_officer(p_jamiya_id) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'FORBIDDEN');
  END IF;
  IF v_reason IS NULL OR char_length(v_reason) < 5 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'REASON_REQUIRED');
  END IF;

  SELECT * INTO v_j FROM public.jamiyas WHERE id = p_jamiya_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'NOT_FOUND');
  END IF;

  BEGIN
    v_new := private.with_terms_changes(v_j, p_changes);
  EXCEPTION WHEN raise_exception THEN
    RETURN jsonb_build_object('ok', false, 'error', 'INVALID_CHANGE');
  END;
  IF cardinality(private.terms_increases(v_j, v_new)) = 0
     OR NOT private.circle_terms_have_other_members(p_jamiya_id) THEN
    -- Nothing goes up, or no other member has accepted terms yet: officers change it directly.
    RETURN jsonb_build_object('ok', false, 'error', 'NO_VOTE_NEEDED');
  END IF;
  IF EXISTS (SELECT 1 FROM public.circle_terms_proposals
             WHERE jamiya_id = p_jamiya_id AND status IN ('open', 'passed')) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'PROPOSAL_IN_PROGRESS');
  END IF;

  INSERT INTO public.circle_terms_proposals (
    jamiya_id, proposed_by, changes, terms_before, terms_after, reason,
    eligible_voters, voting_closes_at
  ) VALUES (
    p_jamiya_id, v_uid, p_changes, private.circle_terms(v_j), private.circle_terms(v_new),
    left(v_reason, 1000), 0, NOW() + INTERVAL '7 days'
  )
  RETURNING * INTO v_p;

  UPDATE public.circle_terms_proposals
  SET eligible_voters = (SELECT count(*) FROM private.terms_proposal_voters(v_p))
  WHERE id = v_p.id;

  PERFORM private.notify_circle_members(
    p_jamiya_id,
    'Vote on a fee change',
    'Officers of ' || v_j.name || ' propose a change to the circle''s fees or penalties. '
      || 'Open the circle to see it and vote by ' || to_char(v_p.voting_closes_at, 'DD Mon YYYY') || '.',
    jsonb_build_object('kind', 'circle_terms_vote', 'jamiya_id', p_jamiya_id, 'proposal_id', v_p.id,
                       'slug', v_j.slug)
  );
  INSERT INTO public.audit_logs (actor_id, action, entity_type, entity_id, jamiya_id, metadata)
  VALUES (v_uid, 'create', 'circle_terms_proposal', v_p.id, p_jamiya_id,
          jsonb_build_object('event', 'circle.terms_proposed', 'changes', p_changes,
                             'increases', to_jsonb(private.terms_increases(v_j, v_new))));

  RETURN jsonb_build_object('ok', true, 'proposal_id', v_p.id, 'voting_closes_at', v_p.voting_closes_at);
END;
$$;

CREATE OR REPLACE FUNCTION public.cast_circle_terms_vote(p_proposal_id UUID, p_yes BOOLEAN)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_p public.circle_terms_proposals%ROWTYPE;
  v_status TEXT;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'UNAUTHENTICATED');
  END IF;
  IF p_yes IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'INVALID_VOTE');
  END IF;
  SELECT * INTO v_p FROM public.circle_terms_proposals WHERE id = p_proposal_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'NOT_FOUND');
  END IF;
  IF v_p.status <> 'open' OR NOW() >= v_p.voting_closes_at THEN
    PERFORM private.decide_terms_proposal(v_p.id);
    RETURN jsonb_build_object('ok', false, 'error', 'VOTING_CLOSED');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM private.terms_proposal_voters(v_p) u WHERE u = v_uid) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'NOT_ELIGIBLE');
  END IF;

  INSERT INTO public.circle_terms_votes (proposal_id, user_id, vote)
  VALUES (v_p.id, v_uid, p_yes)
  ON CONFLICT (proposal_id, user_id) DO UPDATE SET vote = EXCLUDED.vote, voted_at = NOW();

  UPDATE public.circle_terms_proposals
  SET yes_votes = (SELECT count(*) FROM public.circle_terms_votes WHERE proposal_id = v_p.id AND vote),
      no_votes = (SELECT count(*) FROM public.circle_terms_votes WHERE proposal_id = v_p.id AND NOT vote)
  WHERE id = v_p.id;

  v_status := private.decide_terms_proposal(v_p.id);
  RETURN jsonb_build_object('ok', true, 'status', v_status);
END;
$$;

CREATE OR REPLACE FUNCTION public.cancel_circle_terms_proposal(p_proposal_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  v_p public.circle_terms_proposals%ROWTYPE;
BEGIN
  SELECT * INTO v_p FROM public.circle_terms_proposals WHERE id = p_proposal_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'NOT_FOUND');
  END IF;
  IF NOT private.is_circle_officer(v_p.jamiya_id) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'FORBIDDEN');
  END IF;
  IF v_p.status NOT IN ('open', 'passed') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'NOT_CANCELLABLE');
  END IF;
  UPDATE public.circle_terms_proposals SET status = 'cancelled', decided_at = NOW() WHERE id = v_p.id;
  INSERT INTO public.audit_logs (actor_id, action, entity_type, entity_id, jamiya_id, metadata)
  VALUES (auth.uid(), 'update', 'circle_terms_proposal', v_p.id, v_p.jamiya_id,
          jsonb_build_object('event', 'circle.terms_proposal_cancelled'));
  RETURN jsonb_build_object('ok', true);
END;
$$;

-- Close voting that has run out and apply changes whose notice period is over, for one circle.
CREATE OR REPLACE FUNCTION public.refresh_circle_terms_proposals(p_jamiya_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  v_id UUID;
  v_applied INT := 0;
BEGIN
  IF coalesce(auth.role(), '') <> 'service_role'
     AND NOT private.is_active_jamiya_member(p_jamiya_id)
     AND NOT private.is_circle_officer(p_jamiya_id)
     AND NOT private.is_platform_admin() THEN
    RETURN jsonb_build_object('ok', false, 'error', 'FORBIDDEN');
  END IF;
  FOR v_id IN SELECT id FROM public.circle_terms_proposals
              WHERE jamiya_id = p_jamiya_id AND status = 'open' AND voting_closes_at <= NOW() LOOP
    PERFORM private.decide_terms_proposal(v_id);
  END LOOP;
  FOR v_id IN SELECT id FROM public.circle_terms_proposals
              WHERE jamiya_id = p_jamiya_id AND status = 'passed' AND effective_at <= NOW() LOOP
    IF private.apply_terms_proposal(v_id) THEN
      v_applied := v_applied + 1;
    END IF;
  END LOOP;
  RETURN jsonb_build_object('ok', true, 'applied', v_applied);
END;
$$;

-- The same for every circle (scheduled job, service role).
CREATE OR REPLACE FUNCTION public.process_circle_terms_proposals()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  v_id UUID;
  v_decided INT := 0;
  v_applied INT := 0;
BEGIN
  IF coalesce(auth.role(), '') <> 'service_role' AND NOT private.is_platform_admin() THEN
    RETURN jsonb_build_object('ok', false, 'error', 'FORBIDDEN');
  END IF;
  FOR v_id IN SELECT id FROM public.circle_terms_proposals
              WHERE status = 'open' AND voting_closes_at <= NOW() LOOP
    PERFORM private.decide_terms_proposal(v_id);
    v_decided := v_decided + 1;
  END LOOP;
  FOR v_id IN SELECT id FROM public.circle_terms_proposals
              WHERE status = 'passed' AND effective_at <= NOW() LOOP
    IF private.apply_terms_proposal(v_id) THEN
      v_applied := v_applied + 1;
    END IF;
  END LOOP;
  RETURN jsonb_build_object('ok', true, 'decided', v_decided, 'applied', v_applied);
END;
$$;

-- Recent proposals for a circle, with the caller's own vote.
CREATE OR REPLACE FUNCTION public.get_circle_terms_proposals(p_jamiya_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  v_uid UUID := auth.uid();
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'UNAUTHENTICATED');
  END IF;
  IF NOT private.is_active_jamiya_member(p_jamiya_id)
     AND NOT private.is_circle_officer(p_jamiya_id)
     AND NOT private.is_platform_admin() THEN
    RETURN jsonb_build_object('ok', false, 'error', 'FORBIDDEN');
  END IF;
  RETURN jsonb_build_object('ok', true, 'proposals', coalesce((
    SELECT jsonb_agg(jsonb_build_object(
      'id', p.id,
      'status', p.status,
      'reason', p.reason,
      'changes', p.changes,
      'terms_before', p.terms_before,
      'terms_after', p.terms_after,
      'eligible_voters', p.eligible_voters,
      'quorum', ceil(p.eligible_voters * p.quorum_pct / 100.0)::int,
      'yes_votes', p.yes_votes,
      'no_votes', p.no_votes,
      'voting_closes_at', p.voting_closes_at,
      'decided_at', p.decided_at,
      'effective_at', p.effective_at,
      'applied_at', p.applied_at,
      'created_at', p.created_at,
      'my_vote', (SELECT v.vote FROM public.circle_terms_votes v
                  WHERE v.proposal_id = p.id AND v.user_id = v_uid),
      'can_vote', p.status = 'open' AND p.voting_closes_at > NOW()
                  AND EXISTS (SELECT 1 FROM private.terms_proposal_voters(p) u WHERE u = v_uid)
    ) ORDER BY p.created_at DESC)
    FROM (SELECT * FROM public.circle_terms_proposals
          WHERE jamiya_id = p_jamiya_id ORDER BY created_at DESC LIMIT 5) p
  ), '[]'::jsonb));
END;
$$;

-- ---------------------------------------------------------------------------
-- Payout deductions and pocket deposits need the member's consent
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.settle_payout(p_payout_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_p public.payouts%ROWTYPE;
  v_member public.members%ROWTYPE;
  v_mode TEXT;
  v_unpaid INT;
  v_arrears NUMERIC := 0;
  v_open_penalties NUMERIC := 0;
  v_deduct NUMERIC := 0;
  v_pay NUMERIC;
  v_tx UUID;
  v_kyc TEXT;
  v_open_disputes INT;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'UNAUTHENTICATED');
  END IF;

  SELECT * INTO v_p FROM public.payouts WHERE id = p_payout_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'NOT_FOUND');
  END IF;

  IF NOT (private.is_circle_officer(v_p.jamiya_id) OR private.is_platform_admin()) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'FORBIDDEN');
  END IF;

  IF v_p.status NOT IN ('scheduled', 'processing') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'NOT_SETTLEABLE');
  END IF;

  SELECT COALESCE(payout_compliance_mode, 'block') INTO v_mode
  FROM public.jamiyas WHERE id = v_p.jamiya_id;

  SELECT COUNT(*) INTO v_unpaid
  FROM public.contributions
  WHERE jamiya_id = v_p.jamiya_id
    AND cycle_number = v_p.cycle_number
    AND status NOT IN ('paid', 'waived');

  IF v_unpaid > 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'CYCLE_INCOMPLETE', 'unpaid', v_unpaid);
  END IF;

  SELECT * INTO v_member FROM public.members WHERE id = v_p.member_id;

  -- Taking dues and penalties out of a payout needs the member's consent: only members whose
  -- accepted terms say 'deduct' have them deducted; for everyone else the payout waits.
  IF v_mode = 'deduct' AND coalesce(
       (private.latest_circle_consent(v_member.user_id, v_p.jamiya_id)).terms->>'payout_compliance_mode',
       '') <> 'deduct' THEN
    v_mode := 'block';
  END IF;

  SELECT COALESCE(SUM(GREATEST(amount - COALESCE(amount_paid, 0), 0)), 0) INTO v_arrears
  FROM public.contributions
  WHERE member_id = v_p.member_id
    AND status IN ('pending', 'late', 'partial');

  SELECT COALESCE(SUM(amount), 0) INTO v_open_penalties
  FROM public.penalties
  WHERE member_id = v_p.member_id AND status = 'open';

  IF v_mode = 'block' AND (v_arrears > 0 OR v_open_penalties > 0) THEN
    RETURN jsonb_build_object(
      'ok', false,
      'error', 'MEMBER_NONCOMPLIANT',
      'arrears', v_arrears,
      'penalties', v_open_penalties
    );
  END IF;

  IF v_mode = 'deduct' THEN
    v_deduct := LEAST(v_p.amount, v_arrears + v_open_penalties);
  END IF;

  v_pay := GREATEST(v_p.amount - v_deduct, 0);

  SELECT kyc_status INTO v_kyc FROM public.profiles WHERE id = v_member.user_id;
  IF v_kyc IS DISTINCT FROM 'approved' AND v_p.amount >= 50000 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'KYC_REQUIRED', 'kyc_status', v_kyc);
  END IF;

  SELECT COUNT(*) INTO v_open_disputes
  FROM public.disputes
  WHERE jamiya_id = v_p.jamiya_id
    AND status IN ('open', 'under_review');

  IF v_open_disputes > 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'OPEN_DISPUTES', 'count', v_open_disputes);
  END IF;

  UPDATE public.payouts SET status = 'processing', updated_at = NOW() WHERE id = v_p.id;

  IF v_pay > 0 THEN
    v_tx := private.ledger_credit(
      v_member.user_id, v_p.currency, v_pay, 'payout', v_p.jamiya_id,
      'payout:' || v_p.id::text,
      'settle_payout:' || v_p.id::text,
      jsonb_build_object(
        'payout_id', v_p.id,
        'cycle', v_p.cycle_number,
        'gross', v_p.amount,
        'deducted', v_deduct,
        'compliance_mode', v_mode
      )
    );
  END IF;

  IF v_deduct > 0 AND v_open_penalties > 0 THEN
    UPDATE public.penalties
    SET status = 'paid', paid_at = NOW(), updated_at = NOW()
    WHERE member_id = v_p.member_id AND status = 'open';
  END IF;

  UPDATE public.payouts
  SET status = 'paid', paid_at = NOW(), transaction_id = v_tx, updated_at = NOW()
  WHERE id = v_p.id;

  UPDATE public.jamiyas
  SET current_cycle = GREATEST(current_cycle, v_p.cycle_number), updated_at = NOW()
  WHERE id = v_p.jamiya_id;

  INSERT INTO public.notifications (user_id, type, channel, title, body, data)
  VALUES (
    v_member.user_id,
    'payout_paid',
    'in_app',
    'Payout received',
    'Your cycle ' || v_p.cycle_number || ' payout has been credited to your wallet.',
    jsonb_build_object(
      'payout_id', v_p.id,
      'jamiya_id', v_p.jamiya_id,
      'net', v_pay,
      'deducted', v_deduct
    )
  );

  INSERT INTO public.audit_logs (actor_id, action, entity_type, entity_id, jamiya_id, metadata)
  VALUES (
    v_uid, 'approve', 'payout', v_p.id, v_p.jamiya_id,
    jsonb_build_object(
      'transaction_id', v_tx,
      'compliance_mode', v_mode,
      'deducted', v_deduct,
      'arrears', v_arrears,
      'penalties', v_open_penalties
    )
  );

  RETURN jsonb_build_object(
    'ok', true,
    'transaction_id', v_tx,
    'net', v_pay,
    'deducted', v_deduct,
    'compliance_mode', v_mode
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.move_savings_pocket(p_pocket_id uuid, p_amount numeric, p_direction text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_p public.savings_pockets%ROWTYPE;
  v_m public.members%ROWTYPE;
  v_key TEXT;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'UNAUTHENTICATED');
  END IF;
  IF p_amount IS NULL OR p_amount <= 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'INVALID_AMOUNT');
  END IF;
  IF p_direction NOT IN ('deposit', 'withdraw') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'INVALID_DIRECTION');
  END IF;

  SELECT * INTO v_p FROM public.savings_pockets WHERE id = p_pocket_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'NOT_FOUND');
  END IF;

  SELECT * INTO v_m FROM public.members WHERE id = v_p.member_id;
  IF v_m.user_id IS NULL OR (v_m.user_id <> v_uid AND NOT private.is_circle_admin(v_p.jamiya_id)) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'FORBIDDEN');
  END IF;

  v_key := 'pocket_' || p_direction || ':' || p_pocket_id::text || ':' || gen_random_uuid()::text;

  IF p_direction = 'deposit' THEN
    -- Only the member moves their own wallet money into a pocket; officers cannot.
    IF v_m.user_id <> v_uid THEN
      RETURN jsonb_build_object('ok', false, 'error', 'OWNER_ONLY');
    END IF;
    PERFORM private.ledger_debit(
      v_m.user_id, v_p.currency, p_amount, 'contribution'::public.transaction_type,
      v_p.jamiya_id, 'savings_pocket', v_key,
      jsonb_build_object('kind', 'pocket_deposit', 'category', v_p.category)
    );
    UPDATE public.savings_pockets
    SET balance = balance + p_amount, updated_at = NOW()
    WHERE id = p_pocket_id;
  ELSE
    IF v_p.balance < p_amount THEN
      RETURN jsonb_build_object('ok', false, 'error', 'INSUFFICIENT_POCKET');
    END IF;
    UPDATE public.savings_pockets
    SET balance = balance - p_amount, updated_at = NOW()
    WHERE id = p_pocket_id;
    PERFORM private.ledger_credit(
      v_m.user_id, v_p.currency, p_amount, 'payout'::public.transaction_type,
      v_p.jamiya_id, 'savings_pocket', v_key,
      jsonb_build_object('kind', 'pocket_withdraw', 'category', v_p.category)
    );
  END IF;

  RETURN jsonb_build_object('ok', true, 'balance', (
    SELECT balance FROM public.savings_pockets WHERE id = p_pocket_id
  ));
END;
$$;

REVOKE ALL ON FUNCTION private.terms_increases(public.jamiyas, public.jamiyas) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION private.with_terms_changes(public.jamiyas, JSONB) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION private.circle_terms_have_other_members(UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION private.trg_circle_terms_increase_guard() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION private.terms_proposal_voters(public.circle_terms_proposals) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION private.notify_circle_members(UUID, TEXT, TEXT, JSONB) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION private.decide_terms_proposal(UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION private.apply_terms_proposal(UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.propose_circle_terms_change(UUID, JSONB, TEXT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.cast_circle_terms_vote(UUID, BOOLEAN) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.cancel_circle_terms_proposal(UUID) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.refresh_circle_terms_proposals(UUID) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.process_circle_terms_proposals() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.get_circle_terms_proposals(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.propose_circle_terms_change(UUID, JSONB, TEXT) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.cast_circle_terms_vote(UUID, BOOLEAN) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.cancel_circle_terms_proposal(UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.refresh_circle_terms_proposals(UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.process_circle_terms_proposals() TO service_role;
GRANT EXECUTE ON FUNCTION public.get_circle_terms_proposals(UUID) TO authenticated, service_role;
