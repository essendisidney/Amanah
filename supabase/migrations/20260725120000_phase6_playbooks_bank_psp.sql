-- Phase 6: Collections playbooks, bank PSP transfer jobs, observability hooks

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------
CREATE TYPE public.playbook_channel AS ENUM ('in_app', 'email', 'sms', 'call_task');
CREATE TYPE public.bank_transfer_status AS ENUM (
  'queued',
  'submitted',
  'settled',
  'failed',
  'cancelled'
);

-- ---------------------------------------------------------------------------
-- Collection playbooks
-- ---------------------------------------------------------------------------
CREATE TABLE public.collection_playbooks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  min_days_overdue INT NOT NULL DEFAULT 1 CHECK (min_days_overdue >= 0),
  max_days_overdue INT CHECK (max_days_overdue IS NULL OR max_days_overdue >= min_days_overdue),
  severity public.collection_severity,
  is_active BOOLEAN NOT NULL DEFAULT true,
  priority INT NOT NULL DEFAULT 100,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE public.collection_playbook_steps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  playbook_id UUID NOT NULL REFERENCES public.collection_playbooks (id) ON DELETE CASCADE,
  step_order INT NOT NULL CHECK (step_order >= 1),
  channel public.playbook_channel NOT NULL,
  delay_hours INT NOT NULL DEFAULT 0 CHECK (delay_hours >= 0),
  template_subject TEXT,
  template_body TEXT NOT NULL,
  create_agent_task BOOLEAN NOT NULL DEFAULT false,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (playbook_id, step_order)
);

CREATE TABLE public.collection_case_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id UUID NOT NULL REFERENCES public.collection_cases (id) ON DELETE CASCADE,
  playbook_id UUID REFERENCES public.collection_playbooks (id) ON DELETE SET NULL,
  step_id UUID REFERENCES public.collection_playbook_steps (id) ON DELETE SET NULL,
  actor_id UUID REFERENCES public.profiles (id) ON DELETE SET NULL,
  channel public.playbook_channel,
  action TEXT NOT NULL,
  notes TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX collection_case_actions_case_idx
  ON public.collection_case_actions (case_id, created_at DESC);

CREATE TRIGGER collection_playbooks_set_updated_at
  BEFORE UPDATE ON public.collection_playbooks
  FOR EACH ROW EXECUTE FUNCTION private.set_updated_at();

ALTER TABLE public.collection_playbooks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.collection_playbook_steps ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.collection_case_actions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "playbooks_select_compliance"
  ON public.collection_playbooks FOR SELECT TO authenticated
  USING (private.is_compliance_or_admin());

CREATE POLICY "playbooks_write_compliance"
  ON public.collection_playbooks FOR ALL TO authenticated
  USING (private.is_compliance_or_admin())
  WITH CHECK (private.is_compliance_or_admin());

CREATE POLICY "playbook_steps_select_compliance"
  ON public.collection_playbook_steps FOR SELECT TO authenticated
  USING (private.is_compliance_or_admin());

CREATE POLICY "playbook_steps_write_compliance"
  ON public.collection_playbook_steps FOR ALL TO authenticated
  USING (private.is_compliance_or_admin())
  WITH CHECK (private.is_compliance_or_admin());

CREATE POLICY "case_actions_select"
  ON public.collection_case_actions FOR SELECT TO authenticated
  USING (
    private.is_compliance_or_admin()
    OR EXISTS (
      SELECT 1 FROM public.collection_cases c
      WHERE c.id = case_id AND (c.user_id = auth.uid() OR private.is_circle_admin(c.jamiya_id))
    )
  );

CREATE POLICY "case_actions_insert_compliance"
  ON public.collection_case_actions FOR INSERT TO authenticated
  WITH CHECK (private.is_compliance_or_admin());

GRANT SELECT, INSERT, UPDATE, DELETE ON public.collection_playbooks TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.collection_playbook_steps TO authenticated;
GRANT SELECT, INSERT ON public.collection_case_actions TO authenticated;

-- ---------------------------------------------------------------------------
-- Bank transfer jobs (live PSP tracking for withdrawals / payouts)
-- ---------------------------------------------------------------------------
CREATE TABLE public.bank_transfer_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  withdrawal_id UUID REFERENCES public.withdrawal_requests (id) ON DELETE SET NULL,
  payment_intent_id UUID REFERENCES public.payment_intents (id) ON DELETE SET NULL,
  user_id UUID NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  amount NUMERIC(14, 2) NOT NULL CHECK (amount > 0),
  currency CHAR(3) NOT NULL DEFAULT 'KES',
  status public.bank_transfer_status NOT NULL DEFAULT 'queued',
  provider_reference TEXT,
  bank_name TEXT,
  account_name TEXT,
  account_number TEXT,
  error_message TEXT,
  request_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  response_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  submitted_at TIMESTAMPTZ,
  settled_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX bank_transfer_jobs_status_idx
  ON public.bank_transfer_jobs (status, created_at DESC);
