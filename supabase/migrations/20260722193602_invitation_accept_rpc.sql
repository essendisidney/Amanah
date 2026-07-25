-- Phase 1.6: Invitation accept/decline RPCs
-- Token hashing is performed in the application (SHA-256 hex). RPCs take token_hash.

CREATE OR REPLACE FUNCTION private.preview_invitation(p_token_hash TEXT)
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
  WHERE i.token_hash = p_token_hash;
END;
$$;

CREATE OR REPLACE FUNCTION private.accept_invitation(p_token_hash TEXT)
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

  SELECT * INTO v_inv
  FROM public.invitations
  WHERE token_hash = p_token_hash
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

CREATE OR REPLACE FUNCTION private.decline_invitation(p_token_hash TEXT)
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

  SELECT * INTO v_inv
  FROM public.invitations
  WHERE token_hash = p_token_hash
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

CREATE OR REPLACE FUNCTION public.preview_invitation(p_token_hash TEXT)
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
  SELECT * FROM private.preview_invitation(p_token_hash);
$$;

CREATE OR REPLACE FUNCTION public.accept_invitation(p_token_hash TEXT)
RETURNS JSONB
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT private.accept_invitation(p_token_hash);
$$;

CREATE OR REPLACE FUNCTION public.decline_invitation(p_token_hash TEXT)
RETURNS JSONB
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT private.decline_invitation(p_token_hash);
$$;

REVOKE ALL ON FUNCTION public.preview_invitation(TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.accept_invitation(TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.decline_invitation(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.preview_invitation(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.accept_invitation(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.decline_invitation(TEXT) TO authenticated;

CREATE POLICY "invitations_select_email_match"
  ON public.invitations
  FOR SELECT
  TO authenticated
  USING (
    email IS NOT NULL
    AND lower(email) = lower((SELECT p.email FROM public.profiles p WHERE p.id = auth.uid()))
  );

-- Auto-move KYC status to pending when a document is uploaded
CREATE OR REPLACE FUNCTION private.on_kyc_document_uploaded()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  UPDATE public.profiles
  SET
    kyc_status = 'pending',
    updated_at = NOW()
  WHERE id = NEW.user_id
    AND kyc_status IN ('not_started', 'rejected');
  RETURN NEW;
END;
$$;

CREATE TRIGGER kyc_documents_set_profile_pending
  AFTER INSERT ON public.kyc_documents
  FOR EACH ROW
  EXECUTE FUNCTION private.on_kyc_document_uploaded();

-- Compliance/admin KYC review (bypasses profiles self-update restrictions)
CREATE OR REPLACE FUNCTION private.review_kyc_document(
  p_document_id UUID,
  p_decision public.kyc_document_status,
  p_reason TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_doc public.kyc_documents%ROWTYPE;
BEGIN
  IF v_uid IS NULL OR NOT private.is_compliance_or_admin() THEN
    RETURN jsonb_build_object('ok', false, 'error', 'FORBIDDEN');
  END IF;

  IF p_decision NOT IN ('approved', 'rejected') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'INVALID_DECISION');
  END IF;

  SELECT * INTO v_doc FROM public.kyc_documents WHERE id = p_document_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'NOT_FOUND');
  END IF;

  UPDATE public.kyc_documents
  SET
    status = p_decision,
    reviewed_by = v_uid,
    reviewed_at = NOW(),
    rejection_reason = CASE WHEN p_decision = 'rejected' THEN COALESCE(p_reason, 'Rejected') ELSE NULL END,
    updated_at = NOW()
  WHERE id = p_document_id;

  UPDATE public.profiles
  SET
    kyc_status = CASE WHEN p_decision = 'approved' THEN 'approved'::public.kyc_status ELSE 'rejected'::public.kyc_status END,
    updated_at = NOW()
  WHERE id = v_doc.user_id;

  INSERT INTO public.notifications (user_id, type, channel, title, body, data)
  VALUES (
    v_doc.user_id,
    'kyc_update',
    'in_app',
    CASE WHEN p_decision = 'approved' THEN 'KYC approved' ELSE 'KYC rejected' END,
    CASE
      WHEN p_decision = 'approved' THEN 'Your identity documents were approved.'
      ELSE 'Your identity documents were rejected' || CASE WHEN p_reason IS NULL OR p_reason = '' THEN '.' ELSE ': ' || p_reason END
    END,
    jsonb_build_object('document_id', p_document_id, 'decision', p_decision)
  );

  INSERT INTO public.audit_logs (actor_id, action, entity_type, entity_id, metadata)
  VALUES (
    v_uid,
    CASE WHEN p_decision = 'approved' THEN 'approve'::public.audit_action ELSE 'reject'::public.audit_action END,
    'kyc_document',
    p_document_id,
    jsonb_build_object('decision', p_decision, 'reason', p_reason)
  );

  RETURN jsonb_build_object('ok', true);
END;
$$;

CREATE OR REPLACE FUNCTION public.review_kyc_document(
  p_document_id UUID,
  p_decision public.kyc_document_status,
  p_reason TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT private.review_kyc_document(p_document_id, p_decision, p_reason);
$$;

REVOKE ALL ON FUNCTION public.review_kyc_document(UUID, public.kyc_document_status, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.review_kyc_document(UUID, public.kyc_document_status, TEXT) TO authenticated;
