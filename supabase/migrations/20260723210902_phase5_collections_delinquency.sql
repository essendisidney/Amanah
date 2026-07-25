-- Phase 5: Collections / delinquency automation

CREATE TYPE public.collection_status AS ENUM (
  'open',
  'contacted',
  'promised',
  'partially_paid',
  'resolved',
  'written_off',
  'cancelled'
);

CREATE TYPE public.collection_severity AS ENUM (
  'watch',
  'overdue',
  'severe',
  'critical'
);

CREATE TABLE public.collection_cases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  jamiya_id UUID NOT NULL REFERENCES public.jamiyas (id) ON DELETE CASCADE,
  member_id UUID NOT NULL REFERENCES public.members (id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  contribution_id UUID REFERENCES public.contributions (id) ON DELETE SET NULL,
  status public.collection_status NOT NULL DEFAULT 'open',
  severity public.collection_severity NOT NULL DEFAULT 'overdue',
  amount_due NUMERIC(14, 2) NOT NULL CHECK (amount_due > 0),
  currency CHAR(3) NOT NULL DEFAULT 'KES',
  days_overdue INT NOT NULL DEFAULT 0,
  contact_attempts INT NOT NULL DEFAULT 0,
  last_contacted_at TIMESTAMPTZ,
  promised_pay_date DATE,
  notes TEXT,
  assigned_to UUID REFERENCES public.profiles (id) ON DELETE SET NULL,
  resolved_at TIMESTAMPTZ,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX collection_cases_open_contribution_unique_idx
  ON public.collection_cases (contribution_id)
  WHERE contribution_id IS NOT NULL
    AND status IN ('open', 'contacted', 'promised', 'partially_paid');

CREATE INDEX collection_cases_status_severity_idx
  ON public.collection_cases (status, severity, days_overdue DESC);

CREATE INDEX collection_cases_jamiya_idx ON public.collection_cases (jamiya_id, status);
CREATE INDEX collection_cases_user_idx ON public.collection_cases (user_id);

CREATE TRIGGER collection_cases_set_updated_at
  BEFORE UPDATE ON public.collection_cases
  FOR EACH ROW EXECUTE FUNCTION private.set_updated_at();

ALTER TABLE public.collection_cases ENABLE ROW LEVEL SECURITY;

CREATE POLICY "collection_cases_select"
  ON public.collection_cases FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR private.is_circle_admin(jamiya_id)
    OR private.is_compliance_or_admin()
  );

CREATE POLICY "collection_cases_update_admin"
  ON public.collection_cases FOR UPDATE TO authenticated
  USING (private.is_compliance_or_admin() OR private.is_circle_admin(jamiya_id))
  WITH CHECK (private.is_compliance_or_admin() OR private.is_circle_admin(jamiya_id));

REVOKE INSERT, DELETE ON public.collection_cases FROM authenticated, anon;
GRANT SELECT, UPDATE ON public.collection_cases TO authenticated;

CREATE OR REPLACE FUNCTION public.sync_collection_cases()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_row RECORD;
  v_opened INT := 0;
  v_resolved INT := 0;
  v_severity public.collection_severity;
  v_days INT;
  v_exists UUID;
