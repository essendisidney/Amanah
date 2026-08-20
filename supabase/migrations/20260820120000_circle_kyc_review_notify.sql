-- Notify circle KYC uploader when compliance reviews their document.

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
  v_circle_name TEXT;
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

  SELECT name INTO v_circle_name FROM public.jamiyas WHERE id = v_doc.jamiya_id;

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

  IF p_status IN ('approved', 'rejected') AND v_doc.uploaded_by IS NOT NULL THEN
    INSERT INTO public.notifications (user_id, type, channel, title, body, data)
    VALUES (
      v_doc.uploaded_by,
      'kyc_update',
      'in_app',
      CASE
        WHEN p_status = 'approved' THEN 'Circle KYC approved'
        ELSE 'Circle KYC rejected'
      END,
      CASE
        WHEN p_status = 'approved' THEN
          'Registration documents for ' || COALESCE(v_circle_name, 'your circle') || ' were approved.'
        ELSE
          'Registration documents for ' || COALESCE(v_circle_name, 'your circle') || ' were rejected'
          || CASE
            WHEN p_notes IS NULL OR btrim(p_notes) = '' THEN '.'
            ELSE ': ' || p_notes
          END
      END,
      jsonb_build_object(
        'document_id', p_document_id,
        'jamiya_id', v_doc.jamiya_id,
        'status', p_status
      )
    );
  END IF;

  INSERT INTO public.audit_logs (actor_id, action, entity_type, entity_id, jamiya_id, metadata)
  VALUES (
    v_uid,
    CASE
      WHEN p_status = 'approved' THEN 'approve'::public.audit_action
      WHEN p_status = 'rejected' THEN 'reject'::public.audit_action
      ELSE 'update'::public.audit_action
    END,
    'jamiya_kyc_document',
    p_document_id,
    v_doc.jamiya_id,
    jsonb_build_object('status', p_status, 'notes', p_notes)
  );

  RETURN jsonb_build_object('ok', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.review_jamiya_kyc_document(UUID, TEXT, TEXT) TO authenticated;
