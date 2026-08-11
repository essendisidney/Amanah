-- Circle elections, chama KYC docs, goal duration months (1/3/6/12)

-- ---------------------------------------------------------------------------
-- Goal / pocket duration
-- ---------------------------------------------------------------------------
ALTER TABLE public.savings_goals
  ADD COLUMN IF NOT EXISTS duration_months INT;

ALTER TABLE public.savings_pockets
  ADD COLUMN IF NOT EXISTS duration_months INT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'savings_goals_duration_months_chk'
  ) THEN
    ALTER TABLE public.savings_goals
      ADD CONSTRAINT savings_goals_duration_months_chk
      CHECK (duration_months IS NULL OR duration_months IN (1, 3, 6, 12));
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'savings_pockets_duration_months_chk'
  ) THEN
    ALTER TABLE public.savings_pockets
      ADD CONSTRAINT savings_pockets_duration_months_chk
      CHECK (duration_months IS NULL OR duration_months IN (1, 3, 6, 12));
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- Registered chama KYC
-- ---------------------------------------------------------------------------
ALTER TABLE public.jamiyas
  ADD COLUMN IF NOT EXISTS registration_status TEXT NOT NULL DEFAULT 'not_started';

ALTER TABLE public.jamiyas
  ADD COLUMN IF NOT EXISTS registration_number TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'jamiyas_registration_status_chk'
  ) THEN
    ALTER TABLE public.jamiyas
      ADD CONSTRAINT jamiyas_registration_status_chk
      CHECK (registration_status IN ('not_started', 'pending', 'approved', 'rejected'));
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.jamiya_kyc_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  jamiya_id UUID NOT NULL REFERENCES public.jamiyas (id) ON DELETE CASCADE,
  uploaded_by UUID NOT NULL REFERENCES public.profiles (id),
  document_type TEXT NOT NULL CHECK (document_type IN (
    'certificate_of_registration',
    'constitution',
    'minutes',
    'bank_letter',
    'group_photo',
    'other'
  )),
  status TEXT NOT NULL DEFAULT 'uploaded'
    CHECK (status IN ('uploaded', 'under_review', 'approved', 'rejected')),
  storage_path TEXT NOT NULL,
  file_name TEXT NOT NULL,
  mime_type TEXT,
  file_size_bytes BIGINT,
  review_notes TEXT,
  reviewed_by UUID REFERENCES public.profiles (id),
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS jamiya_kyc_documents_jamiya_idx
  ON public.jamiya_kyc_documents (jamiya_id, created_at DESC);

ALTER TABLE public.jamiya_kyc_documents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS jamiya_kyc_select ON public.jamiya_kyc_documents;
CREATE POLICY jamiya_kyc_select ON public.jamiya_kyc_documents
  FOR SELECT TO authenticated
  USING (
    private.is_jamiya_member(jamiya_id)
    OR private.is_circle_admin(jamiya_id)
    OR private.is_compliance_or_admin()
  );

DROP POLICY IF EXISTS jamiya_kyc_insert ON public.jamiya_kyc_documents;
CREATE POLICY jamiya_kyc_insert ON public.jamiya_kyc_documents
  FOR INSERT TO authenticated
  WITH CHECK (
    uploaded_by = auth.uid()
    AND (
      private.is_circle_admin(jamiya_id)
      OR EXISTS (
        SELECT 1 FROM public.members m
        WHERE m.jamiya_id = jamiya_kyc_documents.jamiya_id
          AND m.user_id = auth.uid()
          AND m.status = 'active'
          AND m.role::text IN ('circle_admin', 'chair', 'secretary', 'treasurer')
      )
    )
  );

DROP POLICY IF EXISTS jamiya_kyc_admin_update ON public.jamiya_kyc_documents;
CREATE POLICY jamiya_kyc_admin_update ON public.jamiya_kyc_documents
  FOR UPDATE TO authenticated
  USING (private.is_compliance_or_admin())
  WITH CHECK (private.is_compliance_or_admin());

GRANT SELECT, INSERT, UPDATE ON public.jamiya_kyc_documents TO authenticated;

