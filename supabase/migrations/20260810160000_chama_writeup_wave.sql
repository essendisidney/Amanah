-- Chama write-up wave: penalties, member codes, book entries, payout compliance & receipt,
-- announcements, savings pockets, credit snapshot.

-- ---------------------------------------------------------------------------
-- Penalties config + ledger
-- ---------------------------------------------------------------------------
ALTER TABLE public.jamiyas
  ADD COLUMN IF NOT EXISTS late_contribution_penalty NUMERIC(14, 2) NOT NULL DEFAULT 0
    CHECK (late_contribution_penalty >= 0),
  ADD COLUMN IF NOT EXISTS missed_contribution_penalty NUMERIC(14, 2) NOT NULL DEFAULT 0
    CHECK (missed_contribution_penalty >= 0),
  ADD COLUMN IF NOT EXISTS late_loan_penalty_fixed NUMERIC(14, 2) NOT NULL DEFAULT 0
    CHECK (late_loan_penalty_fixed >= 0),
  ADD COLUMN IF NOT EXISTS late_loan_penalty_pct NUMERIC(7, 4) NOT NULL DEFAULT 0
    CHECK (late_loan_penalty_pct >= 0 AND late_loan_penalty_pct <= 100),
  ADD COLUMN IF NOT EXISTS payout_compliance_mode TEXT NOT NULL DEFAULT 'block'
    CHECK (payout_compliance_mode IN ('block', 'approve', 'deduct', 'allow'));

