-- Before live lending: each person has a room they can still take.
-- Qard room is circle money. Tawarruq room is Jameiyah money.
-- Share groups: half of schedule payments, half of book contributions, 10% of shares.
-- Other circles: half of schedule payments.
-- Open loans reduce the room. An overdue loan sets the room to zero.
-- Jameiyah also keeps one company ceiling on Tawarruq cash still open.

INSERT INTO public.platform_settings (key, value)
VALUES ('tawarruq_exposure_ceiling', jsonb_build_object('kes', 500000))
ON CONFLICT (key) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.tawarruq_guarantees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id UUID NOT NULL REFERENCES public.tawarruq_applications (id) ON DELETE CASCADE,
  borrower_id UUID NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  guarantor_user_id UUID NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'accepted', 'declined', 'released')),
  decided_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT tawarruq_guarantees_not_self CHECK (guarantor_user_id <> borrower_id),
  UNIQUE (application_id, guarantor_user_id)
);

CREATE INDEX IF NOT EXISTS tawarruq_guarantees_guarantor_idx
  ON public.tawarruq_guarantees (guarantor_user_id, status);

ALTER TABLE public.tawarruq_guarantees ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tawarruq_guarantees_select ON public.tawarruq_guarantees;
CREATE POLICY tawarruq_guarantees_select ON public.tawarruq_guarantees
  FOR SELECT TO authenticated
  USING (
    borrower_id = auth.uid()
    OR guarantor_user_id = auth.uid()
    OR private.is_compliance_or_admin()
  );

REVOKE ALL ON public.tawarruq_guarantees FROM PUBLIC, anon;
GRANT SELECT ON public.tawarruq_guarantees TO authenticated;

CREATE OR REPLACE FUNCTION private.facility_member_overdue(p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.qard_loans q
    WHERE q.borrower_id = p_user_id
      AND (
        q.status = 'defaulted'
        OR (q.status = 'active' AND q.due_date IS NOT NULL AND q.due_date < CURRENT_DATE)
      )
  );
$$;

CREATE OR REPLACE FUNCTION private.facility_member_circle(p_jamiya_id UUID, p_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_member UUID;
  v_kind TEXT;
  v_schedule NUMERIC := 0;
  v_book NUMERIC := 0;
  v_shares NUMERIC := 0;
  v_owed NUMERIC := 0;
  v_weight NUMERIC := 0;
  v_share BOOLEAN := FALSE;
BEGIN
  SELECT m.id INTO v_member
  FROM public.members m
  WHERE m.jamiya_id = p_jamiya_id
    AND m.user_id = p_user_id
    AND m.status = 'active';
  IF v_member IS NULL THEN
    RETURN jsonb_build_object('ok', false);
  END IF;

  SELECT coalesce(j.challenge_kind, 'rotating') INTO v_kind
  FROM public.jamiyas j
  WHERE j.id = p_jamiya_id;
  v_share := v_kind = 'share_dividend';

  SELECT coalesce(sum(c.amount_paid), 0) INTO v_schedule
  FROM public.contributions c
  WHERE c.jamiya_id = p_jamiya_id AND c.member_id = v_member;

  SELECT coalesce(sum(b.amount), 0) INTO v_book
  FROM public.book_entries b
  WHERE b.jamiya_id = p_jamiya_id
    AND b.member_id = v_member
    AND b.entry_type = 'contribution';

  SELECT coalesce(sum(l.amount), 0) INTO v_shares
  FROM public.circle_share_lots l
  WHERE l.jamiya_id = p_jamiya_id AND l.member_id = v_member;

  SELECT coalesce(sum(greatest(q.amount - coalesce(q.amount_repaid, 0), 0)), 0) INTO v_owed
  FROM public.qard_loans q
  WHERE q.jamiya_id = p_jamiya_id
    AND q.borrower_id = p_user_id
    AND q.status IN ('requested', 'approved', 'active', 'defaulted');

  IF v_share THEN
    v_weight := round(v_schedule * 0.5 + v_book * 0.5 + v_shares * 0.1, 2);
  ELSE
    v_weight := round(v_schedule * 0.5, 2);
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'member_id', v_member,
    'is_share', v_share,
    'schedule_paid', v_schedule,
    'book_contributions', v_book,
    'shares', v_shares,
    'weight', v_weight,
    'qard_owed', v_owed,
    'personal_room', greatest(v_weight - v_owed, 0)
  );
END;
$$;

