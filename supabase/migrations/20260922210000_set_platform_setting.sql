-- Admin RPC to update platform_settings (e.g. dual_approval_refunds).

CREATE OR REPLACE FUNCTION public.set_platform_setting(
  p_key TEXT,
  p_value JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'UNAUTHENTICATED');
  END IF;
  IF NOT private.is_platform_admin() THEN
    RETURN jsonb_build_object('ok', false, 'error', 'FORBIDDEN');
  END IF;
  IF p_key IS NULL OR length(trim(p_key)) = 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'INVALID_KEY');
  END IF;
  IF p_value IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'INVALID_VALUE');
  END IF;

  INSERT INTO public.platform_settings (key, value)
  VALUES (trim(p_key), p_value)
  ON CONFLICT (key) DO UPDATE
  SET value = EXCLUDED.value;

  INSERT INTO public.audit_logs (actor_id, action, entity_type, entity_id, metadata)
  VALUES (
    auth.uid(),
    'update',
    'platform_setting',
    NULL,
    jsonb_build_object('key', trim(p_key), 'value', p_value)
  );

  RETURN jsonb_build_object('ok', true, 'key', trim(p_key), 'value', p_value);
END;
$$;

REVOKE ALL ON FUNCTION public.set_platform_setting(TEXT, JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_platform_setting(TEXT, JSONB) TO authenticated;
