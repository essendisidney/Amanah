-- Per-member contributions toward a circle-linked savings goal (e.g. school fees).
-- Officers record different amounts per member; anyone in the circle can view totals.

CREATE TABLE IF NOT EXISTS public.savings_goal_contributions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  goal_id UUID NOT NULL REFERENCES public.savings_goals(id) ON DELETE CASCADE,
  jamiya_id UUID NOT NULL REFERENCES public.jamiyas(id) ON DELETE CASCADE,
  member_id UUID NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
  amount NUMERIC(14, 2) NOT NULL CHECK (amount > 0),
  currency CHAR(3) NOT NULL DEFAULT 'KES',
  effective_date DATE NOT NULL DEFAULT CURRENT_DATE,
  notes TEXT,
  recorded_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS savings_goal_contributions_goal_idx
  ON public.savings_goal_contributions (goal_id, effective_date DESC);

CREATE INDEX IF NOT EXISTS savings_goal_contributions_member_idx
  ON public.savings_goal_contributions (member_id, goal_id);

ALTER TABLE public.savings_goal_contributions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS sgc_select ON public.savings_goal_contributions;
CREATE POLICY sgc_select ON public.savings_goal_contributions
  FOR SELECT TO authenticated
  USING (
    private.is_active_jamiya_member(jamiya_id)
    OR private.is_circle_officer(jamiya_id)
    OR private.is_platform_admin()
  );

DROP POLICY IF EXISTS sgc_insert ON public.savings_goal_contributions;
CREATE POLICY sgc_insert ON public.savings_goal_contributions
  FOR INSERT TO authenticated
  WITH CHECK (
    private.is_circle_officer(jamiya_id)
    OR private.is_platform_admin()
  );

DROP POLICY IF EXISTS sgc_delete ON public.savings_goal_contributions;
CREATE POLICY sgc_delete ON public.savings_goal_contributions
  FOR DELETE TO authenticated
  USING (
    private.is_circle_officer(jamiya_id)
    OR private.is_platform_admin()
  );

CREATE OR REPLACE FUNCTION public.record_goal_contribution(
  p_goal_id UUID,
  p_member_id UUID,
  p_amount NUMERIC,
  p_effective_date DATE DEFAULT CURRENT_DATE,
  p_notes TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_goal public.savings_goals%ROWTYPE;
  v_member public.members%ROWTYPE;
  v_id UUID;
  v_total NUMERIC;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'UNAUTHENTICATED');
  END IF;

  SELECT * INTO v_goal FROM public.savings_goals WHERE id = p_goal_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'GOAL_NOT_FOUND');
  END IF;

  IF v_goal.jamiya_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'GOAL_NOT_LINKED_TO_CIRCLE');
  END IF;

  IF NOT (
    private.is_circle_officer(v_goal.jamiya_id)
    OR private.is_platform_admin()
  ) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'FORBIDDEN');
  END IF;

  IF p_amount IS NULL OR p_amount <= 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'INVALID_AMOUNT');
  END IF;

  SELECT * INTO v_member
  FROM public.members
  WHERE id = p_member_id
    AND jamiya_id = v_goal.jamiya_id
    AND status IN ('active', 'invited', 'suspended');

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'MEMBER_NOT_IN_CIRCLE');
  END IF;

  INSERT INTO public.savings_goal_contributions (
    goal_id, jamiya_id, member_id, amount, currency, effective_date, notes, recorded_by
  )
  VALUES (
    p_goal_id,
    v_goal.jamiya_id,
    p_member_id,
    p_amount,
    COALESCE(v_goal.currency, 'KES'),
    COALESCE(p_effective_date, CURRENT_DATE),
    NULLIF(trim(COALESCE(p_notes, '')), ''),
    v_uid
  )
  RETURNING id INTO v_id;

  SELECT COALESCE(SUM(amount), 0) INTO v_total
  FROM public.savings_goal_contributions
  WHERE goal_id = p_goal_id;

  UPDATE public.savings_goals
  SET saved_amount = v_total
  WHERE id = p_goal_id;

  RETURN jsonb_build_object(
    'ok', true,
    'contribution_id', v_id,
    'saved_amount', v_total,
    'target_amount', v_goal.target_amount
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.goal_member_totals(p_goal_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_goal public.savings_goals%ROWTYPE;
  v_members JSONB;
  v_events JSONB;
  v_total NUMERIC;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'UNAUTHENTICATED');
  END IF;

  SELECT * INTO v_goal FROM public.savings_goals WHERE id = p_goal_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'GOAL_NOT_FOUND');
  END IF;

  IF v_goal.jamiya_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'GOAL_NOT_LINKED_TO_CIRCLE');
  END IF;

  IF NOT (
    private.is_active_jamiya_member(v_goal.jamiya_id)
    OR private.is_circle_officer(v_goal.jamiya_id)
    OR private.is_platform_admin()
    OR v_goal.user_id = v_uid
  ) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'FORBIDDEN');
  END IF;

  SELECT COALESCE(SUM(amount), 0) INTO v_total
  FROM public.savings_goal_contributions
  WHERE goal_id = p_goal_id;

  SELECT COALESCE(jsonb_agg(row_to_json(t)::jsonb ORDER BY t.total_saved DESC, t.label), '[]'::jsonb)
  INTO v_members
  FROM (
    SELECT
      m.id AS member_id,
      m.member_code,
      COALESCE(p.full_name, p.email, p.phone, m.member_code, left(m.id::text, 8)) AS label,
      COALESCE(SUM(c.amount), 0)::numeric AS total_saved,
      COUNT(c.id)::int AS entry_count
    FROM public.members m
    LEFT JOIN public.profiles p ON p.id = m.user_id
    LEFT JOIN public.savings_goal_contributions c
      ON c.member_id = m.id AND c.goal_id = p_goal_id
    WHERE m.jamiya_id = v_goal.jamiya_id
      AND m.status IN ('active', 'invited', 'suspended')
    GROUP BY m.id, m.member_code, p.full_name, p.email, p.phone
  ) t;

  SELECT COALESCE(jsonb_agg(row_to_json(e)::jsonb ORDER BY e.effective_date DESC, e.created_at DESC), '[]'::jsonb)
  INTO v_events
  FROM (
    SELECT
      c.id,
      c.member_id,
      c.amount,
      c.effective_date,
      c.notes,
      c.created_at,
      COALESCE(p.full_name, p.email, p.phone, m.member_code, left(m.id::text, 8)) AS member_label
    FROM public.savings_goal_contributions c
    JOIN public.members m ON m.id = c.member_id
    LEFT JOIN public.profiles p ON p.id = m.user_id
    WHERE c.goal_id = p_goal_id
    ORDER BY c.effective_date DESC, c.created_at DESC
    LIMIT 100
  ) e;

  RETURN jsonb_build_object(
    'ok', true,
    'goal', jsonb_build_object(
      'id', v_goal.id,
      'title', v_goal.title,
      'target_amount', v_goal.target_amount,
      'saved_amount', v_total,
      'currency', v_goal.currency,
      'jamiya_id', v_goal.jamiya_id,
      'duration_months', v_goal.duration_months,
      'target_date', v_goal.target_date
    ),
    'members', v_members,
    'events', v_events,
    'can_record', (
      private.is_circle_officer(v_goal.jamiya_id) OR private.is_platform_admin()
    )
  );
END;
$$;

REVOKE ALL ON FUNCTION public.record_goal_contribution(UUID, UUID, NUMERIC, DATE, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.goal_member_totals(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.record_goal_contribution(UUID, UUID, NUMERIC, DATE, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.goal_member_totals(UUID) TO authenticated;
