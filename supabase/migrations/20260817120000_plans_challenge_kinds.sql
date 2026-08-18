-- Challenge kinds (not merry-go-round by default for new circles) + collect SaaS plan fees

ALTER TABLE public.jamiyas
  ADD COLUMN IF NOT EXISTS challenge_kind TEXT NOT NULL DEFAULT 'rotating';

ALTER TABLE public.jamiyas
  DROP CONSTRAINT IF EXISTS jamiyas_challenge_kind_check;

ALTER TABLE public.jamiyas
  ADD CONSTRAINT jamiyas_challenge_kind_check
  CHECK (challenge_kind IN ('rotating', 'savings', 'share_dividend'));

COMMENT ON COLUMN public.jamiyas.challenge_kind IS
  'rotating = ROSCA payouts; savings = contribution rounds only; share_dividend = capital/dividends, no rotating payouts';

CREATE OR REPLACE FUNCTION public.activate_jamiya(p_jamiya_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_jamiya public.jamiyas%ROWTYPE;
  v_member RECORD;
  v_cycle INT;
  v_due DATE;
  v_start DATE;
  v_contrib_count INT := 0;
  v_payout_count INT := 0;
  v_skip_payouts BOOLEAN;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'UNAUTHENTICATED');
  END IF;

  IF NOT private.is_circle_admin(p_jamiya_id) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'FORBIDDEN');
  END IF;

  SELECT * INTO v_jamiya FROM public.jamiyas WHERE id = p_jamiya_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'NOT_FOUND');
  END IF;

  IF v_jamiya.status = 'active' THEN
    RETURN jsonb_build_object('ok', true, 'already_active', true);
  END IF;

  IF v_jamiya.member_count < 2 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'NOT_ENOUGH_MEMBERS');
  END IF;

  v_skip_payouts := coalesce(v_jamiya.challenge_kind, 'rotating') IN ('savings', 'share_dividend');

  v_cycle := 1;
  FOR v_member IN
    SELECT * FROM public.members
    WHERE jamiya_id = p_jamiya_id AND status = 'active'
    ORDER BY payout_position NULLS LAST, created_at
  LOOP
    IF v_member.payout_position IS NULL THEN
      UPDATE public.members SET payout_position = v_cycle, updated_at = NOW()
      WHERE id = v_member.id;
    END IF;
    v_cycle := v_cycle + 1;
  END LOOP;

  v_start := COALESCE(v_jamiya.start_date, CURRENT_DATE);

  FOR v_cycle IN 1..v_jamiya.cycle_count LOOP
    v_due := v_start + ((v_cycle - 1) * v_jamiya.contribution_frequency_days);

    FOR v_member IN
      SELECT * FROM public.members
      WHERE jamiya_id = p_jamiya_id AND status = 'active'
    LOOP
      INSERT INTO public.contributions (
        jamiya_id, member_id, cycle_number, amount, currency, status, due_date
      )
      VALUES (
        p_jamiya_id, v_member.id, v_cycle, v_jamiya.contribution_amount,
        v_jamiya.currency, 'pending', v_due
      )
      ON CONFLICT (member_id, cycle_number) DO NOTHING;
      v_contrib_count := v_contrib_count + 1;
    END LOOP;
  END LOOP;

  IF NOT v_skip_payouts THEN
    FOR v_member IN
      SELECT * FROM public.members
      WHERE jamiya_id = p_jamiya_id AND status = 'active' AND payout_position IS NOT NULL
      ORDER BY payout_position
    LOOP
      IF v_member.payout_position > v_jamiya.cycle_count THEN
        CONTINUE;
      END IF;
      v_due := v_start + ((v_member.payout_position - 1) * v_jamiya.contribution_frequency_days);
      INSERT INTO public.payouts (
        jamiya_id, member_id, cycle_number, amount, currency, status, scheduled_date
      )
      VALUES (
        p_jamiya_id,
        v_member.id,
        v_member.payout_position,
        v_jamiya.contribution_amount * v_jamiya.member_count,
        v_jamiya.currency,
        'scheduled',
        v_due
      )
      ON CONFLICT (jamiya_id, cycle_number) DO NOTHING;
      v_payout_count := v_payout_count + 1;
    END LOOP;
  END IF;

  UPDATE public.jamiyas
  SET status = 'active', current_cycle = 1, start_date = v_start, updated_at = NOW()
  WHERE id = p_jamiya_id;

  INSERT INTO public.audit_logs (actor_id, action, entity_type, entity_id, jamiya_id, metadata)
  VALUES (
    v_uid, 'update', 'jamiya', p_jamiya_id, p_jamiya_id,
    jsonb_build_object(
      'activated', true,
      'contributions', v_contrib_count,
      'payouts', v_payout_count,
      'challenge_kind', v_jamiya.challenge_kind
    )
  );

  INSERT INTO public.notifications (user_id, type, channel, title, body, data)
  SELECT
    m.user_id,
    'system',
    'in_app',
    'Circle activated',
    v_jamiya.name || ' is now active. Contributions are on the schedule.',
    jsonb_build_object('jamiya_id', p_jamiya_id, 'slug', v_jamiya.slug)
  FROM public.members m
  WHERE m.jamiya_id = p_jamiya_id AND m.status = 'active';

  RETURN jsonb_build_object(
    'ok', true,
    'contributions_created', v_contrib_count,
    'payouts_created', v_payout_count,
    'challenge_kind', v_jamiya.challenge_kind
  );