CREATE INDEX bank_transfer_jobs_user_idx
  ON public.bank_transfer_jobs (user_id, created_at DESC);

CREATE TRIGGER bank_transfer_jobs_set_updated_at
  BEFORE UPDATE ON public.bank_transfer_jobs
  FOR EACH ROW EXECUTE FUNCTION private.set_updated_at();

ALTER TABLE public.bank_transfer_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "bank_jobs_select_own_or_admin"
  ON public.bank_transfer_jobs FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR private.is_compliance_or_admin());

REVOKE INSERT, UPDATE, DELETE ON public.bank_transfer_jobs FROM authenticated, anon;
GRANT SELECT ON public.bank_transfer_jobs TO authenticated;
GRANT ALL ON public.bank_transfer_jobs TO service_role;

-- ---------------------------------------------------------------------------
-- Seed default playbooks
-- ---------------------------------------------------------------------------
INSERT INTO public.collection_playbooks (code, name, description, min_days_overdue, max_days_overdue, severity, priority)
VALUES
  ('gentle_reminder', 'Gentle reminder', 'Day 1–3 soft outreach', 1, 3, 'overdue', 10),
  ('firm_followup', 'Firm follow-up', 'Day 4–7 escalation', 4, 7, 'severe', 20),
  ('critical_recovery', 'Critical recovery', 'Day 8+ agent task + multi-channel', 8, NULL, 'critical', 30)
ON CONFLICT (code) DO NOTHING;

INSERT INTO public.collection_playbook_steps (playbook_id, step_order, channel, delay_hours, template_subject, template_body, create_agent_task)
SELECT p.id, s.step_order, s.channel::public.playbook_channel, s.delay_hours, s.template_subject, s.template_body, s.create_agent_task
FROM public.collection_playbooks p
JOIN (
  VALUES
    ('gentle_reminder', 1, 'in_app', 0, 'Contribution reminder', 'Your Amanah contribution is overdue. Please top up and pay from the app.', false),
    ('gentle_reminder', 2, 'email', 24, 'Friendly reminder — overdue contribution', 'Assalamu alaikum. Your rotating savings contribution is overdue. Pay in the Amanah app to stay in good standing.', false),
    ('firm_followup', 1, 'sms', 0, NULL, 'Amanah: contribution overdue. Please pay today to avoid further escalation.', false),
    ('firm_followup', 2, 'email', 12, 'Urgent: overdue Amanah contribution', 'Your contribution remains unpaid. Contact support if you need a payment plan.', false),
    ('critical_recovery', 1, 'sms', 0, NULL, 'Amanah critical: multiple days overdue. An agent will follow up.', true),
    ('critical_recovery', 2, 'call_task', 0, 'Call member', 'Create outbound call task for collections agent.', true),
    ('critical_recovery', 3, 'email', 6, 'Final notice — Amanah collections', 'This is a final automated notice before written-off review.', false)
) AS s(code, step_order, channel, delay_hours, template_subject, template_body, create_agent_task)
  ON s.code = p.code
WHERE NOT EXISTS (
  SELECT 1 FROM public.collection_playbook_steps ps WHERE ps.playbook_id = p.id
);

-- ---------------------------------------------------------------------------
-- Match playbook for a case
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.match_collection_playbook(p_case_id UUID)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_case public.collection_cases%ROWTYPE;
  v_id UUID;
BEGIN
  SELECT * INTO v_case FROM public.collection_cases WHERE id = p_case_id;
  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  SELECT id INTO v_id
  FROM public.collection_playbooks
  WHERE is_active
    AND v_case.days_overdue >= min_days_overdue
    AND (max_days_overdue IS NULL OR v_case.days_overdue <= max_days_overdue)
    AND (severity IS NULL OR severity = v_case.severity)
  ORDER BY priority ASC, min_days_overdue DESC
  LIMIT 1;

  RETURN v_id;
END;
$$;

