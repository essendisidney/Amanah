-- One reusable share link per chama. Any active member can send it.
-- Personal invites still need a phone or email and still close after one accept.

ALTER TABLE public.invitations
  ADD COLUMN IF NOT EXISTS is_share_link BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE public.invitations DROP CONSTRAINT IF EXISTS invitations_contact_present;
ALTER TABLE public.invitations
  ADD CONSTRAINT invitations_contact_present
  CHECK (email IS NOT NULL OR phone IS NOT NULL OR is_share_link);

CREATE UNIQUE INDEX IF NOT EXISTS invitations_one_share_link_idx
  ON public.invitations (jamiya_id)
  WHERE is_share_link AND status = 'pending';

CREATE OR REPLACE FUNCTION public.ensure_circle_share_link(p_jamiya_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_code TEXT;
  v_existing TEXT;
  v_hash TEXT;
  attempt INT;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'UNAUTHENTICATED');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.members m
    WHERE m.jamiya_id = p_jamiya_id AND m.user_id = v_uid AND m.status = 'active'
  ) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'FORBIDDEN');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.jamiyas j WHERE j.id = p_jamiya_id) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'NOT_FOUND');
  END IF;

  SELECT inv.invite_code INTO v_existing
  FROM public.invitations inv
  WHERE inv.jamiya_id = p_jamiya_id
    AND inv.is_share_link
    AND inv.status = 'pending'
    AND inv.expires_at > NOW()
  LIMIT 1;

  IF v_existing IS NOT NULL THEN
    RETURN jsonb_build_object('ok', true, 'invite_code', v_existing);
  END IF;

  FOR attempt IN 1..5 LOOP
    v_code := translate(upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8)), '01', '23');
    v_hash := replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '');
    BEGIN
      INSERT INTO public.invitations (
        jamiya_id, invited_by, email, phone, token_hash, invite_code, status, expires_at, is_share_link
      ) VALUES (
        p_jamiya_id, v_uid, NULL, NULL, v_hash, v_code, 'pending', NOW() + INTERVAL '10 years', true
      );
      RETURN jsonb_build_object('ok', true, 'invite_code', v_code);
    EXCEPTION WHEN unique_violation THEN
      NULL;
    END;
  END LOOP;

  SELECT inv.invite_code INTO v_existing
  FROM public.invitations inv
  WHERE inv.jamiya_id = p_jamiya_id AND inv.is_share_link AND inv.status = 'pending'
  LIMIT 1;

  IF v_existing IS NOT NULL THEN
    RETURN jsonb_build_object('ok', true, 'invite_code', v_existing);
  END IF;

  RETURN jsonb_build_object('ok', false, 'error', 'SHARE_LINK_FAILED');
END;
$$;