CREATE TABLE IF NOT EXISTS public.penalties (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  jamiya_id UUID NOT NULL REFERENCES public.jamiyas (id) ON DELETE CASCADE,
  member_id UUID NOT NULL REFERENCES public.members (id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles (id),
  kind TEXT NOT NULL CHECK (kind IN (
    'late_contribution', 'missed_contribution', 'late_loan'
  )),
  amount NUMERIC(14, 2) NOT NULL CHECK (amount > 0),
  currency CHAR(3) NOT NULL DEFAULT 'KES',
  contribution_id UUID REFERENCES public.contributions (id) ON DELETE SET NULL,
  qard_loan_id UUID,
  status TEXT NOT NULL DEFAULT 'open'
    CHECK (status IN ('open', 'paid', 'waived')),
  assessed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  paid_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS penalties_jamiya_status_idx
  ON public.penalties (jamiya_id, status);
CREATE UNIQUE INDEX IF NOT EXISTS penalties_unique_contrib_kind_idx
  ON public.penalties (contribution_id, kind)
  WHERE contribution_id IS NOT NULL;

ALTER TABLE public.penalties ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS penalties_select ON public.penalties;
CREATE POLICY penalties_select ON public.penalties FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR private.is_circle_admin(jamiya_id)
    OR private.is_platform_admin()
  );

DROP POLICY IF EXISTS penalties_admin_write ON public.penalties;
CREATE POLICY penalties_admin_write ON public.penalties FOR ALL TO authenticated
  USING (private.is_circle_admin(jamiya_id) OR private.is_platform_admin())
  WITH CHECK (private.is_circle_admin(jamiya_id) OR private.is_platform_admin());

GRANT SELECT, INSERT, UPDATE ON public.penalties TO authenticated;

-- ---------------------------------------------------------------------------
-- Human member codes (e.g. ASHAR001)
-- ---------------------------------------------------------------------------
ALTER TABLE public.members
  ADD COLUMN IF NOT EXISTS member_code TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS members_jamiya_code_unique_idx
  ON public.members (jamiya_id, member_code)
  WHERE member_code IS NOT NULL;

CREATE OR REPLACE FUNCTION private.assign_member_code()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_prefix TEXT;
  v_n INT;
BEGIN
  IF NEW.member_code IS NOT NULL THEN
    RETURN NEW;
  END IF;
  SELECT upper(regexp_replace(left(slug, 5), '[^a-z0-9]', '', 'gi'))
  INTO v_prefix FROM public.jamiyas WHERE id = NEW.jamiya_id;
  IF v_prefix IS NULL OR v_prefix = '' THEN
    v_prefix := 'MEM';
  END IF;
  SELECT COUNT(*)::INT + 1 INTO v_n
  FROM public.members WHERE jamiya_id = NEW.jamiya_id;
  NEW.member_code := v_prefix || lpad(v_n::text, 3, '0');
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS members_assign_code ON public.members;
CREATE TRIGGER members_assign_code
  BEFORE INSERT ON public.members
  FOR EACH ROW
  EXECUTE FUNCTION private.assign_member_code();

-- Backfill existing
UPDATE public.members m
SET member_code = sub.code
FROM (
  SELECT
    id,
    upper(coalesce(
      (SELECT left(regexp_replace(j.slug, '[^a-z0-9]', '', 'gi'), 5) FROM public.jamiyas j WHERE j.id = members.jamiya_id),
      'mem'
    )) || lpad(row_number() OVER (PARTITION BY jamiya_id ORDER BY created_at)::text, 3, '0') AS code
  FROM public.members
  WHERE member_code IS NULL
) sub
WHERE m.id = sub.id AND m.member_code IS NULL;

-- ---------------------------------------------------------------------------
-- Backdated / migration book entries
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.book_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  jamiya_id UUID NOT NULL REFERENCES public.jamiyas (id) ON DELETE CASCADE,
  member_id UUID REFERENCES public.members (id) ON DELETE SET NULL,
  entry_type TEXT NOT NULL CHECK (entry_type IN (
    'opening_balance', 'contribution', 'payout', 'loan', 'loan_repayment',
    'penalty', 'withdrawal', 'adjustment', 'merry_go_round'
  )),
  amount NUMERIC(18, 2) NOT NULL,
  currency CHAR(3) NOT NULL DEFAULT 'KES',
  effective_date DATE NOT NULL,
  entered_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  entered_by UUID NOT NULL REFERENCES public.profiles (id),
  notes TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS book_entries_jamiya_date_idx
  ON public.book_entries (jamiya_id, effective_date DESC);

ALTER TABLE public.book_entries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS book_entries_select ON public.book_entries;
CREATE POLICY book_entries_select ON public.book_entries FOR SELECT TO authenticated
  USING (
    private.is_jamiya_member(jamiya_id)
    OR private.is_circle_admin(jamiya_id)
    OR private.is_platform_admin()
  );

DROP POLICY IF EXISTS book_entries_admin_insert ON public.book_entries;
CREATE POLICY book_entries_admin_insert ON public.book_entries FOR INSERT TO authenticated
  WITH CHECK (private.is_circle_admin(jamiya_id) OR private.is_platform_admin());

GRANT SELECT, INSERT ON public.book_entries TO authenticated;

-- ---------------------------------------------------------------------------
-- Payout receipt confirm + compliance helper columns
-- ---------------------------------------------------------------------------
ALTER TABLE public.payouts
  ADD COLUMN IF NOT EXISTS receipt_confirmed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS receipt_confirmed_by UUID REFERENCES public.profiles (id);

-- ---------------------------------------------------------------------------
-- Announcements
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.announcements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  jamiya_id UUID NOT NULL REFERENCES public.jamiyas (id) ON DELETE CASCADE,
  created_by UUID NOT NULL REFERENCES public.profiles (id),
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS announcements_jamiya_idx
  ON public.announcements (jamiya_id, created_at DESC);

ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS announcements_select ON public.announcements;
CREATE POLICY announcements_select ON public.announcements FOR SELECT TO authenticated
  USING (private.is_jamiya_member(jamiya_id) OR private.is_platform_admin());

DROP POLICY IF EXISTS announcements_admin_insert ON public.announcements;
CREATE POLICY announcements_admin_insert ON public.announcements FOR INSERT TO authenticated
  WITH CHECK (private.is_circle_admin(jamiya_id) OR private.is_platform_admin());

GRANT SELECT, INSERT ON public.announcements TO authenticated;

-- ---------------------------------------------------------------------------
-- Savings pockets (multi-category balances per member)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.savings_pockets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  jamiya_id UUID NOT NULL REFERENCES public.jamiyas (id) ON DELETE CASCADE,
  member_id UUID NOT NULL REFERENCES public.members (id) ON DELETE CASCADE,
  category TEXT NOT NULL CHECK (category IN (
    'regular', 'emergency', 'school', 'holiday', 'investment', 'goal'
  )),
  label TEXT,
  target_amount NUMERIC(18, 2),
  balance NUMERIC(18, 2) NOT NULL DEFAULT 0 CHECK (balance >= 0),
  currency CHAR(3) NOT NULL DEFAULT 'KES',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS savings_pockets_member_cat_label_idx
  ON public.savings_pockets (member_id, category, (COALESCE(label, '')));

ALTER TABLE public.savings_pockets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS savings_pockets_select ON public.savings_pockets;
CREATE POLICY savings_pockets_select ON public.savings_pockets FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.members m
      WHERE m.id = member_id AND (m.user_id = auth.uid() OR private.is_circle_admin(m.jamiya_id))
    )
  );

