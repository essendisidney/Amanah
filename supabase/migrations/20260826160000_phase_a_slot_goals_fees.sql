-- Phase A: payout slot choice, goals↔ circles, early-fee / late-rebate transparency.

ALTER TABLE public.jamiyas
  ADD COLUMN IF NOT EXISTS slot_pricing_enabled BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS early_slot_fee_pct NUMERIC(6, 2) NOT NULL DEFAULT 0
    CHECK (early_slot_fee_pct >= 0 AND early_slot_fee_pct <= 50),
  ADD COLUMN IF NOT EXISTS late_slot_rebate_pct NUMERIC(6, 2) NOT NULL DEFAULT 0
    CHECK (late_slot_rebate_pct >= 0 AND late_slot_rebate_pct <= 50);

COMMENT ON COLUMN public.jamiyas.early_slot_fee_pct IS
  'One-time facilitation fee (% of contribution) for early payout slots (positions in first half). Not interest.';
COMMENT ON COLUMN public.jamiyas.late_slot_rebate_pct IS
  'Rebate / incentive (% of contribution) displayed for late payout slots; applied as book credit at settlement when enabled.';

ALTER TABLE public.savings_goals
  ADD COLUMN IF NOT EXISTS jamiya_id UUID REFERENCES public.jamiyas (id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS savings_goals_jamiya_idx
  ON public.savings_goals (jamiya_id)
  WHERE jamiya_id IS NOT NULL;

-- Allow circle officers to see goals linked to their circle (owners still full CRUD via goals_own).
DROP POLICY IF EXISTS savings_goals_circle_read ON public.savings_goals;
CREATE POLICY savings_goals_circle_read
  ON public.savings_goals FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR (
      jamiya_id IS NOT NULL
      AND (
        private.is_circle_officer(jamiya_id)
        OR private.is_active_jamiya_member(jamiya_id)
      )
    )
  );

-- ---------------------------------------------------------------------------
-- accept_invitation with optional payout slot
-- ---------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.accept_invitation(TEXT, TEXT);
DROP FUNCTION IF EXISTS public.accept_invitation(TEXT, TEXT, INTEGER);
DROP FUNCTION IF EXISTS private.accept_invitation(TEXT, TEXT);
DROP FUNCTION IF EXISTS private.accept_invitation(TEXT, TEXT, INTEGER);