-- ---------------------------------------------------------------------------
-- Run next playbook step for a case (queues outbox + logs action)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.run_collection_playbook(
  p_case_id UUID,
  p_playbook_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_case public.collection_cases%ROWTYPE;
  v_playbook_id UUID;
  v_step public.collection_playbook_steps%ROWTYPE;
  v_profile public.profiles%ROWTYPE;
  v_ran INT := 0;
  v_actions INT := 0;
BEGIN
  IF v_uid IS NULL OR NOT private.is_compliance_or_admin() THEN
    RETURN jsonb_build_object('ok', false, 'error', 'FORBIDDEN');
  END IF;

  SELECT * INTO v_case FROM public.collection_cases WHERE id = p_case_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'NOT_FOUND');
  END IF;

  IF v_case.status NOT IN ('open', 'contacted', 'promised', 'partially_paid') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'CASE_CLOSED');
  END IF;

  v_playbook_id := COALESCE(p_playbook_id, public.match_collection_playbook(p_case_id));
  IF v_playbook_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'NO_PLAYBOOK');
  END IF;

  SELECT * INTO v_profile FROM public.profiles WHERE id = v_case.user_id;

  FOR v_step IN
    SELECT *
    FROM public.collection_playbook_steps
    WHERE playbook_id = v_playbook_id
    ORDER BY step_order
  LOOP
    -- Skip steps already executed for this case+step
    IF EXISTS (
      SELECT 1 FROM public.collection_case_actions a
      WHERE a.case_id = p_case_id AND a.step_id = v_step.id
    ) THEN
      CONTINUE;
    END IF;

    INSERT INTO public.collection_case_actions (
      case_id, playbook_id, step_id, actor_id, channel, action, notes, metadata
    ) VALUES (
      p_case_id, v_playbook_id, v_step.id, v_uid, v_step.channel,
      CASE WHEN v_step.create_agent_task THEN 'agent_task' ELSE 'outreach' END,
      v_step.template_body,
      jsonb_build_object('delay_hours', v_step.delay_hours)
    );
    v_actions := v_actions + 1;

    IF v_step.channel = 'email' AND v_profile.email IS NOT NULL THEN
      INSERT INTO public.notification_outbox (user_id, channel, recipient, subject, body, metadata)
      VALUES (
        v_case.user_id, 'email', v_profile.email,
        COALESCE(v_step.template_subject, 'Amanah collections'),
        v_step.template_body,
        jsonb_build_object('collection_case_id', p_case_id, 'playbook_step_id', v_step.id)
      );
    ELSIF v_step.channel = 'sms' AND v_profile.phone IS NOT NULL THEN
      INSERT INTO public.notification_outbox (user_id, channel, recipient, body, metadata)
      VALUES (
        v_case.user_id, 'sms', v_profile.phone, v_step.template_body,
        jsonb_build_object('collection_case_id', p_case_id, 'playbook_step_id', v_step.id)
      );
    ELSIF v_step.channel = 'in_app' THEN
      INSERT INTO public.notifications (user_id, type, channel, title, body, data)
      VALUES (
        v_case.user_id, 'system', 'in_app',
        COALESCE(v_step.template_subject, 'Collections update'),
        v_step.template_body,
        jsonb_build_object('collection_case_id', p_case_id)
      );
    END IF;

    v_ran := v_ran + 1;
    -- Run one new step per invocation (agent pacing)
    EXIT;
  END LOOP;

  IF v_ran > 0 THEN
    UPDATE public.collection_cases
    SET
      status = CASE WHEN status = 'open' THEN 'contacted'::public.collection_status ELSE status END,
      contact_attempts = contact_attempts + 1,
      last_contacted_at = NOW()
    WHERE id = p_case_id;
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'playbook_id', v_playbook_id,
    'steps_ran', v_ran,
    'actions_logged', v_actions
  );
END;
$$;

REVOKE ALL ON FUNCTION public.match_collection_playbook(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.run_collection_playbook(UUID, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.match_collection_playbook(UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.run_collection_playbook(UUID, UUID) TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Queue bank transfer for a withdrawal (service / admin)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.queue_bank_transfer_for_withdrawal(p_withdrawal_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_w public.withdrawal_requests%ROWTYPE;
  v_job_id UUID;
BEGIN
  IF auth.uid() IS NOT NULL AND NOT private.is_compliance_or_admin() THEN
    RETURN jsonb_build_object('ok', false, 'error', 'FORBIDDEN');
  END IF;

  SELECT * INTO v_w FROM public.withdrawal_requests WHERE id = p_withdrawal_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'NOT_FOUND');
  END IF;

  IF v_w.destination_type <> 'bank' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'NOT_BANK');
  END IF;

  INSERT INTO public.bank_transfer_jobs (
    withdrawal_id, user_id, amount, currency, status,
    bank_name, account_name, account_number, request_payload
  ) VALUES (
    v_w.id, v_w.user_id, v_w.amount, v_w.currency, 'queued',
    v_w.bank_name, v_w.bank_account_name, v_w.bank_account_number,
    jsonb_build_object('withdrawal_id', v_w.id)
  )
  RETURNING id INTO v_job_id;

  RETURN jsonb_build_object('ok', true, 'job_id', v_job_id);
END;
$$;

REVOKE ALL ON FUNCTION public.queue_bank_transfer_for_withdrawal(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.queue_bank_transfer_for_withdrawal(UUID) TO authenticated, service_role;
