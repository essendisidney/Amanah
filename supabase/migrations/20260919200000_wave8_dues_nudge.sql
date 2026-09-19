-- Wave 8: dues conversion — nudge current period only (not all future cycles)

CREATE OR REPLACE FUNCTION public.issue_contribution_invoices(
  p_jamiya_id UUID,
  p_due_within_days INT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_slug TEXT;
  v_count INT := 0;
  v_row RECORD;
  v_due NUMERIC;
  v_num TEXT;
  v_seq INT;
  v_cutoff DATE;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'UNAUTHENTICATED');
  END IF;
  IF NOT (private.is_circle_officer(p_jamiya_id) OR private.is_platform_admin()) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'FORBIDDEN');
  END IF;

  SELECT slug INTO v_slug FROM public.jamiyas WHERE id = p_jamiya_id;
  IF v_slug IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'NOT_FOUND');
  END IF;

  IF p_due_within_days IS NOT NULL THEN
    v_cutoff := CURRENT_DATE + GREATEST(p_due_within_days, 0);
  END IF;

  SELECT COALESCE(count(*), 0)::int INTO v_seq
  FROM public.circle_contribution_invoices WHERE jamiya_id = p_jamiya_id;

  FOR v_row IN
    SELECT c.*, m.user_id AS member_user_id
    FROM public.contributions c
    JOIN public.members m ON m.id = c.member_id
    WHERE c.jamiya_id = p_jamiya_id
      AND c.status IN ('pending', 'late', 'partial')
      AND (v_cutoff IS NULL OR c.due_date IS NULL OR c.due_date <= v_cutoff)
      AND NOT EXISTS (
        SELECT 1 FROM public.circle_contribution_invoices i
        WHERE i.contribution_id = c.id AND i.status IN ('open', 'paid')
      )
    ORDER BY c.due_date NULLS LAST, c.created_at
  LOOP
    v_due := GREATEST(v_row.amount - COALESCE(v_row.amount_paid, 0), 0);
    IF v_due <= 0 THEN
      CONTINUE;
    END IF;
    v_seq := v_seq + 1;
    v_num := 'INV-' || upper(left(regexp_replace(v_slug, '[^a-z0-9]', '', 'gi'), 6))
      || '-' || lpad(v_seq::text, 4, '0');

    INSERT INTO public.circle_contribution_invoices (
      jamiya_id, contribution_id, member_id, user_id, invoice_number,
      amount_due, currency, due_date, status, notes
    ) VALUES (
      p_jamiya_id, v_row.id, v_row.member_id, v_row.member_user_id, v_num,
      v_due, v_row.currency, v_row.due_date, 'open',
      format('Cycle %s contribution', coalesce(v_row.cycle_number::text, '?'))
    );

    INSERT INTO public.notifications (user_id, type, channel, title, body, data)
    VALUES (
      v_row.member_user_id,
      'contribution_due'::public.notification_type,
      'in_app'::public.notification_channel,
      'Contribution invoice ' || v_num,
      format('Invoice %s for %s is due%s. Pay from Home or your circle.',
        v_num,
        v_due::text,
        CASE WHEN v_row.due_date IS NOT NULL THEN ' by ' || v_row.due_date::text ELSE '' END
      ),
      jsonb_build_object(
        'jamiya_id', p_jamiya_id,
        'contribution_id', v_row.id,
        'invoice_number', v_num
      )
    );

    v_count := v_count + 1;
  END LOOP;

  UPDATE public.circle_contribution_invoices i
  SET status = 'paid', paid_at = NOW()
  FROM public.contributions c
  WHERE i.jamiya_id = p_jamiya_id
    AND i.contribution_id = c.id
    AND i.status = 'open'
    AND c.status = 'paid';

  RETURN jsonb_build_object(
    'ok', true,
    'issued', v_count,
    'due_within_days', p_due_within_days
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.remind_contribution_invoices(
  p_jamiya_id UUID,
  p_user_id UUID DEFAULT NULL
)
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
    WHERE i.jamiya_id = p_jamiya_id
      AND i.status = 'open'
      AND (p_user_id IS NULL OR i.user_id = p_user_id)
    ORDER BY i.due_date NULLS LAST
  LOOP
    IF v_row.reminded_at IS NOT NULL AND v_row.reminded_at > NOW() - INTERVAL '24 hours' THEN
      v_skipped := v_skipped + 1;
      CONTINUE;
    END IF;

    v_title := 'Reminder: ' || v_row.invoice_number;
    v_body := format(
      'Jameiyah · %s — please pay invoice %s (%s %s)%s. Open the app to pay.',
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

-- One officer action: invoice dues due soon, then remind
CREATE OR REPLACE FUNCTION public.nudge_circle_dues(
  p_jamiya_id UUID,
  p_due_within_days INT DEFAULT 7
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_issued JSONB;
  v_reminded JSONB;
  v_days INT := GREATEST(COALESCE(p_due_within_days, 7), 0);
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'UNAUTHENTICATED');
  END IF;
  IF NOT (private.is_circle_officer(p_jamiya_id) OR private.is_platform_admin()) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'FORBIDDEN');
  END IF;

  v_issued := public.issue_contribution_invoices(p_jamiya_id, v_days);
  IF coalesce((v_issued->>'ok')::boolean, false) IS NOT TRUE THEN
    RETURN v_issued;
  END IF;

  v_reminded := public.remind_contribution_invoices(p_jamiya_id, NULL);
  IF coalesce((v_reminded->>'ok')::boolean, false) IS NOT TRUE THEN
    RETURN jsonb_build_object(
      'ok', false,
      'error', coalesce(v_reminded->>'error', 'REMIND_FAILED'),
      'issued', coalesce((v_issued->>'issued')::int, 0)
    );
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'due_within_days', v_days,
    'issued', coalesce((v_issued->>'issued')::int, 0),
    'reminded', coalesce((v_reminded->>'reminded')::int, 0),
    'skipped_cooldown', coalesce((v_reminded->>'skipped_cooldown')::int, 0),
    'sms_queued', coalesce((v_reminded->>'sms_queued')::int, 0),
    'whatsapp_queued', coalesce((v_reminded->>'whatsapp_queued')::int, 0)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.issue_contribution_invoices(UUID, INT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.issue_contribution_invoices(UUID, INT) TO authenticated;

REVOKE ALL ON FUNCTION public.nudge_circle_dues(UUID, INT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.nudge_circle_dues(UUID, INT) TO authenticated;
