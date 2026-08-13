-- Trust & chama ops polish: arrears aging, auto-fine schedules, reminder cooldown.

ALTER TABLE public.jamiyas
  ADD COLUMN IF NOT EXISTS auto_fine_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS auto_fine_grace_days INT NOT NULL DEFAULT 3
    CHECK (auto_fine_grace_days >= 0 AND auto_fine_grace_days <= 90);

-- ---------------------------------------------------------------------------
-- Reminder cooldown (skip invoices reminded in last 24h)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.remind_contribution_invoices(p_jamiya_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_count INT := 0;
  v_skipped INT := 0;
  v_sms INT := 0;
  v_wa INT := 0;
  v_row RECORD;
  v_phone TEXT;
  v_title TEXT;
  v_body TEXT;
  v_circle TEXT;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'UNAUTHENTICATED');
  END IF;
  IF NOT (private.is_circle_officer(p_jamiya_id) OR private.is_platform_admin()) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'FORBIDDEN');
  END IF;

  SELECT name INTO v_circle FROM public.jamiyas WHERE id = p_jamiya_id;

  FOR v_row IN
    SELECT i.*, p.phone AS profile_phone, p.mpesa_phone
    FROM public.circle_contribution_invoices i
    LEFT JOIN public.profiles p ON p.id = i.user_id
    WHERE i.jamiya_id = p_jamiya_id AND i.status = 'open'
    ORDER BY i.due_date NULLS LAST
  LOOP
    IF v_row.reminded_at IS NOT NULL AND v_row.reminded_at > NOW() - INTERVAL '24 hours' THEN
      v_skipped := v_skipped + 1;
      CONTINUE;
    END IF;

    v_title := 'Reminder: ' || v_row.invoice_number;
    v_body := format(
      'Amanah · %s — please pay invoice %s (%s %s)%s. Open the app to pay.',
      coalesce(v_circle, 'your circle'),
      v_row.invoice_number,
      v_row.currency,
      v_row.amount_due::text,
      CASE WHEN v_row.due_date IS NOT NULL THEN ' due ' || v_row.due_date::text ELSE '' END
    );

    INSERT INTO public.notifications (user_id, type, channel, title, body, data)
    VALUES (
      v_row.user_id,
      'contribution_due'::public.notification_type,
      'in_app'::public.notification_channel,
      v_title,
      v_body,
      jsonb_build_object(
        'jamiya_id', p_jamiya_id,
        'contribution_id', v_row.contribution_id,
        'invoice_number', v_row.invoice_number,
        'reminder', true
      )
    );

    v_phone := nullif(trim(coalesce(v_row.mpesa_phone, v_row.profile_phone, '')), '');
    IF v_phone IS NOT NULL THEN
      PERFORM private.enqueue_delivery(
        'sms'::public.notification_channel, v_phone, v_title, v_body, v_row.user_id, NULL,
        jsonb_build_object('jamiya_id', p_jamiya_id, 'invoice_number', v_row.invoice_number, 'kind', 'invoice_reminder')
      );
      v_sms := v_sms + 1;
      PERFORM private.enqueue_delivery(
        'whatsapp'::public.notification_channel, v_phone, v_title, v_body, v_row.user_id, NULL,
        jsonb_build_object('jamiya_id', p_jamiya_id, 'invoice_number', v_row.invoice_number, 'kind', 'invoice_reminder')
      );
      v_wa := v_wa + 1;
    END IF;

    UPDATE public.circle_contribution_invoices
    SET reminded_at = NOW()
    WHERE id = v_row.id;

    v_count := v_count + 1;
  END LOOP;

  RETURN jsonb_build_object(
    'ok', true,
    'reminded', v_count,
    'skipped_cooldown', v_skipped,
    'sms_queued', v_sms,
    'whatsapp_queued', v_wa
  );
END;
$$;

