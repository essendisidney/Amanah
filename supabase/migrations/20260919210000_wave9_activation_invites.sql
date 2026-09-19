-- Wave 9: activation — Jameiyah invite copy + resend pending invites

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

  IF NOT (private.is_circle_officer(v_inv.jamiya_id) OR private.is_platform_admin()) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'FORBIDDEN');
  END IF;

  IF v_inv.status IS DISTINCT FROM 'pending' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'NOT_PENDING');
  END IF;

  SELECT name INTO v_name FROM public.jamiyas WHERE id = v_inv.jamiya_id;

  IF v_inv.email IS NOT NULL THEN
    PERFORM private.enqueue_delivery(
      'email',
      v_inv.email,
      'You are invited to join ' || coalesce(v_name, 'a circle'),
      'You have been invited to join ' || coalesce(v_name, 'a savings circle on Jameiyah') ||
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
      'Jameiyah invite: join ' || coalesce(v_name, 'a circle') || ' — ' || p_invite_url,
      v_inv.invitee_user_id,
      NULL,
      jsonb_build_object('invitation_id', v_inv.id, 'kind', 'invitation')
    );
    v_queued := v_queued + 1;
  END IF;

  RETURN jsonb_build_object('ok', true, 'queued', v_queued);
END;
$$;

CREATE OR REPLACE FUNCTION public.resend_pending_invitations(
  p_jamiya_id UUID,
  p_base_url TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_row RECORD;
  v_sent INT := 0;
  v_skipped INT := 0;
  v_failed INT := 0;
  v_url TEXT;
  v_result JSONB;
  v_base TEXT;
  v_dedupe TEXT;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'UNAUTHENTICATED');
  END IF;
  IF NOT (private.is_circle_officer(p_jamiya_id) OR private.is_platform_admin()) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'FORBIDDEN');
  END IF;

  v_base := rtrim(coalesce(nullif(trim(p_base_url), ''), 'https://amanah-liart.vercel.app'), '/');

  FOR v_row IN
    SELECT id, invite_code, phone, email, updated_at
    FROM public.invitations
    WHERE jamiya_id = p_jamiya_id
      AND status = 'pending'
      AND expires_at > NOW()
      AND invite_code IS NOT NULL
    ORDER BY created_at
  LOOP
    v_dedupe := 'invite_resend:' || v_row.id::text || ':' || to_char(NOW(), 'YYYY-MM-DD-HH24');
    IF EXISTS (SELECT 1 FROM public.reminder_dedupe WHERE dedupe_key = v_dedupe) THEN
      v_skipped := v_skipped + 1;
      CONTINUE;
    END IF;

    v_url := v_base || '/invitations/' || v_row.invite_code;
    v_result := public.queue_invitation_delivery(v_row.id, v_url);

    IF coalesce((v_result->>'ok')::boolean, false) AND coalesce((v_result->>'queued')::int, 0) > 0 THEN
      INSERT INTO public.reminder_dedupe (dedupe_key) VALUES (v_dedupe)
      ON CONFLICT DO NOTHING;
      UPDATE public.invitations SET updated_at = NOW() WHERE id = v_row.id;
      v_sent := v_sent + 1;
    ELSIF coalesce((v_result->>'ok')::boolean, false) AND coalesce((v_result->>'queued')::int, 0) = 0 THEN
      v_skipped := v_skipped + 1;
    ELSE
      v_failed := v_failed + 1;
    END IF;
  END LOOP;

  RETURN jsonb_build_object(
    'ok', true,
    'sent', v_sent,
    'skipped', v_skipped,
    'failed', v_failed
  );
END;
$$;

REVOKE ALL ON FUNCTION public.queue_invitation_delivery(UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.queue_invitation_delivery(UUID, TEXT) TO authenticated;

REVOKE ALL ON FUNCTION public.resend_pending_invitations(UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.resend_pending_invitations(UUID, TEXT) TO authenticated;
