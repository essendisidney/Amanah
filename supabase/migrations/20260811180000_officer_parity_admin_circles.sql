-- Officer parity (chair/treasurer) + platform admin circle status control

CREATE OR REPLACE FUNCTION private.is_circle_officer(p_jamiya_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.members m
    WHERE m.jamiya_id = p_jamiya_id
      AND m.user_id = auth.uid()
      AND m.status = 'active'
      AND m.role::text IN ('circle_admin', 'chair', 'treasurer')
  )
  OR private.is_platform_admin();
$$;

REVOKE ALL ON FUNCTION private.is_circle_officer(UUID) FROM PUBLIC;

-- Invitations
DROP POLICY IF EXISTS "invitations_insert_circle_admin" ON public.invitations;
CREATE POLICY "invitations_insert_circle_admin"
  ON public.invitations FOR INSERT TO authenticated
  WITH CHECK (
    private.is_circle_officer(jamiya_id)
    AND invited_by = auth.uid()
  );

DROP POLICY IF EXISTS "invitations_select" ON public.invitations;
CREATE POLICY "invitations_select"
  ON public.invitations FOR SELECT TO authenticated
  USING (
    private.is_circle_officer(jamiya_id)
    OR invited_by = auth.uid()
    OR invitee_user_id = auth.uid()
    OR private.is_platform_admin()
  );

DROP POLICY IF EXISTS "invitations_update_admin_or_invitee" ON public.invitations;
CREATE POLICY "invitations_update_admin_or_invitee"
  ON public.invitations FOR UPDATE TO authenticated
  USING (
    private.is_circle_officer(jamiya_id)
    OR invitee_user_id = auth.uid()
  )
  WITH CHECK (
    private.is_circle_officer(jamiya_id)
    OR invitee_user_id = auth.uid()
  );

-- Book entries + announcements
DROP POLICY IF EXISTS book_entries_admin_insert ON public.book_entries;
CREATE POLICY book_entries_admin_insert ON public.book_entries FOR INSERT TO authenticated
  WITH CHECK (private.is_circle_officer(jamiya_id) OR private.is_platform_admin());

DROP POLICY IF EXISTS announcements_admin_insert ON public.announcements;
CREATE POLICY announcements_admin_insert ON public.announcements FOR INSERT TO authenticated
  WITH CHECK (private.is_circle_officer(jamiya_id) OR private.is_platform_admin());

-- Circle settings (penalties) + platform status edits
DROP POLICY IF EXISTS "jamiyas_update_circle_admin" ON public.jamiyas;
CREATE POLICY "jamiyas_update_circle_admin"
  ON public.jamiyas FOR UPDATE TO authenticated
  USING (private.is_circle_officer(id) OR private.is_platform_admin())
  WITH CHECK (private.is_circle_officer(id) OR private.is_platform_admin());

