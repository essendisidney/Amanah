-- Member support tickets for Help & support (in-app channel).

CREATE TABLE IF NOT EXISTS public.support_tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  subject TEXT NOT NULL,
  body TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open'
    CHECK (status IN ('open', 'closed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT support_tickets_subject_len CHECK (char_length(trim(subject)) BETWEEN 3 AND 200),
  CONSTRAINT support_tickets_body_len CHECK (char_length(trim(body)) BETWEEN 10 AND 4000)
);

CREATE INDEX IF NOT EXISTS support_tickets_created_idx
  ON public.support_tickets (created_at DESC);
CREATE INDEX IF NOT EXISTS support_tickets_user_idx
  ON public.support_tickets (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS support_tickets_open_idx
  ON public.support_tickets (created_at DESC)
  WHERE status = 'open';

ALTER TABLE public.support_tickets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS support_tickets_select_own_or_admin ON public.support_tickets;
CREATE POLICY support_tickets_select_own_or_admin
  ON public.support_tickets
  FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid()
    OR private.is_platform_admin()
  );

DROP POLICY IF EXISTS support_tickets_insert_own ON public.support_tickets;
CREATE POLICY support_tickets_insert_own
  ON public.support_tickets
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS support_tickets_admin_update ON public.support_tickets;
CREATE POLICY support_tickets_admin_update
  ON public.support_tickets
  FOR UPDATE
  TO authenticated
  USING (private.is_platform_admin())
  WITH CHECK (private.is_platform_admin());

GRANT SELECT, INSERT ON public.support_tickets TO authenticated;
GRANT UPDATE ON public.support_tickets TO authenticated;