CREATE OR REPLACE FUNCTION public.review_jamiya_kyc_document(
  p_document_id UUID,
  p_status TEXT,
  p_notes TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_doc public.jamiya_kyc_documents%ROWTYPE;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'UNAUTHENTICATED');
  END IF;
  IF NOT private.is_compliance_or_admin() THEN
    RETURN jsonb_build_object('ok', false, 'error', 'FORBIDDEN');
  END IF;
  IF p_status NOT IN ('approved', 'rejected', 'under_review') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'INVALID_STATUS');
  END IF;

  SELECT * INTO v_doc FROM public.jamiya_kyc_documents WHERE id = p_document_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'NOT_FOUND');
  END IF;

  UPDATE public.jamiya_kyc_documents
  SET
    status = p_status,
    review_notes = p_notes,
    reviewed_by = v_uid,
    reviewed_at = NOW(),
    updated_at = NOW()
  WHERE id = p_document_id;

  IF p_status = 'approved' THEN
    UPDATE public.jamiyas
    SET registration_status = 'approved', updated_at = NOW()
    WHERE id = v_doc.jamiya_id;
  ELSIF p_status = 'rejected' THEN
    UPDATE public.jamiyas
    SET registration_status = 'rejected', updated_at = NOW()
    WHERE id = v_doc.jamiya_id;
  ELSE
    UPDATE public.jamiyas
    SET registration_status = 'pending', updated_at = NOW()
    WHERE id = v_doc.jamiya_id;
  END IF;

  RETURN jsonb_build_object('ok', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.review_jamiya_kyc_document(UUID, TEXT, TEXT) TO authenticated;

-- ---------------------------------------------------------------------------
-- Elections / voting
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'election_status') THEN
    CREATE TYPE public.election_status AS ENUM ('open', 'closed', 'cancelled');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.circle_elections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  jamiya_id UUID NOT NULL REFERENCES public.jamiyas (id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  seat_role TEXT NOT NULL CHECK (seat_role IN ('chair', 'treasurer', 'secretary', 'circle_admin')),
  status public.election_status NOT NULL DEFAULT 'open',
  opens_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  closes_at TIMESTAMPTZ,
  created_by UUID NOT NULL REFERENCES public.profiles (id),
  winner_member_id UUID REFERENCES public.members (id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS circle_elections_jamiya_idx
  ON public.circle_elections (jamiya_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.circle_election_candidates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  election_id UUID NOT NULL REFERENCES public.circle_elections (id) ON DELETE CASCADE,
  member_id UUID NOT NULL REFERENCES public.members (id) ON DELETE CASCADE,
  nominated_by UUID REFERENCES public.profiles (id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (election_id, member_id)
);

CREATE TABLE IF NOT EXISTS public.circle_votes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  election_id UUID NOT NULL REFERENCES public.circle_elections (id) ON DELETE CASCADE,
  voter_member_id UUID NOT NULL REFERENCES public.members (id) ON DELETE CASCADE,
  candidate_id UUID NOT NULL REFERENCES public.circle_election_candidates (id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (election_id, voter_member_id)
);

ALTER TABLE public.circle_elections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.circle_election_candidates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.circle_votes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS circle_elections_select ON public.circle_elections;
CREATE POLICY circle_elections_select ON public.circle_elections
  FOR SELECT TO authenticated
  USING (private.is_jamiya_member(jamiya_id) OR private.is_platform_admin());

DROP POLICY IF EXISTS circle_election_candidates_select ON public.circle_election_candidates;
CREATE POLICY circle_election_candidates_select ON public.circle_election_candidates
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.circle_elections e
      WHERE e.id = election_id
        AND (private.is_jamiya_member(e.jamiya_id) OR private.is_platform_admin())
    )
  );

DROP POLICY IF EXISTS circle_votes_select ON public.circle_votes;
CREATE POLICY circle_votes_select ON public.circle_votes
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.circle_elections e
      WHERE e.id = election_id
        AND (
          private.is_circle_admin(e.jamiya_id)
          OR private.is_platform_admin()
          OR EXISTS (
            SELECT 1 FROM public.members m
            WHERE m.id = circle_votes.voter_member_id AND m.user_id = auth.uid()
          )
        )
    )
  );

GRANT SELECT ON public.circle_elections TO authenticated;
GRANT SELECT ON public.circle_election_candidates TO authenticated;
GRANT SELECT ON public.circle_votes TO authenticated;