CREATE OR REPLACE FUNCTION private.facility_circle_room(p_jamiya_id UUID)
RETURNS NUMERIC
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_kind TEXT;
  v_schedule NUMERIC := 0;
  v_book NUMERIC := 0;
  v_owed NUMERIC := 0;
  v_base NUMERIC := 0;
BEGIN
  SELECT coalesce(j.challenge_kind, 'rotating') INTO v_kind
  FROM public.jamiyas j
  WHERE j.id = p_jamiya_id;

  SELECT coalesce(sum(c.amount_paid), 0) INTO v_schedule
  FROM public.contributions c
  WHERE c.jamiya_id = p_jamiya_id;

  SELECT coalesce(sum(b.amount), 0) INTO v_book
  FROM public.book_entries b
  WHERE b.jamiya_id = p_jamiya_id AND b.entry_type = 'contribution';

  SELECT coalesce(sum(greatest(q.amount - coalesce(q.amount_repaid, 0), 0)), 0) INTO v_owed
  FROM public.qard_loans q
  WHERE q.jamiya_id = p_jamiya_id
    AND q.status IN ('requested', 'approved', 'active', 'defaulted');

  IF v_kind = 'share_dividend' THEN
    v_base := (v_schedule + v_book) * 0.5;
  ELSE
    v_base := v_schedule * 0.5;
  END IF;

  RETURN greatest(round(v_base - v_owed, 2), 0);
END;
$$;

CREATE OR REPLACE FUNCTION private.facility_tawarruq_owed(p_user_id UUID)
RETURNS NUMERIC
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT coalesce(sum(a.amount), 0)
  FROM public.tawarruq_applications a
  WHERE a.user_id = p_user_id
    AND a.status IN ('requested', 'submitted_to_partner', 'approved', 'disbursed');
$$;

CREATE OR REPLACE FUNCTION private.facility_company_tawarruq_owed()
RETURNS NUMERIC
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT coalesce(sum(a.amount), 0)
  FROM public.tawarruq_applications a
  WHERE a.status IN ('requested', 'submitted_to_partner', 'approved', 'disbursed');
$$;

CREATE OR REPLACE FUNCTION private.facility_company_ceiling()
RETURNS NUMERIC
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT coalesce(
    (SELECT (value->>'kes')::NUMERIC FROM public.platform_settings WHERE key = 'tawarruq_exposure_ceiling'),
    500000
  );
$$;