DROP POLICY IF EXISTS savings_pockets_admin ON public.savings_pockets;
CREATE POLICY savings_pockets_admin ON public.savings_pockets FOR ALL TO authenticated
  USING (private.is_circle_admin(jamiya_id) OR private.is_platform_admin())
  WITH CHECK (private.is_circle_admin(jamiya_id) OR private.is_platform_admin());

GRANT SELECT, INSERT, UPDATE ON public.savings_pockets TO authenticated;

DROP POLICY IF EXISTS savings_pockets_member_insert ON public.savings_pockets;
CREATE POLICY savings_pockets_member_insert ON public.savings_pockets
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.members m
      WHERE m.id = member_id
        AND m.user_id = auth.uid()
        AND m.status = 'active'
        AND m.jamiya_id = savings_pockets.jamiya_id
    )
  );

-- ---------------------------------------------------------------------------
-- Assess late contribution penalties (idempotent per contribution)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.assess_contribution_penalties(p_jamiya_id UUID DEFAULT NULL)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_count INT := 0;
  r RECORD;
BEGIN
  FOR r IN
    SELECT c.id AS contribution_id, c.jamiya_id, c.member_id, m.user_id, j.currency,
           j.late_contribution_penalty AS penalty_amt
    FROM public.contributions c
    JOIN public.members m ON m.id = c.member_id
    JOIN public.jamiyas j ON j.id = c.jamiya_id
    WHERE c.status IN ('late', 'partial')
      AND j.late_contribution_penalty > 0
      AND (p_jamiya_id IS NULL OR c.jamiya_id = p_jamiya_id)
      AND NOT EXISTS (
        SELECT 1 FROM public.penalties p
        WHERE p.contribution_id = c.id AND p.kind = 'late_contribution'
      )
  LOOP
    INSERT INTO public.penalties (
      jamiya_id, member_id, user_id, kind, amount, currency, contribution_id, notes
    ) VALUES (
      r.jamiya_id, r.member_id, r.user_id, 'late_contribution', r.penalty_amt, r.currency,
      r.contribution_id, 'Auto-assessed late contribution penalty'
    );
    v_count := v_count + 1;

    INSERT INTO public.notifications (user_id, type, channel, title, body, data)
    VALUES (
      r.user_id,
      'contribution_due',
      'in_app',
      'Late contribution penalty',
      'A penalty of ' || r.penalty_amt::text || ' ' || r.currency || ' was assessed.',
      jsonb_build_object('contribution_id', r.contribution_id, 'penalty', r.penalty_amt)
    );
  END LOOP;

  RETURN jsonb_build_object('ok', true, 'assessed', v_count);
END;
$$;