BEGIN
  IF coalesce(auth.role(), '') <> 'service_role' AND NOT private.is_compliance_or_admin() THEN
    RETURN jsonb_build_object('ok', false, 'error', 'FORBIDDEN');
  END IF;

  PERFORM public.mark_late_contributions();

  FOR v_row IN
    SELECT
      c.id AS contribution_id,
      c.jamiya_id,
      c.member_id,
      m.user_id,
      c.amount,
      c.currency,
      GREATEST(0, (CURRENT_DATE - c.due_date)) AS days_overdue
    FROM public.contributions c
    JOIN public.members m ON m.id = c.member_id
    WHERE c.status = 'late'
  LOOP
    v_days := v_row.days_overdue;
    v_severity := CASE
      WHEN v_days >= 30 THEN 'critical'::public.collection_severity
      WHEN v_days >= 14 THEN 'severe'::public.collection_severity
      WHEN v_days >= 7 THEN 'overdue'::public.collection_severity
      ELSE 'watch'::public.collection_severity
    END;

    SELECT id INTO v_exists
    FROM public.collection_cases
    WHERE contribution_id = v_row.contribution_id
      AND status IN ('open', 'contacted', 'promised', 'partially_paid')
    LIMIT 1;

    IF v_exists IS NULL THEN
      INSERT INTO public.collection_cases (
        jamiya_id, member_id, user_id, contribution_id,
        status, severity, amount_due, currency, days_overdue
      )
      VALUES (
        v_row.jamiya_id, v_row.member_id, v_row.user_id, v_row.contribution_id,
        'open', v_severity, v_row.amount, v_row.currency, v_days
      );
      v_opened := v_opened + 1;
    ELSE
      UPDATE public.collection_cases
      SET
        days_overdue = v_days,
        severity = v_severity,
        amount_due = v_row.amount,
        updated_at = NOW()
      WHERE id = v_exists;
    END IF;
  END LOOP;

  UPDATE public.collection_cases cc
  SET status = 'resolved', resolved_at = NOW(), updated_at = NOW()
  FROM public.contributions c
  WHERE cc.contribution_id = c.id
    AND c.status IN ('paid', 'waived')
    AND cc.status IN ('open', 'contacted', 'promised', 'partially_paid');

  GET DIAGNOSTICS v_resolved = ROW_COUNT;

  RETURN jsonb_build_object('ok', true, 'opened', v_opened, 'resolved', v_resolved);
END;
$$;

CREATE OR REPLACE FUNCTION public.update_collection_case(
  p_case_id UUID,
  p_status public.collection_status,
  p_notes TEXT DEFAULT NULL,
  p_promised_pay_date DATE DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_case public.collection_cases%ROWTYPE;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'UNAUTHENTICATED');
  END IF;

  SELECT * INTO v_case FROM public.collection_cases WHERE id = p_case_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'NOT_FOUND');
  END IF;

  IF NOT (private.is_compliance_or_admin() OR private.is_circle_admin(v_case.jamiya_id)) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'FORBIDDEN');
  END IF;

  UPDATE public.collection_cases
  SET
    status = p_status,
    notes = coalesce(p_notes, notes),
    promised_pay_date = coalesce(p_promised_pay_date, promised_pay_date),
    contact_attempts = CASE
      WHEN p_status IN ('contacted', 'promised') THEN contact_attempts + 1
      ELSE contact_attempts
    END,
    last_contacted_at = CASE
      WHEN p_status IN ('contacted', 'promised') THEN NOW()
      ELSE last_contacted_at
    END,
    assigned_to = coalesce(assigned_to, v_uid),
    resolved_at = CASE
      WHEN p_status IN ('resolved', 'written_off', 'cancelled') THEN NOW()
      ELSE resolved_at
    END,
    updated_at = NOW()
  WHERE id = p_case_id;

  INSERT INTO public.audit_logs (actor_id, action, entity_type, entity_id, jamiya_id, metadata)
  VALUES (
    v_uid, 'update', 'collection_case', p_case_id, v_case.jamiya_id,
    jsonb_build_object('status', p_status)
  );

  RETURN jsonb_build_object('ok', true);
END;
$$;

REVOKE ALL ON FUNCTION public.sync_collection_cases() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.update_collection_case(UUID, public.collection_status, TEXT, DATE) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.sync_collection_cases() TO authenticated;
GRANT EXECUTE ON FUNCTION public.sync_collection_cases() TO service_role;
GRANT EXECUTE ON FUNCTION public.update_collection_case(UUID, public.collection_status, TEXT, DATE) TO authenticated;

GRANT SELECT, INSERT, UPDATE ON public.collection_cases TO service_role;
GRANT SELECT, INSERT, UPDATE ON public.notification_outbox TO service_role;
