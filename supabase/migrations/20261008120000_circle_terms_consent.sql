-- Members opt in to a circle's fees.
-- Officers set circle fees (join, per-contribution, early slot) and penalties, and every fee
-- was debited from members' wallets without the member ever seeing or accepting them; an
-- officer adding a member directly even charged that member's join fee.
--
-- Now:
--   * jamiyas.terms_version goes up whenever a fee, penalty or the contribution amount changes;
--   * member_consents records which version each member accepted, with a snapshot of the terms;
--   * a fee is charged only to a member who accepted the circle's terms, and only up to what they
--     accepted (a lower current fee applies at once; a higher one needs fresh acceptance);
--   * admin_add_circle_member no longer charges a join fee; it is charged when the member accepts.
-- Penalties are disclosed in the terms but are not wallet debits, so they are not gated here.

ALTER TABLE public.jamiyas
  ADD COLUMN IF NOT EXISTS terms_version INT NOT NULL DEFAULT 1;

-- ---------------------------------------------------------------------------
-- The circle's money terms, as members see and accept them
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION private.circle_terms(p_j public.jamiyas)
RETURNS JSONB
LANGUAGE sql
STABLE
SET search_path TO ''
AS $$
  SELECT jsonb_build_object(
    'version', p_j.terms_version,
    'currency', p_j.currency,
    'contribution_amount', p_j.contribution_amount,
    'join_fee_amount', coalesce(p_j.join_fee_amount, 0),
    'transaction_fee_amount', coalesce(p_j.transaction_fee_amount, 0),
    'early_slot_fee_pct', CASE WHEN coalesce(p_j.slot_pricing_enabled, false)
                               THEN coalesce(p_j.early_slot_fee_pct, 0) ELSE 0 END,
    'early_slot_fee_amount', CASE WHEN coalesce(p_j.slot_pricing_enabled, false)
                                  THEN round(coalesce(p_j.contribution_amount, 0)
                                             * coalesce(p_j.early_slot_fee_pct, 0) / 100.0, 2)
                                  ELSE 0 END,
    'late_contribution_penalty', coalesce(p_j.late_contribution_penalty, 0),
    'missed_contribution_penalty', coalesce(p_j.missed_contribution_penalty, 0),
    'late_loan_penalty_fixed', coalesce(p_j.late_loan_penalty_fixed, 0),
    'late_loan_penalty_pct', coalesce(p_j.late_loan_penalty_pct, 0),
    'auto_fine_enabled', coalesce(p_j.auto_fine_enabled, false),
    'payout_compliance_mode', p_j.payout_compliance_mode
  );
$$;

CREATE OR REPLACE FUNCTION private.trg_circle_terms_version()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO ''
AS $$
BEGIN
  IF (private.circle_terms(NEW) - 'version') IS DISTINCT FROM (private.circle_terms(OLD) - 'version') THEN
    NEW.terms_version := OLD.terms_version + 1;
  ELSE
    NEW.terms_version := OLD.terms_version;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE TRIGGER circle_terms_version
BEFORE UPDATE ON public.jamiyas
FOR EACH ROW
EXECUTE FUNCTION private.trg_circle_terms_version();

-- ---------------------------------------------------------------------------
-- Consents
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.member_consents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  jamiya_id UUID NOT NULL REFERENCES public.jamiyas(id) ON DELETE CASCADE,
  kind TEXT NOT NULL DEFAULT 'circle_terms' CHECK (kind IN ('circle_terms')),
  version INT NOT NULL,
  terms JSONB NOT NULL,
  accepted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, jamiya_id, kind, version)
);

CREATE INDEX IF NOT EXISTS member_consents_jamiya_idx ON public.member_consents (jamiya_id, kind, version);

ALTER TABLE public.member_consents ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.member_consents FROM anon;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.member_consents FROM authenticated;

CREATE POLICY member_consents_select ON public.member_consents
  FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR private.is_circle_officer(jamiya_id)
    OR private.is_platform_admin()
  );

-- The member's latest acceptance for a circle (NULL when they never accepted).
CREATE OR REPLACE FUNCTION private.latest_circle_consent(p_user_id UUID, p_jamiya_id UUID)
RETURNS public.member_consents
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO ''
AS $$
  SELECT * FROM public.member_consents
  WHERE user_id = p_user_id AND jamiya_id = p_jamiya_id AND kind = 'circle_terms'
  ORDER BY version DESC
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION private.has_accepted_circle_terms(p_user_id UUID, p_jamiya_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.member_consents
    WHERE user_id = p_user_id AND jamiya_id = p_jamiya_id AND kind = 'circle_terms'
  );
