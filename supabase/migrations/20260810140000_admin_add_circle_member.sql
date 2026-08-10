-- Admin can add an existing (or provisioned) user to a circle as active or invited.
-- Lookup by user_id, email, or phone (definer bypasses profiles RLS).

CREATE OR REPLACE FUNCTION public.admin_add_circle_member(
  p_jamiya_id UUID,
  p_user_id UUID DEFAULT NULL,
  p_status public.membership_status DEFAULT 'active',
  p_email TEXT DEFAULT NULL,
  p_phone TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_jamiya public.jamiyas%ROWTYPE;
  v_profile public.profiles%ROWTYPE;
  v_member public.members%ROWTYPE;
  v_member_id UUID;
  v_next_position INTEGER;
  v_seat_count INTEGER;
  v_fee NUMERIC;
  v_tx UUID;
  v_fee_warning BOOLEAN := false;
  v_target UUID;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'UNAUTHENTICATED');
  END IF;

  IF p_status NOT IN ('active', 'invited') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'INVALID_STATUS');
  END IF;

  IF NOT private.is_circle_admin(p_jamiya_id) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'FORBIDDEN');
  END IF;

  SELECT * INTO v_jamiya FROM public.jamiyas WHERE id = p_jamiya_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'NOT_FOUND');
  END IF;

  v_target := p_user_id;
  IF v_target IS NULL AND p_email IS NOT NULL AND btrim(p_email) <> '' THEN
    SELECT id INTO v_target
    FROM public.profiles
    WHERE lower(email) = lower(btrim(p_email))
    LIMIT 1;
  END IF;
  IF v_target IS NULL AND p_phone IS NOT NULL AND btrim(p_phone) <> '' THEN
    SELECT id INTO v_target
    FROM public.profiles
    WHERE phone = btrim(p_phone)
    LIMIT 1;
  END IF;

  IF v_target IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'USER_NOT_FOUND');
  END IF;

  SELECT * INTO v_profile FROM public.profiles WHERE id = v_target;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'USER_NOT_FOUND');
  END IF;

  SELECT * INTO v_member
  FROM public.members
  WHERE jamiya_id = p_jamiya_id AND user_id = v_target;

  IF FOUND AND v_member.status = 'active' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'ALREADY_MEMBER', 'member_id', v_member.id);
  END IF;

  SELECT COUNT(*)::INTEGER INTO v_seat_count
  FROM public.members m
  WHERE m.jamiya_id = p_jamiya_id
    AND m.status IN ('active', 'invited');

  IF v_member.id IS NULL OR v_member.status NOT IN ('active', 'invited') THEN
    IF v_seat_count >= v_jamiya.max_members THEN
      RETURN jsonb_build_object('ok', false, 'error', 'CIRCLE_FULL');
    END IF;
  END IF;

  SELECT COALESCE(MAX(payout_position), 0) + 1
  INTO v_next_position
  FROM public.members
  WHERE jamiya_id = p_jamiya_id;

  INSERT INTO public.members (
    jamiya_id, user_id, role, status, payout_position, joined_at
  )
  VALUES (
    p_jamiya_id,
    v_target,
    'member',
    p_status,
    v_next_position,
    CASE WHEN p_status = 'active' THEN NOW() ELSE NULL END
  )
  ON CONFLICT (jamiya_id, user_id) DO UPDATE
  SET
    status = EXCLUDED.status,
    payout_position = COALESCE(public.members.payout_position, EXCLUDED.payout_position),
    joined_at = CASE
      WHEN EXCLUDED.status = 'active' THEN COALESCE(public.members.joined_at, NOW())
      ELSE public.members.joined_at
    END,
    left_at = NULL,
    updated_at = NOW()
  RETURNING id INTO v_member_id;

  IF p_status = 'active' THEN
    v_fee := coalesce(v_jamiya.join_fee_amount, 0);
    IF v_fee > 0 THEN
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM public.transactions t
          WHERE t.user_id = v_target
            AND t.jamiya_id = p_jamiya_id
            AND t.metadata->>'kind' = 'join_fee'
            AND t.status = 'completed'
        ) THEN
          v_tx := private.ledger_debit(
            v_target,
            v_jamiya.currency,
            v_fee,
            'fee'::public.transaction_type,
            p_jamiya_id,
            'join_fee',
            p_jamiya_id::text || ':' || v_target::text || ':join_fee',
            jsonb_build_object('kind', 'join_fee', 'added_by', v_uid)
          );
        END IF;
      EXCEPTION WHEN OTHERS THEN
        v_fee_warning := true;
      END;
    END IF;

    INSERT INTO public.notifications (user_id, type, channel, title, body, data)
    VALUES (
      v_target,
      'invitation',
      'in_app',
      'Added to circle',
      'You were added to ' || v_jamiya.name || ' on Amanah.',
      jsonb_build_object('jamiya_id', v_jamiya.id, 'slug', v_jamiya.slug, 'member_id', v_member_id)
    );
  ELSE
    INSERT INTO public.notifications (user_id, type, channel, title, body, data)
    VALUES (
      v_target,
      'invitation',
      'in_app',
      'Circle seat reserved',
      'A seat was reserved for you in ' || v_jamiya.name || '. Open your invite link to activate.',
      jsonb_build_object('jamiya_id', v_jamiya.id, 'slug', v_jamiya.slug, 'member_id', v_member_id)
    );
  END IF;

  INSERT INTO public.audit_logs (actor_id, action, entity_type, entity_id, jamiya_id, metadata)
  VALUES (
    v_uid,
    'invite',
    'member',
    v_member_id,
    p_jamiya_id,
    jsonb_build_object(
      'user_id', v_target,
      'status', p_status,
      'fee_warning', v_fee_warning,
      'transaction_id', v_tx
    )
  );

  RETURN jsonb_build_object(
    'ok', true,
    'member_id', v_member_id,
    'user_id', v_target,
    'status', p_status,
    'slug', v_jamiya.slug,
    'jamiya_id', v_jamiya.id,
    'fee_warning', v_fee_warning
  );
END;
$$;

REVOKE ALL ON FUNCTION public.admin_add_circle_member(UUID, UUID, public.membership_status, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_add_circle_member(UUID, UUID, public.membership_status, TEXT, TEXT) TO authenticated;