-- ---------------------------------------------------------------------------
-- Arrears aging pack
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.circle_arrears_aging(p_jamiya_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_buckets JSONB;
  v_members JSONB;
  v_currency TEXT;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'UNAUTHENTICATED');
  END IF;
  IF NOT (
    private.is_circle_officer(p_jamiya_id)
    OR private.is_platform_admin()
    OR private.is_jamiya_member(p_jamiya_id)
  ) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'FORBIDDEN');
  END IF;

  SELECT currency INTO v_currency FROM public.jamiyas WHERE id = p_jamiya_id;

  SELECT jsonb_build_object(
    'current', coalesce(SUM(CASE WHEN days_overdue <= 0 THEN outstanding ELSE 0 END), 0),
    'd1_7', coalesce(SUM(CASE WHEN days_overdue BETWEEN 1 AND 7 THEN outstanding ELSE 0 END), 0),
    'd8_30', coalesce(SUM(CASE WHEN days_overdue BETWEEN 8 AND 30 THEN outstanding ELSE 0 END), 0),
    'd31_60', coalesce(SUM(CASE WHEN days_overdue BETWEEN 31 AND 60 THEN outstanding ELSE 0 END), 0),
    'd61_plus', coalesce(SUM(CASE WHEN days_overdue >= 61 THEN outstanding ELSE 0 END), 0),
    'total', coalesce(SUM(outstanding), 0)
  )
  INTO v_buckets
  FROM (
    SELECT
      GREATEST(amount - coalesce(amount_paid, 0), 0) AS outstanding,
      GREATEST((CURRENT_DATE - due_date), 0) AS days_overdue
    FROM public.contributions
    WHERE jamiya_id = p_jamiya_id
      AND status IN ('pending', 'late', 'partial')
      AND GREATEST(amount - coalesce(amount_paid, 0), 0) > 0
  ) x;

  SELECT coalesce(jsonb_agg(row_to_json(t)::jsonb ORDER BY t.days_overdue DESC), '[]'::jsonb)
  INTO v_members
  FROM (
    SELECT
      c.member_id,
      m.member_code,
      m.user_id,
      SUM(GREATEST(c.amount - coalesce(c.amount_paid, 0), 0)) AS outstanding,
      MAX(GREATEST((CURRENT_DATE - c.due_date), 0)) AS days_overdue,
      COUNT(*)::int AS open_items
    FROM public.contributions c
    JOIN public.members m ON m.id = c.member_id
    WHERE c.jamiya_id = p_jamiya_id
      AND c.status IN ('pending', 'late', 'partial')
      AND GREATEST(c.amount - coalesce(c.amount_paid, 0), 0) > 0
    GROUP BY c.member_id, m.member_code, m.user_id
    ORDER BY MAX(GREATEST((CURRENT_DATE - c.due_date), 0)) DESC
    LIMIT 80
  ) t;

  RETURN jsonb_build_object(
    'ok', true,
    'currency', coalesce(v_currency, 'KES'),
    'buckets', v_buckets,
    'members', v_members
  );
END;
$$;

