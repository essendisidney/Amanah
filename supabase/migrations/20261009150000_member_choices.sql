-- Members choose: one place to opt in and out of optional things, with a record of each choice.
--
-- 1. Notification preferences. Members can turn off reminders and payout heads-ups by email,
--    SMS, WhatsApp or push. Receipts, security, KYC, collections and circle decisions are always
--    sent, and every message still lands in the in-app inbox. Enforced on notification_outbox,
--    so every sender (database functions and Edge Functions alike) respects it.
-- 2. Sponsorships: the sponsor can pause, resume or stop a monthly sponsorship.
-- 3. Circle plans: officers can turn auto-renew off; the plan then ends at the end of the
--    period instead of charging the officer's wallet again.
-- 4. member_choice_events records every choice, both ways, with its date. get_my_choices
--    returns the member's current choices, their accepted circle terms and that history.

-- ---------------------------------------------------------------------------
-- Choice history
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.member_choice_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  subject TEXT NOT NULL CHECK (subject IN ('notifications', 'sponsorship', 'circle_plan')),
  subject_id UUID,
  choice TEXT NOT NULL,
  detail JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS member_choice_events_user_idx
  ON public.member_choice_events (user_id, created_at DESC);

ALTER TABLE public.member_choice_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.member_choice_events FROM anon;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.member_choice_events FROM authenticated;
CREATE POLICY member_choice_events_select_own ON public.member_choice_events
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR private.is_compliance_or_admin());

CREATE OR REPLACE FUNCTION private.record_choice(
  p_user_id UUID, p_subject TEXT, p_subject_id UUID, p_choice TEXT, p_detail JSONB DEFAULT '{}'::jsonb
)
RETURNS VOID
LANGUAGE sql
SECURITY DEFINER
SET search_path TO ''
AS $$
  INSERT INTO public.member_choice_events (user_id, subject, subject_id, choice, detail)
  VALUES (p_user_id, p_subject, p_subject_id, p_choice, coalesce(p_detail, '{}'::jsonb));
$$;

-- ---------------------------------------------------------------------------
-- Notification preferences
-- ---------------------------------------------------------------------------
-- A row means the member turned that category off (or back on) for that channel; no row = on.
CREATE TABLE IF NOT EXISTS public.notification_preferences (
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  category TEXT NOT NULL CHECK (category IN ('reminders', 'payout_alerts')),
  channel public.notification_channel NOT NULL CHECK (channel IN ('email', 'sms', 'whatsapp', 'push')),
  enabled BOOLEAN NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, category, channel)
);

ALTER TABLE public.notification_preferences ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.notification_preferences FROM anon;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.notification_preferences FROM authenticated;
CREATE POLICY notification_preferences_select_own ON public.notification_preferences
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- Which optional category an outbound message belongs to; NULL = essential, always sent.
CREATE OR REPLACE FUNCTION private.outbox_category(p_metadata JSONB)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
SET search_path TO ''
AS $$
  SELECT CASE
    WHEN p_metadata->>'category' IN ('reminders', 'payout_alerts') THEN p_metadata->>'category'
    WHEN p_metadata ? 'collection_case_id' THEN NULL
    WHEN p_metadata ? 'payout_id' OR p_metadata->>'dedupe_key' LIKE 'payout:%' THEN 'payout_alerts'
    WHEN p_metadata ? 'contribution_id'
      OR p_metadata->>'kind' = 'invoice_reminder'
      OR p_metadata->>'dedupe_key' LIKE 'contrib:%' THEN 'reminders'
    ELSE NULL
  END;
$$;

CREATE OR REPLACE FUNCTION private.trg_outbox_respect_preferences()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  v_category TEXT;
BEGIN
  IF NEW.user_id IS NULL THEN
    RETURN NEW;
  END IF;
  v_category := private.outbox_category(NEW.metadata);
  IF v_category IS NULL THEN
    RETURN NEW;
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.notification_preferences p
    WHERE p.user_id = NEW.user_id AND p.category = v_category
      AND p.channel = NEW.channel AND NOT p.enabled
  ) THEN
    RETURN NULL; -- the member turned this off: skip it quietly
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE TRIGGER notification_outbox_respect_preferences
  BEFORE INSERT ON public.notification_outbox
  FOR EACH ROW EXECUTE FUNCTION private.trg_outbox_respect_preferences();

