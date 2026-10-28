-- Final pricing (Jameiyah FINAL Pricing & Developer Requirements, approved October 2026).
--
-- Circle plans now follow the final price list:
--   Free        up to 5 members                         KES 0
--   Starter     up to 10 members   KES 450 / 1,300 / 4,500   (month / quarter / year), 20 SMS
--   Growth      11–20 members      KES 700 / 2,000 / 7,000,   40 SMS
--   Pro         21–35 members      KES 1,000 / 2,850 / 10,000, 75 SMS
--   Enterprise  36+ members        KES 1,000 + KES 30 a member above 35 (capped at KES 5,000) a
--                                  month; a quarter is 3 months less 5%, a year is 10 months; 150 SMS
-- Officers can pay monthly, quarterly or yearly, and can take one 14-day free trial of a paid plan.
-- A trial never turns into a charge unless an officer has turned auto-pay on. Renewals use the
-- circle's size at the time: a circle that has outgrown its plan renews on the smallest plan that
-- fits, at that plan's price, and is told so beforehand. Officers get a reminder three days before
-- any trial ends or plan renews. A plan that cannot be paid stays past due for 7 days, then the
-- circle drops to Free; records are never removed.
--
-- An optional launch discount on the first yearly payment (platform setting
-- circle_plan_launch_discount = {"pct": 20, "until": "YYYY-MM-DD"}) applies to circles created on or
-- before that date. It is not set here; management switches it on.
--
-- Tawarruq rates move to the final per-term table: 3.5% / 6.5% / 12% / 22% for 3 / 6 / 12 / 24 months.

-- ---------------------------------------------------------------------------
-- 1. Plans
-- ---------------------------------------------------------------------------
ALTER TABLE public.platform_plans
  ADD COLUMN IF NOT EXISTS price_quarterly_kes NUMERIC(14, 2),
  ADD COLUMN IF NOT EXISTS price_annual_kes NUMERIC(14, 2),
  ADD COLUMN IF NOT EXISTS included_members INT,
  ADD COLUMN IF NOT EXISTS per_member_kes NUMERIC(14, 2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS price_cap_kes NUMERIC(14, 2),
  ADD COLUMN IF NOT EXISTS min_members INT NOT NULL DEFAULT 0;

INSERT INTO public.platform_plans (
  id, name, description, price_kes, price_quarterly_kes, price_annual_kes,
  min_members, max_members, included_members, per_member_kes, price_cap_kes,
  sms_credits_month, whatsapp_enabled, dual_approval_included, exports_included, sort_order, active
) VALUES
  ('free', 'Free',
   'Very small circles: member list, contributions and merry-go-round records, basic statement.',
   0, NULL, NULL, 0, 5, NULL, 0, NULL, 0, false, false, false, 10, true),
  ('starter', 'Starter',
   'Member records, contribution and savings tracking, merry-go-round records, statements and reports.',
   450, 1300, 4500, 0, 10, NULL, 0, NULL, 20, false, false, true, 20, true),
  ('growth', 'Growth',
   'Starter plus income and expenses, welfare fund, meetings and more detailed reports.',
   700, 2000, 7000, 11, 20, NULL, 0, NULL, 40, false, false, true, 25, true),
  ('pro', 'Pro',
   'Growth plus Qard Hasan loan tracking, several officers with approvals, enhanced reports and priority support.',
   1000, 2850, 10000, 21, 35, NULL, 0, NULL, 75, true, true, true, 30, true),
  ('enterprise', 'Enterprise',
   'Large groups: everything in Pro, with custom onboarding and statement or API import.',
   1000, NULL, NULL, 36, 100000, 35, 30, 5000, 150, true, true, true, 40, true)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  price_kes = EXCLUDED.price_kes,
  price_quarterly_kes = EXCLUDED.price_quarterly_kes,
  price_annual_kes = EXCLUDED.price_annual_kes,
  min_members = EXCLUDED.min_members,
  max_members = EXCLUDED.max_members,
  included_members = EXCLUDED.included_members,
  per_member_kes = EXCLUDED.per_member_kes,
  price_cap_kes = EXCLUDED.price_cap_kes,
  sms_credits_month = EXCLUDED.sms_credits_month,
  whatsapp_enabled = EXCLUDED.whatsapp_enabled,
  dual_approval_included = EXCLUDED.dual_approval_included,
  exports_included = EXCLUDED.exports_included,
  sort_order = EXCLUDED.sort_order,
  active = EXCLUDED.active;

-- ---------------------------------------------------------------------------
-- 2. Subscriptions: billing period, the price charged, the trial and reminders
-- ---------------------------------------------------------------------------
ALTER TABLE public.circle_subscriptions
  ADD COLUMN IF NOT EXISTS billing_period TEXT NOT NULL DEFAULT 'monthly',
  ADD COLUMN IF NOT EXISTS price_kes NUMERIC(14, 2),
  ADD COLUMN IF NOT EXISTS trial_ends_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS reminded_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS launch_discount_used BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE public.circle_subscriptions DROP CONSTRAINT IF EXISTS circle_subscriptions_status_check;
ALTER TABLE public.circle_subscriptions ADD CONSTRAINT circle_subscriptions_status_check
  CHECK (status IN ('trial', 'active', 'past_due', 'cancelled'));
ALTER TABLE public.circle_subscriptions DROP CONSTRAINT IF EXISTS circle_subscriptions_billing_period_check;
ALTER TABLE public.circle_subscriptions ADD CONSTRAINT circle_subscriptions_billing_period_check
  CHECK (billing_period IN ('monthly', 'quarterly', 'annual'));

-- ---------------------------------------------------------------------------
-- 3. Prices
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION private.circle_plan_period_interval(p_period TEXT)
RETURNS INTERVAL
LANGUAGE sql
IMMUTABLE
SET search_path TO ''
AS $$
  SELECT CASE p_period WHEN 'quarterly' THEN INTERVAL '3 months'
                       WHEN 'annual' THEN INTERVAL '1 year'
                       ELSE INTERVAL '1 month' END;
$$;

-- List price of a plan for a circle of p_members, for one billing period. NULL if no such plan.
CREATE OR REPLACE FUNCTION private.circle_plan_list_price(p_plan_id TEXT, p_members INT, p_period TEXT)
RETURNS NUMERIC
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  v_plan public.platform_plans%ROWTYPE;
  v_extra NUMERIC := 0;
  v_monthly NUMERIC;
BEGIN
  SELECT * INTO v_plan FROM public.platform_plans WHERE id = p_plan_id;
  IF NOT FOUND THEN
    RETURN NULL;
  END IF;
  IF v_plan.included_members IS NOT NULL THEN
    v_extra := v_plan.per_member_kes * greatest(coalesce(p_members, 0) - v_plan.included_members, 0);
  END IF;
  v_monthly := v_plan.price_kes + v_extra;
  IF v_plan.price_cap_kes IS NOT NULL THEN
    v_monthly := least(v_monthly, v_plan.price_cap_kes);
  END IF;

  RETURN CASE coalesce(p_period, 'monthly')
    WHEN 'quarterly' THEN
      CASE WHEN v_extra = 0 AND v_plan.price_quarterly_kes IS NOT NULL THEN v_plan.price_quarterly_kes
           ELSE round(v_monthly * 3 * 0.95) END
    WHEN 'annual' THEN
      CASE WHEN v_extra = 0 AND v_plan.price_annual_kes IS NOT NULL THEN v_plan.price_annual_kes
           ELSE v_monthly * 10 END
    ELSE v_monthly
  END;
END;
$$;

-- Launch discount on the first yearly payment, in percent (0 when none applies).
CREATE OR REPLACE FUNCTION private.circle_plan_launch_discount_pct(p_jamiya_id UUID, p_period TEXT)
RETURNS NUMERIC
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  v_setting JSONB;
  v_pct NUMERIC;
  v_until DATE;
BEGIN
  IF p_period IS DISTINCT FROM 'annual' THEN
    RETURN 0;
  END IF;
  SELECT value INTO v_setting FROM public.platform_settings WHERE key = 'circle_plan_launch_discount';
  IF v_setting IS NULL THEN
    RETURN 0;
  END IF;
  BEGIN
    v_pct := (v_setting->>'pct')::numeric;
    v_until := (v_setting->>'until')::date;
  EXCEPTION WHEN OTHERS THEN
    RETURN 0;
  END;
  IF v_pct IS NULL OR v_pct <= 0 OR v_pct >= 100 OR v_until IS NULL
     OR (now() AT TIME ZONE 'Africa/Nairobi')::date > v_until THEN
    RETURN 0;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.jamiyas j
    WHERE j.id = p_jamiya_id AND (j.created_at AT TIME ZONE 'Africa/Nairobi')::date <= v_until
  ) THEN
    RETURN 0;
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.circle_subscriptions s
    WHERE s.jamiya_id = p_jamiya_id AND s.launch_discount_used
  ) THEN
    RETURN 0;
  END IF;
  RETURN v_pct;