REVOKE ALL ON FUNCTION public.ensure_circle_share_link(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.ensure_circle_share_link(UUID) TO authenticated;

CREATE OR REPLACE FUNCTION private.accept_invitation(
  p_token_hash TEXT DEFAULT NULL,
  p_invite_code TEXT DEFAULT NULL,
  p_payout_position INTEGER DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_inv public.invitations%ROWTYPE;
  v_jamiya public.jamiyas%ROWTYPE;
  v_profile public.profiles%ROWTYPE;
  v_member_id UUID;
  v_next_position INTEGER;
  v_max_slot INTEGER;
  v_auth_phone TEXT;
  v_bound BOOLEAN := false;
  v_match BOOLEAN := false;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'UNAUTHENTICATED');
  END IF;

  IF (p_token_hash IS NULL OR p_token_hash = '')
     AND (p_invite_code IS NULL OR p_invite_code = '') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'NOT_FOUND');
  END IF;

  SELECT * INTO v_inv
  FROM public.invitations
  WHERE (
    (p_token_hash IS NOT NULL AND p_token_hash <> '' AND token_hash = p_token_hash)
    OR (
      p_invite_code IS NOT NULL AND p_invite_code <> ''
      AND upper(invite_code) = upper(p_invite_code)
    )
  )
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'NOT_FOUND');
  END IF;

  IF v_inv.status <> 'pending' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'NOT_PENDING', 'status', v_inv.status);
  END IF;

  IF v_inv.expires_at < NOW() THEN
    UPDATE public.invitations SET status = 'expired', updated_at = NOW() WHERE id = v_inv.id;
    RETURN jsonb_build_object('ok', false, 'error', 'EXPIRED');
  END IF;

  SELECT * INTO v_profile FROM public.profiles WHERE id = v_uid;
  SELECT phone INTO v_auth_phone FROM auth.users WHERE id = v_uid;
  SELECT * INTO v_jamiya FROM public.jamiyas WHERE id = v_inv.jamiya_id;

  IF v_inv.invitee_user_id IS NOT NULL THEN
    v_bound := true;
    IF v_inv.invitee_user_id = v_uid THEN
      v_match := true;
    END IF;
  END IF;

  IF COALESCE(btrim(v_inv.phone), '') <> '' THEN
    v_bound := true;
    IF private.kenya_phone_digits(v_inv.phone) IS NOT NULL
       AND (
         private.kenya_phone_digits(v_inv.phone) = private.kenya_phone_digits(v_profile.phone)
         OR private.kenya_phone_digits(v_inv.phone) = private.kenya_phone_digits(v_auth_phone)
       ) THEN
      v_match := true;
    END IF;
  END IF;

  IF COALESCE(btrim(v_inv.email), '') <> '' THEN
    v_bound := true;
    IF lower(btrim(v_inv.email)) = lower(COALESCE(v_profile.email, '')) THEN
      v_match := true;
    END IF;
  END IF;

  IF v_bound AND NOT v_match THEN
    RETURN jsonb_build_object('ok', false, 'error', 'WRONG_INVITEE');
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.members
    WHERE jamiya_id = v_inv.jamiya_id AND user_id = v_uid AND status = 'active'
  ) THEN
    IF NOT COALESCE(v_inv.is_share_link, false) THEN
      UPDATE public.invitations
      SET status = 'accepted',
          invitee_user_id = COALESCE(invitee_user_id, v_uid),
          accepted_at = NOW(),
          updated_at = NOW()
      WHERE id = v_inv.id;
    END IF;
    RETURN jsonb_build_object('ok', true, 'already_member', true, 'slug', v_jamiya.slug);
  END IF;

  IF v_jamiya.member_count >= v_jamiya.max_members THEN
    RETURN jsonb_build_object('ok', false, 'error', 'CIRCLE_FULL');
  END IF;

  v_max_slot := GREATEST(
    COALESCE(v_jamiya.cycle_count, v_jamiya.max_members),
    v_jamiya.max_members,
    1
  );

  IF p_payout_position IS NOT NULL THEN
    IF p_payout_position < 1 OR p_payout_position > v_max_slot THEN
      RETURN jsonb_build_object('ok', false, 'error', 'INVALID_SLOT');
    END IF;
    IF EXISTS (
      SELECT 1 FROM public.members
      WHERE jamiya_id = v_inv.jamiya_id
        AND payout_position = p_payout_position
        AND status = 'active'
    ) THEN
      RETURN jsonb_build_object('ok', false, 'error', 'SLOT_TAKEN');
    END IF;
    v_next_position := p_payout_position;
  ELSE
    SELECT COALESCE(MAX(payout_position), 0) + 1
    INTO v_next_position
    FROM public.members
    WHERE jamiya_id = v_inv.jamiya_id;
  END IF;

  INSERT INTO public.members (
    jamiya_id, user_id, role, status, payout_position, joined_at
  )
  VALUES (
    v_inv.jamiya_id, v_uid, 'member', 'active', v_next_position, NOW()
  )
  ON CONFLICT (jamiya_id, user_id) DO UPDATE
  SET
    status = 'active',
    payout_position = COALESCE(EXCLUDED.payout_position, public.members.payout_position),
    joined_at = COALESCE(public.members.joined_at, NOW()),
    left_at = NULL,
    updated_at = NOW()
  RETURNING id INTO v_member_id;

  IF NOT COALESCE(v_inv.is_share_link, false) THEN
    UPDATE public.invitations
    SET
      status = 'accepted',
      invitee_user_id = COALESCE(invitee_user_id, v_uid),
      accepted_at = NOW(),
      updated_at = NOW()
    WHERE id = v_inv.id;
  END IF;

  INSERT INTO public.audit_logs (actor_id, action, entity_type, entity_id, jamiya_id, metadata)
  VALUES (
    v_uid,
    'join',
    'invitation',
    v_inv.id,
    v_inv.jamiya_id,
    jsonb_build_object(
      'member_id', v_member_id,
      'slug', v_jamiya.slug,
      'payout_position', v_next_position,
      'share_link', COALESCE(v_inv.is_share_link, false)
    )
  );

  INSERT INTO public.notifications (user_id, type, channel, title, body, data)
  VALUES (
    v_inv.invited_by,
    'invitation',
    'in_app',
    'Invitation accepted',
    COALESCE(v_profile.full_name, v_profile.email, 'A member') || ' joined ' || v_jamiya.name,
    jsonb_build_object('jamiya_id', v_jamiya.id, 'slug', v_jamiya.slug)
  );

  RETURN jsonb_build_object(
    'ok', true,
    'slug', v_jamiya.slug,
    'jamiya_id', v_jamiya.id,
    'member_id', v_member_id,
    'payout_position', v_next_position
  );
END;
$$;
