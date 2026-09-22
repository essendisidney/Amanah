-- Integrity repair: backfill missing journal posts for completed payment intents.
-- Idempotent via private.post_balanced_journal (source_type + source_id unique).

CREATE OR REPLACE FUNCTION public.backfill_payment_intent_journal(p_intent_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_intent public.payment_intents%ROWTYPE;
  v_entry UUID;
  v_existing UUID;
BEGIN
  IF v_uid IS NULL OR NOT private.is_platform_admin() THEN
    RETURN jsonb_build_object('ok', false, 'error', 'FORBIDDEN');
  END IF;

  SELECT * INTO v_intent FROM public.payment_intents WHERE id = p_intent_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'NOT_FOUND');
  END IF;

  IF v_intent.status <> 'completed' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'NOT_COMPLETED', 'status', v_intent.status);
  END IF;

  SELECT id INTO v_existing
  FROM public.journal_entries
  WHERE source_type = 'payment_intent' AND source_id = p_intent_id::text;

  IF v_existing IS NOT NULL THEN
    RETURN jsonb_build_object(
      'ok', true,
      'action', 'already_posted',
      'journal_entry_id', v_existing,
      'payment_intent_id', p_intent_id
    );
  END IF;

  v_entry := private.post_journal_for_payment_intent(p_intent_id);
  IF v_entry IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'POST_FAILED', 'payment_intent_id', p_intent_id);
  END IF;

  INSERT INTO public.audit_logs (actor_id, action, entity_type, entity_id, metadata)
  VALUES (
    v_uid,
    'update',
    'payment_intent',
    p_intent_id,
    jsonb_build_object('event', 'finance.journal_backfill', 'journal_entry_id', v_entry)
  );

  RETURN jsonb_build_object(
    'ok', true,
    'action', 'posted',
    'journal_entry_id', v_entry,
    'payment_intent_id', p_intent_id
  );
END;
$$;

REVOKE ALL ON FUNCTION public.backfill_payment_intent_journal(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.backfill_payment_intent_journal(UUID) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.backfill_missing_payment_journals(p_limit INT DEFAULT 50)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_lim INT := greatest(1, least(coalesce(p_limit, 50), 200));
  v_row RECORD;
  v_posted INT := 0;
  v_skipped INT := 0;
  v_failed INT := 0;
  v_result JSONB;
  v_ids UUID[] := ARRAY[]::UUID[];
BEGIN
  IF v_uid IS NULL OR NOT private.is_platform_admin() THEN
    RETURN jsonb_build_object('ok', false, 'error', 'FORBIDDEN');
  END IF;

  FOR v_row IN
    SELECT pi.id
    FROM public.payment_intents pi
    WHERE pi.status = 'completed'
      AND NOT EXISTS (
        SELECT 1 FROM public.journal_entries je
        WHERE je.source_type = 'payment_intent'
          AND je.source_id = pi.id::text
      )
    ORDER BY pi.completed_at ASC NULLS LAST, pi.created_at ASC
    LIMIT v_lim
  LOOP
    v_result := public.backfill_payment_intent_journal(v_row.id);
    IF coalesce((v_result->>'ok')::boolean, false) THEN
      IF v_result->>'action' = 'posted' THEN
        v_posted := v_posted + 1;
        v_ids := array_append(v_ids, v_row.id);
      ELSE
        v_skipped := v_skipped + 1;
      END IF;
    ELSE
      v_failed := v_failed + 1;
    END IF;
  END LOOP;

  RETURN jsonb_build_object(
    'ok', true,
    'posted', v_posted,
    'skipped', v_skipped,
    'failed', v_failed,
    'limit', v_lim,
    'payment_intent_ids', to_jsonb(v_ids)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.backfill_missing_payment_journals(INT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.backfill_missing_payment_journals(INT) TO authenticated, service_role;