$$;

-- The fee a member agreed to: the lower of what they accepted and what the circle charges now.
CREATE OR REPLACE FUNCTION private.agreed_circle_fee(p_user_id UUID, p_jamiya_id UUID, p_key TEXT)
RETURNS NUMERIC
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  v_j public.jamiyas%ROWTYPE;
  v_c public.member_consents%ROWTYPE;
BEGIN
  SELECT * INTO v_j FROM public.jamiyas WHERE id = p_jamiya_id;
  IF NOT FOUND THEN
    RETURN 0;
  END IF;
  v_c := private.latest_circle_consent(p_user_id, p_jamiya_id);
  IF v_c.id IS NULL THEN
    RETURN 0;
  END IF;
  RETURN greatest(least(
    coalesce((private.circle_terms(v_j)->>p_key)::numeric, 0),
    coalesce((v_c.terms->>p_key)::numeric, 0)
  ), 0);
END;
$$;

-- ---------------------------------------------------------------------------
-- Reading and accepting terms
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION private.circle_terms_view(p_j public.jamiyas, p_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  v_terms JSONB := private.circle_terms(p_j);
  v_c public.member_consents%ROWTYPE := private.latest_circle_consent(p_user_id, p_j.id);
BEGIN
  RETURN jsonb_build_object(
    'ok', true,
    'jamiya_id', p_j.id,
    'terms', v_terms,
    'has_charges', (
      (v_terms->>'join_fee_amount')::numeric > 0
      OR (v_terms->>'transaction_fee_amount')::numeric > 0
      OR (v_terms->>'early_slot_fee_amount')::numeric > 0
      OR (v_terms->>'late_contribution_penalty')::numeric > 0
      OR (v_terms->>'missed_contribution_penalty')::numeric > 0
      OR (v_terms->>'late_loan_penalty_fixed')::numeric > 0
      OR (v_terms->>'late_loan_penalty_pct')::numeric > 0
    ),
    'accepted_version', v_c.version,
    'accepted_at', v_c.accepted_at,
    'needs_acceptance', v_c.version IS DISTINCT FROM p_j.terms_version
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.get_circle_terms(p_jamiya_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_j public.jamiyas%ROWTYPE;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'UNAUTHENTICATED');
  END IF;
  SELECT * INTO v_j FROM public.jamiyas WHERE id = p_jamiya_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'NOT_FOUND');
  END IF;
  IF NOT EXISTS (
       SELECT 1 FROM public.members
       WHERE jamiya_id = p_jamiya_id AND user_id = v_uid AND status IN ('active', 'invited'))
     AND NOT private.is_circle_officer(p_jamiya_id)
     AND NOT private.is_platform_admin() THEN
    RETURN jsonb_build_object('ok', false, 'error', 'FORBIDDEN');
  END IF;
  RETURN private.circle_terms_view(v_j, v_uid);
END;
$$;

-- For the invitation page: whoever holds a valid invite link may read the circle's terms.
CREATE OR REPLACE FUNCTION public.preview_invitation_terms(
  p_token_hash TEXT DEFAULT NULL,
  p_invite_code TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_jamiya_id UUID;
  v_j public.jamiyas%ROWTYPE;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'UNAUTHENTICATED');
  END IF;
  SELECT p.jamiya_id INTO v_jamiya_id
  FROM private.preview_invitation(p_token_hash, p_invite_code) p
  LIMIT 1;
  IF v_jamiya_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'NOT_FOUND');
  END IF;
  SELECT * INTO v_j FROM public.jamiyas WHERE id = v_jamiya_id;
  RETURN private.circle_terms_view(v_j, v_uid);
END;
$$;