CREATE OR REPLACE FUNCTION public.set_notification_preference(
  p_category TEXT, p_channel TEXT, p_enabled BOOLEAN
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_was BOOLEAN;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'UNAUTHENTICATED');
  END IF;
  IF p_category IS NULL OR p_category NOT IN ('reminders', 'payout_alerts')
     OR p_channel IS NULL OR p_channel NOT IN ('email', 'sms', 'whatsapp', 'push')
     OR p_enabled IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'INVALID_CHOICE');
  END IF;

  SELECT enabled INTO v_was FROM public.notification_preferences
  WHERE user_id = v_uid AND category = p_category AND channel = p_channel::public.notification_channel;
  IF coalesce(v_was, true) = p_enabled THEN
    RETURN jsonb_build_object('ok', true, 'unchanged', true);
  END IF;

  INSERT INTO public.notification_preferences (user_id, category, channel, enabled, updated_at)
  VALUES (v_uid, p_category, p_channel::public.notification_channel, p_enabled, NOW())
  ON CONFLICT (user_id, category, channel)
  DO UPDATE SET enabled = EXCLUDED.enabled, updated_at = NOW();

  PERFORM private.record_choice(v_uid, 'notifications', NULL,
    CASE WHEN p_enabled THEN 'opted_in' ELSE 'opted_out' END,
    jsonb_build_object('category', p_category, 'channel', p_channel));

  RETURN jsonb_build_object('ok', true);
END;
$$;

-- ---------------------------------------------------------------------------
-- Sponsorships: pause, resume, stop
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.set_sponsorship_status(p_sponsorship_id UUID, p_status TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_s public.sponsorships%ROWTYPE;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'UNAUTHENTICATED');
  END IF;
  IF p_status IS NULL OR p_status NOT IN ('active', 'paused', 'cancelled') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'INVALID_CHOICE');
  END IF;

  SELECT * INTO v_s FROM public.sponsorships WHERE id = p_sponsorship_id FOR UPDATE;
  IF NOT FOUND OR v_s.sponsor_user_id IS DISTINCT FROM v_uid THEN
    RETURN jsonb_build_object('ok', false, 'error', 'NOT_FOUND');
  END IF;
  IF v_s.status = 'cancelled' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'SPONSORSHIP_ENDED');
  END IF;
  IF v_s.status::text = p_status THEN
    RETURN jsonb_build_object('ok', true, 'unchanged', true, 'status', p_status);
  END IF;

  UPDATE public.sponsorships
  SET status = p_status::public.sponsorship_status,
      -- Resuming never charges for the paused months: the next charge is today at the earliest.
      next_charge_date = CASE WHEN p_status = 'active'
                              THEN GREATEST(next_charge_date, CURRENT_DATE)
                              ELSE next_charge_date END,
      updated_at = NOW()
  WHERE id = p_sponsorship_id;

  PERFORM private.record_choice(v_uid, 'sponsorship', p_sponsorship_id,
    CASE p_status WHEN 'active' THEN 'resumed' WHEN 'paused' THEN 'paused' ELSE 'stopped' END,
    jsonb_build_object('from', v_s.status, 'to', p_status));

  RETURN jsonb_build_object('ok', true, 'status', p_status);
END;
$$;

-- ---------------------------------------------------------------------------
-- Circle plans: auto-renew
-- ---------------------------------------------------------------------------
ALTER TABLE public.circle_subscriptions
  ADD COLUMN IF NOT EXISTS auto_renew BOOLEAN NOT NULL DEFAULT TRUE;

CREATE OR REPLACE FUNCTION public.set_circle_plan_auto_renew(p_jamiya_id UUID, p_auto_renew BOOLEAN)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_sub public.circle_subscriptions%ROWTYPE;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'UNAUTHENTICATED');
  END IF;
  IF p_auto_renew IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'INVALID_CHOICE');
  END IF;
  IF NOT private.is_circle_officer(p_jamiya_id) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'FORBIDDEN');
  END IF;

  SELECT * INTO v_sub FROM public.circle_subscriptions WHERE jamiya_id = p_jamiya_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'NO_PAID_PLAN');
  END IF;
  IF v_sub.auto_renew = p_auto_renew THEN
    RETURN jsonb_build_object('ok', true, 'unchanged', true, 'auto_renew', p_auto_renew);
  END IF;

  UPDATE public.circle_subscriptions
  SET auto_renew = p_auto_renew, updated_at = NOW()
  WHERE jamiya_id = p_jamiya_id;

  PERFORM private.record_choice(v_uid, 'circle_plan', p_jamiya_id,
    CASE WHEN p_auto_renew THEN 'auto_renew_on' ELSE 'auto_renew_off' END,
    jsonb_build_object('plan_id', v_sub.plan_id, 'renews_at', v_sub.renews_at));

  INSERT INTO public.audit_logs (actor_id, action, entity_type, entity_id, jamiya_id, metadata)
  VALUES (v_uid, 'update', 'circle_subscription', p_jamiya_id, p_jamiya_id,
          jsonb_build_object('kind', 'auto_renew', 'auto_renew', p_auto_renew));

  RETURN jsonb_build_object('ok', true, 'auto_renew', p_auto_renew);