REVOKE ALL ON FUNCTION public.assess_contribution_penalties(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.assess_contribution_penalties(UUID) TO authenticated;

-- ---------------------------------------------------------------------------
-- Confirm payout receipt
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.confirm_payout_receipt(p_payout_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_p public.payouts%ROWTYPE;
  v_m public.members%ROWTYPE;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'UNAUTHENTICATED');
  END IF;

  SELECT * INTO v_p FROM public.payouts WHERE id = p_payout_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'NOT_FOUND');
  END IF;

  SELECT * INTO v_m FROM public.members WHERE id = v_p.member_id;
  IF v_m.user_id <> v_uid THEN
    RETURN jsonb_build_object('ok', false, 'error', 'FORBIDDEN');
  END IF;

  IF v_p.status <> 'paid' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'NOT_PAID_YET');
  END IF;

  IF v_p.receipt_confirmed_at IS NOT NULL THEN
    RETURN jsonb_build_object('ok', true, 'already_confirmed', true);
  END IF;

  UPDATE public.payouts
  SET receipt_confirmed_at = NOW(), receipt_confirmed_by = v_uid, updated_at = NOW()
  WHERE id = p_payout_id;

  RETURN jsonb_build_object('ok', true);
END;
$$;

REVOKE ALL ON FUNCTION public.confirm_payout_receipt(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.confirm_payout_receipt(UUID) TO authenticated;

-- ---------------------------------------------------------------------------
-- Broadcast announcement → in-app notifications for all active members
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.broadcast_announcement(
  p_jamiya_id UUID,
  p_title TEXT,
  p_body TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_ann UUID;
  v_count INT := 0;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'UNAUTHENTICATED');
  END IF;
  IF NOT private.is_circle_admin(p_jamiya_id) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'FORBIDDEN');
  END IF;

  INSERT INTO public.announcements (jamiya_id, created_by, title, body)
  VALUES (p_jamiya_id, v_uid, btrim(p_title), btrim(p_body))
  RETURNING id INTO v_ann;

  INSERT INTO public.notifications (user_id, type, channel, title, body, data)
  SELECT
    m.user_id,
    'system',
    'in_app',
    p_title,
    p_body,
    jsonb_build_object('jamiya_id', p_jamiya_id, 'announcement_id', v_ann)
  FROM public.members m
  WHERE m.jamiya_id = p_jamiya_id AND m.status = 'active';

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN jsonb_build_object('ok', true, 'announcement_id', v_ann, 'notified', v_count);
END;
$$;

REVOKE ALL ON FUNCTION public.broadcast_announcement(UUID, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.broadcast_announcement(UUID, TEXT, TEXT) TO authenticated;

-- ---------------------------------------------------------------------------
-- Member credit snapshot (chama-scoped)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.member_credit_snapshot(p_member_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_m public.members%ROWTYPE;
  v_facilities INT;
  v_borrowed NUMERIC;
  v_repaid NUMERIC;
  v_outstanding NUMERIC;
  v_on_time INT;
  v_late INT;
  v_rate NUMERIC;
  v_rating TEXT;
BEGIN
  SELECT * INTO v_m FROM public.members WHERE id = p_member_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'NOT_FOUND');
  END IF;
  IF v_m.user_id <> v_uid AND NOT private.is_circle_admin(v_m.jamiya_id) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'FORBIDDEN');
  END IF;

  SELECT
    COUNT(*)::INT,
    COALESCE(SUM(amount), 0),
    COALESCE(SUM(amount_repaid), 0),
    COALESCE(SUM(GREATEST(amount - amount_repaid, 0)), 0)
  INTO v_facilities, v_borrowed, v_repaid, v_outstanding
  FROM public.qard_loans
  WHERE borrower_id = v_m.user_id AND jamiya_id = v_m.jamiya_id;

  SELECT
    COUNT(*) FILTER (WHERE status = 'repaid')::INT,
    COUNT(*) FILTER (
      WHERE status IN ('active', 'approved', 'defaulted')
        AND due_date IS NOT NULL
        AND due_date < CURRENT_DATE
        AND amount_repaid < amount
    )::INT
  INTO v_on_time, v_late
  FROM public.qard_loans
  WHERE borrower_id = v_m.user_id AND jamiya_id = v_m.jamiya_id;

  IF v_facilities = 0 THEN
    v_rate := 100;
  ELSE
    v_rate := ROUND((v_on_time::NUMERIC / NULLIF(v_facilities, 0)) * 100, 1);
  END IF;

  v_rating := CASE
    WHEN v_rate >= 95 THEN 'Excellent'
    WHEN v_rate >= 80 THEN 'Good'
    WHEN v_rate >= 65 THEN 'Fair'
    ELSE 'High Risk'
  END;

  RETURN jsonb_build_object(
    'ok', true,
    'member_id', p_member_id,
    'member_code', v_m.member_code,
    'facilities', v_facilities,
    'borrowed', v_borrowed,
    'repaid', v_repaid,
    'outstanding', v_outstanding,
    'on_time', v_on_time,
    'late_or_default', v_late,
    'repayment_rate', v_rate,
    'rating', v_rating
  );