REVOKE ALL ON FUNCTION private.facility_member_overdue(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION private.facility_member_circle(UUID, UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION private.facility_circle_room(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION private.facility_tawarruq_owed(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION private.facility_company_tawarruq_owed() FROM PUBLIC;
REVOKE ALL ON FUNCTION private.facility_company_ceiling() FROM PUBLIC;

CREATE OR REPLACE FUNCTION public.my_facility_qualification()
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_phone TEXT;
  v_kyc TEXT;
  v_row RECORD;
  v_fig JSONB;
  v_circles JSONB := '[]'::jsonb;
  v_strength NUMERIC := 0;
  v_owed NUMERIC := 0;
  v_room NUMERIC := 0;
  v_company NUMERIC := 0;
  v_ceiling NUMERIC := 0;
  v_overdue BOOLEAN := FALSE;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'UNAUTHENTICATED');
  END IF;

  SELECT coalesce(nullif(trim(mpesa_phone), ''), nullif(trim(phone), '')), kyc_status::text
  INTO v_phone, v_kyc
  FROM public.profiles
  WHERE id = v_uid;

  v_overdue := private.facility_member_overdue(v_uid);
  v_owed := private.facility_tawarruq_owed(v_uid);
  v_company := private.facility_company_tawarruq_owed();
  v_ceiling := private.facility_company_ceiling();

  FOR v_row IN
    SELECT m.jamiya_id, j.name
    FROM public.members m
    JOIN public.jamiyas j ON j.id = m.jamiya_id
    WHERE m.user_id = v_uid AND m.status = 'active'
  LOOP
    v_fig := private.facility_member_circle(v_row.jamiya_id, v_uid);
    IF coalesce((v_fig->>'ok')::boolean, false) THEN
      v_strength := v_strength + coalesce((v_fig->>'weight')::numeric, 0);
      v_circles := v_circles || jsonb_build_array(
        v_fig || jsonb_build_object(
          'jamiya_id', v_row.jamiya_id,
          'name', v_row.name,
          'circle_room', private.facility_circle_room(v_row.jamiya_id),
          'qard_room', CASE
            WHEN v_overdue THEN 0
            ELSE least(
              coalesce((v_fig->>'personal_room')::numeric, 0),
              private.facility_circle_room(v_row.jamiya_id)
            )
          END
        )
      );
    END IF;
  END LOOP;

  v_room := CASE WHEN v_overdue THEN 0 ELSE greatest(round(v_strength - v_owed, 2), 0) END;

  RETURN jsonb_build_object(
    'ok', true,
    'overdue', v_overdue,
    'phone_ok', v_phone IS NOT NULL AND v_phone ~ '^\+[1-9]\d{7,14}$',
    'kyc_status', v_kyc,
    'tawarruq_strength', round(v_strength, 2),
    'tawarruq_owed', v_owed,
    'tawarruq_room', v_room,
    'company_owed', v_company,
    'company_ceiling', v_ceiling,
    'company_left', greatest(v_ceiling - v_company, 0),
    'circles', v_circles
  );
END;
$$;

REVOKE ALL ON FUNCTION public.my_facility_qualification() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.my_facility_qualification() TO authenticated;

CREATE OR REPLACE FUNCTION public.qard_cap_for_jamiya(p_jamiya_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_fig JSONB;
  v_circle NUMERIC := 0;
  v_personal NUMERIC := 0;
  v_cap NUMERIC := 0;
  v_overdue BOOLEAN := FALSE;
BEGIN
  IF v_uid IS NULL OR NOT private.is_active_jamiya_member(p_jamiya_id) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'FORBIDDEN');
  END IF;

  v_fig := private.facility_member_circle(p_jamiya_id, v_uid);
  IF NOT coalesce((v_fig->>'ok')::boolean, false) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'FORBIDDEN');
  END IF;

  v_overdue := private.facility_member_overdue(v_uid);
  v_circle := private.facility_circle_room(p_jamiya_id);
  v_personal := coalesce((v_fig->>'personal_room')::numeric, 0);
  v_cap := CASE WHEN v_overdue THEN 0 ELSE least(v_personal, v_circle) END;

  RETURN jsonb_build_object(
    'ok', true,
    'paid_total', coalesce((v_fig->>'schedule_paid')::numeric, 0),
    'cap', v_cap,
    'currency', 'KES',
    'overdue', v_overdue,
    'is_share', coalesce((v_fig->>'is_share')::boolean, false),
    'schedule_paid', coalesce((v_fig->>'schedule_paid')::numeric, 0),
    'book_contributions', coalesce((v_fig->>'book_contributions')::numeric, 0),
    'shares', coalesce((v_fig->>'shares')::numeric, 0),
    'qard_owed', coalesce((v_fig->>'qard_owed')::numeric, 0),
    'personal_room', v_personal,
    'circle_room', v_circle
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.request_qard(
  p_jamiya_id UUID,
  p_amount NUMERIC,
  p_purpose TEXT,
  p_installments INT DEFAULT 4,
  p_guarantor_user_ids UUID[] DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_cap NUMERIC;
  v_id UUID;
  v_g UUID;
  v_count INT := 0;
  v_name TEXT;
  v_cap_row JSONB;
BEGIN
  IF v_uid IS NULL OR NOT private.is_active_jamiya_member(p_jamiya_id) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'FORBIDDEN');
  END IF;
  IF p_amount IS NULL OR p_amount < 100 OR char_length(trim(p_purpose)) < 5 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'INVALID');
  END IF;

  PERFORM 1 FROM public.jamiyas WHERE id = p_jamiya_id FOR UPDATE;

  IF private.facility_member_overdue(v_uid) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'OVERDUE');
  END IF;

  v_cap_row := public.qard_cap_for_jamiya(p_jamiya_id);
  v_cap := coalesce((v_cap_row->>'cap')::numeric, 0);
  IF p_amount > v_cap THEN
    RETURN jsonb_build_object('ok', false, 'error', 'ABOVE_CAP', 'cap', v_cap);
  END IF;

  INSERT INTO public.qard_loans (
    jamiya_id, borrower_id, amount, currency, purpose, installment_count
  )
  SELECT p_jamiya_id, v_uid, p_amount, j.currency, trim(p_purpose),
         least(greatest(coalesce(p_installments, 4), 1), 24)
  FROM public.jamiyas j WHERE j.id = p_jamiya_id
  RETURNING id INTO v_id;

  SELECT coalesce(full_name, email, 'A member') INTO v_name
  FROM public.profiles WHERE id = v_uid;

  IF p_guarantor_user_ids IS NOT NULL THEN
    FOREACH v_g IN ARRAY p_guarantor_user_ids LOOP
      IF v_g IS NULL OR v_g = v_uid THEN
        CONTINUE;
      END IF;
      IF NOT EXISTS (
        SELECT 1 FROM public.members m
        WHERE m.jamiya_id = p_jamiya_id
          AND m.user_id = v_g
          AND m.status = 'active'
      ) THEN
        CONTINUE;
      END IF;

      INSERT INTO public.qard_guarantees (
        loan_id, jamiya_id, borrower_id, guarantor_user_id, status
      )
      VALUES (v_id, p_jamiya_id, v_uid, v_g, 'pending')
      ON CONFLICT (loan_id, guarantor_user_id) DO NOTHING;

      IF EXISTS (
        SELECT 1 FROM public.qard_guarantees
        WHERE loan_id = v_id AND guarantor_user_id = v_g AND status = 'pending'
      ) THEN
        v_count := v_count + 1;
        INSERT INTO public.notifications (user_id, type, channel, title, body, data)
        VALUES (
          v_g,
          'system',
          'in_app',
          'Guarantee requested',
          v_name || ' asked you to guarantee their circle loan (Qard Hassan).',
          jsonb_build_object(
            'kind', 'qard_guarantee',
            'loan_id', v_id,
            'jamiya_id', p_jamiya_id
          )
        );
      END IF;
    END LOOP;
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'loan_id', v_id,
    'cap', v_cap,
    'guarantors_nominated', v_count
  );