END;
$$;

-- What this circle would pay for a plan and period now.
CREATE OR REPLACE FUNCTION private.circle_plan_charge(p_jamiya_id UUID, p_plan_id TEXT, p_period TEXT)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  v_members INT;
  v_list NUMERIC;
  v_pct NUMERIC;
BEGIN
  SELECT coalesce(member_count, 0) INTO v_members FROM public.jamiyas WHERE id = p_jamiya_id;
  v_list := private.circle_plan_list_price(p_plan_id, v_members, p_period);
  v_pct := private.circle_plan_launch_discount_pct(p_jamiya_id, p_period);
  RETURN jsonb_build_object(
    'members', v_members,
    'list_price', v_list,
    'discount_pct', v_pct,
    'price', round(v_list * (100 - v_pct) / 100)
  );
END;
$$;

-- The smallest paid plan this many members fits.
CREATE OR REPLACE FUNCTION private.smallest_paid_plan_for(p_members INT)
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO ''
AS $$
  SELECT id FROM public.platform_plans
  WHERE active AND price_kes > 0 AND max_members >= coalesce(p_members, 0)
  ORDER BY sort_order
  LIMIT 1;
$$;

-- Prices of every plan for this circle, for the officer page.
CREATE OR REPLACE FUNCTION public.circle_plan_quotes(p_jamiya_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  v_members INT;
  v_sub public.circle_subscriptions%ROWTYPE;
  v_paid_before BOOLEAN;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'UNAUTHENTICATED');
  END IF;
  IF NOT (private.is_jamiya_member(p_jamiya_id) OR private.is_platform_admin()) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'FORBIDDEN');
  END IF;

  SELECT coalesce(member_count, 0) INTO v_members FROM public.jamiyas WHERE id = p_jamiya_id;
  SELECT * INTO v_sub FROM public.circle_subscriptions WHERE jamiya_id = p_jamiya_id;
  v_paid_before := EXISTS (
    SELECT 1 FROM public.transactions t
    WHERE t.jamiya_id = p_jamiya_id AND t.type = 'fee' AND t.status = 'completed'
      AND t.metadata->>'kind' IN ('circle_plan', 'circle_plan_renewal')
  );

  RETURN jsonb_build_object(
    'ok', true,
    'members', v_members,
    'trial_available', NOT v_paid_before AND (v_sub.jamiya_id IS NULL OR v_sub.trial_ends_at IS NULL),
    'trial_days', 14,
    'plans', (
      SELECT coalesce(jsonb_agg(jsonb_build_object(
               'id', p.id, 'name', p.name, 'description', p.description,
               'max_members', p.max_members, 'sms_credits_month', p.sms_credits_month,
               'fits', v_members <= p.max_members,
               'monthly', (private.circle_plan_charge(p_jamiya_id, p.id, 'monthly'))->'price',
               'quarterly', (private.circle_plan_charge(p_jamiya_id, p.id, 'quarterly'))->'price',
               'annual', (private.circle_plan_charge(p_jamiya_id, p.id, 'annual'))->'price',
               'annual_list', (private.circle_plan_charge(p_jamiya_id, p.id, 'annual'))->'list_price',
               'annual_discount_pct', (private.circle_plan_charge(p_jamiya_id, p.id, 'annual'))->'discount_pct')
             ORDER BY p.sort_order), '[]'::jsonb)
      FROM public.platform_plans p
      WHERE p.active
    )
  );