END;
$$;

REVOKE ALL ON FUNCTION public.member_credit_snapshot(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.member_credit_snapshot(UUID) TO authenticated;

-- ---------------------------------------------------------------------------
-- Table banking fund position (circle cash available to lend)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.table_banking_fund(p_jamiya_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_contrib NUMERIC;
  v_penalties NUMERIC;
  v_lent NUMERIC;
  v_repaid NUMERIC;
  v_outstanding NUMERIC;
  v_overdue NUMERIC;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'UNAUTHENTICATED');
  END IF;
  IF NOT (private.is_circle_admin(p_jamiya_id) OR private.is_jamiya_member(p_jamiya_id)) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'FORBIDDEN');
  END IF;

  SELECT COALESCE(SUM(amount_paid), 0) INTO v_contrib
  FROM public.contributions WHERE jamiya_id = p_jamiya_id;

  SELECT COALESCE(SUM(amount), 0) INTO v_penalties
  FROM public.penalties WHERE jamiya_id = p_jamiya_id AND status = 'paid';

  SELECT
    COALESCE(SUM(amount), 0),
    COALESCE(SUM(amount_repaid), 0),
    COALESCE(SUM(GREATEST(amount - amount_repaid, 0)), 0),
    COALESCE(SUM(CASE WHEN due_date < CURRENT_DATE AND amount_repaid < amount
      THEN GREATEST(amount - amount_repaid, 0) ELSE 0 END), 0)
  INTO v_lent, v_repaid, v_outstanding, v_overdue
  FROM public.qard_loans
  WHERE jamiya_id = p_jamiya_id;

  RETURN jsonb_build_object(
    'ok', true,
    'jamiya_id', p_jamiya_id,
    'member_contributions', v_contrib,
    'penalties_received', v_penalties,
    'lent_out', v_lent,
    'repaid', v_repaid,
    'outstanding', v_outstanding,
    'overdue', v_overdue,
    'available_to_lend', GREATEST(v_contrib + v_penalties + v_repaid - v_lent, 0),
    'portfolio_at_risk_pct',
      CASE WHEN v_outstanding > 0
        THEN ROUND((v_overdue / NULLIF(v_outstanding, 0)) * 100, 1)
        ELSE 0 END
  );
END;
$$;

