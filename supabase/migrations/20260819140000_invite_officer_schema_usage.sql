-- RLS policies call private.is_circle_officer(). EXECUTE alone is not enough:
-- authenticated had no USAGE on schema private, which surfaces as
-- "permission denied for function is_circle_officer" on invitation insert.

GRANT USAGE ON SCHEMA private TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION private.is_circle_officer(UUID) TO authenticated, service_role;

-- Insert invitations as definer so officers can always mint a shareable link/code.
CREATE OR REPLACE FUNCTION public.create_circle_invitation(
  p_jamiya_id UUID,
  p_email TEXT DEFAULT NULL,
  p_phone TEXT DEFAULT NULL,
  p_invitee_user_id UUID DEFAULT NULL,
  p_token_hash TEXT DEFAULT NULL,
  p_invite_code TEXT DEFAULT NULL,
  p_expires_at TIMESTAMPTZ DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_id UUID;
  v_code TEXT;
  v_email TEXT;
  v_phone TEXT;
BEGIN
  v_email := lower(btrim(coalesce(p_email, '')));
  IF v_email = '' THEN
    v_email := NULL;
  END IF;
  v_phone := btrim(coalesce(p_phone, ''));
  IF v_phone = '' THEN
    v_phone := NULL;
  END IF;

  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'UNAUTHENTICATED');
  END IF;

  IF NOT private.is_circle_officer(p_jamiya_id) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'FORBIDDEN');
  END IF;

  IF v_email IS NULL AND v_phone IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'CONTACT_REQUIRED');
  END IF;

  IF p_token_hash IS NULL OR btrim(p_token_hash) = '' OR p_invite_code IS NULL OR btrim(p_invite_code) = '' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'TOKEN_REQUIRED');
  END IF;

  INSERT INTO public.invitations (
    jamiya_id,
    invited_by,
    email,
    phone,
    invitee_user_id,
    token_hash,
    invite_code,
    status,
    expires_at
  )
  VALUES (
    p_jamiya_id,
    v_uid,
    v_email,
    v_phone,
    p_invitee_user_id,
    p_token_hash,
    upper(btrim(p_invite_code)),
    'pending',
    COALESCE(p_expires_at, NOW() + INTERVAL '14 days')
  )
  RETURNING id, invite_code INTO v_id, v_code;

  RETURN jsonb_build_object('ok', true, 'id', v_id, 'invite_code', v_code);
END;
$$;

REVOKE ALL ON FUNCTION public.create_circle_invitation(UUID, TEXT, TEXT, UUID, TEXT, TEXT, TIMESTAMPTZ) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_circle_invitation(UUID, TEXT, TEXT, UUID, TEXT, TEXT, TIMESTAMPTZ) TO authenticated;