-- Widen add-member gate only (preserve rest of function body via recreate of check)
CREATE OR REPLACE FUNCTION public.admin_add_circle_member(
  p_jamiya_id UUID,
  p_user_id UUID DEFAULT NULL,
  p_status public.membership_status DEFAULT 'active',
  p_email TEXT DEFAULT NULL,
  p_phone TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_jamiya public.jamiyas%ROWTYPE;
  v_profile public.profiles%ROWTYPE;
  v_member public.members%ROWTYPE;
  v_member_id UUID;
  v_next_position INTEGER;
  v_seat_count INTEGER;
  v_fee NUMERIC;
  v_tx UUID;
  v_fee_warning BOOLEAN := false;
  v_target UUID;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'UNAUTHENTICATED');
  END IF;

  IF p_status NOT IN ('active', 'invited') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'INVALID_STATUS');
  END IF;

  IF NOT private.is_circle_officer(p_jamiya_id) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'FORBIDDEN');
  END IF;

  SELECT * INTO v_jamiya FROM public.jamiyas WHERE id = p_jamiya_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'NOT_FOUND');
  END IF;

  v_target := p_user_id;
  IF v_target IS NULL AND p_email IS NOT NULL AND btrim(p_email) <> '' THEN
    SELECT id INTO v_target
    FROM public.profiles
    WHERE lower(email) = lower(btrim(p_email))
    LIMIT 1;
  END IF;
  IF v_target IS NULL AND p_phone IS NOT NULL AND btrim(p_phone) <> '' THEN
    SELECT id INTO v_target
    FROM public.profiles
    WHERE phone = btrim(p_phone)
    LIMIT 1;
  END IF;

  IF v_target IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'USER_NOT_FOUND');
  END IF;

  SELECT * INTO v_profile FROM public.profiles WHERE id = v_target;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'USER_NOT_FOUND');
  END IF;

  SELECT * INTO v_member
  FROM public.members
  WHERE jamiya_id = p_jamiya_id AND user_id = v_target;

  IF FOUND AND v_member.status = 'active' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'ALREADY_MEMBER', 'member_id', v_member.id);
  END IF;

  SELECT COUNT(*)::INTEGER INTO v_seat_count
  FROM public.members m
  WHERE m.jamiya_id = p_jamiya_id
    AND m.status IN ('active', 'invited');

  IF v_member.id IS NULL OR v_member.status NOT IN ('active', 'invited') THEN
    IF v_seat_count >= v_jamiya.max_members THEN
      RETURN jsonb_build_object('ok', false, 'error', 'CIRCLE_FULL');
    END IF;
  END IF;

  SELECT COALESCE(MAX(payout_position), 0) + 1
  INTO v_next_position
  FROM public.members
  WHERE jamiya_id = p_jamiya_id;

  INSERT INTO public.members (
    jamiya_id, user_id, role, status, payout_position, joined_at
  )
  VALUES (
    p_jamiya_id,
    v_target,
    'member',
    p_status,
    v_next_position,
    CASE WHEN p_status = 'active' THEN NOW() ELSE NULL END
  )
  ON CONFLICT (jamiya_id, user_id) DO UPDATE
  SET
    status = EXCLUDED.status,
    payout_position = COALESCE(public.members.payout_position, EXCLUDED.payout_position),
    joined_at = CASE
      WHEN EXCLUDED.status = 'active' THEN COALESCE(public.members.joined_at, NOW())
      ELSE public.members.joined_at
    END,
    left_at = NULL,
    updated_at = NOW()
  RETURNING id INTO v_member_id;

  IF p_status = 'active' THEN
    v_fee := coalesce(v_jamiya.join_fee_amount, 0);
    IF v_fee > 0 THEN
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM public.transactions t
          WHERE t.user_id = v_target
            AND t.jamiya_id = p_jamiya_id
            AND t.metadata->>'kind' = 'join_fee'
            AND t.status = 'completed'
        ) THEN
          v_tx := private.ledger_debit(
            v_target,
            v_jamiya.currency,
            v_fee,
            'fee'::public.transaction_type,
            p_jamiya_id,
            'join_fee',
            p_jamiya_id::text || ':' || v_target::text || ':join_fee',
            jsonb_build_object('kind', 'join_fee', 'added_by', v_uid)
          );
        END IF;
      EXCEPTION WHEN OTHERS THEN
        v_fee_warning := true;
      END;
    END IF;

    INSERT INTO public.notifications (user_id, type, channel, title, body, data)
    VALUES (
      v_target,
      'invitation',
      'in_app',
      'Added to circle',
      'You were added to ' || v_jamiya.name || ' on Amanah.',
      jsonb_build_object('jamiya_id', v_jamiya.id, 'slug', v_jamiya.slug, 'member_id', v_member_id)
    );
  ELSE
    INSERT INTO public.notifications (user_id, type, channel, title, body, data)
    VALUES (
      v_target,
      'invitation',
      'in_app',
      'Circle seat reserved',
      'A seat was reserved for you in ' || v_jamiya.name || '. Open your invite link to activate.',
      jsonb_build_object('jamiya_id', v_jamiya.id, 'slug', v_jamiya.slug, 'member_id', v_member_id)
    );
  END IF;

  INSERT INTO public.audit_logs (actor_id, action, entity_type, entity_id, jamiya_id, metadata)
  VALUES (
    v_uid,
    'invite',
    'member',
    v_member_id,
    p_jamiya_id,
    jsonb_build_object(
      'user_id', v_target,
      'status', p_status,
      'fee_warning', v_fee_warning,
      'transaction_id', v_tx
    )
  );

  RETURN jsonb_build_object(
    'ok', true,
    'member_id', v_member_id,
    'user_id', v_target,
    'status', p_status,
    'slug', v_jamiya.slug,
    'jamiya_id', v_jamiya.id,
    'fee_warning', v_fee_warning
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.broadcast_announcement(
  p_jamiya_id UUID,
  p_title TEXT,
  p_body TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_ann UUID;
  v_count INT := 0;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'UNAUTHENTICATED');
  END IF;
  IF NOT private.is_circle_officer(p_jamiya_id) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'FORBIDDEN');
  END IF;

  INSERT INTO public.announcements (jamiya_id, created_by, title, body)
  VALUES (p_jamiya_id, v_uid, btrim(p_title), btrim(p_body))
  RETURNING id INTO v_ann;

  INSERT INTO public.notifications (user_id, type, channel, title, body, data)
  SELECT
    m.user_id,
    'system',
    'in_app',
    p_title,
    p_body,
    jsonb_build_object('jamiya_id', p_jamiya_id, 'announcement_id', v_ann)
  FROM public.members m
  WHERE m.jamiya_id = p_jamiya_id AND m.status = 'active';

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN jsonb_build_object('ok', true, 'announcement_id', v_ann, 'notified', v_count);
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_set_jamiya_status(
  p_jamiya_id UUID,
  p_status public.jamiya_status
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_old public.jamiya_status;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'UNAUTHENTICATED');
  END IF;
  IF NOT private.is_platform_admin() THEN
    RETURN jsonb_build_object('ok', false, 'error', 'FORBIDDEN');
  END IF;

  SELECT status INTO v_old FROM public.jamiyas WHERE id = p_jamiya_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'NOT_FOUND');
  END IF;

  UPDATE public.jamiyas
  SET status = p_status, updated_at = NOW()
  WHERE id = p_jamiya_id;

  INSERT INTO public.audit_logs (actor_id, action, entity_type, entity_id, jamiya_id, metadata)
  VALUES (
    v_uid,
    'jamiya_status_change',
    'jamiya',
    p_jamiya_id,
    p_jamiya_id,
    jsonb_build_object('from', v_old, 'to', p_status)
  );

  RETURN jsonb_build_object('ok', true, 'status', p_status, 'previous', v_old);
END;
$$;

REVOKE ALL ON FUNCTION public.admin_set_jamiya_status(UUID, public.jamiya_status) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_set_jamiya_status(UUID, public.jamiya_status) TO authenticated;