REVOKE ALL ON FUNCTION public.table_banking_fund(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.table_banking_fund(UUID) TO authenticated;
-- ---------------------------------------------------------------------------
-- Payout compliance modes on settle_payout
-- block: refuse if recipient has open dues/penalties
-- approve: allow officer settle despite arrears (audit)
-- deduct: net open arrears/penalties from payout
-- allow: settle regardless of recipient arrears
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.settle_payout(p_payout_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_p public.payouts%ROWTYPE;
  v_member public.members%ROWTYPE;
  v_mode TEXT;
  v_unpaid INT;
  v_arrears NUMERIC := 0;
  v_open_penalties NUMERIC := 0;
  v_deduct NUMERIC := 0;
  v_pay NUMERIC;
  v_tx UUID;
  v_kyc TEXT;
  v_open_disputes INT;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'UNAUTHENTICATED');
  END IF;

  SELECT * INTO v_p FROM public.payouts WHERE id = p_payout_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'NOT_FOUND');
  END IF;

  IF NOT (private.is_circle_admin(v_p.jamiya_id) OR private.is_platform_admin()) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'FORBIDDEN');
  END IF;

  IF v_p.status NOT IN ('scheduled', 'processing') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'NOT_SETTLEABLE');
  END IF;

  SELECT COALESCE(payout_compliance_mode, 'block') INTO v_mode
  FROM public.jamiyas WHERE id = v_p.jamiya_id;

  SELECT COUNT(*) INTO v_unpaid
  FROM public.contributions
  WHERE jamiya_id = v_p.jamiya_id
    AND cycle_number = v_p.cycle_number
    AND status NOT IN ('paid', 'waived');

  IF v_unpaid > 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'CYCLE_INCOMPLETE', 'unpaid', v_unpaid);
  END IF;

  SELECT * INTO v_member FROM public.members WHERE id = v_p.member_id;

  SELECT COALESCE(SUM(GREATEST(amount - COALESCE(amount_paid, 0), 0)), 0) INTO v_arrears
  FROM public.contributions
  WHERE member_id = v_p.member_id
    AND status IN ('pending', 'late', 'partial');

  SELECT COALESCE(SUM(amount), 0) INTO v_open_penalties
  FROM public.penalties
  WHERE member_id = v_p.member_id AND status = 'open';

  IF v_mode = 'block' AND (v_arrears > 0 OR v_open_penalties > 0) THEN
    RETURN jsonb_build_object(
      'ok', false,
      'error', 'MEMBER_NONCOMPLIANT',
      'arrears', v_arrears,
      'penalties', v_open_penalties
    );
  END IF;

  IF v_mode = 'deduct' THEN
    v_deduct := LEAST(v_p.amount, v_arrears + v_open_penalties);
  END IF;

  v_pay := GREATEST(v_p.amount - v_deduct, 0);

  SELECT kyc_status INTO v_kyc FROM public.profiles WHERE id = v_member.user_id;
  IF v_kyc IS DISTINCT FROM 'approved' AND v_p.amount >= 50000 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'KYC_REQUIRED', 'kyc_status', v_kyc);
  END IF;

  SELECT COUNT(*) INTO v_open_disputes
  FROM public.disputes
  WHERE jamiya_id = v_p.jamiya_id
    AND status IN ('open', 'under_review');

  IF v_open_disputes > 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'OPEN_DISPUTES', 'count', v_open_disputes);
  END IF;

  UPDATE public.payouts SET status = 'processing', updated_at = NOW() WHERE id = v_p.id;

  IF v_pay > 0 THEN
    v_tx := private.ledger_credit(
      v_member.user_id, v_p.currency, v_pay, 'payout', v_p.jamiya_id,
      'payout:' || v_p.id::text,
      'settle_payout:' || v_p.id::text,
      jsonb_build_object(
        'payout_id', v_p.id,
        'cycle', v_p.cycle_number,
        'gross', v_p.amount,
        'deducted', v_deduct,
        'compliance_mode', v_mode
      )
    );
  END IF;

  IF v_deduct > 0 AND v_open_penalties > 0 THEN
    UPDATE public.penalties
    SET status = 'paid', paid_at = NOW(), updated_at = NOW()
    WHERE member_id = v_p.member_id AND status = 'open';
  END IF;

  UPDATE public.payouts
  SET status = 'paid', paid_at = NOW(), transaction_id = v_tx, updated_at = NOW()
  WHERE id = v_p.id;

  UPDATE public.jamiyas
  SET current_cycle = GREATEST(current_cycle, v_p.cycle_number), updated_at = NOW()
  WHERE id = v_p.jamiya_id;

  INSERT INTO public.notifications (user_id, type, channel, title, body, data)
  VALUES (
    v_member.user_id,
    'payout_paid',
    'in_app',
    'Payout received',
    'Your cycle ' || v_p.cycle_number || ' payout has been credited to your wallet.',
    jsonb_build_object(
      'payout_id', v_p.id,
      'jamiya_id', v_p.jamiya_id,
      'net', v_pay,
      'deducted', v_deduct
    )
  );

  INSERT INTO public.audit_logs (actor_id, action, entity_type, entity_id, jamiya_id, metadata)
  VALUES (
    v_uid, 'approve', 'payout', v_p.id, v_p.jamiya_id,
    jsonb_build_object(
      'transaction_id', v_tx,
      'compliance_mode', v_mode,
      'deducted', v_deduct,
      'arrears', v_arrears,
      'penalties', v_open_penalties
    )
  );

  RETURN jsonb_build_object(
    'ok', true,
    'transaction_id', v_tx,
    'net', v_pay,
    'deducted', v_deduct,
    'compliance_mode', v_mode
  );
