-- Next layer: optional member invoice reminders + subscription renewal processing.

DROP FUNCTION IF EXISTS public.remind_contribution_invoices(UUID);

-- ---------------------------------------------------------------------------
-- Remind open invoices (optional single member filter)
-- ---------------------------------------------------------------------------
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

REVOKE ALL ON FUNCTION public.remind_contribution_invoices(UUID, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.remind_contribution_invoices(UUID, UUID) TO authenticated;

-- ---------------------------------------------------------------------------
-- Renew paid circle plans (or mark past_due). Called by cron with service role.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.process_circle_subscription_renewals()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_row RECORD;
  v_plan public.platform_plans%ROWTYPE;
  v_payer UUID;
  v_tx UUID;
  v_renewed INT := 0;
  v_past_due INT := 0;
  v_skipped INT := 0;
BEGIN
  FOR v_row IN
    SELECT s.*
    FROM public.circle_subscriptions s
    WHERE s.status IN ('active', 'past_due')
      AND s.renews_at IS NOT NULL
      AND s.renews_at <= NOW()
    ORDER BY s.renews_at ASC
    LIMIT 200
  LOOP
    SELECT * INTO v_plan FROM public.platform_plans WHERE id = v_row.plan_id AND active;
    IF NOT FOUND OR coalesce(v_plan.price_kes, 0) <= 0 THEN
      UPDATE public.circle_subscriptions
      SET renews_at = NULL, status = 'active', updated_at = NOW()
      WHERE jamiya_id = v_row.jamiya_id;
      v_skipped := v_skipped + 1;
      CONTINUE;
    END IF;

    SELECT m.user_id INTO v_payer
    FROM public.members m
    WHERE m.jamiya_id = v_row.jamiya_id
      AND m.status = 'active'
      AND m.role IN ('circle_admin', 'chair', 'treasurer')
    ORDER BY
      CASE m.role
        WHEN 'circle_admin' THEN 1
        WHEN 'chair' THEN 2
        ELSE 3
      END
    LIMIT 1;

    IF v_payer IS NULL THEN
      UPDATE public.circle_subscriptions
      SET status = 'past_due', updated_at = NOW()
      WHERE jamiya_id = v_row.jamiya_id;
      v_past_due := v_past_due + 1;
      CONTINUE;
    END IF;

    BEGIN
      v_tx := private.ledger_debit(
        v_payer,
        'KES',
        v_plan.price_kes,
        'fee'::public.transaction_type,
        v_row.jamiya_id,
        'circle_plan_renewal:' || v_row.plan_id,
        v_row.jamiya_id::text || ':plan-renew:' || v_row.plan_id || ':' || floor(extract(epoch FROM now()))::text,
        jsonb_build_object('kind', 'circle_plan_renewal', 'plan_id', v_row.plan_id)
      );

      UPDATE public.circle_subscriptions
      SET
        status = 'active',
        renews_at = NOW() + INTERVAL '30 days',
        notes = 'renewed tx ' || v_tx::text,
        updated_at = NOW()
      WHERE jamiya_id = v_row.jamiya_id;

      INSERT INTO public.notifications (user_id, type, channel, title, body, data)
      VALUES (
        v_payer,
        'system'::public.notification_type,
        'in_app'::public.notification_channel,
        'Circle plan renewed',
        format('Your %s plan was renewed for 30 days (KES %s charged to your wallet).', v_plan.name, v_plan.price_kes::text),
        jsonb_build_object('jamiya_id', v_row.jamiya_id, 'plan_id', v_row.plan_id, 'transaction_id', v_tx)
      );

      INSERT INTO public.audit_logs (actor_id, action, entity_type, entity_id, jamiya_id, metadata)
      VALUES (
        v_payer,
        'update',
        'circle_subscription',
        v_row.jamiya_id,
        v_row.jamiya_id,
        jsonb_build_object('kind', 'auto_renew', 'plan_id', v_row.plan_id, 'transaction_id', v_tx)
      );

      v_renewed := v_renewed + 1;
    EXCEPTION WHEN OTHERS THEN
      UPDATE public.circle_subscriptions
      SET status = 'past_due', updated_at = NOW(), notes = left(SQLERRM, 200)
      WHERE jamiya_id = v_row.jamiya_id;

      INSERT INTO public.notifications (user_id, type, channel, title, body, data)
      VALUES (
        v_payer,
        'system'::public.notification_type,
        'in_app'::public.notification_channel,
        'Circle plan past due',
        format('Could not renew %s (KES %s). Top up your wallet, then open Officer → Circle plan.', v_plan.name, v_plan.price_kes::text),
        jsonb_build_object('jamiya_id', v_row.jamiya_id, 'plan_id', v_row.plan_id, 'error', SQLERRM)
      );

      v_past_due := v_past_due + 1;
    END;
  END LOOP;

  RETURN jsonb_build_object(
    'ok', true,
    'renewed', v_renewed,
    'past_due', v_past_due,
    'skipped', v_skipped
  );
END;
$$;

REVOKE ALL ON FUNCTION public.process_circle_subscription_renewals() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.process_circle_subscription_renewals() TO service_role;
