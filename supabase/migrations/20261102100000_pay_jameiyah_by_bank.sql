-- Circles pay Jameiyah by M-Pesa or bank transfer into Jameiyah Digital Limited's bank account.
--
-- 1. Every circle gets a short payment reference (JM10001, ...) to quote when it pays.
-- 2. Admins keep the payment details (bank, account, M-Pesa paybill and account) in one setting;
--    officers see them, with their reference, on the Circle plan card.
-- 3. An admin reads Jameiyah's bank statement and records each payment against a circle and plan.
--    A payment that covers the plan switches it on (or extends it from where it ends); a smaller
--    one is held until the rest arrives. Every payment is posted as circle plan income
--    (Dr 1100 Cash at platform / Cr 2110 Circle plan income) so it shows in Admin → Revenue.

-- ---------------------------------------------------------------------------
-- 1. Payment reference per circle
-- ---------------------------------------------------------------------------
CREATE SEQUENCE IF NOT EXISTS public.circle_billing_ref_seq START 10001;
ALTER TABLE public.jamiyas ADD COLUMN IF NOT EXISTS billing_ref TEXT;

UPDATE public.jamiyas j
SET billing_ref = 'JM' || nextval('public.circle_billing_ref_seq')::text
FROM (SELECT id FROM public.jamiyas WHERE billing_ref IS NULL ORDER BY created_at, id) o
WHERE j.id = o.id;

ALTER TABLE public.jamiyas
  ALTER COLUMN billing_ref SET DEFAULT ('JM' || nextval('public.circle_billing_ref_seq')::text),
  ALTER COLUMN billing_ref SET NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS jamiyas_billing_ref_key ON public.jamiyas (billing_ref);

-- ---------------------------------------------------------------------------
-- 2. Where circles pay
-- ---------------------------------------------------------------------------
INSERT INTO public.platform_settings (key, value) VALUES (
  'jameiyah_payment_details',
  jsonb_build_object(
    'account_name', 'JAMEIYAH DIGITAL LIMITED',
    'bank', 'Gulf African Bank',
    'branch', 'Jomo Kenyatta Avenue, Mombasa',
    'account', '0900739901'
  )
) ON CONFLICT (key) DO NOTHING;

-- Officers (and admins) see where to pay and their circle's reference.
CREATE OR REPLACE FUNCTION public.jameiyah_payment_details(p_jamiya_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO ''
AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT (private.is_circle_officer(p_jamiya_id) OR private.is_platform_admin()) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'FORBIDDEN');
  END IF;
  RETURN jsonb_build_object(
    'ok', true,
    'reference', (SELECT billing_ref FROM public.jamiyas WHERE id = p_jamiya_id),
    'details', coalesce((SELECT value FROM public.platform_settings WHERE key = 'jameiyah_payment_details'), '{}'::jsonb),
    'held', coalesce((SELECT sum(amount) FROM public.platform_plan_payments
                      WHERE jamiya_id = p_jamiya_id AND status = 'held'), 0)
  );
END;
$$;

-- Admins change the details. mpesa_account may contain {ref}, replaced by the circle's reference.
CREATE OR REPLACE FUNCTION public.admin_set_jameiyah_payment_details(
  p_account_name TEXT,
  p_bank TEXT,
  p_branch TEXT,
  p_account TEXT,
  p_paybill TEXT,
  p_mpesa_account TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  v_details JSONB;
BEGIN
  IF NOT private.is_platform_admin() THEN
    RETURN jsonb_build_object('ok', false, 'error', 'FORBIDDEN');
  END IF;
  IF greatest(char_length(coalesce(p_account_name, '')), char_length(coalesce(p_bank, '')),
              char_length(coalesce(p_branch, '')), char_length(coalesce(p_account, '')),
              char_length(coalesce(p_paybill, '')), char_length(coalesce(p_mpesa_account, ''))) > 80 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'INVALID');
  END IF;
  v_details := jsonb_strip_nulls(jsonb_build_object(
    'account_name', nullif(btrim(p_account_name), ''),
    'bank', nullif(btrim(p_bank), ''),
    'branch', nullif(btrim(p_branch), ''),
    'account', nullif(btrim(p_account), ''),
    'paybill', nullif(btrim(p_paybill), ''),
    'mpesa_account', nullif(btrim(p_mpesa_account), '')
  ));
  INSERT INTO public.platform_settings (key, value, updated_at)
  VALUES ('jameiyah_payment_details', v_details, NOW())
  ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW();

  INSERT INTO public.audit_logs (actor_id, action, entity_type, entity_id, metadata)
  VALUES (auth.uid(), 'update', 'platform_settings', NULL,
          jsonb_build_object('key', 'jameiyah_payment_details', 'value', v_details));
  RETURN jsonb_build_object('ok', true, 'details', v_details);