END;
$$;

-- ---------------------------------------------------------------------------
-- Digital facility agreement (Qard Hassan)
-- ---------------------------------------------------------------------------
ALTER TABLE public.qard_loans
  ADD COLUMN IF NOT EXISTS agreement_accepted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS agreement_signer_name TEXT,
  ADD COLUMN IF NOT EXISTS agreement_version TEXT DEFAULT 'v1';

CREATE OR REPLACE FUNCTION public.accept_qard_agreement(
  p_loan_id UUID,
  p_signer_name TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_l public.qard_loans%ROWTYPE;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'UNAUTHENTICATED');
  END IF;

  SELECT * INTO v_l FROM public.qard_loans WHERE id = p_loan_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'NOT_FOUND');
  END IF;
  IF v_l.borrower_id <> v_uid THEN
    RETURN jsonb_build_object('ok', false, 'error', 'FORBIDDEN');
  END IF;
  IF v_l.status NOT IN ('requested', 'approved') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'INVALID_STATUS');
  END IF;
  IF btrim(COALESCE(p_signer_name, '')) = '' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'SIGNER_REQUIRED');
  END IF;
  IF v_l.agreement_accepted_at IS NOT NULL THEN
    RETURN jsonb_build_object('ok', true, 'already_accepted', true);
  END IF;

  UPDATE public.qard_loans
  SET
    agreement_accepted_at = NOW(),
    agreement_signer_name = btrim(p_signer_name),
    agreement_version = COALESCE(agreement_version, 'v1')
  WHERE id = p_loan_id;

  RETURN jsonb_build_object('ok', true);
END;
$$;

REVOKE ALL ON FUNCTION public.accept_qard_agreement(UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.accept_qard_agreement(UUID, TEXT) TO authenticated;

CREATE OR REPLACE FUNCTION public.decide_qard(p_loan_id UUID, p_approve BOOLEAN)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_l public.qard_loans%ROWTYPE;
BEGIN
  SELECT * INTO v_l FROM public.qard_loans WHERE id = p_loan_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'error', 'NOT_FOUND'); END IF;
  IF NOT (
    private.is_circle_admin(v_l.jamiya_id)
    OR EXISTS (
      SELECT 1 FROM public.members m
      WHERE m.jamiya_id = v_l.jamiya_id AND m.user_id = v_uid
        AND m.role::text IN ('treasurer', 'chair', 'circle_admin') AND m.status = 'active'
    )
  ) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'FORBIDDEN');
  END IF;
  IF v_l.status <> 'requested' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'NOT_REQUESTED');
  END IF;

  IF NOT p_approve THEN
    UPDATE public.qard_loans SET status = 'rejected', approved_by = v_uid, decided_at = NOW()
    WHERE id = p_loan_id;
    RETURN jsonb_build_object('ok', true, 'status', 'rejected');
  END IF;

  IF v_l.agreement_accepted_at IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'AGREEMENT_REQUIRED');
  END IF;

  PERFORM private.ledger_credit(
    v_l.borrower_id, v_l.currency, v_l.amount, 'payout'::public.transaction_type, v_l.jamiya_id,
    'qard', p_loan_id::text, jsonb_build_object('kind', 'qard_disbursement')
  );
  UPDATE public.qard_loans
  SET status = 'active', approved_by = v_uid, decided_at = NOW(),
      due_date = CURRENT_DATE + (v_l.installment_count * 30)
  WHERE id = p_loan_id;
  RETURN jsonb_build_object('ok', true, 'status', 'active');
END;
$$;