END;
$$;

DROP FUNCTION IF EXISTS public.submit_jameiyah_tawarruq(NUMERIC, TEXT, UUID, INT, INT, BOOLEAN);

CREATE OR REPLACE FUNCTION public.submit_jameiyah_tawarruq(
  p_amount NUMERIC,
  p_purpose TEXT,
  p_jamiya_id UUID,
  p_profit_rate_bps INT,
  p_tenor_months INT,
  p_wakalah BOOLEAN,
  p_guarantor_user_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_id UUID;
  v_profit NUMERIC(14, 2);
  v_deferred NUMERIC(14, 2);
  v_installment NUMERIC(14, 2);
  v_phone TEXT;
  v_kyc TEXT;
  v_name TEXT;
  v_qual JSONB;
  v_room NUMERIC := 0;
  v_company_left NUMERIC := 0;
  v_ceiling NUMERIC := 0;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'UNAUTHENTICATED');
  END IF;
  IF p_wakalah IS NOT TRUE THEN
    RETURN jsonb_build_object('ok', false, 'error', 'WAKALAH_REQUIRED');
  END IF;
  IF p_amount IS NULL OR p_amount < 1000 OR p_amount > 5000000
     OR p_profit_rate_bps IS NULL OR p_profit_rate_bps NOT IN (500, 1000, 1500)
     OR p_tenor_months IS NULL OR p_tenor_months NOT IN (3, 6, 12, 24)
     OR p_purpose IS NULL OR char_length(trim(p_purpose)) < 5 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'INVALID');
  END IF;

  IF p_jamiya_id IS NOT NULL AND NOT EXISTS (
    SELECT 1
    FROM public.members
    WHERE user_id = v_uid
      AND jamiya_id = p_jamiya_id
      AND status = 'active'
  ) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'NOT_A_MEMBER');
  END IF;

  PERFORM 1 FROM public.platform_settings WHERE key = 'tawarruq_exposure_ceiling' FOR UPDATE;

  SELECT coalesce(nullif(trim(mpesa_phone), ''), nullif(trim(phone), '')), kyc_status::text,
         coalesce(full_name, email, 'A member')
  INTO v_phone, v_kyc, v_name
  FROM public.profiles
  WHERE id = v_uid;

  IF v_phone IS NULL OR v_phone !~ '^\+[1-9]\d{7,14}$' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'PHONE_REQUIRED');
  END IF;

  IF private.facility_member_overdue(v_uid) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'OVERDUE');
  END IF;

  v_qual := public.my_facility_qualification();
  v_room := coalesce((v_qual->>'tawarruq_room')::numeric, 0);
  v_company_left := coalesce((v_qual->>'company_left')::numeric, 0);
  v_ceiling := coalesce((v_qual->>'company_ceiling')::numeric, 500000);

  IF p_amount > v_room THEN
    RETURN jsonb_build_object('ok', false, 'error', 'ABOVE_ROOM', 'room', v_room);
  END IF;
  IF p_amount > v_company_left THEN
    RETURN jsonb_build_object(
      'ok', false,
      'error', 'ABOVE_COMPANY_LIMIT',
      'company_left', v_company_left,
      'ceiling', v_ceiling
    );
  END IF;
  IF p_amount > 5000 AND v_kyc IS DISTINCT FROM 'approved' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'KYC_REQUIRED', 'kyc_status', v_kyc);
  END IF;
  IF p_amount > 20000 AND (
    p_guarantor_user_id IS NULL
    OR p_guarantor_user_id = v_uid
    OR NOT EXISTS (
      SELECT 1
      FROM public.members mine
      JOIN public.members theirs
        ON theirs.jamiya_id = mine.jamiya_id
       AND theirs.user_id = p_guarantor_user_id
       AND theirs.status = 'active'
      WHERE mine.user_id = v_uid AND mine.status = 'active'
    )
  ) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'GUARANTOR_REQUIRED');
  END IF;

  v_profit := round(p_amount * p_profit_rate_bps / 10000.0, 2);
  IF v_profit <= 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'INVALID');
  END IF;
  v_deferred := round(p_amount + v_profit, 2);
  v_installment := round(v_deferred / p_tenor_months, 2);

  INSERT INTO public.tawarruq_applications (
    user_id, jamiya_id, amount, purpose, status,
    profit_rate_bps, tenor_months, profit_amount, deferred_amount,
    platform_fee_amount, circle_profit_amount, installment_amount,
    wakalah_accepted_at, commodity, metadata
  )
  VALUES (
    v_uid, p_jamiya_id, p_amount, trim(p_purpose), 'requested',
    p_profit_rate_bps, p_tenor_months, v_profit, v_deferred,
    v_profit, 0, v_installment,
    NOW(), 'crude_palm_oil',
    jsonb_build_object(
      'structure', 'jameiyah_murabaha_tawarruq',
      'financier', 'jameiyah',
      'profit_to', 'jameiyah',
      'cash_moves', false,
      'qualification_room', v_room,
      'band', CASE
        WHEN p_amount > 100000 THEN 'two_admins'
        WHEN p_amount > 20000 THEN 'guarantor'
        WHEN p_amount > 5000 THEN 'kyc'
        ELSE 'standard'
      END
    )
  )
  RETURNING id INTO v_id;

  IF p_amount > 20000 THEN
    INSERT INTO public.tawarruq_guarantees (
      application_id, borrower_id, guarantor_user_id, status
    )
    VALUES (v_id, v_uid, p_guarantor_user_id, 'pending');

    INSERT INTO public.notifications (user_id, type, channel, title, body, data)
    VALUES (
      p_guarantor_user_id,
      'system',
      'in_app',
      'Guarantee requested',
      v_name || ' asked you to guarantee a Jameiyah financing request.',
      jsonb_build_object('kind', 'tawarruq_guarantee', 'application_id', v_id)
    );
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'application_id', v_id,
    'cash_amount', p_amount,
    'deferred_amount', v_deferred,
    'platform_fee_amount', v_profit,
    'circle_profit_amount', 0,
    'installment_amount', v_installment,
    'room', v_room
  );
