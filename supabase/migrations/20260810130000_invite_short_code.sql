-- Short invite codes for WhatsApp / SMS / in-app paste (alongside full token URLs).

ALTER TABLE public.invitations
  ADD COLUMN IF NOT EXISTS invite_code TEXT;

UPDATE public.invitations
SET invite_code = upper(substr(replace(replace(id::text, '-', ''), '0', '2'), 1, 8))
WHERE invite_code IS NULL;

ALTER TABLE public.invitations
  ALTER COLUMN invite_code SET NOT NULL;

ALTER TABLE public.invitations
  ALTER COLUMN invite_code SET DEFAULT upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));

CREATE UNIQUE INDEX IF NOT EXISTS invitations_invite_code_unique_idx
  ON public.invitations (upper(invite_code));

-- Drop old single-arg wrappers/impls before creating two-arg versions.
DROP FUNCTION IF EXISTS public.preview_invitation(TEXT);
DROP FUNCTION IF EXISTS public.accept_invitation(TEXT);
DROP FUNCTION IF EXISTS public.decline_invitation(TEXT);
DROP FUNCTION IF EXISTS private.preview_invitation(TEXT);
DROP FUNCTION IF EXISTS private.accept_invitation(TEXT);
DROP FUNCTION IF EXISTS private.decline_invitation(TEXT);

CREATE OR REPLACE FUNCTION private.preview_invitation(
  p_token_hash TEXT DEFAULT NULL,
  p_invite_code TEXT DEFAULT NULL
)
RETURNS TABLE (
  invitation_id UUID,
  jamiya_id UUID,
  jamiya_name TEXT,
  jamiya_slug TEXT,
  status public.invitation_status,
  email TEXT,
  phone TEXT,
  expires_at TIMESTAMPTZ,
  invited_by_name TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF (p_token_hash IS NULL OR p_token_hash = '')
     AND (p_invite_code IS NULL OR p_invite_code = '') THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    i.id,
    i.jamiya_id,
    j.name,
    j.slug,
    i.status,
    i.email,
    i.phone,
    i.expires_at,
    p.full_name
  FROM public.invitations i
  JOIN public.jamiyas j ON j.id = i.jamiya_id
  JOIN public.profiles p ON p.id = i.invited_by
  WHERE (
    (p_token_hash IS NOT NULL AND p_token_hash <> '' AND i.token_hash = p_token_hash)
    OR (
      p_invite_code IS NOT NULL AND p_invite_code <> ''
      AND upper(i.invite_code) = upper(p_invite_code)
    )
  );
END;
$$;

CREATE OR REPLACE FUNCTION private.accept_invitation(
  p_token_hash TEXT DEFAULT NULL,
  p_invite_code TEXT DEFAULT NULL
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
  SELECT * INTO v_jamiya FROM public.jamiyas WHERE id = v_inv.jamiya_id;

  IF v_jamiya.member_count >= v_jamiya.max_members THEN
    RETURN jsonb_build_object('ok', false, 'error', 'CIRCLE_FULL');
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.members
    WHERE jamiya_id = v_inv.jamiya_id AND user_id = v_uid AND status = 'active'
  ) THEN
    UPDATE public.invitations
    SET status = 'accepted', invitee_user_id = v_uid, accepted_at = NOW(), updated_at = NOW()
    WHERE id = v_inv.id;
    RETURN jsonb_build_object('ok', true, 'already_member', true, 'slug', v_jamiya.slug);
  END IF;

  SELECT COALESCE(MAX(payout_position), 0) + 1
  INTO v_next_position
  FROM public.members
  WHERE jamiya_id = v_inv.jamiya_id;

  INSERT INTO public.members (
    jamiya_id, user_id, role, status, payout_position, joined_at
  )
  VALUES (
    v_inv.jamiya_id, v_uid, 'member', 'active', v_next_position, NOW()
  )
  ON CONFLICT (jamiya_id, user_id) DO UPDATE
  SET
    status = 'active',
    joined_at = COALESCE(public.members.joined_at, NOW()),
    left_at = NULL,
    updated_at = NOW()
  RETURNING id INTO v_member_id;

  UPDATE public.invitations
  SET
    status = 'accepted',
    invitee_user_id = v_uid,
    accepted_at = NOW(),
    updated_at = NOW()
  WHERE id = v_inv.id;

  INSERT INTO public.audit_logs (actor_id, action, entity_type, entity_id, jamiya_id, metadata)
  VALUES (
    v_uid,
    'join',
    'invitation',
    v_inv.id,
    v_inv.jamiya_id,
    jsonb_build_object('member_id', v_member_id, 'slug', v_jamiya.slug)
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
    'member_id', v_member_id
  );
END;
$$;

CREATE OR REPLACE FUNCTION private.decline_invitation(
  p_token_hash TEXT DEFAULT NULL,
  p_invite_code TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_inv public.invitations%ROWTYPE;
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
    RETURN jsonb_build_object('ok', false, 'error', 'NOT_PENDING');
  END IF;

  UPDATE public.invitations
  SET
    status = 'declined',
    invitee_user_id = COALESCE(invitee_user_id, v_uid),
    updated_at = NOW()
  WHERE id = v_inv.id;

  INSERT INTO public.audit_logs (actor_id, action, entity_type, entity_id, jamiya_id, metadata)
  VALUES (v_uid, 'reject', 'invitation', v_inv.id, v_inv.jamiya_id, '{}'::jsonb);

  RETURN jsonb_build_object('ok', true);
END;
$$;

CREATE OR REPLACE FUNCTION public.preview_invitation(
  p_token_hash TEXT DEFAULT NULL,
  p_invite_code TEXT DEFAULT NULL
)
RETURNS TABLE (
  invitation_id UUID,
  jamiya_id UUID,
  jamiya_name TEXT,
  jamiya_slug TEXT,
  status public.invitation_status,
  email TEXT,
  phone TEXT,
  expires_at TIMESTAMPTZ,
  invited_by_name TEXT
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT * FROM private.preview_invitation(p_token_hash, p_invite_code);
$$;

CREATE OR REPLACE FUNCTION public.accept_invitation(
  p_token_hash TEXT DEFAULT NULL,
  p_invite_code TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT private.accept_invitation(p_token_hash, p_invite_code);
$$;

CREATE OR REPLACE FUNCTION public.decline_invitation(
  p_token_hash TEXT DEFAULT NULL,
  p_invite_code TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT private.decline_invitation(p_token_hash, p_invite_code);
$$;

REVOKE ALL ON FUNCTION public.preview_invitation(TEXT, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.accept_invitation(TEXT, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.decline_invitation(TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.preview_invitation(TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.accept_invitation(TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.decline_invitation(TEXT, TEXT) TO authenticated;
