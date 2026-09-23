-- Bind targeted invites to the intended invitee (stop code theft).
-- Soft-close pending claim invites once the person is already an active member.
-- Harden admin_add phone lookup across +254 / 254 / 07 formats.

CREATE OR REPLACE FUNCTION private.kenya_phone_digits(p_raw TEXT)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN d IS NULL OR d = '' THEN NULL
    WHEN d LIKE '254%' AND length(d) = 12 THEN d
    WHEN d LIKE '0%' AND length(d) = 10 THEN '254' || substr(d, 2)
    WHEN length(d) = 9 THEN '254' || d
    ELSE d
  END
  FROM (
    SELECT NULLIF(regexp_replace(COALESCE(p_raw, ''), '[^0-9]', '', 'g'), '') AS d
  ) s;
$$;

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
  v_auth_phone TEXT;
  v_bound BOOLEAN := false;
  v_match BOOLEAN := false;
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
  SELECT phone INTO v_auth_phone FROM auth.users WHERE id = v_uid;
  SELECT * INTO v_jamiya FROM public.jamiyas WHERE id = v_inv.jamiya_id;

  -- Targeted invite: must be the intended person (user id, phone, or email).
  IF v_inv.invitee_user_id IS NOT NULL THEN
    v_bound := true;
    IF v_inv.invitee_user_id = v_uid THEN
      v_match := true;
    END IF;
  END IF;

  IF COALESCE(btrim(v_inv.phone), '') <> '' THEN
    v_bound := true;
    IF private.kenya_phone_digits(v_inv.phone) IS NOT NULL
       AND (
         private.kenya_phone_digits(v_inv.phone) = private.kenya_phone_digits(v_profile.phone)
         OR private.kenya_phone_digits(v_inv.phone) = private.kenya_phone_digits(v_auth_phone)
       ) THEN
      v_match := true;
    END IF;
  END IF;

  IF COALESCE(btrim(v_inv.email), '') <> '' THEN
    v_bound := true;
    IF lower(btrim(v_inv.email)) = lower(COALESCE(v_profile.email, '')) THEN
      v_match := true;
    END IF;
  END IF;

  IF v_bound AND NOT v_match THEN
    RETURN jsonb_build_object('ok', false, 'error', 'WRONG_INVITEE');
  END IF;

  -- Already a member: close the invite for them without creating a duplicate seat.
  IF EXISTS (
    SELECT 1 FROM public.members
    WHERE jamiya_id = v_inv.jamiya_id AND user_id = v_uid AND status = 'active'
  ) THEN
    UPDATE public.invitations
    SET status = 'accepted',
        invitee_user_id = COALESCE(invitee_user_id, v_uid),
        accepted_at = NOW(),
        updated_at = NOW()
    WHERE id = v_inv.id;
    RETURN jsonb_build_object('ok', true, 'already_member', true, 'slug', v_jamiya.slug);
  END IF;

  IF v_jamiya.member_count >= v_jamiya.max_members THEN
    RETURN jsonb_build_object('ok', false, 'error', 'CIRCLE_FULL');
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
    invitee_user_id = COALESCE(invitee_user_id, v_uid),
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

-- Phone lookup: match +254 / 254 / 07 forms
CREATE OR REPLACE FUNCTION public.admin_add_circle_member(
  p_jamiya_id uuid,
  p_user_id uuid DEFAULT NULL::uuid,
  p_status membership_status DEFAULT 'active'::membership_status,
  p_email text DEFAULT NULL::text,
  p_phone text DEFAULT NULL::text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
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
  v_phone_digits TEXT;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'UNAUTHENTICATED');
  END IF;

  IF p_status NOT IN ('active', 'invited') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'INVALID_STATUS');
  END IF;

  IF NOT private.is_circle_officer(p_jamiya_id) THEN
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
    v_phone_digits := private.kenya_phone_digits(p_phone);
    SELECT id INTO v_target
    FROM public.profiles
    WHERE private.kenya_phone_digits(phone) = v_phone_digits
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

  -- Soft-close any pending invite aimed at this person for this circle.
  IF p_status = 'active' THEN
    UPDATE public.invitations i
    SET status = 'accepted',
        invitee_user_id = COALESCE(i.invitee_user_id, v_target),
        accepted_at = COALESCE(i.accepted_at, NOW()),
        updated_at = NOW()
    WHERE i.jamiya_id = p_jamiya_id
      AND i.status = 'pending'
      AND (
        i.invitee_user_id = v_target
        OR (
          i.phone IS NOT NULL
          AND private.kenya_phone_digits(i.phone) = private.kenya_phone_digits(v_profile.phone)
        )
        OR (
          i.email IS NOT NULL
          AND v_profile.email IS NOT NULL
          AND lower(btrim(i.email)) = lower(btrim(v_profile.email))
        )
      );
  END IF;

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
$function$;

-- Data repair: close pending invites for people already active in that circle.
UPDATE public.invitations i
SET
  status = 'accepted',
  invitee_user_id = COALESCE(i.invitee_user_id, m.user_id),
  accepted_at = COALESCE(i.accepted_at, NOW()),
  updated_at = NOW()
FROM public.members m
LEFT JOIN public.profiles p ON p.id = m.user_id
WHERE i.status = 'pending'
  AND m.jamiya_id = i.jamiya_id
  AND m.status = 'active'
  AND (
    i.invitee_user_id = m.user_id
    OR (
      i.phone IS NOT NULL
      AND private.kenya_phone_digits(i.phone) = private.kenya_phone_digits(p.phone)
    )
    OR (
      i.email IS NOT NULL
      AND p.email IS NOT NULL
      AND lower(btrim(i.email)) = lower(btrim(p.email))
    )
  );

-- Undo accidental E2E steal: Sidney joined Family savings via Yusuf's targeted invite.
DELETE FROM public.members m
USING public.jamiyas j
WHERE j.slug = 'family-savings'
  AND m.jamiya_id = j.id
  AND m.user_id = 'c065f363-9f18-4ad1-895b-b378de3d3110'
  AND m.payout_position = 17
  AND m.joined_at::date = DATE '2026-09-23';
