-- Withdrawal holds.
-- A withdrawal whose metadata has a 'hold' key ({"reason", "held_at", "held_by"}) cannot change
-- status: not processing, completed, failed or cancelled. It stays pending, so its amount stays
-- reserved (private.wallet_spendable subtracts pending withdrawals) and cannot be re-requested.
-- Dual approval only writes metadata, so it still records; the web app's payout path re-reads
-- the hold before calling any provider (runWithdrawalDisbursement).
--
-- Place and release holds with public.admin_hold_withdrawal / public.admin_release_withdrawal
-- (platform admins or the service role), which write audit_logs.

CREATE OR REPLACE FUNCTION private.trg_withdrawal_hold()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
BEGIN
  IF coalesce(OLD.metadata, '{}'::jsonb) ? 'hold'
     AND coalesce(NEW.metadata, '{}'::jsonb) ? 'hold'
     AND NEW.status IS DISTINCT FROM OLD.status THEN
    RAISE EXCEPTION 'WITHDRAWAL_ON_HOLD'
      USING HINT = 'Release the hold (admin_release_withdrawal) before processing this withdrawal.';
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE TRIGGER withdrawal_hold
BEFORE UPDATE ON public.withdrawal_requests
FOR EACH ROW
EXECUTE FUNCTION private.trg_withdrawal_hold();

CREATE OR REPLACE FUNCTION public.admin_hold_withdrawal(p_withdrawal_id UUID, p_reason TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  v_w public.withdrawal_requests%ROWTYPE;
  v_reason TEXT := nullif(btrim(coalesce(p_reason, '')), '');
BEGIN
  IF coalesce(auth.role(), '') <> 'service_role' AND NOT private.is_platform_admin() THEN
    RETURN jsonb_build_object('ok', false, 'error', 'FORBIDDEN');
  END IF;
  IF v_reason IS NULL OR char_length(v_reason) < 3 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'REASON_REQUIRED');
  END IF;

  SELECT * INTO v_w FROM public.withdrawal_requests WHERE id = p_withdrawal_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'NOT_FOUND');
  END IF;
  IF coalesce(v_w.metadata, '{}'::jsonb) ? 'hold' THEN
    RETURN jsonb_build_object('ok', true, 'idempotent', true);
  END IF;
  IF v_w.status NOT IN ('pending', 'processing') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'NOT_HOLDABLE', 'status', v_w.status);
  END IF;

  UPDATE public.withdrawal_requests
  SET metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object(
        'hold', jsonb_build_object('reason', left(v_reason, 500), 'held_at', NOW(), 'held_by', auth.uid())
      ),
      updated_at = NOW()
  WHERE id = v_w.id;

  INSERT INTO public.audit_logs (actor_id, action, entity_type, entity_id, metadata)
  VALUES (
    auth.uid(), 'update', 'withdrawal_request', v_w.id,
    jsonb_build_object('event', 'finance.withdrawal_hold', 'reason', left(v_reason, 500),
                       'amount', v_w.amount, 'user_id', v_w.user_id)
  );

  RETURN jsonb_build_object('ok', true, 'withdrawal_id', v_w.id);
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_release_withdrawal(p_withdrawal_id UUID, p_reason TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  v_w public.withdrawal_requests%ROWTYPE;
  v_reason TEXT := nullif(btrim(coalesce(p_reason, '')), '');
BEGIN
  IF coalesce(auth.role(), '') <> 'service_role' AND NOT private.is_platform_admin() THEN
    RETURN jsonb_build_object('ok', false, 'error', 'FORBIDDEN');
  END IF;
  IF v_reason IS NULL OR char_length(v_reason) < 3 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'REASON_REQUIRED');
  END IF;

  SELECT * INTO v_w FROM public.withdrawal_requests WHERE id = p_withdrawal_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'NOT_FOUND');
  END IF;
  IF NOT coalesce(v_w.metadata, '{}'::jsonb) ? 'hold' THEN
    RETURN jsonb_build_object('ok', true, 'idempotent', true);
  END IF;

  UPDATE public.withdrawal_requests
  SET metadata = (metadata - 'hold') || jsonb_build_object(
        'hold_released', jsonb_build_object(
          'reason', left(v_reason, 500), 'released_at', NOW(), 'released_by', auth.uid(),
          'hold', metadata->'hold')
      ),
      updated_at = NOW()
  WHERE id = v_w.id;

  INSERT INTO public.audit_logs (actor_id, action, entity_type, entity_id, metadata)
  VALUES (
    auth.uid(), 'update', 'withdrawal_request', v_w.id,
    jsonb_build_object('event', 'finance.withdrawal_hold_released', 'reason', left(v_reason, 500))
  );

  RETURN jsonb_build_object('ok', true, 'withdrawal_id', v_w.id);
END;
$$;

REVOKE ALL ON FUNCTION private.trg_withdrawal_hold() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.admin_hold_withdrawal(UUID, TEXT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_release_withdrawal(UUID, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_hold_withdrawal(UUID, TEXT) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.admin_release_withdrawal(UUID, TEXT) TO authenticated, service_role;
