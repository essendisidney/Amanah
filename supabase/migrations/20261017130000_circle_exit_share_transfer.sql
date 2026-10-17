-- Members can leave a circle, transferring their shares to another member.
--
-- Until now there was no way to leave: only officers could remove a member, and the leaver's
-- share lots stayed on record and kept earning dividends. Now:
-- 1. A member asks to leave (request_circle_exit). If they hold shares they name a member to take
--    them over; that member accepts or declines (respond_share_transfer).
-- 2. An officer other than the leaver approves (decide_circle_exit). The leaver's share lots are
--    handed to the recipient and each move is logged in circle_share_transfers, so every share
--    total, dividend and loan cap follows without other changes. The member is marked 'left',
--    their future unpaid contributions are waived and their scheduled payouts cancelled.
-- Leaving is refused while the member owes the circle: an open loan, unpaid dues or open
-- penalties, or having already been paid out with contributions still due. The circle's last
-- admin cannot leave without handing over the role.

CREATE TABLE IF NOT EXISTS public.circle_exit_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  jamiya_id UUID NOT NULL REFERENCES public.jamiyas(id) ON DELETE CASCADE,
  member_id UUID NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  reason TEXT NOT NULL DEFAULT '',
  transfer_to_member_id UUID REFERENCES public.members(id) ON DELETE SET NULL,
  shares NUMERIC(18, 4) NOT NULL DEFAULT 0,
  share_amount NUMERIC(14, 2) NOT NULL DEFAULT 0,
  status TEXT NOT NULL CHECK (status IN (
    'awaiting_recipient', 'awaiting_approval', 'approved', 'rejected', 'declined', 'cancelled'
  )),
  recipient_responded_at TIMESTAMPTZ,
  decided_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  decided_at TIMESTAMPTZ,
  decision_note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS circle_exit_requests_one_open
  ON public.circle_exit_requests (member_id) WHERE status IN ('awaiting_recipient', 'awaiting_approval');
CREATE INDEX IF NOT EXISTS circle_exit_requests_jamiya_idx ON public.circle_exit_requests (jamiya_id, created_at DESC);

ALTER TABLE public.circle_exit_requests ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.circle_exit_requests FROM anon;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.circle_exit_requests FROM authenticated;
CREATE POLICY circle_exit_requests_select ON public.circle_exit_requests
  FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.members m WHERE m.id = transfer_to_member_id AND m.user_id = auth.uid())
    OR private.is_circle_officer(jamiya_id)
    OR private.is_compliance_or_admin()
  );

-- Each share lot handed from a leaver to another member.
CREATE TABLE IF NOT EXISTS public.circle_share_transfers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  jamiya_id UUID NOT NULL REFERENCES public.jamiyas(id) ON DELETE CASCADE,
  exit_request_id UUID REFERENCES public.circle_exit_requests(id) ON DELETE SET NULL,
  lot_id UUID REFERENCES public.circle_share_lots(id) ON DELETE SET NULL,
  from_member_id UUID REFERENCES public.members(id) ON DELETE SET NULL,
  to_member_id UUID REFERENCES public.members(id) ON DELETE SET NULL,
  shares NUMERIC(18, 4) NOT NULL,
  amount NUMERIC(14, 2) NOT NULL,
  transferred_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  transferred_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS circle_share_transfers_jamiya_idx ON public.circle_share_transfers (jamiya_id, transferred_at DESC);
ALTER TABLE public.circle_share_transfers ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.circle_share_transfers FROM anon;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.circle_share_transfers FROM authenticated;
CREATE POLICY circle_share_transfers_select ON public.circle_share_transfers
  FOR SELECT TO authenticated
  USING (private.is_jamiya_member(jamiya_id) OR private.is_circle_officer(jamiya_id) OR private.is_compliance_or_admin());