CREATE OR REPLACE FUNCTION private.accept_invitation(
  p_token_hash TEXT DEFAULT NULL,
  p_invite_code TEXT DEFAULT NULL,
  p_payout_position INTEGER DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_inv public.invitations%ROWTYPE;
  v_jamiya public.jamiyas%ROWTYPE;
  v_profile public.profiles%ROWTYPE;
  v_member_id UUID;
  v_next_position INTEGER;
  v_max_slot INTEGER;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'UNAUTHENTICATED');
  END IF;

  IF (p_token_hash IS NULL OR p_token_hash = '')
     AND (p_invite_code IS NULL OR p_invite_code = '') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'NOT_FOUND');
  END IF;

  SELECT * INTO v_inv
  FROM public.invitations
  WHERE (
    (p_token_hash IS NOT NULL AND p_token_hash <> '' AND token_hash = p_token_hash)
    OR (
      p_invite_code IS NOT NULL AND p_invite_code <> ''
      AND upper(invite_code) = upper(p_invite_code)
    )
  )
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'NOT_FOUND');
  END IF;

  IF v_inv.status <> 'pending' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'NOT_PENDING', 'status', v_inv.status);
  END IF;

  IF v_inv.expires_at < NOW() THEN
    UPDATE public.invitations SET status = 'expired', updated_at = NOW() WHERE id = v_inv.id;
    RETURN jsonb_build_object('ok', false, 'error', 'EXPIRED');
  END IF;

  SELECT * INTO v_profile FROM public.profiles WHERE id = v_uid;
  SELECT * INTO v_jamiya FROM public.jamiyas WHERE id = v_inv.jamiya_id;

  IF v_jamiya.member_count >= v_jamiya.max_members THEN
    RETURN jsonb_build_object('ok', false, 'error', 'CIRCLE_FULL');
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.members
    WHERE jamiya_id = v_inv.jamiya_id AND user_id = v_uid AND status = 'active'
  ) THEN
    UPDATE public.invitations
    SET status = 'accepted', invitee_user_id = v_uid, accepted_at = NOW(), updated_at = NOW()
    WHERE id = v_inv.id;
    RETURN jsonb_build_object('ok', true, 'already_member', true, 'slug', v_jamiya.slug);
  END IF;

  v_max_slot := GREATEST(
    COALESCE(v_jamiya.cycle_count, v_jamiya.max_members),
    v_jamiya.max_members,
    1
  );

  IF p_payout_position IS NOT NULL THEN
    IF p_payout_position < 1 OR p_payout_position > v_max_slot THEN
      RETURN jsonb_build_object('ok', false, 'error', 'INVALID_SLOT');
    END IF;
    IF EXISTS (
      SELECT 1 FROM public.members
      WHERE jamiya_id = v_inv.jamiya_id
        AND payout_position = p_payout_position
        AND status = 'active'
    ) THEN
      RETURN jsonb_build_object('ok', false, 'error', 'SLOT_TAKEN');
    END IF;
    v_next_position := p_payout_position;
  ELSE
    SELECT COALESCE(MAX(payout_position), 0) + 1
    INTO v_next_position
    FROM public.members
    WHERE jamiya_id = v_inv.jamiya_id;
  END IF;

  INSERT INTO public.members (
    jamiya_id, user_id, role, status, payout_position, joined_at
  )
  VALUES (
    v_inv.jamiya_id, v_uid, 'member', 'active', v_next_position, NOW()
  )
  ON CONFLICT (jamiya_id, user_id) DO UPDATE
  SET
    status = 'active',
    payout_position = COALESCE(EXCLUDED.payout_position, public.members.payout_position),
    joined_at = COALESCE(public.members.joined_at, NOW()),
    left_at = NULL,
    updated_at = NOW()
  RETURNING id INTO v_member_id;

  UPDATE public.invitations
  SET
    status = 'accepted',
    invitee_user_id = v_uid,
    accepted_at = NOW(),
    updated_at = NOW()
  WHERE id = v_inv.id;

  INSERT INTO public.audit_logs (actor_id, action, entity_type, entity_id, jamiya_id, metadata)
  VALUES (
    v_uid,
    'join',
    'invitation',
    v_inv.id,
    v_inv.jamiya_id,
    jsonb_build_object(
      'member_id', v_member_id,
      'slug', v_jamiya.slug,
      'payout_position', v_next_position
    )
  );

  INSERT INTO public.notifications (user_id, type, channel, title, body, data)
  VALUES (
    v_inv.invited_by,
    'invitation',
    'in_app',
    'Invitation accepted',
    COALESCE(v_profile.full_name, v_profile.email, 'A member') || ' joined ' || v_jamiya.name,
    jsonb_build_object('jamiya_id', v_jamiya.id, 'slug', v_jamiya.slug)
  );

  RETURN jsonb_build_object(
    'ok', true,
    'slug', v_jamiya.slug,
    'jamiya_id', v_jamiya.id,
    'member_id', v_member_id,
    'payout_position', v_next_position
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.accept_invitation(
  p_token_hash TEXT DEFAULT NULL,
  p_invite_code TEXT DEFAULT NULL,
  p_payout_position INTEGER DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  RETURN private.accept_invitation(p_token_hash, p_invite_code, p_payout_position);
END;
$$;

REVOKE ALL ON FUNCTION public.accept_invitation(TEXT, TEXT, INTEGER) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.accept_invitation(TEXT, TEXT, INTEGER) TO authenticated;

-- ---------------------------------------------------------------------------
-- Claim / change payout slot before circle is active
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.claim_payout_slot(
  p_jamiya_id UUID,
  p_payout_position INTEGER
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_jamiya public.jamiyas%ROWTYPE;
  v_member public.members%ROWTYPE;
  v_max_slot INTEGER;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'UNAUTHENTICATED');
  END IF;

  SELECT * INTO v_jamiya FROM public.jamiyas WHERE id = p_jamiya_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'NOT_FOUND');
  END IF;

  IF v_jamiya.status = 'active' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'CIRCLE_ALREADY_ACTIVE');
  END IF;

  IF COALESCE(v_jamiya.challenge_kind, 'rotating') IN ('savings', 'share_dividend') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'NOT_ROTATING');
  END IF;

  SELECT * INTO v_member
  FROM public.members
  WHERE jamiya_id = p_jamiya_id AND user_id = v_uid AND status = 'active'
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'NOT_MEMBER');
  END IF;

  v_max_slot := GREATEST(
    COALESCE(v_jamiya.cycle_count, v_jamiya.max_members),
    v_jamiya.max_members,
    1
  );

  IF p_payout_position IS NULL OR p_payout_position < 1 OR p_payout_position > v_max_slot THEN
    RETURN jsonb_build_object('ok', false, 'error', 'INVALID_SLOT');
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.members
    WHERE jamiya_id = p_jamiya_id
      AND payout_position = p_payout_position
      AND status = 'active'
      AND id <> v_member.id
  ) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'SLOT_TAKEN');
  END IF;

  UPDATE public.members
  SET payout_position = p_payout_position, updated_at = NOW()
  WHERE id = v_member.id;

  RETURN jsonb_build_object(
    'ok', true,
    'payout_position', p_payout_position,
    'member_id', v_member.id
  );