END;
$$;

CREATE OR REPLACE FUNCTION public.get_circle_plan(p_jamiya_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v_sub public.circle_subscriptions%ROWTYPE;
  v_plan public.platform_plans%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'UNAUTHENTICATED');
  END IF;

  SELECT * INTO v_sub FROM public.circle_subscriptions WHERE jamiya_id = p_jamiya_id;
  IF NOT FOUND THEN
    SELECT * INTO v_plan FROM public.platform_plans WHERE id = 'free';
    RETURN jsonb_build_object(
      'ok', true,
      'plan_id', 'free',
      'plan', to_jsonb(v_plan),
      'status', 'active',
      'implicit', true,
      'auto_renew', false
    );
  END IF;

  SELECT * INTO v_plan FROM public.platform_plans WHERE id = v_sub.plan_id;
  RETURN jsonb_build_object(
    'ok', true,
    'plan_id', v_sub.plan_id,
    'plan', to_jsonb(v_plan),
    'status', v_sub.status,
    'renews_at', v_sub.renews_at,
    'implicit', false,
    'auto_renew', v_sub.auto_renew
  );
END;
$function$;

-- Renewals: a plan with auto-renew off ends at the end of its period instead of being charged.
CREATE OR REPLACE FUNCTION public.process_circle_subscription_renewals()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v_row RECORD;
  v_plan public.platform_plans%ROWTYPE;
  v_payer UUID;
  v_tx UUID;
  v_renewed INT := 0;
  v_past_due INT := 0;
  v_skipped INT := 0;
  v_ended INT := 0;
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

    IF NOT v_row.auto_renew THEN
      UPDATE public.circle_subscriptions
      SET status = 'cancelled', renews_at = NULL, notes = 'ended: auto-renew off', updated_at = NOW()
      WHERE jamiya_id = v_row.jamiya_id;

      INSERT INTO public.notifications (user_id, type, channel, title, body, data)
      SELECT m.user_id, 'system'::public.notification_type, 'in_app'::public.notification_channel,
             'Circle plan ended',
             format('Your %s plan ended and was not renewed, because auto-renew is off. Choose a plan again in Officer → Circle plan whenever you need it.', v_plan.name),
             jsonb_build_object('jamiya_id', v_row.jamiya_id, 'plan_id', v_row.plan_id)
      FROM public.members m
      WHERE m.jamiya_id = v_row.jamiya_id AND m.status = 'active'
        AND m.role IN ('circle_admin', 'chair', 'treasurer') AND m.user_id IS NOT NULL;

      v_ended := v_ended + 1;
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
        format('Your %s plan was renewed for 30 days (KES %s charged to your wallet). You can turn auto-renew off in You → My choices.', v_plan.name, v_plan.price_kes::text),
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
    'skipped', v_skipped,
    'ended', v_ended
  );
END;
$function$;