-- ---------------------------------------------------------------------------
-- What stops a member leaving
-- ---------------------------------------------------------------------------
-- NULL when the member may leave, otherwise the reason.
CREATE OR REPLACE FUNCTION private.circle_exit_blocker(p_member_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  v_m public.members%ROWTYPE;
BEGIN
  SELECT * INTO v_m FROM public.members WHERE id = p_member_id;
  IF NOT FOUND OR v_m.status <> 'active' THEN
    RETURN 'NOT_ACTIVE';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.qard_loans l
    WHERE l.jamiya_id = v_m.jamiya_id AND l.borrower_id = v_m.user_id
      AND l.status IN ('requested', 'approved', 'active', 'defaulted')
  ) THEN
    RETURN 'OPEN_LOAN';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.member_loan_facilities f
    WHERE f.member_id = v_m.id AND f.status = 'active' AND f.principal_outstanding > 0
  ) THEN
    RETURN 'OPEN_LOAN';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.contributions c
    WHERE c.member_id = v_m.id
      AND (c.status IN ('late', 'partial')
           OR (c.status = 'pending' AND c.due_date IS NOT NULL AND c.due_date < CURRENT_DATE))
  ) THEN
    RETURN 'UNPAID_DUES';
  END IF;
  IF EXISTS (SELECT 1 FROM public.penalties p WHERE p.member_id = v_m.id AND p.status = 'open') THEN
    RETURN 'OPEN_PENALTIES';
  END IF;
  -- Paid out already, with contributions still to come: they owe the rest of the rotation.
  IF EXISTS (SELECT 1 FROM public.payouts p WHERE p.member_id = v_m.id AND p.status = 'paid')
     AND EXISTS (SELECT 1 FROM public.contributions c WHERE c.member_id = v_m.id AND c.status = 'pending') THEN
    RETURN 'PAID_OUT_OWES_ROTATION';
  END IF;
  IF v_m.role = 'circle_admin' AND NOT EXISTS (
    SELECT 1 FROM public.members o
    WHERE o.jamiya_id = v_m.jamiya_id AND o.id <> v_m.id AND o.status = 'active' AND o.role = 'circle_admin'
  ) THEN
    RETURN 'LAST_ADMIN';
  END IF;
  RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION private.member_share_holding(p_member_id UUID)
RETURNS TABLE (shares NUMERIC, amount NUMERIC)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO ''
AS $$
  SELECT coalesce(sum(l.shares), 0), coalesce(sum(l.amount), 0)
  FROM public.circle_share_lots l
  WHERE l.member_id = p_member_id;
$$;

CREATE OR REPLACE FUNCTION private.notify_circle_officers(
  p_jamiya_id UUID, p_title TEXT, p_body TEXT, p_data JSONB, p_except UUID DEFAULT NULL
)
RETURNS VOID
LANGUAGE sql
SECURITY DEFINER
SET search_path TO ''
AS $$
  INSERT INTO public.notifications (user_id, type, channel, title, body, data)
  SELECT m.user_id, 'system', 'in_app', p_title, p_body, p_data
  FROM public.members m
  WHERE m.jamiya_id = p_jamiya_id AND m.status = 'active' AND m.user_id IS NOT NULL
    AND m.role::text IN ('circle_admin', 'chair', 'treasurer', 'secretary')
    AND m.user_id IS DISTINCT FROM p_except;
$$;