END;
$$;

-- ---------------------------------------------------------------------------
-- 4. Applying a plan
-- ---------------------------------------------------------------------------
DROP FUNCTION IF EXISTS private.apply_circle_plan(UUID, TEXT, UUID);

CREATE OR REPLACE FUNCTION private.apply_circle_plan(
  p_jamiya_id UUID,
  p_plan_id TEXT,
  p_tx UUID DEFAULT NULL,
  p_period TEXT DEFAULT 'monthly',
  p_price NUMERIC DEFAULT NULL,
  p_discount_used BOOLEAN DEFAULT FALSE
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_plan public.platform_plans%ROWTYPE;
  v_members INT;
  v_period TEXT := coalesce(nullif(p_period, ''), 'monthly');
  v_price NUMERIC;
BEGIN
  SELECT * INTO v_plan FROM public.platform_plans WHERE id = p_plan_id AND active;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'PLAN_NOT_FOUND');
  END IF;
  IF v_period NOT IN ('monthly', 'quarterly', 'annual') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'INVALID_PERIOD');
  END IF;

  SELECT member_count INTO v_members FROM public.jamiyas WHERE id = p_jamiya_id;
  IF coalesce(v_members, 0) > v_plan.max_members THEN
    RETURN jsonb_build_object(
      'ok', false,
      'error', 'MEMBER_LIMIT',
      'members', v_members,
      'max_members', v_plan.max_members
    );
  END IF;

  v_price := coalesce(p_price, private.circle_plan_list_price(p_plan_id, v_members, v_period));

  INSERT INTO public.circle_subscriptions (
    jamiya_id, plan_id, status, started_at, renews_at, updated_at, notes,
    billing_period, price_kes, reminded_at, launch_discount_used
  )
  VALUES (
    p_jamiya_id, p_plan_id, 'active', NOW(),
    CASE WHEN v_plan.price_kes > 0 THEN NOW() + private.circle_plan_period_interval(v_period) ELSE NULL END,
    NOW(),
    CASE WHEN p_tx IS NOT NULL THEN 'paid tx ' || p_tx::text ELSE NULL END,
    v_period,
    CASE WHEN v_plan.price_kes > 0 THEN v_price ELSE 0 END,
    NULL,
    coalesce(p_discount_used, false)
  )
  ON CONFLICT (jamiya_id) DO UPDATE SET
    plan_id = EXCLUDED.plan_id,
    status = 'active',
    started_at = NOW(),
    renews_at = EXCLUDED.renews_at,
    notes = EXCLUDED.notes,
    billing_period = EXCLUDED.billing_period,
    price_kes = EXCLUDED.price_kes,
    reminded_at = NULL,
    launch_discount_used = public.circle_subscriptions.launch_discount_used OR EXCLUDED.launch_discount_used,
    updated_at = NOW();

  IF v_plan.dual_approval_included THEN
    UPDATE public.jamiyas
    SET dual_approval_enabled = TRUE, updated_at = NOW()
    WHERE id = p_jamiya_id AND dual_approval_enabled = FALSE;
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'plan_id', p_plan_id,
    'billing_period', v_period,
    'price_kes', CASE WHEN v_plan.price_kes > 0 THEN v_price ELSE 0 END,
    'max_members', v_plan.max_members,
    'transaction_id', p_tx
  );
END;
$$;

-- Plans paid straight from M-Pesa carry their period in the payment metadata.
CREATE OR REPLACE FUNCTION private.on_circle_plan_payment_completed()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_plan TEXT;
  v_jamiya UUID;
  v_applied JSONB;
BEGIN
  IF NEW.status IS DISTINCT FROM 'completed' THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'UPDATE' AND OLD.status = 'completed' THEN
    RETURN NEW;
  END IF;
  IF coalesce(NEW.metadata->>'kind', '') <> 'circle_plan' THEN
    RETURN NEW;
  END IF;

  v_plan := nullif(NEW.metadata->>'plan_id', '');
  BEGIN
    v_jamiya := nullif(NEW.metadata->>'jamiya_id', '')::uuid;
  EXCEPTION WHEN OTHERS THEN
    RETURN NEW;
  END;
  IF v_plan IS NULL OR v_jamiya IS NULL THEN
    RETURN NEW;
  END IF;

  v_applied := private.apply_circle_plan(
    v_jamiya, v_plan, NEW.transaction_id,
    coalesce(nullif(NEW.metadata->>'billing_period', ''), 'monthly'),
    NEW.amount
  );
  RETURN NEW;
END;
$$;

-- ---------------------------------------------------------------------------
-- 5. Officers choose a plan
-- ---------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.set_circle_plan(UUID, TEXT);

