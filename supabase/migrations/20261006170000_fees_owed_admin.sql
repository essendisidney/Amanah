-- Admin tools for fees_owed: see what members owe, try collecting now, or waive a fee.
-- All three are admin-only (platform_admin / super_admin, or the service role) and
-- write to audit_logs.

ALTER TABLE public.fees_owed
  ADD COLUMN IF NOT EXISTS waived_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS waived_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS waive_reason TEXT;

-- ---------------------------------------------------------------------------
-- Overview: KES totals plus the rows for one status ('owed', 'collected', 'waived', 'all')
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_fees_owed_overview(
  p_status TEXT DEFAULT 'owed',
  p_limit INT DEFAULT 100
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  v_summary JSONB;
  v_rows JSONB;
BEGIN
  IF coalesce(auth.role(), '') <> 'service_role' AND NOT private.is_platform_admin() THEN
    RETURN jsonb_build_object('ok', false, 'error', 'FORBIDDEN');
  END IF;

  IF p_status NOT IN ('owed', 'collected', 'waived', 'all') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'INVALID_STATUS');
  END IF;

  SELECT jsonb_build_object(
    'owed_count', count(*) FILTER (WHERE status = 'owed'),
    'owed_total', coalesce(sum(amount) FILTER (WHERE status = 'owed'), 0),
    'owed_members', count(DISTINCT user_id) FILTER (WHERE status = 'owed'),
    'collected_30d_total', coalesce(sum(amount) FILTER (
      WHERE status = 'collected' AND collected_at >= NOW() - INTERVAL '30 days'), 0),
    'waived_total', coalesce(sum(amount) FILTER (WHERE status = 'waived'), 0),
    'oldest_owed_at', min(created_at) FILTER (WHERE status = 'owed')
  )
  INTO v_summary
  FROM public.fees_owed
  WHERE currency = 'KES';

  SELECT coalesce(jsonb_agg(r ORDER BY r.created_at), '[]'::jsonb)
  INTO v_rows
  FROM (
    SELECT
      f.id,
      f.user_id,
      p.full_name,
      p.phone,
      j.name AS jamiya_name,
      c.cycle_number,
      f.amount,
      f.currency,
      f.status,
      f.created_at,
      f.collected_at,
      f.waived_at,
      f.waive_reason
    FROM public.fees_owed f
    LEFT JOIN public.profiles p ON p.id = f.user_id
    LEFT JOIN public.jamiyas j ON j.id = f.jamiya_id
    LEFT JOIN public.contributions c ON c.id = f.contribution_id
    WHERE p_status = 'all' OR f.status = p_status
    ORDER BY f.created_at
    LIMIT greatest(least(coalesce(p_limit, 100), 500), 1)
  ) r;

  RETURN jsonb_build_object('ok', true, 'summary', v_summary, 'rows', v_rows);
END;
$$;

-- ---------------------------------------------------------------------------
-- Collect now: take whatever the member's spendable balance covers
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_collect_fees_owed(p_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  v_currency CHAR(3);
  v_collected INT := 0;
  v_left INT;
BEGIN
  IF coalesce(auth.role(), '') <> 'service_role' AND NOT private.is_platform_admin() THEN
    RETURN jsonb_build_object('ok', false, 'error', 'FORBIDDEN');
  END IF;

  FOR v_currency IN
    SELECT DISTINCT currency FROM public.fees_owed
    WHERE user_id = p_user_id AND status = 'owed'
  LOOP
    v_collected := v_collected + private.collect_fees_owed(p_user_id, v_currency);
  END LOOP;

  SELECT count(*) INTO v_left
  FROM public.fees_owed
  WHERE user_id = p_user_id AND status = 'owed';

  INSERT INTO public.audit_logs (actor_id, action, entity_type, entity_id, metadata)
  VALUES (
    auth.uid(), 'update', 'fees_owed', p_user_id,
    jsonb_build_object('event', 'finance.fees_owed_collect', 'collected', v_collected, 'still_owed', v_left)
  );

  RETURN jsonb_build_object('ok', true, 'collected', v_collected, 'still_owed', v_left);
END;
$$;

-- ---------------------------------------------------------------------------
-- Waive: an admin forgives one owed fee, with a reason the member is told
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_waive_fee_owed(p_fee_id UUID, p_reason TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  v_fee public.fees_owed%ROWTYPE;
  v_reason TEXT := nullif(btrim(coalesce(p_reason, '')), '');
  v_circle TEXT;
BEGIN
  IF coalesce(auth.role(), '') <> 'service_role' AND NOT private.is_platform_admin() THEN
    RETURN jsonb_build_object('ok', false, 'error', 'FORBIDDEN');
  END IF;

  IF v_reason IS NULL OR char_length(v_reason) < 3 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'REASON_REQUIRED');
  END IF;

  SELECT * INTO v_fee FROM public.fees_owed WHERE id = p_fee_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'NOT_FOUND');
  END IF;

  IF v_fee.status = 'waived' THEN
    RETURN jsonb_build_object('ok', true, 'idempotent', true);
  END IF;
  IF v_fee.status <> 'owed' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'NOT_OWED', 'status', v_fee.status);
  END IF;

  UPDATE public.fees_owed
  SET
    status = 'waived',
    waived_by = auth.uid(),
    waived_at = NOW(),
    waive_reason = left(v_reason, 500),
    updated_at = NOW()
  WHERE id = v_fee.id;

  INSERT INTO public.audit_logs (actor_id, action, entity_type, entity_id, jamiya_id, metadata)
  VALUES (
    auth.uid(), 'update', 'fees_owed', v_fee.id, v_fee.jamiya_id,
    jsonb_build_object(
      'event', 'finance.fee_waived',
      'user_id', v_fee.user_id,
      'amount', v_fee.amount,
      'currency', v_fee.currency,
      'reason', left(v_reason, 500)
    )
  );

  SELECT name INTO v_circle FROM public.jamiyas WHERE id = v_fee.jamiya_id;

  INSERT INTO public.notifications (user_id, type, channel, title, body, data)
  VALUES (
    v_fee.user_id,
    'system',
    'in_app',
    'Circle fee waived',
    'Your ' || v_fee.amount::text || ' ' || v_fee.currency || ' fee'
      || coalesce(' for ' || v_circle, '') || ' has been waived. Nothing more is owed.',
    jsonb_build_object('kind', 'contribution_fee_waived', 'fees_owed_id', v_fee.id)
  );

  RETURN jsonb_build_object('ok', true, 'fee_id', v_fee.id);
END;
$$;

REVOKE ALL ON FUNCTION public.admin_fees_owed_overview(TEXT, INT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_collect_fees_owed(UUID) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_waive_fee_owed(UUID, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_fees_owed_overview(TEXT, INT) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.admin_collect_fees_owed(UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.admin_waive_fee_owed(UUID, TEXT) TO authenticated, service_role;