END;
$$;

REVOKE ALL ON FUNCTION public.claim_payout_slot(UUID, INTEGER) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.claim_payout_slot(UUID, INTEGER) TO authenticated;

-- One-time early-slot facilitation fee (wallet debit) when pricing enabled.
CREATE OR REPLACE FUNCTION public.charge_early_slot_fee(p_jamiya_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_jamiya public.jamiyas%ROWTYPE;
  v_member public.members%ROWTYPE;
  v_mid INTEGER;
  v_fee NUMERIC;
  v_max_slot INTEGER;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'UNAUTHENTICATED');
  END IF;

  SELECT * INTO v_jamiya FROM public.jamiyas WHERE id = p_jamiya_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'NOT_FOUND');
  END IF;

  IF NOT COALESCE(v_jamiya.slot_pricing_enabled, false)
     OR COALESCE(v_jamiya.early_slot_fee_pct, 0) <= 0 THEN
    RETURN jsonb_build_object('ok', true, 'skipped', true);
  END IF;

  SELECT * INTO v_member
  FROM public.members
  WHERE jamiya_id = p_jamiya_id AND user_id = v_uid AND status = 'active';

  IF NOT FOUND OR v_member.payout_position IS NULL THEN
    RETURN jsonb_build_object('ok', true, 'skipped', true);
  END IF;

  v_max_slot := GREATEST(
    COALESCE(v_jamiya.cycle_count, v_jamiya.max_members),
    v_jamiya.max_members,
    1
  );
  v_mid := CEIL(v_max_slot::NUMERIC / 2.0);

  IF v_member.payout_position > v_mid THEN
    RETURN jsonb_build_object('ok', true, 'skipped', true, 'reason', 'late_slot');
  END IF;

  v_fee := ROUND(
    (v_jamiya.contribution_amount * v_jamiya.early_slot_fee_pct / 100.0)::NUMERIC,
    2
  );
  IF v_fee <= 0 THEN
    RETURN jsonb_build_object('ok', true, 'skipped', true);
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.transactions
    WHERE user_id = v_uid
      AND jamiya_id = p_jamiya_id
      AND idempotency_key = 'early_slot_fee:' || v_member.id::text
  ) THEN
    RETURN jsonb_build_object('ok', true, 'already_charged', true);
  END IF;

  PERFORM private.ledger_debit(
    v_uid,
    v_jamiya.currency,
    v_fee,
    'fee'::public.transaction_type,
    p_jamiya_id,
    'early_slot_fee:' || v_member.id::text,
    'early_slot_fee:' || v_member.id::text,
    jsonb_build_object(
      'kind', 'early_slot_fee',
      'payout_position', v_member.payout_position,
      'pct', v_jamiya.early_slot_fee_pct
    )
  );

  RETURN jsonb_build_object('ok', true, 'fee', v_fee, 'payout_position', v_member.payout_position);
EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object('ok', false, 'error', SQLERRM);
END;
$$;

REVOKE ALL ON FUNCTION public.charge_early_slot_fee(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.charge_early_slot_fee(UUID) TO authenticated;
