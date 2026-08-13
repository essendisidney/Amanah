-- Allow claiming outbox rows for a single channel (e.g. SMS via Vercel/Taifa).
CREATE OR REPLACE FUNCTION public.claim_notification_outbox(
  p_limit INT DEFAULT 50,
  p_channel public.notification_channel DEFAULT NULL
)
RETURNS SETOF public.notification_outbox
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF coalesce(auth.role(), '') <> 'service_role' THEN
    RAISE EXCEPTION 'FORBIDDEN';
  END IF;

  RETURN QUERY
  WITH picked AS (
    SELECT id
    FROM public.notification_outbox
    WHERE status IN ('pending', 'failed')
      AND scheduled_at <= NOW()
      AND attempts < 5
      AND (p_channel IS NULL OR channel = p_channel)
    ORDER BY scheduled_at
    LIMIT GREATEST(p_limit, 1)
    FOR UPDATE SKIP LOCKED
  )
  UPDATE public.notification_outbox o
  SET status = 'processing', attempts = attempts + 1, updated_at = NOW()
  FROM picked
  WHERE o.id = picked.id
  RETURNING o.*;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_notification_outbox(INT, public.notification_channel) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.claim_notification_outbox(INT, public.notification_channel) TO service_role;

-- Keep single-arg overload working for older callers if Postgres created a new signature only.
-- Recreate 1-arg wrapper for compatibility with existing Edge deploy.
CREATE OR REPLACE FUNCTION public.claim_notification_outbox(p_limit INT DEFAULT 50)
RETURNS SETOF public.notification_outbox
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT * FROM public.claim_notification_outbox(p_limit, NULL::public.notification_channel);
$$;

REVOKE ALL ON FUNCTION public.claim_notification_outbox(INT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.claim_notification_outbox(INT) TO service_role;
