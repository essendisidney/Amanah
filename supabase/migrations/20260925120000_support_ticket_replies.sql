-- In-app support replies. Members read their own row (existing RLS);
-- only platform admins can write the reply.

ALTER TABLE public.support_tickets
  ADD COLUMN IF NOT EXISTS admin_reply TEXT,
  ADD COLUMN IF NOT EXISTS replied_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS replied_by UUID REFERENCES public.profiles (id);

ALTER TABLE public.support_tickets
  DROP CONSTRAINT IF EXISTS support_tickets_admin_reply_len;

ALTER TABLE public.support_tickets
  ADD CONSTRAINT support_tickets_admin_reply_len
  CHECK (admin_reply IS NULL OR char_length(trim(admin_reply)) BETWEEN 1 AND 4000);