-- ---------------------------------------------------------------------------
-- Everything the member has chosen, in one place
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_my_choices()
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  v_uid UUID := auth.uid();
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'UNAUTHENTICATED');
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'notifications', (
      SELECT coalesce(jsonb_agg(jsonb_build_object(
               'category', c.category, 'channel', ch.channel,
               'enabled', coalesce(p.enabled, true), 'updated_at', p.updated_at)
             ORDER BY c.ord, ch.ord), '[]'::jsonb)
      FROM (VALUES ('reminders', 1), ('payout_alerts', 2)) AS c(category, ord)
      CROSS JOIN (VALUES ('sms', 1), ('whatsapp', 2), ('email', 3), ('push', 4)) AS ch(channel, ord)
      LEFT JOIN public.notification_preferences p
        ON p.user_id = v_uid AND p.category = c.category AND p.channel::text = ch.channel
    ),
    'circle_terms', (
      SELECT coalesce(jsonb_agg(jsonb_build_object(
               'jamiya_id', j.id, 'name', j.name, 'slug', j.slug,
               'current_version', j.terms_version,
               'accepted_version', mc.version, 'accepted_at', mc.accepted_at,
               'up_to_date', mc.version IS NOT NULL AND mc.version >= j.terms_version)
             ORDER BY j.name), '[]'::jsonb)
      FROM public.members m
      JOIN public.jamiyas j ON j.id = m.jamiya_id
      LEFT JOIN LATERAL (
        SELECT c.version, c.accepted_at FROM public.member_consents c
        WHERE c.user_id = v_uid AND c.jamiya_id = j.id AND c.kind = 'circle_terms'
        ORDER BY c.version DESC LIMIT 1
      ) mc ON true
      WHERE m.user_id = v_uid AND m.status IN ('active', 'suspended')
    ),
    'sponsorships', (
      SELECT coalesce(jsonb_agg(jsonb_build_object(
               'id', s.id, 'title', ap.title, 'monthly_amount', s.monthly_amount,
               'currency', s.currency, 'status', s.status, 'next_charge_date', s.next_charge_date)
             ORDER BY s.created_at DESC), '[]'::jsonb)
      FROM public.sponsorships s
      JOIN public.adoption_profiles ap ON ap.id = s.adoption_profile_id
      WHERE s.sponsor_user_id = v_uid
    ),
    'circle_plans', (
      SELECT coalesce(jsonb_agg(jsonb_build_object(
               'jamiya_id', j.id, 'name', j.name, 'slug', j.slug,
               'plan_id', cs.plan_id, 'plan_name', pp.name, 'price_kes', pp.price_kes,
               'status', cs.status, 'renews_at', cs.renews_at, 'auto_renew', cs.auto_renew)
             ORDER BY j.name), '[]'::jsonb)
      FROM public.members m
      JOIN public.jamiyas j ON j.id = m.jamiya_id
      JOIN public.circle_subscriptions cs ON cs.jamiya_id = j.id
      JOIN public.platform_plans pp ON pp.id = cs.plan_id
      WHERE m.user_id = v_uid AND m.status = 'active'
        AND m.role IN ('circle_admin', 'chair', 'treasurer')
        AND pp.price_kes > 0
    ),
    'history', (
      SELECT coalesce(jsonb_agg(h ORDER BY h.created_at DESC), '[]'::jsonb)
      FROM (
        SELECT e.subject, e.subject_id, e.choice, e.detail, e.created_at
        FROM public.member_choice_events e
        WHERE e.user_id = v_uid
        UNION ALL
        SELECT 'circle_terms', c.jamiya_id, 'accepted',
               jsonb_build_object('version', c.version, 'name', j.name), c.accepted_at
        FROM public.member_consents c
        JOIN public.jamiyas j ON j.id = c.jamiya_id
        WHERE c.user_id = v_uid
        UNION ALL
        SELECT 'fee_vote', p.jamiya_id, CASE WHEN v.vote THEN 'voted_yes' ELSE 'voted_no' END,
               jsonb_build_object('proposal_id', p.id, 'name', j.name), v.voted_at
        FROM public.circle_terms_votes v
        JOIN public.circle_terms_proposals p ON p.id = v.proposal_id
        JOIN public.jamiyas j ON j.id = p.jamiya_id
        WHERE v.user_id = v_uid
        ORDER BY 5 DESC
        LIMIT 100
      ) h
    )
  );
END;
$$;

-- ---------------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------------
REVOKE ALL ON FUNCTION private.record_choice(UUID, TEXT, UUID, TEXT, JSONB) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION private.outbox_category(JSONB) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION private.trg_outbox_respect_preferences() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.set_notification_preference(TEXT, TEXT, BOOLEAN) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.set_sponsorship_status(UUID, TEXT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.set_circle_plan_auto_renew(UUID, BOOLEAN) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_my_choices() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_notification_preference(TEXT, TEXT, BOOLEAN) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.set_sponsorship_status(UUID, TEXT) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.set_circle_plan_auto_renew(UUID, BOOLEAN) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_my_choices() TO authenticated, service_role;