CREATE OR REPLACE FUNCTION public.open_circle_election(
  p_jamiya_id UUID,
  p_title TEXT,
  p_seat_role TEXT,
  p_closes_at TIMESTAMPTZ DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_id UUID;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'UNAUTHENTICATED');
  END IF;
  IF NOT private.is_circle_admin(p_jamiya_id) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'FORBIDDEN');
  END IF;
  IF p_seat_role NOT IN ('chair', 'treasurer', 'secretary', 'circle_admin') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'INVALID_ROLE');
  END IF;
  IF p_title IS NULL OR length(trim(p_title)) < 3 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'INVALID_TITLE');
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.circle_elections e
    WHERE e.jamiya_id = p_jamiya_id AND e.seat_role = p_seat_role AND e.status = 'open'
  ) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'ELECTION_ALREADY_OPEN');
  END IF;

  INSERT INTO public.circle_elections (jamiya_id, title, seat_role, closes_at, created_by)
  VALUES (p_jamiya_id, trim(p_title), p_seat_role, p_closes_at, v_uid)
  RETURNING id INTO v_id;

  RETURN jsonb_build_object('ok', true, 'election_id', v_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.nominate_election_candidate(
  p_election_id UUID,
  p_member_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_e public.circle_elections%ROWTYPE;
  v_m public.members%ROWTYPE;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'UNAUTHENTICATED');
  END IF;

  SELECT * INTO v_e FROM public.circle_elections WHERE id = p_election_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'NOT_FOUND');
  END IF;
  IF v_e.status <> 'open' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'NOT_OPEN');
  END IF;
  IF NOT private.is_circle_admin(v_e.jamiya_id) AND NOT private.is_active_jamiya_member(v_e.jamiya_id) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'FORBIDDEN');
  END IF;

  SELECT * INTO v_m FROM public.members WHERE id = p_member_id AND jamiya_id = v_e.jamiya_id;
  IF NOT FOUND OR v_m.status <> 'active' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'INVALID_MEMBER');
  END IF;

  INSERT INTO public.circle_election_candidates (election_id, member_id, nominated_by)
  VALUES (p_election_id, p_member_id, v_uid)
  ON CONFLICT (election_id, member_id) DO NOTHING;

  RETURN jsonb_build_object('ok', true);
END;
$$;

CREATE OR REPLACE FUNCTION public.cast_circle_vote(
  p_election_id UUID,
  p_candidate_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_e public.circle_elections%ROWTYPE;
  v_voter public.members%ROWTYPE;
  v_cand public.circle_election_candidates%ROWTYPE;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'UNAUTHENTICATED');
  END IF;

  SELECT * INTO v_e FROM public.circle_elections WHERE id = p_election_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'NOT_FOUND');
  END IF;
  IF v_e.status <> 'open' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'NOT_OPEN');
  END IF;
  IF v_e.closes_at IS NOT NULL AND v_e.closes_at < NOW() THEN
    RETURN jsonb_build_object('ok', false, 'error', 'CLOSED');
  END IF;

  SELECT * INTO v_voter
  FROM public.members
  WHERE jamiya_id = v_e.jamiya_id AND user_id = v_uid AND status = 'active';
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'FORBIDDEN');
  END IF;

  SELECT * INTO v_cand
  FROM public.circle_election_candidates
  WHERE id = p_candidate_id AND election_id = p_election_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'INVALID_CANDIDATE');
  END IF;

  INSERT INTO public.circle_votes (election_id, voter_member_id, candidate_id)
  VALUES (p_election_id, v_voter.id, p_candidate_id)
  ON CONFLICT (election_id, voter_member_id) DO UPDATE
    SET candidate_id = EXCLUDED.candidate_id;

  RETURN jsonb_build_object('ok', true);
END;
$$;

CREATE OR REPLACE FUNCTION public.close_circle_election(p_election_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_e public.circle_elections%ROWTYPE;
  v_winner UUID;
  v_votes INT;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'UNAUTHENTICATED');
  END IF;

  SELECT * INTO v_e FROM public.circle_elections WHERE id = p_election_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'NOT_FOUND');
  END IF;
  IF NOT private.is_circle_admin(v_e.jamiya_id) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'FORBIDDEN');
  END IF;
  IF v_e.status <> 'open' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'NOT_OPEN');
  END IF;

  SELECT c.member_id, count(v.id)::INT
  INTO v_winner, v_votes
  FROM public.circle_election_candidates c
  LEFT JOIN public.circle_votes v ON v.candidate_id = c.id
  WHERE c.election_id = p_election_id
  GROUP BY c.id, c.member_id
  ORDER BY count(v.id) DESC, c.created_at ASC
  LIMIT 1;

  IF v_winner IS NULL THEN
    UPDATE public.circle_elections
    SET status = 'cancelled', updated_at = NOW()
    WHERE id = p_election_id;
    RETURN jsonb_build_object('ok', false, 'error', 'NO_CANDIDATES');
  END IF;

  UPDATE public.members
  SET role = v_e.seat_role::public.membership_role
  WHERE id = v_winner;

  UPDATE public.circle_elections
  SET
    status = 'closed',
    winner_member_id = v_winner,
    closes_at = coalesce(closes_at, NOW()),
    updated_at = NOW()
  WHERE id = p_election_id;

  RETURN jsonb_build_object('ok', true, 'winner_member_id', v_winner, 'votes', coalesce(v_votes, 0));
END;
$$;

GRANT EXECUTE ON FUNCTION public.open_circle_election(UUID, TEXT, TEXT, TIMESTAMPTZ) TO authenticated;
GRANT EXECUTE ON FUNCTION public.nominate_election_candidate(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.cast_circle_vote(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.close_circle_election(UUID) TO authenticated;