END;
$$;

-- ---------------------------------------------------------------------------
-- 3. Payments received
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.platform_plan_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reference TEXT NOT NULL UNIQUE,
  paid_on DATE,
  amount NUMERIC(14, 2) NOT NULL CHECK (amount > 0),
  jamiya_id UUID NOT NULL REFERENCES public.jamiyas (id) ON DELETE CASCADE,
  plan_id TEXT NOT NULL REFERENCES public.platform_plans (id),
  billing_period TEXT NOT NULL CHECK (billing_period IN ('monthly', 'quarterly', 'annual')),
  -- applied: paid for a plan period; held: short, waiting for the rest; used: a held payment that
  -- later went into a plan together with the payment that completed it.
  status TEXT NOT NULL CHECK (status IN ('applied', 'held', 'used')),
  details TEXT,
  recorded_by UUID NOT NULL REFERENCES auth.users (id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS platform_plan_payments_jamiya_idx ON public.platform_plan_payments (jamiya_id);

ALTER TABLE public.platform_plan_payments ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.platform_plan_payments FROM anon;
GRANT SELECT ON public.platform_plan_payments TO authenticated;
DROP POLICY IF EXISTS platform_plan_payments_select ON public.platform_plan_payments;
CREATE POLICY platform_plan_payments_select ON public.platform_plan_payments
  FOR SELECT TO authenticated
  USING (private.is_platform_admin() OR private.is_circle_officer(jamiya_id));

-- Start the plan, or for the plan the circle already has, add the period from where it ends.
CREATE OR REPLACE FUNCTION private.apply_bank_plan_payment(
  p_jamiya_id UUID,
  p_plan_id TEXT,
  p_period TEXT,
  p_price NUMERIC,
  p_discount_used BOOLEAN
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  v_sub public.circle_subscriptions%ROWTYPE;
  v_from TIMESTAMPTZ;
  v_applied JSONB;
BEGIN
  SELECT * INTO v_sub FROM public.circle_subscriptions WHERE jamiya_id = p_jamiya_id FOR UPDATE;
  IF FOUND AND v_sub.plan_id = p_plan_id AND v_sub.status IN ('active', 'past_due')
     AND v_sub.renews_at IS NOT NULL THEN
    v_from := v_sub.renews_at;
    IF v_from + private.circle_plan_period_interval(p_period) < NOW() THEN
      v_from := NOW();
    END IF;
    UPDATE public.circle_subscriptions
    SET status = 'active',
        renews_at = v_from + private.circle_plan_period_interval(p_period),
        billing_period = p_period,
        price_kes = p_price,
        reminded_at = NULL,
        launch_discount_used = launch_discount_used OR coalesce(p_discount_used, false),
        notes = 'paid by bank',
        updated_at = NOW()
    WHERE jamiya_id = p_jamiya_id;
    RETURN jsonb_build_object('ok', true, 'extended', true,
                              'renews_at', v_from + private.circle_plan_period_interval(p_period));
  END IF;

  v_applied := private.apply_circle_plan(p_jamiya_id, p_plan_id, NULL, p_period, p_price, p_discount_used);
  IF coalesce((v_applied->>'ok')::boolean, false) THEN
    UPDATE public.circle_subscriptions SET notes = 'paid by bank' WHERE jamiya_id = p_jamiya_id;
  END IF;
  RETURN v_applied;
END;
$$;

-- Payment references already recorded, for the admin matching page.
CREATE OR REPLACE FUNCTION public.admin_plan_payment_refs()
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO ''
AS $$
BEGIN
  IF NOT private.is_platform_admin() THEN
    RETURN jsonb_build_object('ok', false, 'error', 'FORBIDDEN');
  END IF;
  RETURN jsonb_build_object('ok', true, 'refs',
    coalesce((SELECT jsonb_agg(reference) FROM public.platform_plan_payments), '[]'::jsonb));
END;
$$;

-- Record payments read from Jameiyah's bank statement.
-- p_rows: [{reference, paid_on, amount, jamiya_id, plan_id, period, details}]
CREATE OR REPLACE FUNCTION public.admin_record_plan_payments(p_rows JSONB)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_row JSONB;
  v_ref TEXT;
  v_amount NUMERIC;
  v_jamiya UUID;
  v_plan TEXT;
  v_period TEXT;
  v_paid_on DATE;
  v_quote JSONB;
  v_price NUMERIC;
  v_held NUMERIC;
  v_applied JSONB;
  v_status TEXT;
  v_id UUID;
  v_plan_name TEXT;
  v_results JSONB := '[]'::jsonb;
  v_recorded INT := 0;
  v_activated INT := 0;
  v_duplicates INT := 0;
BEGIN
  IF v_uid IS NULL OR NOT private.is_platform_admin() THEN
    RETURN jsonb_build_object('ok', false, 'error', 'FORBIDDEN');
  END IF;
  IF p_rows IS NULL OR jsonb_typeof(p_rows) <> 'array' OR jsonb_array_length(p_rows) = 0
     OR jsonb_array_length(p_rows) > 500 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'INVALID');
  END IF;

  FOR v_row IN SELECT * FROM jsonb_array_elements(p_rows) LOOP
    v_ref := upper(left(btrim(coalesce(v_row->>'reference', '')), 64));
    v_plan := btrim(coalesce(v_row->>'plan_id', ''));
    v_period := coalesce(nullif(btrim(v_row->>'period'), ''), 'monthly');
    BEGIN
      v_amount := round((v_row->>'amount')::numeric, 2);
      v_jamiya := (v_row->>'jamiya_id')::uuid;
      v_paid_on := nullif(v_row->>'paid_on', '')::date;
    EXCEPTION WHEN OTHERS THEN
      v_results := v_results || jsonb_build_object('reference', v_ref, 'status', 'invalid');
      CONTINUE;
    END;

    SELECT name INTO v_plan_name FROM public.platform_plans WHERE id = v_plan AND active AND price_kes > 0;
    IF v_ref = '' OR v_amount IS NULL OR v_amount <= 0 OR v_jamiya IS NULL OR v_plan_name IS NULL
       OR v_period NOT IN ('monthly', 'quarterly', 'annual')
       OR NOT EXISTS (SELECT 1 FROM public.jamiyas WHERE id = v_jamiya) THEN
      v_results := v_results || jsonb_build_object('reference', v_ref, 'status', 'invalid');
      CONTINUE;
    END IF;
    IF EXISTS (SELECT 1 FROM public.platform_plan_payments WHERE reference = v_ref) THEN
      v_results := v_results || jsonb_build_object('reference', v_ref, 'status', 'duplicate');
      v_duplicates := v_duplicates + 1;
      CONTINUE;
    END IF;

    v_quote := private.circle_plan_charge(v_jamiya, v_plan, v_period);
    v_price := (v_quote->>'price')::numeric;
    SELECT coalesce(sum(amount), 0) INTO v_held
    FROM public.platform_plan_payments WHERE jamiya_id = v_jamiya AND status = 'held';

    IF v_amount + v_held >= v_price THEN
      v_applied := private.apply_bank_plan_payment(
        v_jamiya, v_plan, v_period, v_price, (v_quote->>'discount_pct')::numeric > 0);
      IF NOT coalesce((v_applied->>'ok')::boolean, false) THEN
        v_results := v_results || jsonb_build_object('reference', v_ref, 'status', 'invalid',
                                                     'error', v_applied->>'error');
        CONTINUE;
      END IF;
      UPDATE public.platform_plan_payments SET status = 'used'
      WHERE jamiya_id = v_jamiya AND status = 'held';
      v_status := 'applied';
      v_activated := v_activated + 1;
    ELSE
      v_status := 'held';
    END IF;

    INSERT INTO public.platform_plan_payments (
      reference, paid_on, amount, jamiya_id, plan_id, billing_period, status, details, recorded_by
    ) VALUES (
      v_ref, v_paid_on, v_amount, v_jamiya, v_plan, v_period, v_status, left(v_row->>'details', 500), v_uid
    ) RETURNING id INTO v_id;

    PERFORM private.post_balanced_journal(
      'plan_bank_payment', v_id::text, 'OPERATING', 'Circle plan paid by bank ' || v_ref, 'KES',
      '1100', '2110', v_amount, NULL, v_jamiya, NULL,
      jsonb_build_object('kind', 'circle_plan', 'reference', v_ref, 'plan_id', v_plan,
                         'billing_period', v_period));

    PERFORM private.notify_circle_plan(
      v_jamiya,
      CASE WHEN v_status = 'applied' THEN 'Payment received: plan is on' ELSE 'Part payment received' END,
      CASE WHEN v_status = 'applied' THEN
        format('Thank you. KES %s received (ref %s). Your %s plan is paid for %s.',
               v_amount::text, v_ref, v_plan_name,
               CASE v_period WHEN 'quarterly' THEN '3 months' WHEN 'annual' THEN '1 year' ELSE '1 month' END)
      ELSE
        format('KES %s received (ref %s). The %s plan costs KES %s; pay the remaining KES %s to switch it on.',
               v_amount::text, v_ref, v_plan_name, v_price::text, (v_price - v_amount - v_held)::text)
      END,
      jsonb_build_object('kind', 'plan_bank_payment', 'plan_id', v_plan, 'reference', v_ref));

    v_results := v_results || jsonb_build_object('reference', v_ref, 'status', v_status,
                                                 'price', v_price, 'jamiya_id', v_jamiya);
    v_recorded := v_recorded + 1;
  END LOOP;

  IF v_recorded > 0 THEN
    INSERT INTO public.audit_logs (actor_id, action, entity_type, entity_id, metadata)
    VALUES (v_uid, 'create', 'platform_plan_payments', NULL,
            jsonb_build_object('recorded', v_recorded, 'activated', v_activated, 'duplicates', v_duplicates));
  END IF;

  RETURN jsonb_build_object('ok', true, 'recorded', v_recorded, 'activated', v_activated,
                            'duplicates', v_duplicates, 'results', v_results);
END;
$$;

-- Circles that paid by bank have used up their free trial too; renewal messages point to M-Pesa and
-- bank payment.
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
  ) OR EXISTS (
    SELECT 1 FROM public.platform_plan_payments pp WHERE pp.jamiya_id = p_jamiya_id
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
          format('Your %s trial ends on %s. Auto-pay is on, so KES %s will be charged to an officer wallet then, unless you pay by M-Pesa or bank first (Officer → Circle plan).',
                 v_row.plan_name, to_char(v_row.renews_at AT TIME ZONE 'Africa/Nairobi', 'DD Mon YYYY'), v_price::text)
        WHEN v_row.status = 'trial' THEN
          format('Your %s trial ends on %s. To keep it, pay by M-Pesa or bank as shown in Officer → Circle plan. Otherwise the circle moves to Free; no records are removed.',
                 v_row.plan_name, to_char(v_row.renews_at AT TIME ZONE 'Africa/Nairobi', 'DD Mon YYYY'))
        WHEN v_row.auto_renew AND v_next_plan <> v_row.plan_id THEN
          format('Your circle now has %s members, more than %s allows. On %s it renews on the %s plan for KES %s.',
                 v_row.member_count::text, v_row.plan_name,
                 to_char(v_row.renews_at AT TIME ZONE 'Africa/Nairobi', 'DD Mon YYYY'),
                 (SELECT name FROM public.platform_plans WHERE id = v_next_plan), v_price::text)
        WHEN v_row.auto_renew THEN
          format('Your %s plan renews on %s for KES %s. Pay by M-Pesa or bank as shown in Officer → Circle plan; otherwise it is charged to an officer wallet.',
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
        format('Your %s plan could not be paid for 7 days, so the circle is now on Free. No records were removed. Pay by M-Pesa or bank as shown in Officer → Circle plan to restore it.', v_plan.name),
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
          format('Could not take KES %s for the %s plan. Pay by M-Pesa or bank as shown in Officer → Circle plan. The plan stays on for 7 days.',
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

REVOKE ALL ON FUNCTION public.jameiyah_payment_details(UUID) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_set_jameiyah_payment_details(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_plan_payment_refs() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_record_plan_payments(JSONB) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION private.apply_bank_plan_payment(UUID, TEXT, TEXT, NUMERIC, BOOLEAN) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.jameiyah_payment_details(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_set_jameiyah_payment_details(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_plan_payment_refs() TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_record_plan_payments(JSONB) TO authenticated;
