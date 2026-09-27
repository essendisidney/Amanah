-- Declining a shared chama link must not cancel it for everyone else.
-- A personal invite still closes when that person declines.

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

  IF COALESCE(v_inv.is_share_link, false) THEN
    RETURN jsonb_build_object('ok', true, 'share_link', true);
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