REVOKE ALL ON FUNCTION public.circle_arrears_aging(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.circle_arrears_aging(UUID) TO authenticated;

-- ---------------------------------------------------------------------------
-- Auto-fine schedule settings + runner
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.set_circle_auto_fine(
  p_jamiya_id UUID,
  p_enabled BOOLEAN,
  p_grace_days INT DEFAULT 3
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
  IF NOT (private.is_circle_officer(p_jamiya_id) OR private.is_platform_admin()) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'FORBIDDEN');
  END IF;
  IF p_grace_days IS NULL OR p_grace_days < 0 OR p_grace_days > 90 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'INVALID_GRACE_DAYS');
  END IF;

  UPDATE public.jamiyas
  SET
    auto_fine_enabled = coalesce(p_enabled, false),
    auto_fine_grace_days = p_grace_days,
    updated_at = NOW()
  WHERE id = p_jamiya_id;

  RETURN jsonb_build_object(
    'ok', true,
    'enabled', coalesce(p_enabled, false),
    'grace_days', p_grace_days
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.run_auto_fines(p_jamiya_id UUID DEFAULT NULL)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_role TEXT := coalesce(auth.role(), '');
  v_j RECORD;
  v_assessed INT := 0;
  v_circles INT := 0;
  v_result JSONB;
BEGIN
  IF v_role <> 'service_role' THEN
    IF v_uid IS NULL THEN
      RETURN jsonb_build_object('ok', false, 'error', 'UNAUTHENTICATED');
    END IF;
    IF p_jamiya_id IS NULL THEN
      RETURN jsonb_build_object('ok', false, 'error', 'JAMIYA_REQUIRED');
    END IF;
    IF NOT (private.is_circle_officer(p_jamiya_id) OR private.is_platform_admin()) THEN
      RETURN jsonb_build_object('ok', false, 'error', 'FORBIDDEN');
    END IF;
  END IF;

  FOR v_j IN
    SELECT id, auto_fine_grace_days
    FROM public.jamiyas
    WHERE auto_fine_enabled = TRUE
      AND (p_jamiya_id IS NULL OR id = p_jamiya_id)
  LOOP
    -- Mark late after grace, then assess contribution penalties
    UPDATE public.contributions
    SET status = 'late', updated_at = NOW()
    WHERE jamiya_id = v_j.id
      AND status IN ('pending', 'partial')
      AND due_date IS NOT NULL
      AND due_date < (CURRENT_DATE - v_j.auto_fine_grace_days);

    v_result := public.assess_contribution_penalties(v_j.id);
    v_assessed := v_assessed + coalesce((v_result->>'assessed')::int, 0);
    v_circles := v_circles + 1;
  END LOOP;

  RETURN jsonb_build_object(
    'ok', true,
    'circles', v_circles,
    'assessed', v_assessed
  );
END;
$$;

REVOKE ALL ON FUNCTION public.set_circle_auto_fine(UUID, BOOLEAN, INT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.run_auto_fines(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_circle_auto_fine(UUID, BOOLEAN, INT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.run_auto_fines(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.run_auto_fines(UUID) TO service_role;

-- Officers can read their circle's audit trail (dual approval / treasury).
DROP POLICY IF EXISTS audit_logs_select_officer ON public.audit_logs;
CREATE POLICY audit_logs_select_officer
  ON public.audit_logs FOR SELECT TO authenticated
  USING (
    jamiya_id IS NOT NULL
    AND private.is_circle_officer(jamiya_id)
  );

-- Require a decision reference when endorsing Sadaka fee policy (board sign-off).
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

  IF coalesce(p_sharia_board_endorsed, false)
     AND nullif(trim(coalesce(p_decision_reference, '')), '') IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'DECISION_REFERENCE_REQUIRED');
  END IF;

  v_mode := p_fee_mode::public.fee_mode;

  SELECT * INTO v_c FROM public.charity_campaigns WHERE id = p_campaign_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'NOT_FOUND');
  END IF;

  IF p_status IS NOT NULL AND nullif(trim(p_status), '') IS NOT NULL THEN
    IF trim(p_status) NOT IN (
      'draft', 'pending_review', 'live', 'paused', 'completed', 'cancelled',
      'rejected', 'funded', 'disbursed', 'closed'
    ) THEN
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
  ) VALUES (
    p_campaign_id, v_uid,
    v_c.fee_mode, v_mode,
    v_c.fee_bps, p_fee_bps,
    v_c.sharia_board_endorsed, p_sharia_board_endorsed,
    nullif(trim(COALESCE(p_decision_reference, '')), ''),
    nullif(trim(COALESCE(p_notes, '')), '')
  )
  RETURNING id INTO v_event_id;

  UPDATE public.charity_campaigns
  SET fee_mode = v_mode,
      fee_bps = p_fee_bps,
      sharia_board_endorsed = p_sharia_board_endorsed,
      status = v_status,
      updated_at = NOW()
  WHERE id = p_campaign_id;

  RETURN jsonb_build_object('ok', true, 'event_id', v_event_id);
END;
$$;
