-- Phase 6: Daily payment reconciliation runs.

CREATE TABLE IF NOT EXISTS public.reconcile_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  status TEXT NOT NULL DEFAULT 'running'
    CHECK (status IN ('running', 'completed', 'failed')),
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  finished_at TIMESTAMPTZ,
  summary JSONB NOT NULL DEFAULT '{}'::jsonb,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS reconcile_runs_started_idx
  ON public.reconcile_runs (started_at DESC);

CREATE TABLE IF NOT EXISTS public.reconcile_run_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id UUID NOT NULL REFERENCES public.reconcile_runs (id) ON DELETE CASCADE,
  entity_type TEXT NOT NULL CHECK (entity_type IN ('payment_intent', 'withdrawal')),
  entity_id UUID NOT NULL,
  provider TEXT,
  action TEXT NOT NULL,
  result TEXT NOT NULL,
  detail JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS reconcile_run_items_run_idx
  ON public.reconcile_run_items (run_id, created_at);

ALTER TABLE public.reconcile_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reconcile_run_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS reconcile_runs_select_admin ON public.reconcile_runs;
CREATE POLICY reconcile_runs_select_admin
  ON public.reconcile_runs FOR SELECT TO authenticated
  USING (private.is_compliance_or_admin());

DROP POLICY IF EXISTS reconcile_run_items_select_admin ON public.reconcile_run_items;
CREATE POLICY reconcile_run_items_select_admin
  ON public.reconcile_run_items FOR SELECT TO authenticated
  USING (private.is_compliance_or_admin());

GRANT SELECT ON public.reconcile_runs TO authenticated;
GRANT SELECT ON public.reconcile_run_items TO authenticated;
GRANT ALL ON public.reconcile_runs TO service_role;
GRANT ALL ON public.reconcile_run_items TO service_role;
