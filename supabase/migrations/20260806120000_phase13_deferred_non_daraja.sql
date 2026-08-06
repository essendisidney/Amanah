-- Phase 13: non-Daraja deferred items — Sadaka fee policy audit, Tawarruq partner handoff metadata

CREATE TABLE IF NOT EXISTS public.sharia_fee_policy_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES public.charity_campaigns (id) ON DELETE CASCADE,
  actor_id UUID REFERENCES public.profiles (id) ON DELETE SET NULL,
  previous_fee_mode public.fee_mode,
  fee_mode public.fee_mode NOT NULL,
  previous_fee_bps INT,
  fee_bps INT NOT NULL,
  previous_endorsed BOOLEAN,
  sharia_board_endorsed BOOLEAN NOT NULL,
  decision_reference TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS sharia_fee_policy_events_campaign_idx
  ON public.sharia_fee_policy_events (campaign_id, created_at DESC);

ALTER TABLE public.sharia_fee_policy_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "sharia_fee_policy_select_admin" ON public.sharia_fee_policy_events;
CREATE POLICY "sharia_fee_policy_select_admin"
  ON public.sharia_fee_policy_events FOR SELECT TO authenticated
  USING (private.is_compliance_or_admin());

GRANT SELECT ON public.sharia_fee_policy_events TO authenticated;

CREATE OR REPLACE FUNCTION public.set_campaign_fee_policy(
  p_campaign_id UUID,
  p_fee_mode TEXT,
  p_fee_bps INT,
  p_sharia_board_endorsed BOOLEAN,
  p_decision_reference TEXT DEFAULT NULL,
  p_notes TEXT DEFAULT NULL,
  p_status TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_c public.charity_campaigns%ROWTYPE;
  v_mode public.fee_mode;
  v_status public.campaign_status;
  v_event_id UUID;
BEGIN
  IF v_uid IS NULL OR NOT private.is_compliance_or_admin() THEN
    RETURN jsonb_build_object('ok', false, 'error', 'FORBIDDEN');
  END IF;

  IF p_fee_mode NOT IN ('donation_addon', 'donation_deduct') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'INVALID_FEE_MODE');
  END IF;
  IF p_fee_bps IS NULL OR p_fee_bps < 0 OR p_fee_bps > 2000 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'INVALID_FEE_BPS');
  END IF;

  v_mode := p_fee_mode::public.fee_mode;

  SELECT * INTO v_c FROM public.charity_campaigns WHERE id = p_campaign_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'NOT_FOUND');
  END IF;

  IF p_status IS NOT NULL AND nullif(trim(p_status), '') IS NOT NULL THEN
    IF trim(p_status) NOT IN ('draft', 'live', 'paused', 'completed', 'cancelled') THEN
      RETURN jsonb_build_object('ok', false, 'error', 'INVALID_STATUS');
    END IF;
    v_status := trim(p_status)::public.campaign_status;
  ELSE
    v_status := v_c.status;
  END IF;

  INSERT INTO public.sharia_fee_policy_events (
    campaign_id, actor_id,
    previous_fee_mode, fee_mode,
    previous_fee_bps, fee_bps,
    previous_endorsed, sharia_board_endorsed,
    decision_reference, notes
  )
  VALUES (
    p_campaign_id, v_uid,
    v_c.fee_mode, v_mode,
    v_c.fee_bps, p_fee_bps,
    v_c.sharia_board_endorsed, coalesce(p_sharia_board_endorsed, false),
    nullif(trim(coalesce(p_decision_reference, '')), ''),
    nullif(trim(coalesce(p_notes, '')), '')
  )
  RETURNING id INTO v_event_id;

  UPDATE public.charity_campaigns
  SET
    fee_mode = v_mode,
    fee_bps = p_fee_bps,
    sharia_board_endorsed = coalesce(p_sharia_board_endorsed, false),
    status = v_status,
    updated_at = NOW()
  WHERE id = p_campaign_id;

  PERFORM private.write_audit_log(
    'update'::public.audit_action,
    'charity_campaign',
    p_campaign_id,
    NULL,
    jsonb_build_object(
      'event_id', v_event_id,
      'fee_mode', v_mode,
      'fee_bps', p_fee_bps,
      'sharia_board_endorsed', coalesce(p_sharia_board_endorsed, false),
      'status', v_status,
      'decision_reference', nullif(trim(coalesce(p_decision_reference, '')), '')
    )
  );

  RETURN jsonb_build_object(
    'ok', true,
    'event_id', v_event_id,
    'fee_mode', v_mode,
    'fee_bps', p_fee_bps,
    'sharia_board_endorsed', coalesce(p_sharia_board_endorsed, false),
    'status', v_status
  );
END;
$$;

REVOKE ALL ON FUNCTION public.set_campaign_fee_policy(UUID, TEXT, INT, BOOLEAN, TEXT, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_campaign_fee_policy(UUID, TEXT, INT, BOOLEAN, TEXT, TEXT, TEXT) TO authenticated;

-- Partner handoff: queue for Edge worker (live or simulated) instead of baking simulated-only metadata
CREATE OR REPLACE FUNCTION public.submit_tawarruq_to_partner(p_application_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_app public.tawarruq_applications%ROWTYPE;
  v_ref TEXT;
BEGIN
  IF v_uid IS NULL OR NOT private.is_compliance_or_admin() THEN
    RETURN jsonb_build_object('ok', false, 'error', 'FORBIDDEN');
  END IF;

  SELECT * INTO v_app FROM public.tawarruq_applications WHERE id = p_application_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'NOT_FOUND');
  END IF;
  IF v_app.status <> 'requested' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'NOT_REQUESTED');
  END IF;

  v_ref := coalesce(
    nullif(trim(coalesce(v_app.partner_reference, '')), ''),
    'PTR-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 10))
  );

  UPDATE public.tawarruq_applications
  SET
    status = 'submitted_to_partner',
    partner_reference = v_ref,
    partner_status = 'queued',
    metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object(
      'submitted_by', v_uid,
      'submitted_at', NOW(),
      'handoff', 'partner_api_queued'
    ),
    updated_at = NOW()
  WHERE id = p_application_id;

  RETURN jsonb_build_object('ok', true, 'partner_reference', v_ref, 'status', 'submitted_to_partner');
END;
$$;

REVOKE ALL ON FUNCTION public.submit_tawarruq_to_partner(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.submit_tawarruq_to_partner(UUID) TO authenticated;