CREATE OR REPLACE FUNCTION public.set_circle_plan(
  p_jamiya_id UUID,
  p_plan_id TEXT,
  p_period TEXT DEFAULT 'monthly'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_plan public.platform_plans%ROWTYPE;
  v_sub public.circle_subscriptions%ROWTYPE;
  v_has_sub BOOLEAN;
  v_period TEXT := coalesce(nullif(btrim(p_period), ''), 'monthly');
  v_quote JSONB;
  v_price NUMERIC;
  v_credit NUMERIC := 0;
  v_charge NUMERIC;
  v_tx UUID;
  v_applied JSONB;
  v_members INT;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'UNAUTHENTICATED');
  END IF;
  IF NOT (private.is_circle_officer(p_jamiya_id) OR private.is_platform_admin()) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'FORBIDDEN');
  END IF;
  IF v_period NOT IN ('monthly', 'quarterly', 'annual') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'INVALID_PERIOD');
  END IF;

  SELECT * INTO v_plan FROM public.platform_plans WHERE id = p_plan_id AND active;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'PLAN_NOT_FOUND');
  END IF;

  SELECT coalesce(member_count, 0) INTO v_members FROM public.jamiyas WHERE id = p_jamiya_id;
  IF v_members > v_plan.max_members THEN
    RETURN jsonb_build_object('ok', false, 'error', 'MEMBER_LIMIT',
      'members', v_members, 'max_members', v_plan.max_members);
  END IF;

  SELECT * INTO v_sub FROM public.circle_subscriptions WHERE jamiya_id = p_jamiya_id FOR UPDATE;
  v_has_sub := FOUND;

  IF v_has_sub AND v_sub.plan_id = p_plan_id AND v_sub.status = 'active'
     AND (v_plan.price_kes = 0 OR v_sub.billing_period = v_period) THEN
    RETURN jsonb_build_object('ok', true, 'already_active', true, 'plan_id', p_plan_id);
  END IF;

  -- Moving to Free from a plan that is paid up: keep the paid plan to the end of its period.
  IF v_plan.price_kes = 0 AND v_has_sub AND v_sub.status = 'active'
     AND v_sub.renews_at IS NOT NULL AND v_sub.renews_at > NOW() THEN
    UPDATE public.circle_subscriptions
    SET auto_renew = FALSE, updated_at = NOW()
    WHERE jamiya_id = p_jamiya_id;
    RETURN jsonb_build_object('ok', true, 'scheduled', true, 'plan_id', 'free', 'ends_at', v_sub.renews_at);
  END IF;

  IF v_plan.price_kes > 0 THEN
    v_quote := private.circle_plan_charge(p_jamiya_id, p_plan_id, v_period);
    v_price := (v_quote->>'price')::numeric;

    -- Credit for the unused part of a plan that is paid up (not a trial).
    IF v_has_sub AND v_sub.status = 'active' AND coalesce(v_sub.price_kes, 0) > 0
       AND v_sub.renews_at > NOW() AND v_sub.started_at < v_sub.renews_at THEN
      v_credit := round(v_sub.price_kes
        * extract(epoch FROM (v_sub.renews_at - NOW()))
        / extract(epoch FROM (v_sub.renews_at - v_sub.started_at)));
    END IF;
    v_charge := greatest(v_price - v_credit, 0);

    IF v_charge > 0 THEN
      BEGIN
        v_tx := private.ledger_debit(
          v_uid,
          'KES',
          v_charge,
          'fee'::public.transaction_type,
          p_jamiya_id,
          'circle_plan:' || p_plan_id,
          p_jamiya_id::text || ':plan:' || p_plan_id || ':' || v_period || ':'
            || floor(extract(epoch FROM now()))::text,
          jsonb_build_object('kind', 'circle_plan', 'plan_id', p_plan_id,
                             'billing_period', v_period, 'price', v_price, 'credit', v_credit,
                             'discount_pct', v_quote->'discount_pct')
        );
      EXCEPTION WHEN OTHERS THEN
        RETURN jsonb_build_object('ok', false, 'error', SQLERRM);
      END;
    END IF;
  END IF;

  v_applied := private.apply_circle_plan(
    p_jamiya_id, p_plan_id, v_tx, v_period, v_price,
    coalesce((v_quote->>'discount_pct')::numeric, 0) > 0
  );
  IF coalesce(v_applied->>'ok', 'false') <> 'true' THEN
    RETURN v_applied;
  END IF;

  INSERT INTO public.audit_logs (actor_id, action, entity_type, entity_id, jamiya_id, metadata)
  VALUES (
    v_uid, 'update', 'jamiya', p_jamiya_id, p_jamiya_id,
    jsonb_build_object('plan_id', p_plan_id, 'billing_period', v_period, 'price_kes', v_price,
                       'credit', v_credit, 'charged', coalesce(v_charge, 0), 'transaction_id', v_tx)
  );

  RETURN v_applied || jsonb_build_object('charged', coalesce(v_charge, 0), 'credit', v_credit);
END;
$$;

