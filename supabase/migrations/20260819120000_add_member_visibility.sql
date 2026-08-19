-- Officers must see fellow members' names/phones, and invitation delivery
-- must work for chair/treasurer as well as circle_admin.

DROP POLICY IF EXISTS "profiles_select_circle_peers" ON public.profiles;
CREATE POLICY "profiles_select_circle_peers"
  ON public.profiles
  FOR SELECT
  TO authenticated
  USING (
    private.is_platform_admin()
    OR EXISTS (
      SELECT 1
      FROM public.members peer
      WHERE peer.user_id = profiles.id
        AND peer.status IN ('active', 'invited')
        AND private.is_jamiya_member(peer.jamiya_id)
    )
  );

CREATE OR REPLACE FUNCTION public.queue_invitation_delivery(
  p_invitation_id UUID,
  p_invite_url TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_inv public.invitations%ROWTYPE;
  v_name TEXT;
  v_queued INT := 0;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'UNAUTHENTICATED');
  END IF;

  SELECT * INTO v_inv FROM public.invitations WHERE id = p_invitation_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'NOT_FOUND');
  END IF;

  IF NOT private.is_circle_officer(v_inv.jamiya_id) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'FORBIDDEN');
  END IF;

  SELECT name INTO v_name FROM public.jamiyas WHERE id = v_inv.jamiya_id;

  IF v_inv.email IS NOT NULL THEN
    PERFORM private.enqueue_delivery(
      'email',
      v_inv.email,
      'You are invited to join ' || coalesce(v_name, 'a circle'),
      'You have been invited to join ' || coalesce(v_name, 'a savings circle on Amanah') ||
        '. Open this link to accept: ' || p_invite_url,
      v_inv.invitee_user_id,
      NULL,
      jsonb_build_object('invitation_id', v_inv.id, 'kind', 'invitation')
    );
    v_queued := v_queued + 1;
  END IF;

  IF v_inv.phone IS NOT NULL THEN
    PERFORM private.enqueue_delivery(
      'sms',
      v_inv.phone,
      NULL,
      'Amanah invite: join ' || coalesce(v_name, 'a circle') || ' — ' || p_invite_url,
      v_inv.invitee_user_id,
      NULL,
      jsonb_build_object('invitation_id', v_inv.id, 'kind', 'invitation')
    );
    v_queued := v_queued + 1;
  END IF;

  RETURN jsonb_build_object('ok', true, 'queued', v_queued);
END;
$$;

REVOKE ALL ON FUNCTION public.queue_invitation_delivery(UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.queue_invitation_delivery(UUID, TEXT) TO authenticated;