END;
$$;

CREATE OR REPLACE FUNCTION private.apply_circle_plan(
  p_jamiya_id UUID,
  p_plan_id TEXT,
  p_tx UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_plan public.platform_plans%ROWTYPE;
  v_members INT;
BEGIN
  SELECT * INTO v_plan FROM public.platform_plans WHERE id = p_plan_id AND active;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'PLAN_NOT_FOUND');
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

  INSERT INTO public.circle_subscriptions (jamiya_id, plan_id, status, started_at, renews_at, updated_at, notes)
  VALUES (
    p_jamiya_id, p_plan_id, 'active', NOW(),
    CASE WHEN v_plan.price_kes > 0 THEN NOW() + INTERVAL '30 days' ELSE NULL END,
    NOW(),
    CASE WHEN p_tx IS NOT NULL THEN 'paid tx ' || p_tx::text ELSE NULL END
  )
  ON CONFLICT (jamiya_id) DO UPDATE SET
    plan_id = EXCLUDED.plan_id,
    status = 'active',
    started_at = NOW(),
    renews_at = EXCLUDED.renews_at,
    notes = EXCLUDED.notes,
    updated_at = NOW();

  IF v_plan.dual_approval_included THEN
    UPDATE public.jamiyas
    SET dual_approval_enabled = TRUE, updated_at = NOW()
    WHERE id = p_jamiya_id AND dual_approval_enabled = FALSE;
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'plan_id', p_plan_id,
    'price_kes', v_plan.price_kes,
    'max_members', v_plan.max_members,
    'transaction_id', p_tx
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.set_circle_plan(
  p_jamiya_id UUID,
  p_plan_id TEXT
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
  v_tx UUID;
  v_applied JSONB;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'UNAUTHENTICATED');
  END IF;
  IF NOT (private.is_circle_officer(p_jamiya_id) OR private.is_platform_admin()) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'FORBIDDEN');
  END IF;

  SELECT * INTO v_plan FROM public.platform_plans WHERE id = p_plan_id AND active;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'PLAN_NOT_FOUND');
  END IF;

  SELECT * INTO v_sub FROM public.circle_subscriptions WHERE jamiya_id = p_jamiya_id;
  IF FOUND AND v_sub.plan_id = p_plan_id AND v_sub.status = 'active' THEN
    RETURN jsonb_build_object('ok', true, 'already_active', true, 'plan_id', p_plan_id);
  END IF;

  IF coalesce(v_plan.price_kes, 0) > 0 THEN
    BEGIN
      v_tx := private.ledger_debit(
        v_uid,
        'KES',
        v_plan.price_kes,
        'fee'::public.transaction_type,
        p_jamiya_id,
        'circle_plan:' || p_plan_id,
        p_jamiya_id::text || ':plan:' || p_plan_id || ':' || floor(extract(epoch FROM now()))::text,
        jsonb_build_object('kind', 'circle_plan', 'plan_id', p_plan_id)
      );
    EXCEPTION WHEN OTHERS THEN
      RETURN jsonb_build_object('ok', false, 'error', SQLERRM);
    END;
  END IF;

  v_applied := private.apply_circle_plan(p_jamiya_id, p_plan_id, v_tx);
  IF coalesce(v_applied->>'ok', 'false') <> 'true' THEN
    RETURN v_applied;
  END IF;

  INSERT INTO public.audit_logs (actor_id, action, entity_type, entity_id, jamiya_id, metadata)
  VALUES (
    v_uid,
    'update',
    'jamiya',
    p_jamiya_id,
    p_jamiya_id,
    jsonb_build_object('plan_id', p_plan_id, 'price_kes', v_plan.price_kes, 'transaction_id', v_tx)
  );

  RETURN v_applied;
END;
$$;

CREATE OR REPLACE FUNCTION private.on_circle_plan_payment_completed()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_kind TEXT;
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

  v_kind := coalesce(NEW.metadata->>'kind', '');
  IF v_kind <> 'circle_plan' THEN
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

  v_applied := private.apply_circle_plan(v_jamiya, v_plan, NEW.transaction_id);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS payment_intents_circle_plan ON public.payment_intents;
CREATE TRIGGER payment_intents_circle_plan
  AFTER INSERT OR UPDATE OF status ON public.payment_intents
  FOR EACH ROW
  EXECUTE FUNCTION private.on_circle_plan_payment_completed();