-- One free 14-day trial of a paid plan per circle. Nothing is charged when it ends unless an
-- officer turns auto-pay on.
CREATE OR REPLACE FUNCTION public.start_circle_plan_trial(
  p_jamiya_id UUID,
  p_plan_id TEXT,
  p_period TEXT DEFAULT 'monthly'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_plan public.platform_plans%ROWTYPE;
  v_sub public.circle_subscriptions%ROWTYPE;
  v_period TEXT := coalesce(nullif(btrim(p_period), ''), 'monthly');
  v_members INT;
  v_price NUMERIC;
  v_ends TIMESTAMPTZ := NOW() + INTERVAL '14 days';
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'UNAUTHENTICATED');
  END IF;
  IF NOT private.is_circle_officer(p_jamiya_id) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'FORBIDDEN');
  END IF;
  IF v_period NOT IN ('monthly', 'quarterly', 'annual') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'INVALID_PERIOD');
  END IF;

  SELECT * INTO v_plan FROM public.platform_plans WHERE id = p_plan_id AND active AND price_kes > 0;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'PLAN_NOT_FOUND');
  END IF;

  SELECT coalesce(member_count, 0) INTO v_members FROM public.jamiyas WHERE id = p_jamiya_id;
  IF v_members > v_plan.max_members THEN
    RETURN jsonb_build_object('ok', false, 'error', 'MEMBER_LIMIT',
      'members', v_members, 'max_members', v_plan.max_members);
  END IF;

  SELECT * INTO v_sub FROM public.circle_subscriptions WHERE jamiya_id = p_jamiya_id FOR UPDATE;
  IF (FOUND AND v_sub.trial_ends_at IS NOT NULL) OR EXISTS (
    SELECT 1 FROM public.transactions t
    WHERE t.jamiya_id = p_jamiya_id AND t.type = 'fee' AND t.status = 'completed'
      AND t.metadata->>'kind' IN ('circle_plan', 'circle_plan_renewal')
  ) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'TRIAL_USED');
  END IF;

  v_price := (private.circle_plan_charge(p_jamiya_id, p_plan_id, v_period)->>'price')::numeric;

  INSERT INTO public.circle_subscriptions (
    jamiya_id, plan_id, status, started_at, renews_at, trial_ends_at, updated_at, notes,
    billing_period, price_kes, auto_renew, reminded_at
  )
  VALUES (p_jamiya_id, p_plan_id, 'trial', NOW(), v_ends, v_ends, NOW(), 'free trial',
          v_period, v_price, FALSE, NULL)
  ON CONFLICT (jamiya_id) DO UPDATE SET
    plan_id = EXCLUDED.plan_id,
    status = 'trial',
    started_at = NOW(),
    renews_at = EXCLUDED.renews_at,
    trial_ends_at = EXCLUDED.trial_ends_at,
    notes = EXCLUDED.notes,
    billing_period = EXCLUDED.billing_period,
    price_kes = EXCLUDED.price_kes,
    auto_renew = FALSE,
    reminded_at = NULL,
    updated_at = NOW();

  IF v_plan.dual_approval_included THEN
    UPDATE public.jamiyas
    SET dual_approval_enabled = TRUE, updated_at = NOW()
    WHERE id = p_jamiya_id AND dual_approval_enabled = FALSE;
  END IF;

  PERFORM private.record_choice(v_uid, 'circle_plan', p_jamiya_id, 'trial_started',
    jsonb_build_object('plan_id', p_plan_id, 'billing_period', v_period, 'trial_ends_at', v_ends,
                       'price_after_trial', v_price));

  INSERT INTO public.audit_logs (actor_id, action, entity_type, entity_id, jamiya_id, metadata)
  VALUES (v_uid, 'update', 'circle_subscription', p_jamiya_id, p_jamiya_id,
          jsonb_build_object('kind', 'trial_started', 'plan_id', p_plan_id, 'billing_period', v_period,
                             'trial_ends_at', v_ends));

  RETURN jsonb_build_object('ok', true, 'plan_id', p_plan_id, 'billing_period', v_period,
                            'trial_ends_at', v_ends, 'price_after_trial', v_price);
END;
$$;

-- ---------------------------------------------------------------------------
-- 6. Reading the plan: a plan that has ended reads as Free
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_circle_plan(p_jamiya_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  v_sub public.circle_subscriptions%ROWTYPE;
  v_plan public.platform_plans%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'UNAUTHENTICATED');
  END IF;

  SELECT * INTO v_sub FROM public.circle_subscriptions WHERE jamiya_id = p_jamiya_id;
  IF NOT FOUND OR v_sub.status = 'cancelled' THEN
    SELECT * INTO v_plan FROM public.platform_plans WHERE id = 'free';
    RETURN jsonb_build_object(
      'ok', true,
      'plan_id', 'free',
      'plan', to_jsonb(v_plan),
      'status', 'active',
      'implicit', true,
      'auto_renew', false,
      'trial_used', FOUND AND v_sub.trial_ends_at IS NOT NULL
    );
  END IF;

  SELECT * INTO v_plan FROM public.platform_plans WHERE id = v_sub.plan_id;
  RETURN jsonb_build_object(
    'ok', true,
    'plan_id', v_sub.plan_id,
    'plan', to_jsonb(v_plan),
    'status', v_sub.status,
    'renews_at', v_sub.renews_at,
    'billing_period', v_sub.billing_period,
    'price_kes', v_sub.price_kes,
    'trial_ends_at', v_sub.trial_ends_at,
    'trial_used', v_sub.trial_ends_at IS NOT NULL,
    'implicit', false,
    'auto_renew', v_sub.auto_renew
  );
END;
$$;

-- ---------------------------------------------------------------------------
-- 7. Renewals, trial ends, reminders and the grace period
-- ---------------------------------------------------------------------------
-- Officer notices about the plan link to the officer page.
CREATE OR REPLACE FUNCTION private.notify_circle_plan(p_jamiya_id UUID, p_title TEXT, p_body TEXT, p_data JSONB)
RETURNS VOID
LANGUAGE sql
SECURITY DEFINER
SET search_path TO ''
AS $$
  SELECT private.notify_circle_officers(
    p_jamiya_id, p_title, p_body,
    p_data || jsonb_build_object('jamiya_id', p_jamiya_id,
      'href', '/circles/' || (SELECT slug FROM public.jamiyas WHERE id = p_jamiya_id) || '/officer'));
$$;