END;
$$;

REVOKE ALL ON FUNCTION public.submit_jameiyah_tawarruq(NUMERIC, TEXT, UUID, INT, INT, BOOLEAN, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.submit_jameiyah_tawarruq(NUMERIC, TEXT, UUID, INT, INT, BOOLEAN, UUID) TO authenticated;

CREATE OR REPLACE FUNCTION public.respond_tawarruq_guarantee(
  p_guarantee_id UUID,
  p_accept BOOLEAN
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_g public.tawarruq_guarantees%ROWTYPE;
  v_app public.tawarruq_applications%ROWTYPE;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'UNAUTHENTICATED');
  END IF;

  SELECT * INTO v_g FROM public.tawarruq_guarantees WHERE id = p_guarantee_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'NOT_FOUND');
  END IF;
  IF v_g.guarantor_user_id <> v_uid THEN
    RETURN jsonb_build_object('ok', false, 'error', 'FORBIDDEN');
  END IF;
  IF v_g.status <> 'pending' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'ALREADY_DECIDED');
  END IF;

  SELECT * INTO v_app FROM public.tawarruq_applications WHERE id = v_g.application_id;
  IF NOT FOUND OR v_app.status <> 'requested' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'NOT_REQUESTED');
  END IF;

  UPDATE public.tawarruq_guarantees
  SET status = CASE WHEN p_accept THEN 'accepted' ELSE 'declined' END,
      decided_at = NOW()
  WHERE id = p_guarantee_id;

  INSERT INTO public.notifications (user_id, type, channel, title, body, data)
  VALUES (
    v_g.borrower_id,
    'system',
    'in_app',
    CASE WHEN p_accept THEN 'Guarantee accepted' ELSE 'Guarantee declined' END,
    CASE WHEN p_accept
      THEN 'Your guarantor accepted the Jameiyah financing request.'
      ELSE 'Your guarantor declined the Jameiyah financing request.'
    END,
    jsonb_build_object('kind', 'tawarruq_guarantee', 'application_id', v_g.application_id)
  );

  RETURN jsonb_build_object('ok', true, 'status', CASE WHEN p_accept THEN 'accepted' ELSE 'declined' END);
