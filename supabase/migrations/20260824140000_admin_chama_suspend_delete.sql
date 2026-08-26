-- Admin chama: add suspended status + reliable set/delete RPCs.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum e
    JOIN pg_type t ON e.enumtypid = t.oid
    WHERE t.typname = 'jamiya_status' AND e.enumlabel = 'suspended'
  ) THEN
    ALTER TYPE public.jamiya_status ADD VALUE 'suspended';
  END IF;
END $$;

DROP FUNCTION IF EXISTS public.admin_set_jamiya_status(UUID, public.jamiya_status);
DROP FUNCTION IF EXISTS public.admin_set_jamiya_status(UUID, TEXT);

CREATE OR REPLACE FUNCTION public.admin_set_jamiya_status(
  p_jamiya_id UUID,
  p_status TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_old public.jamiya_status;
  v_new public.jamiya_status;
  v_status TEXT := lower(trim(coalesce(p_status, '')));
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'UNAUTHENTICATED');
  END IF;
  IF NOT private.is_platform_admin() THEN
    RETURN jsonb_build_object('ok', false, 'error', 'FORBIDDEN');
  END IF;

  IF v_status NOT IN (
    'draft', 'open', 'active', 'paused', 'suspended', 'completed', 'cancelled'
  ) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'INVALID_STATUS');
  END IF;

  v_new := v_status::public.jamiya_status;

  SELECT status INTO v_old FROM public.jamiyas WHERE id = p_jamiya_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'NOT_FOUND');
  END IF;

  IF v_old = v_new THEN
    RETURN jsonb_build_object('ok', true, 'status', v_new, 'previous', v_old, 'unchanged', true);
  END IF;

  UPDATE public.jamiyas
  SET status = v_new, updated_at = NOW()
  WHERE id = p_jamiya_id;

  INSERT INTO public.audit_logs (actor_id, action, entity_type, entity_id, jamiya_id, metadata)
  VALUES (
    v_uid,
    'jamiya_status_change',
    'jamiya',
    p_jamiya_id,
    p_jamiya_id,
    jsonb_build_object('from', v_old, 'to', v_new)
  );

  RETURN jsonb_build_object('ok', true, 'status', v_new, 'previous', v_old);
END;
$$;

REVOKE ALL ON FUNCTION public.admin_set_jamiya_status(UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_set_jamiya_status(UUID, TEXT) TO authenticated;

DROP FUNCTION IF EXISTS public.admin_delete_jamiya(UUID);

CREATE OR REPLACE FUNCTION public.admin_delete_jamiya(p_jamiya_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_row public.jamiyas%ROWTYPE;
  v_active_members INT := 0;
  v_paid_activity INT := 0;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'UNAUTHENTICATED');
  END IF;
  IF NOT private.is_platform_admin() THEN
    RETURN jsonb_build_object('ok', false, 'error', 'FORBIDDEN');
  END IF;

  SELECT * INTO v_row FROM public.jamiyas WHERE id = p_jamiya_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'NOT_FOUND');
  END IF;

  SELECT count(*)::INT INTO v_active_members
  FROM public.members
  WHERE jamiya_id = p_jamiya_id AND status = 'active';

  SELECT count(*)::INT INTO v_paid_activity
  FROM public.contributions
  WHERE jamiya_id = p_jamiya_id
    AND status IN ('paid', 'partial', 'late');

  IF v_row.status IN ('active', 'paused', 'open', 'completed')
     AND (v_active_members > 0 OR v_paid_activity > 0) THEN
    RETURN jsonb_build_object(
      'ok', false,
      'error', 'CANCEL_FIRST',
      'message', 'Cancel or suspend the chama first, then delete. Live circles with members or payments cannot be deleted directly.'
    );
  END IF;

  INSERT INTO public.audit_logs (actor_id, action, entity_type, entity_id, jamiya_id, metadata)
  VALUES (
    v_uid,
    'jamiya_delete',
    'jamiya',
    p_jamiya_id,
    p_jamiya_id,
    jsonb_build_object(
      'name', v_row.name,
      'slug', v_row.slug,
      'status', v_row.status,
      'active_members', v_active_members,
      'paid_activity', v_paid_activity
    )
  );

  DELETE FROM public.jamiyas WHERE id = p_jamiya_id;

  RETURN jsonb_build_object('ok', true, 'deleted', true, 'name', v_row.name);
EXCEPTION
  WHEN foreign_key_violation THEN
    RETURN jsonb_build_object(
      'ok', false,
      'error', 'HAS_DEPENDENCIES',
      'message', 'This chama still has linked records that block delete. Cancel or suspend it, then try again.'
    );
END;
$$;

REVOKE ALL ON FUNCTION public.admin_delete_jamiya(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_delete_jamiya(UUID) TO authenticated;