CREATE OR REPLACE FUNCTION public.process_circle_subscription_renewals()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  v_row RECORD;
  v_plan public.platform_plans%ROWTYPE;
  v_next_plan TEXT;
  v_members INT;
  v_quote JSONB;
  v_price NUMERIC;
  v_payer UUID;
  v_tx UUID;
  v_period_label TEXT;
  v_renewed INT := 0;
  v_past_due INT := 0;
  v_skipped INT := 0;
  v_ended INT := 0;
  v_trials_ended INT := 0;
  v_reminded INT := 0;
BEGIN
  -- Reminders three days ahead, once per period.
  FOR v_row IN
    SELECT s.*, p.name AS plan_name, j.member_count
    FROM public.circle_subscriptions s
    JOIN public.platform_plans p ON p.id = s.plan_id
    JOIN public.jamiyas j ON j.id = s.jamiya_id
    WHERE s.status IN ('trial', 'active')
      AND s.renews_at IS NOT NULL
      AND s.renews_at > NOW()
      AND s.renews_at <= NOW() + INTERVAL '3 days'
      AND s.reminded_at IS NULL
    LIMIT 200
  LOOP
    v_next_plan := v_row.plan_id;
    SELECT * INTO v_plan FROM public.platform_plans WHERE id = v_row.plan_id;
    IF coalesce(v_row.member_count, 0) > v_plan.max_members THEN
      v_next_plan := coalesce(private.smallest_paid_plan_for(v_row.member_count), v_row.plan_id);
    END IF;
    v_price := (private.circle_plan_charge(v_row.jamiya_id, v_next_plan, v_row.billing_period)->>'price')::numeric;

    PERFORM private.notify_circle_plan(
      v_row.jamiya_id,
      CASE WHEN v_row.status = 'trial' THEN 'Free trial ending soon' ELSE 'Circle plan renews soon' END,
      CASE
        WHEN v_row.status = 'trial' AND v_row.auto_renew THEN
          format('Your %s trial ends on %s. Auto-pay is on, so KES %s will be charged to an officer wallet then.',
                 v_row.plan_name, to_char(v_row.renews_at AT TIME ZONE 'Africa/Nairobi', 'DD Mon YYYY'), v_price::text)
        WHEN v_row.status = 'trial' THEN
          format('Your %s trial ends on %s. To keep it, pay in Officer → Circle plan or turn auto-pay on. Otherwise the circle moves to Free; no records are removed.',
                 v_row.plan_name, to_char(v_row.renews_at AT TIME ZONE 'Africa/Nairobi', 'DD Mon YYYY'))
        WHEN v_row.auto_renew AND v_next_plan <> v_row.plan_id THEN
          format('Your circle now has %s members, more than %s allows. On %s it renews on the %s plan for KES %s.',
                 v_row.member_count::text, v_row.plan_name,
                 to_char(v_row.renews_at AT TIME ZONE 'Africa/Nairobi', 'DD Mon YYYY'),
                 (SELECT name FROM public.platform_plans WHERE id = v_next_plan), v_price::text)
        WHEN v_row.auto_renew THEN
          format('Your %s plan renews on %s for KES %s, charged to an officer wallet.',
                 v_row.plan_name, to_char(v_row.renews_at AT TIME ZONE 'Africa/Nairobi', 'DD Mon YYYY'), v_price::text)
        ELSE
          format('Your %s plan ends on %s because auto-renew is off. The circle then moves to Free; no records are removed.',
                 v_row.plan_name, to_char(v_row.renews_at AT TIME ZONE 'Africa/Nairobi', 'DD Mon YYYY'))
      END,
      jsonb_build_object('plan_id', v_row.plan_id, 'kind', 'plan_reminder')
    );
    UPDATE public.circle_subscriptions SET reminded_at = NOW() WHERE jamiya_id = v_row.jamiya_id;
    v_reminded := v_reminded + 1;
  END LOOP;

  -- Due now.
  FOR v_row IN
    SELECT s.*, coalesce(j.member_count, 0) AS member_count
    FROM public.circle_subscriptions s
    JOIN public.jamiyas j ON j.id = s.jamiya_id
    WHERE s.status IN ('trial', 'active', 'past_due')
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

    -- Trial over and nobody asked to pay: back to Free.
    IF v_row.status = 'trial' AND NOT v_row.auto_renew THEN
      UPDATE public.circle_subscriptions
      SET plan_id = 'free', status = 'active', renews_at = NULL, price_kes = 0,
          notes = 'trial ended', reminded_at = NULL, updated_at = NOW()
      WHERE jamiya_id = v_row.jamiya_id;
      PERFORM private.notify_circle_plan(
        v_row.jamiya_id, 'Free trial ended',
        format('Your %s trial has ended and the circle is now on Free. Nothing was charged and no records were removed. Choose a plan in Officer → Circle plan whenever you are ready.', v_plan.name),
        jsonb_build_object('plan_id', v_row.plan_id, 'kind', 'trial_ended'));
      v_trials_ended := v_trials_ended + 1;
      CONTINUE;
    END IF;

    IF NOT v_row.auto_renew THEN
      UPDATE public.circle_subscriptions
      SET status = 'cancelled', renews_at = NULL, notes = 'ended: auto-renew off', updated_at = NOW()
      WHERE jamiya_id = v_row.jamiya_id;
      PERFORM private.notify_circle_plan(
        v_row.jamiya_id, 'Circle plan ended',
        format('Your %s plan ended and was not renewed, because auto-renew is off. The circle is on Free; no records were removed. Choose a plan again in Officer → Circle plan whenever you need it.', v_plan.name),
        jsonb_build_object('plan_id', v_row.plan_id));
      v_ended := v_ended + 1;
      CONTINUE;
    END IF;

    -- Unpaid for more than 7 days: drop to Free.
    IF v_row.status = 'past_due' AND v_row.renews_at < NOW() - INTERVAL '7 days' THEN
      UPDATE public.circle_subscriptions
      SET status = 'cancelled', renews_at = NULL, notes = 'ended: unpaid after 7 days', updated_at = NOW()
      WHERE jamiya_id = v_row.jamiya_id;
      PERFORM private.notify_circle_plan(
        v_row.jamiya_id, 'Circle plan ended',
        format('Your %s plan could not be paid for 7 days, so the circle is now on Free. No records were removed. Top up Money and choose a plan in Officer → Circle plan to restore it.', v_plan.name),
        jsonb_build_object('plan_id', v_row.plan_id, 'kind', 'grace_ended'));
      v_ended := v_ended + 1;
      CONTINUE;
    END IF;

    -- A circle that outgrew its plan renews on the smallest plan that fits.
    v_next_plan := v_row.plan_id;
    IF v_row.member_count > v_plan.max_members THEN
      v_next_plan := coalesce(private.smallest_paid_plan_for(v_row.member_count), v_row.plan_id);
      SELECT * INTO v_plan FROM public.platform_plans WHERE id = v_next_plan;
    END IF;
    v_quote := private.circle_plan_charge(v_row.jamiya_id, v_next_plan, v_row.billing_period);
    v_price := (v_quote->>'price')::numeric;
    v_period_label := CASE v_row.billing_period WHEN 'quarterly' THEN '3 months'
                                                WHEN 'annual' THEN '1 year' ELSE '1 month' END;

    SELECT m.user_id INTO v_payer
    FROM public.members m
    WHERE m.jamiya_id = v_row.jamiya_id
      AND m.status = 'active'
      AND m.role IN ('circle_admin', 'chair', 'treasurer')
    ORDER BY CASE m.role WHEN 'circle_admin' THEN 1 WHEN 'chair' THEN 2 ELSE 3 END
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
        v_price,
        'fee'::public.transaction_type,
        v_row.jamiya_id,
        'circle_plan_renewal:' || v_next_plan,
        -- One charge per period that falls due.
        v_row.jamiya_id::text || ':plan-renew:' || v_next_plan || ':' || v_row.billing_period || ':'
          || floor(extract(epoch FROM v_row.renews_at))::text,
        jsonb_build_object('kind', 'circle_plan_renewal', 'plan_id', v_next_plan,
                           'billing_period', v_row.billing_period, 'price', v_price,
                           'discount_pct', v_quote->'discount_pct')
      );

      UPDATE public.circle_subscriptions
      SET plan_id = v_next_plan,
          status = 'active',
          started_at = NOW(),
          renews_at = NOW() + private.circle_plan_period_interval(v_row.billing_period),
          price_kes = v_price,
          reminded_at = NULL,
          launch_discount_used = launch_discount_used OR (v_quote->>'discount_pct')::numeric > 0,
          notes = 'renewed tx ' || v_tx::text,
          updated_at = NOW()
      WHERE jamiya_id = v_row.jamiya_id;

      INSERT INTO public.notifications (user_id, type, channel, title, body, data)
      VALUES (
        v_payer, 'system'::public.notification_type, 'in_app'::public.notification_channel,
        CASE WHEN v_row.status = 'trial' THEN 'Circle plan started' ELSE 'Circle plan renewed' END,
        format('Your %s plan is paid for %s (KES %s charged to your wallet). You can turn auto-renew off in You → My choices.',
               v_plan.name, v_period_label, v_price::text),
        jsonb_build_object('jamiya_id', v_row.jamiya_id, 'plan_id', v_next_plan, 'transaction_id', v_tx)
      );

      INSERT INTO public.audit_logs (actor_id, action, entity_type, entity_id, jamiya_id, metadata)
      VALUES (v_payer, 'update', 'circle_subscription', v_row.jamiya_id, v_row.jamiya_id,
              jsonb_build_object('kind', 'auto_renew', 'plan_id', v_next_plan,
                                 'billing_period', v_row.billing_period, 'price', v_price,
                                 'transaction_id', v_tx));

      v_renewed := v_renewed + 1;
    EXCEPTION WHEN OTHERS THEN
      UPDATE public.circle_subscriptions
      SET status = 'past_due', updated_at = NOW(), notes = left(SQLERRM, 200)
      WHERE jamiya_id = v_row.jamiya_id;

      IF v_row.status <> 'past_due' THEN
        PERFORM private.notify_circle_plan(
          v_row.jamiya_id, 'Circle plan past due',
          format('Could not take KES %s for the %s plan. Top up Money, then open Officer → Circle plan. The plan stays on for 7 days.',
                 v_price::text, v_plan.name),
          jsonb_build_object('plan_id', v_next_plan, 'error', SQLERRM));
      END IF;
      v_past_due := v_past_due + 1;
    END;
  END LOOP;

  RETURN jsonb_build_object(
    'ok', true,
    'renewed', v_renewed,
    'past_due', v_past_due,
    'skipped', v_skipped,
    'ended', v_ended,
    'trials_ended', v_trials_ended,
    'reminded', v_reminded
  );