CREATE OR REPLACE FUNCTION public.accept_circle_terms(p_jamiya_id UUID, p_version INT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_j public.jamiyas%ROWTYPE;
  v_terms JSONB;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'UNAUTHENTICATED');
  END IF;
  SELECT * INTO v_j FROM public.jamiyas WHERE id = p_jamiya_id FOR SHARE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'NOT_FOUND');
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.members
    WHERE jamiya_id = p_jamiya_id AND user_id = v_uid AND status IN ('active', 'invited')
  ) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'NOT_A_MEMBER');
  END IF;

  v_terms := private.circle_terms(v_j);
  -- The member accepts exactly what they were shown; if officers changed it since, show again.
  IF p_version IS DISTINCT FROM v_j.terms_version THEN
    RETURN jsonb_build_object('ok', false, 'error', 'TERMS_CHANGED', 'terms', v_terms);
  END IF;

  INSERT INTO public.member_consents (user_id, jamiya_id, kind, version, terms)
  VALUES (v_uid, p_jamiya_id, 'circle_terms', v_j.terms_version, v_terms)
  ON CONFLICT (user_id, jamiya_id, kind, version) DO NOTHING;

  IF FOUND THEN
    INSERT INTO public.audit_logs (actor_id, action, entity_type, entity_id, jamiya_id, metadata)
    VALUES (
      v_uid, 'update', 'member_consent', v_uid, p_jamiya_id,
      jsonb_build_object('event', 'circle.terms_accepted', 'version', v_j.terms_version, 'terms', v_terms)
    );
  END IF;

  RETURN jsonb_build_object('ok', true, 'version', v_j.terms_version);
END;
$$;

-- ---------------------------------------------------------------------------
-- Fees charge only what the member agreed to
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.charge_join_fee(p_jamiya_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_j public.jamiyas%ROWTYPE;
  v_fee NUMERIC;
  v_tx UUID;
BEGIN
  IF v_uid IS NULL OR NOT private.is_active_jamiya_member(p_jamiya_id) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'FORBIDDEN');
  END IF;

  SELECT * INTO v_j FROM public.jamiyas WHERE id = p_jamiya_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'NOT_FOUND');
  END IF;

  IF coalesce(v_j.join_fee_amount, 0) <= 0 THEN
    RETURN jsonb_build_object('ok', true, 'skipped', true, 'fee', 0);
  END IF;
  -- Only what the member accepted (and never more than the circle charges now).
  IF NOT private.has_accepted_circle_terms(v_uid, p_jamiya_id) THEN
    RETURN jsonb_build_object('ok', true, 'skipped', true, 'reason', 'TERMS_NOT_ACCEPTED');
  END IF;
  v_fee := private.agreed_circle_fee(v_uid, p_jamiya_id, 'join_fee_amount');
  IF v_fee <= 0 THEN
    RETURN jsonb_build_object('ok', true, 'skipped', true, 'fee', 0);
  END IF;

  -- Idempotent: skip if already charged for this user+circle
  IF EXISTS (
    SELECT 1 FROM public.transactions t
    WHERE t.user_id = v_uid
      AND t.jamiya_id = p_jamiya_id
      AND t.metadata->>'kind' = 'join_fee'
      AND t.status = 'completed'
  ) THEN
    RETURN jsonb_build_object('ok', true, 'skipped', true, 'already_paid', true);
  END IF;

  v_tx := private.ledger_debit(
    v_uid, v_j.currency, v_fee, 'fee'::public.transaction_type, p_jamiya_id,
    'join_fee', p_jamiya_id::text, jsonb_build_object('kind', 'join_fee')
  );

  RETURN jsonb_build_object('ok', true, 'fee', v_fee, 'transaction_id', v_tx);
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('ok', false, 'error', SQLERRM);
END;
$$;