-- ---------------------------------------------------------------------------
-- Asking to leave
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.request_circle_exit(
  p_jamiya_id UUID, p_transfer_to_member_id UUID DEFAULT NULL, p_reason TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_m public.members%ROWTYPE;
  v_to public.members%ROWTYPE;
  v_block TEXT;
  v_shares NUMERIC;
  v_amount NUMERIC;
  v_id UUID;
  v_name TEXT;
  v_circle TEXT;
  v_slug TEXT;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'UNAUTHENTICATED');
  END IF;
  SELECT * INTO v_m FROM public.members
  WHERE jamiya_id = p_jamiya_id AND user_id = v_uid AND status = 'active'
  FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'NOT_A_MEMBER');
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.circle_exit_requests
    WHERE member_id = v_m.id AND status IN ('awaiting_recipient', 'awaiting_approval')
  ) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'ALREADY_REQUESTED');
  END IF;

  v_block := private.circle_exit_blocker(v_m.id);
  IF v_block IS NOT NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', v_block);
  END IF;

  SELECT h.shares, h.amount INTO v_shares, v_amount FROM private.member_share_holding(v_m.id) h;
  IF p_transfer_to_member_id IS NOT NULL THEN
    SELECT * INTO v_to FROM public.members
    WHERE id = p_transfer_to_member_id AND jamiya_id = p_jamiya_id AND status = 'active'
      AND id <> v_m.id AND user_id IS NOT NULL;
    IF NOT FOUND THEN
      RETURN jsonb_build_object('ok', false, 'error', 'INVALID_RECIPIENT');
    END IF;
  ELSIF v_shares > 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'SHARES_NEED_RECIPIENT', 'shares', v_shares);
  END IF;
  IF v_shares <= 0 THEN
    v_to := NULL;  -- nothing to transfer
  END IF;

  INSERT INTO public.circle_exit_requests (
    jamiya_id, member_id, user_id, reason, transfer_to_member_id, shares, share_amount, status
  ) VALUES (
    p_jamiya_id, v_m.id, v_uid, left(btrim(coalesce(p_reason, '')), 500), v_to.id,
    greatest(v_shares, 0), greatest(v_amount, 0),
    CASE WHEN v_to.id IS NOT NULL THEN 'awaiting_recipient' ELSE 'awaiting_approval' END
  )
  RETURNING id INTO v_id;

  SELECT coalesce(full_name, 'A member') INTO v_name FROM public.profiles WHERE id = v_uid;
  SELECT name, slug INTO v_circle, v_slug FROM public.jamiyas WHERE id = p_jamiya_id;
  IF v_to.id IS NOT NULL THEN
    INSERT INTO public.notifications (user_id, type, channel, title, body, data)
    VALUES (v_to.user_id, 'system', 'in_app', 'Take over shares?',
      v_name || ' is leaving ' || v_circle || ' and asked you to take over their ' || v_shares::text
        || ' shares (' || v_amount::text || '). Open the circle to accept or decline.',
      jsonb_build_object('kind', 'share_transfer_request', 'href', '/circles/' || v_slug || '/leave', 'exit_request_id', v_id, 'jamiya_id', p_jamiya_id, 'slug', v_slug));
  ELSE
    PERFORM private.notify_circle_officers(p_jamiya_id, 'Member asks to leave',
      v_name || ' asked to leave ' || v_circle || '. Approve it on the members page.',
      jsonb_build_object('kind', 'circle_exit_request', 'href', '/circles/' || v_slug || '/leave', 'exit_request_id', v_id, 'jamiya_id', p_jamiya_id, 'slug', v_slug),
      v_uid);
  END IF;

  RETURN jsonb_build_object('ok', true, 'exit_request_id', v_id,
    'status', CASE WHEN v_to.id IS NOT NULL THEN 'awaiting_recipient' ELSE 'awaiting_approval' END);
END;
$$;

-- The named member accepts or declines taking over the shares.
CREATE OR REPLACE FUNCTION public.respond_share_transfer(p_exit_request_id UUID, p_accept BOOLEAN)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_r public.circle_exit_requests%ROWTYPE;
  v_circle TEXT;
  v_slug TEXT;
  v_name TEXT;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'UNAUTHENTICATED');
  END IF;
  IF p_accept IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'INVALID');
  END IF;
  SELECT r.* INTO v_r FROM public.circle_exit_requests r
  JOIN public.members m ON m.id = r.transfer_to_member_id
  WHERE r.id = p_exit_request_id AND m.user_id = v_uid
  FOR UPDATE OF r;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'NOT_FOUND');
  END IF;
  IF v_r.status <> 'awaiting_recipient' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'NOT_AWAITING');
  END IF;

  UPDATE public.circle_exit_requests
  SET status = CASE WHEN p_accept THEN 'awaiting_approval' ELSE 'declined' END,
      recipient_responded_at = NOW(), updated_at = NOW()
  WHERE id = v_r.id;

  SELECT name, slug INTO v_circle, v_slug FROM public.jamiyas WHERE id = v_r.jamiya_id;
  SELECT coalesce(full_name, 'The member') INTO v_name FROM public.profiles WHERE id = v_uid;
  INSERT INTO public.notifications (user_id, type, channel, title, body, data)
  VALUES (v_r.user_id, 'system', 'in_app',
    CASE WHEN p_accept THEN 'Share transfer accepted' ELSE 'Share transfer declined' END,
    CASE WHEN p_accept
      THEN v_name || ' agreed to take over your shares. Officers of ' || v_circle || ' now approve your exit.'
      ELSE v_name || ' declined to take over your shares. Choose another member to ask.' END,
    jsonb_build_object('kind', 'share_transfer_response', 'href', '/circles/' || v_slug || '/leave', 'exit_request_id', v_r.id, 'jamiya_id', v_r.jamiya_id, 'slug', v_slug));
  IF p_accept THEN
    PERFORM private.notify_circle_officers(v_r.jamiya_id, 'Member asks to leave',
      'A member asked to leave ' || v_circle || ' and ' || v_name || ' agreed to take over their shares. Approve it on the members page.',
      jsonb_build_object('kind', 'circle_exit_request', 'href', '/circles/' || v_slug || '/leave', 'exit_request_id', v_r.id, 'jamiya_id', v_r.jamiya_id, 'slug', v_slug),
      v_r.user_id);
  END IF;
  RETURN jsonb_build_object('ok', true, 'status', CASE WHEN p_accept THEN 'awaiting_approval' ELSE 'declined' END);