END;
$$;


-- ---------------------------------------------------------------------------
-- 8. Admin revenue summary: recurring revenue from what circles actually pay
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_revenue_summary(p_from date, p_to date)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  v_from timestamptz := p_from::timestamptz;
  v_to timestamptz := (p_to + 1)::timestamptz;
  v_result jsonb;
BEGIN
  IF NOT private.is_platform_admin() THEN
    RETURN jsonb_build_object('ok', false, 'error', 'FORBIDDEN');
  END IF;

  WITH income AS (
    SELECT la.code, la.name, je.posted_at, je.jamiya_id,
           CASE WHEN jl.side = 'credit' THEN jl.amount ELSE -jl.amount END AS amt
    FROM public.journal_lines jl
    JOIN public.journal_entries je ON je.id = jl.journal_entry_id
    JOIN public.ledger_accounts la ON la.id = jl.ledger_account_id
    WHERE la.code BETWEEN '2100' AND '2199'
  ),
  in_range AS (
    SELECT * FROM income WHERE posted_at >= v_from AND posted_at < v_to
  )
  SELECT jsonb_build_object(
    'ok', true,
    'from', p_from,
    'to', p_to,
    'total', coalesce((SELECT sum(amt) FROM in_range), 0),
    'all_time', coalesce((SELECT sum(amt) FROM income), 0),
    'by_stream', coalesce((
      SELECT jsonb_agg(jsonb_build_object('code', s.code, 'name', s.name, 'amount', s.amount) ORDER BY s.code)
      FROM (
        SELECT la.code, la.name, coalesce((SELECT sum(amt) FROM in_range r WHERE r.code = la.code), 0) AS amount
        FROM public.ledger_accounts la
        WHERE la.code BETWEEN '2100' AND '2199'
      ) s
    ), '[]'::jsonb),
    'by_day', coalesce((
      SELECT jsonb_agg(jsonb_build_object('day', d.day, 'amount', d.amount) ORDER BY d.day)
      FROM (
        SELECT (posted_at AT TIME ZONE 'Africa/Nairobi')::date AS day, sum(amt) AS amount
        FROM in_range GROUP BY 1
      ) d
    ), '[]'::jsonb),
    'by_circle', coalesce((
      SELECT jsonb_agg(jsonb_build_object('jamiya_id', c.jamiya_id, 'name', c.name, 'amount', c.amount) ORDER BY c.amount DESC)
      FROM (
        SELECT r.jamiya_id, j.name, sum(r.amt) AS amount
        FROM in_range r LEFT JOIN public.jamiyas j ON j.id = r.jamiya_id
        WHERE r.jamiya_id IS NOT NULL
        GROUP BY 1, 2
        ORDER BY 3 DESC
        LIMIT 10
      ) c
    ), '[]'::jsonb),
    'paying_circles', (
      SELECT count(*) FROM public.circle_subscriptions s
      WHERE s.status IN ('active', 'past_due') AND coalesce(s.price_kes, 0) > 0
    ),
    'trials', (SELECT count(*) FROM public.circle_subscriptions WHERE status = 'trial'),
    'monthly_recurring', coalesce((
      SELECT round(sum(s.price_kes / CASE s.billing_period WHEN 'quarterly' THEN 3
                                                           WHEN 'annual' THEN 12 ELSE 1 END))
      FROM public.circle_subscriptions s
      WHERE s.status IN ('active', 'past_due') AND coalesce(s.price_kes, 0) > 0
    ), 0),
    'circles_total', (SELECT count(*) FROM public.jamiyas WHERE status IN ('open', 'active')),
    'financing_fees_agreed', coalesce((
      SELECT sum(platform_fee_amount) FROM public.tawarruq_applications
      WHERE status IN ('approved', 'submitted_to_partner', 'disbursed')
    ), 0)
  ) INTO v_result;

  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_revenue_summary(date, date) FROM PUBLIC, anon;