CREATE OR REPLACE FUNCTION public.charge_early_slot_fee(p_jamiya_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
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

  IF NOT private.has_accepted_circle_terms(v_uid, p_jamiya_id) THEN
    RETURN jsonb_build_object('ok', true, 'skipped', true, 'reason', 'TERMS_NOT_ACCEPTED');
  END IF;
  -- Only what the member accepted (and never more than the circle charges now).
  v_fee := private.agreed_circle_fee(v_uid, p_jamiya_id, 'early_slot_fee_amount');
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

CREATE OR REPLACE FUNCTION private.charge_circle_fee(p_contribution_id uuid, p_user_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $$
DECLARE
  v_c public.contributions%ROWTYPE;
  v_j public.jamiyas%ROWTYPE;
  v_fee NUMERIC;
  v_tx UUID;
  v_owed public.fees_owed%ROWTYPE;
BEGIN
  SELECT * INTO v_c FROM public.contributions WHERE id = p_contribution_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('fee_status', 'none');
  END IF;
  -- The fee is due once the contribution is fully paid, not before.
  IF v_c.status <> 'paid' THEN
    RETURN jsonb_build_object('fee_status', 'not_due');
  END IF;

  SELECT * INTO v_j FROM public.jamiyas WHERE id = v_c.jamiya_id;
  IF coalesce(v_j.transaction_fee_amount, 0) <= 0 THEN
    RETURN jsonb_build_object('fee_status', 'none');
  END IF;
  -- Only what the member accepted (and never more than the circle charges now).
  IF NOT private.has_accepted_circle_terms(p_user_id, v_j.id) THEN
    RETURN jsonb_build_object('fee_status', 'not_agreed');
  END IF;
  v_fee := private.agreed_circle_fee(p_user_id, v_j.id, 'transaction_fee_amount');
  IF v_fee <= 0 THEN
    RETURN jsonb_build_object('fee_status', 'none');
  END IF;

  SELECT id INTO v_tx
  FROM public.transactions t
  WHERE t.user_id = p_user_id
    AND t.reference = 'contrib_fee:' || v_c.id::text
    AND t.status = 'completed'
  LIMIT 1;
  IF FOUND THEN
    RETURN jsonb_build_object('fee_status', 'charged', 'already', true, 'transaction_id', v_tx);
  END IF;

  SELECT * INTO v_owed
  FROM public.fees_owed
  WHERE contribution_id = v_c.id AND kind = 'contribution_fee';
  IF FOUND THEN
    RETURN jsonb_build_object('fee_status', v_owed.status, 'already', true, 'fee', v_owed.amount);
  END IF;

  IF private.wallet_spendable(p_user_id, v_j.currency) >= v_fee THEN
    v_tx := private.ledger_debit(
      p_user_id,
      v_j.currency,
      v_fee,
      'fee'::public.transaction_type,
      v_j.id,
      'contrib_fee:' || v_c.id::text,
      v_c.id::text,
      jsonb_build_object('kind', 'contribution_fee', 'contribution_id', v_c.id)
    );
    RETURN jsonb_build_object('fee_status', 'charged', 'fee', v_fee, 'transaction_id', v_tx);
  END IF;

  INSERT INTO public.fees_owed (user_id, jamiya_id, contribution_id, kind, amount, currency)
  VALUES (p_user_id, v_j.id, v_c.id, 'contribution_fee', v_fee, v_j.currency);

  INSERT INTO public.notifications (user_id, type, channel, title, body, data)
  VALUES (
    p_user_id,
    'system',
    'in_app',
    'Circle fee owed',
    'Your ' || v_fee::text || ' ' || v_j.currency || ' fee for ' || v_j.name || ', cycle '
      || v_c.cycle_number || ', will be taken from your next deposit.',
    jsonb_build_object(
      'kind', 'contribution_fee_owed',
      'jamiya_id', v_j.id,
      'contribution_id', v_c.id,
      'amount', v_fee
    )
  );

  RETURN jsonb_build_object('fee_status', 'owed', 'fee', v_fee);
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_add_circle_member(p_jamiya_id uuid, p_user_id uuid DEFAULT NULL::uuid, p_status membership_status DEFAULT 'active'::membership_status, p_email text DEFAULT NULL::text, p_phone text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
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
    -- No join fee here: the member has not seen or accepted the circle's terms. It is
    -- charged when they accept them (accept_circle_terms, then charge_join_fee).

    INSERT INTO public.notifications (user_id, type, channel, title, body, data)
    VALUES (
      v_target,
      'invitation',
      'in_app',
      'Added to circle',
      'You were added to ' || v_jamiya.name || ' on Jameiyah. Open the circle to review and accept its terms.',
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

REVOKE ALL ON FUNCTION private.circle_terms(public.jamiyas) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION private.trg_circle_terms_version() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION private.latest_circle_consent(UUID, UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION private.has_accepted_circle_terms(UUID, UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION private.agreed_circle_fee(UUID, UUID, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION private.circle_terms_view(public.jamiyas, UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.get_circle_terms(UUID) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.preview_invitation_terms(TEXT, TEXT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.accept_circle_terms(UUID, INT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_circle_terms(UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.preview_invitation_terms(TEXT, TEXT) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.accept_circle_terms(UUID, INT) TO authenticated, service_role;