END;
$$;

CREATE OR REPLACE FUNCTION public.cancel_circle_exit(p_exit_request_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'UNAUTHENTICATED');
  END IF;
  UPDATE public.circle_exit_requests
  SET status = 'cancelled', updated_at = NOW()
  WHERE id = p_exit_request_id AND user_id = auth.uid()
    AND status IN ('awaiting_recipient', 'awaiting_approval');
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'NOT_FOUND');
  END IF;
  RETURN jsonb_build_object('ok', true);
END;
$$;

-- An officer (not the leaver) approves or rejects. Approval moves the shares and marks the
-- member as left.
CREATE OR REPLACE FUNCTION public.decide_circle_exit(
  p_exit_request_id UUID, p_approve BOOLEAN, p_note TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_r public.circle_exit_requests%ROWTYPE;
  v_block TEXT;
  v_shares NUMERIC;
  v_amount NUMERIC;
  v_to public.members%ROWTYPE;
  v_circle TEXT;
  v_slug TEXT;
  v_name TEXT;
  v_waived INT := 0;
  v_cancelled INT := 0;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'UNAUTHENTICATED');
  END IF;
  IF p_approve IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'INVALID');
  END IF;
  SELECT * INTO v_r FROM public.circle_exit_requests WHERE id = p_exit_request_id FOR UPDATE;
  IF NOT FOUND OR NOT private.is_circle_officer(v_r.jamiya_id) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'NOT_FOUND');
  END IF;
  IF v_r.user_id = v_uid AND NOT private.is_platform_admin() THEN
    RETURN jsonb_build_object('ok', false, 'error', 'OWN_REQUEST');
  END IF;
  IF v_r.status <> 'awaiting_approval' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'NOT_AWAITING');
  END IF;

  SELECT name, slug INTO v_circle, v_slug FROM public.jamiyas WHERE id = v_r.jamiya_id;

  IF NOT p_approve THEN
    UPDATE public.circle_exit_requests
    SET status = 'rejected', decided_by = v_uid, decided_at = NOW(),
        decision_note = left(nullif(btrim(coalesce(p_note, '')), ''), 500), updated_at = NOW()
    WHERE id = v_r.id;
    INSERT INTO public.notifications (user_id, type, channel, title, body, data)
    VALUES (v_r.user_id, 'system', 'in_app', 'Request to leave not approved',
      'Officers of ' || v_circle || ' did not approve your request to leave'
        || coalesce(': ' || nullif(btrim(coalesce(p_note, '')), ''), '.'),
      jsonb_build_object('kind', 'circle_exit_decided', 'exit_request_id', v_r.id, 'jamiya_id', v_r.jamiya_id, 'slug', v_slug));
    RETURN jsonb_build_object('ok', true, 'status', 'rejected');
  END IF;

  PERFORM 1 FROM public.members WHERE id = v_r.member_id FOR UPDATE;
  v_block := private.circle_exit_blocker(v_r.member_id);
  IF v_block IS NOT NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', v_block);
  END IF;

  -- Move whatever the member holds now (the register may have changed since they asked).
  SELECT h.shares, h.amount INTO v_shares, v_amount FROM private.member_share_holding(v_r.member_id) h;
  IF v_shares > 0 THEN
    SELECT * INTO v_to FROM public.members
    WHERE id = v_r.transfer_to_member_id AND jamiya_id = v_r.jamiya_id AND status = 'active';
    IF NOT FOUND THEN
      RETURN jsonb_build_object('ok', false, 'error', 'RECIPIENT_GONE');
    END IF;
    INSERT INTO public.circle_share_transfers (
      jamiya_id, exit_request_id, lot_id, from_member_id, to_member_id, shares, amount, transferred_by
    )
    SELECT l.jamiya_id, v_r.id, l.id, v_r.member_id, v_to.id, l.shares, l.amount, v_uid
    FROM public.circle_share_lots l
    WHERE l.member_id = v_r.member_id;
    UPDATE public.circle_share_lots
    SET member_id = v_to.id,
        notes = left(coalesce(notes || ' · ', '') || 'transferred ' || to_char(CURRENT_DATE, 'YYYY-MM-DD')
                     || ' from a member who left', 500)
    WHERE member_id = v_r.member_id;
  END IF;

  UPDATE public.members SET status = 'left', left_at = NOW() WHERE id = v_r.member_id;

  UPDATE public.contributions SET status = 'waived', updated_at = NOW()
  WHERE member_id = v_r.member_id AND status = 'pending';
  GET DIAGNOSTICS v_waived = ROW_COUNT;
  UPDATE public.payouts SET status = 'cancelled', updated_at = NOW()
  WHERE member_id = v_r.member_id AND status = 'scheduled';
  GET DIAGNOSTICS v_cancelled = ROW_COUNT;

  UPDATE public.circle_exit_requests
  SET status = 'approved', decided_by = v_uid, decided_at = NOW(),
      shares = greatest(v_shares, 0), share_amount = greatest(v_amount, 0),
      decision_note = left(nullif(btrim(coalesce(p_note, '')), ''), 500), updated_at = NOW()
  WHERE id = v_r.id;

  SELECT coalesce(full_name, 'A member') INTO v_name FROM public.profiles WHERE id = v_r.user_id;
  INSERT INTO public.notifications (user_id, type, channel, title, body, data)
  VALUES (v_r.user_id, 'system', 'in_app', 'You have left the circle',
    'Officers of ' || v_circle || ' approved your exit.'
      || CASE WHEN v_shares > 0 THEN ' Your shares were transferred.' ELSE '' END
      || ' Money in your Jameiyah wallet stays yours.',
    jsonb_build_object('kind', 'circle_exit_decided', 'exit_request_id', v_r.id, 'jamiya_id', v_r.jamiya_id));
  IF v_shares > 0 THEN
    INSERT INTO public.notifications (user_id, type, channel, title, body, data)
    VALUES (v_to.user_id, 'system', 'in_app', 'Shares transferred to you',
      v_name || '''s ' || v_shares::text || ' shares in ' || v_circle || ' are now yours.',
      jsonb_build_object('kind', 'share_transfer_done', 'href', '/circles/' || v_slug || '/leave', 'exit_request_id', v_r.id, 'jamiya_id', v_r.jamiya_id, 'slug', v_slug));
  END IF;
  INSERT INTO public.audit_logs (actor_id, action, entity_type, entity_id, jamiya_id, metadata)
  VALUES (v_uid, 'approve', 'circle_exit', v_r.id, v_r.jamiya_id,
          jsonb_build_object('member_id', v_r.member_id, 'shares', v_shares, 'amount', v_amount,
                             'to_member_id', v_to.id, 'contributions_waived', v_waived, 'payouts_cancelled', v_cancelled));

  RETURN jsonb_build_object('ok', true, 'status', 'approved', 'shares', greatest(v_shares, 0),
    'contributions_waived', v_waived, 'payouts_cancelled', v_cancelled);
END;
$$;

-- What the caller would face if they asked to leave now: the reason they cannot, if any, and
-- the shares they would hand over.
CREATE OR REPLACE FUNCTION public.my_circle_exit_check(p_jamiya_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  v_m public.members%ROWTYPE;
  v_shares NUMERIC;
  v_amount NUMERIC;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'UNAUTHENTICATED');
  END IF;
  SELECT * INTO v_m FROM public.members
  WHERE jamiya_id = p_jamiya_id AND user_id = auth.uid() AND status = 'active';
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'NOT_A_MEMBER');
  END IF;
  SELECT h.shares, h.amount INTO v_shares, v_amount FROM private.member_share_holding(v_m.id) h;
  RETURN jsonb_build_object(
    'ok', true,
    'member_id', v_m.id,
    'blocker', private.circle_exit_blocker(v_m.id),
    'shares', greatest(v_shares, 0),
    'share_amount', greatest(v_amount, 0)
  );
END;
$$;

REVOKE ALL ON FUNCTION private.circle_exit_blocker(UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION private.member_share_holding(UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION private.notify_circle_officers(UUID, TEXT, TEXT, JSONB, UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.request_circle_exit(UUID, UUID, TEXT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.respond_share_transfer(UUID, BOOLEAN) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.cancel_circle_exit(UUID) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.my_circle_exit_check(UUID) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.decide_circle_exit(UUID, BOOLEAN, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.request_circle_exit(UUID, UUID, TEXT) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.respond_share_transfer(UUID, BOOLEAN) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.cancel_circle_exit(UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.my_circle_exit_check(UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.decide_circle_exit(UUID, BOOLEAN, TEXT) TO authenticated, service_role;