-- ---------------------------------------------------------------------------
-- 9. My choices: show the price and period the circle actually pays
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
               'plan_id', cs.plan_id, 'plan_name', pp.name,
               'price_kes', coalesce(cs.price_kes, pp.price_kes), 'billing_period', cs.billing_period,
               'status', cs.status, 'renews_at', cs.renews_at, 'auto_renew', cs.auto_renew)
             ORDER BY j.name), '[]'::jsonb)
      FROM public.members m
      JOIN public.jamiyas j ON j.id = m.jamiya_id
      JOIN public.circle_subscriptions cs ON cs.jamiya_id = j.id
      JOIN public.platform_plans pp ON pp.id = cs.plan_id
      WHERE m.user_id = v_uid AND m.status = 'active'
        AND m.role IN ('circle_admin', 'chair', 'treasurer')
        AND pp.price_kes > 0
        AND cs.status <> 'cancelled'
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

-- ---------------------------------------------------------------------------
-- 10. Tawarruq: final per-term rates (about 1% a month)
-- ---------------------------------------------------------------------------
INSERT INTO public.platform_settings (key, value)
VALUES ('tawarruq_profit_bps', '{"3": 350, "6": 650, "12": 1200, "24": 2200}'::jsonb)
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;

-- ---------------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------------
REVOKE ALL ON FUNCTION private.circle_plan_period_interval(TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION private.circle_plan_list_price(TEXT, INT, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION private.circle_plan_launch_discount_pct(UUID, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION private.circle_plan_charge(UUID, TEXT, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION private.smallest_paid_plan_for(INT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION private.apply_circle_plan(UUID, TEXT, UUID, TEXT, NUMERIC, BOOLEAN) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION private.notify_circle_plan(UUID, TEXT, TEXT, JSONB) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.circle_plan_quotes(UUID) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.set_circle_plan(UUID, TEXT, TEXT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.start_circle_plan_trial(UUID, TEXT, TEXT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_circle_plan(UUID) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.process_circle_subscription_renewals() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.admin_revenue_summary(date, date) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_my_choices() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.circle_plan_quotes(UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.set_circle_plan(UUID, TEXT, TEXT) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.start_circle_plan_trial(UUID, TEXT, TEXT) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_circle_plan(UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.process_circle_subscription_renewals() TO service_role;
GRANT EXECUTE ON FUNCTION public.admin_revenue_summary(date, date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_my_choices() TO authenticated, service_role;