END;
$$;

REVOKE ALL ON FUNCTION public.respond_tawarruq_guarantee(UUID, BOOLEAN) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.respond_tawarruq_guarantee(UUID, BOOLEAN) TO authenticated;

CREATE OR REPLACE FUNCTION public.submit_tawarruq_to_partner(p_application_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_app public.tawarruq_applications%ROWTYPE;
  v_ref TEXT;
  v_accepted INT := 0;
  v_first UUID;
BEGIN
  IF v_uid IS NULL OR NOT private.is_compliance_or_admin() THEN
    RETURN jsonb_build_object('ok', false, 'error', 'FORBIDDEN');
  END IF;

  SELECT * INTO v_app FROM public.tawarruq_applications WHERE id = p_application_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'NOT_FOUND');
  END IF;
  IF v_app.status <> 'requested' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'NOT_REQUESTED');
  END IF;

  IF v_app.amount > 20000 THEN
    SELECT count(*)::INT INTO v_accepted
    FROM public.tawarruq_guarantees
    WHERE application_id = p_application_id AND status = 'accepted';
    IF coalesce(v_accepted, 0) < 1 THEN
      RETURN jsonb_build_object('ok', false, 'error', 'GUARANTEE_REQUIRED');
    END IF;
  END IF;

  IF v_app.amount > 100000 THEN
    v_first := NULLIF(v_app.metadata->>'first_admin_id', '')::uuid;
    IF v_first IS NULL THEN
      UPDATE public.tawarruq_applications
      SET metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object(
            'first_admin_id', v_uid,
            'first_admin_at', NOW()
          ),
          updated_at = NOW()
      WHERE id = p_application_id;
      RETURN jsonb_build_object('ok', true, 'pending_second_admin', true, 'status', 'requested');
    END IF;
    IF v_first = v_uid THEN
      RETURN jsonb_build_object('ok', false, 'error', 'SECOND_APPROVER_MUST_DIFFER');
    END IF;
  END IF;

  v_ref := coalesce(
    nullif(trim(coalesce(v_app.partner_reference, '')), ''),
    'PTR-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 10))
  );

  UPDATE public.tawarruq_applications
  SET
    status = 'submitted_to_partner',
    partner_reference = v_ref,
    partner_status = 'queued',
    metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object(
      'submitted_by', v_uid,
      'submitted_at', NOW(),
      'handoff', 'partner_api_queued'
    ),
    updated_at = NOW()
  WHERE id = p_application_id;

  RETURN jsonb_build_object('ok', true, 'partner_reference', v_ref, 'status', 'submitted_to_partner');
END;
$$;

CREATE OR REPLACE FUNCTION public.tawarruq_exposure()
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT private.is_compliance_or_admin() THEN
    RETURN jsonb_build_object('ok', false, 'error', 'FORBIDDEN');
  END IF;
  RETURN jsonb_build_object(
    'ok', true,
    'company_owed', private.facility_company_tawarruq_owed(),
    'company_ceiling', private.facility_company_ceiling(),
    'company_left', greatest(
      private.facility_company_ceiling() - private.facility_company_tawarruq_owed(),
      0
    )
  );
END;
$$;

REVOKE ALL ON FUNCTION public.tawarruq_exposure() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.tawarruq_exposure() TO authenticated;
