-- Chamasoft-style circle treasury: bank/cash accounts, income & expense categories,
-- investments/projects, configurable fine categories, cashbook RPCs, statements.

-- ---------------------------------------------------------------------------
-- Bank / cash accounts (group e-wallet style cashbook)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.circle_bank_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  jamiya_id UUID NOT NULL REFERENCES public.jamiyas (id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  account_kind TEXT NOT NULL DEFAULT 'bank'
    CHECK (account_kind IN ('bank', 'mpesa', 'petty_cash', 'other')),
  account_number TEXT,
  currency CHAR(3) NOT NULL DEFAULT 'KES',
  balance NUMERIC(18, 2) NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT circle_bank_accounts_name_len CHECK (char_length(btrim(name)) BETWEEN 2 AND 80)
);

CREATE UNIQUE INDEX IF NOT EXISTS circle_bank_accounts_jamiya_name_uidx
  ON public.circle_bank_accounts (jamiya_id, lower(name));
CREATE INDEX IF NOT EXISTS circle_bank_accounts_jamiya_idx
  ON public.circle_bank_accounts (jamiya_id) WHERE is_active;

ALTER TABLE public.circle_bank_accounts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS circle_bank_accounts_select ON public.circle_bank_accounts;
CREATE POLICY circle_bank_accounts_select ON public.circle_bank_accounts
  FOR SELECT TO authenticated
  USING (
    private.is_jamiya_member(jamiya_id)
    OR private.is_circle_officer(jamiya_id)
    OR private.is_platform_admin()
  );

DROP POLICY IF EXISTS circle_bank_accounts_write ON public.circle_bank_accounts;
CREATE POLICY circle_bank_accounts_write ON public.circle_bank_accounts
  FOR ALL TO authenticated
  USING (private.is_circle_officer(jamiya_id) OR private.is_platform_admin())
  WITH CHECK (private.is_circle_officer(jamiya_id) OR private.is_platform_admin());

GRANT SELECT, INSERT, UPDATE ON public.circle_bank_accounts TO authenticated;

-- ---------------------------------------------------------------------------
-- Income / expense categories
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.circle_ledger_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  jamiya_id UUID NOT NULL REFERENCES public.jamiyas (id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('income', 'expense')),
  name TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT circle_ledger_categories_name_len CHECK (char_length(btrim(name)) BETWEEN 2 AND 80)
);

CREATE UNIQUE INDEX IF NOT EXISTS circle_ledger_categories_uidx
  ON public.circle_ledger_categories (jamiya_id, kind, lower(name));

ALTER TABLE public.circle_ledger_categories ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS circle_ledger_categories_select ON public.circle_ledger_categories;
CREATE POLICY circle_ledger_categories_select ON public.circle_ledger_categories
  FOR SELECT TO authenticated
  USING (
    private.is_jamiya_member(jamiya_id)
    OR private.is_circle_officer(jamiya_id)
    OR private.is_platform_admin()
  );

DROP POLICY IF EXISTS circle_ledger_categories_write ON public.circle_ledger_categories;
CREATE POLICY circle_ledger_categories_write ON public.circle_ledger_categories
  FOR ALL TO authenticated
  USING (private.is_circle_officer(jamiya_id) OR private.is_platform_admin())
  WITH CHECK (private.is_circle_officer(jamiya_id) OR private.is_platform_admin());

GRANT SELECT, INSERT, UPDATE ON public.circle_ledger_categories TO authenticated;

-- ---------------------------------------------------------------------------
-- Investments / projects
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.circle_investments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  jamiya_id UUID NOT NULL REFERENCES public.jamiyas (id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('planned', 'active', 'closed')),
  principal NUMERIC(18, 2) NOT NULL DEFAULT 0 CHECK (principal >= 0),
  current_value NUMERIC(18, 2) NOT NULL DEFAULT 0 CHECK (current_value >= 0),
  currency CHAR(3) NOT NULL DEFAULT 'KES',
  started_on DATE,
  closed_on DATE,
  notes TEXT,
  created_by UUID REFERENCES public.profiles (id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT circle_investments_name_len CHECK (char_length(btrim(name)) BETWEEN 2 AND 120)
);

CREATE INDEX IF NOT EXISTS circle_investments_jamiya_idx
  ON public.circle_investments (jamiya_id, status);

ALTER TABLE public.circle_investments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS circle_investments_select ON public.circle_investments;
CREATE POLICY circle_investments_select ON public.circle_investments
  FOR SELECT TO authenticated
  USING (
    private.is_jamiya_member(jamiya_id)
    OR private.is_circle_officer(jamiya_id)
    OR private.is_platform_admin()
  );

DROP POLICY IF EXISTS circle_investments_write ON public.circle_investments;
CREATE POLICY circle_investments_write ON public.circle_investments
  FOR ALL TO authenticated
  USING (private.is_circle_officer(jamiya_id) OR private.is_platform_admin())
  WITH CHECK (private.is_circle_officer(jamiya_id) OR private.is_platform_admin());

GRANT SELECT, INSERT, UPDATE ON public.circle_investments TO authenticated;

-- ---------------------------------------------------------------------------
-- Fine categories (one-time penalties: late meeting, etc.)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.fine_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  jamiya_id UUID NOT NULL REFERENCES public.jamiyas (id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  default_amount NUMERIC(14, 2) NOT NULL DEFAULT 0 CHECK (default_amount >= 0),
  currency CHAR(3) NOT NULL DEFAULT 'KES',
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT fine_categories_name_len CHECK (char_length(btrim(name)) BETWEEN 2 AND 80)
);

CREATE UNIQUE INDEX IF NOT EXISTS fine_categories_jamiya_name_uidx
  ON public.fine_categories (jamiya_id, lower(name));

ALTER TABLE public.fine_categories ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS fine_categories_select ON public.fine_categories;
CREATE POLICY fine_categories_select ON public.fine_categories
  FOR SELECT TO authenticated
  USING (
    private.is_jamiya_member(jamiya_id)
    OR private.is_circle_officer(jamiya_id)
    OR private.is_platform_admin()
  );

DROP POLICY IF EXISTS fine_categories_write ON public.fine_categories;
CREATE POLICY fine_categories_write ON public.fine_categories
  FOR ALL TO authenticated
  USING (private.is_circle_officer(jamiya_id) OR private.is_platform_admin())
  WITH CHECK (private.is_circle_officer(jamiya_id) OR private.is_platform_admin());

GRANT SELECT, INSERT, UPDATE ON public.fine_categories TO authenticated;

-- Widen penalties for ad-hoc / category fines
ALTER TABLE public.penalties DROP CONSTRAINT IF EXISTS penalties_kind_check;
ALTER TABLE public.penalties
  ADD CONSTRAINT penalties_kind_check CHECK (kind IN (
    'late_contribution', 'missed_contribution', 'late_loan', 'ad_hoc'
  ));

ALTER TABLE public.penalties
  ADD COLUMN IF NOT EXISTS fine_category_id UUID REFERENCES public.fine_categories (id) ON DELETE SET NULL;

-- ---------------------------------------------------------------------------
-- Expand book_entries for cashbook / backdating
-- ---------------------------------------------------------------------------
ALTER TABLE public.book_entries DROP CONSTRAINT IF EXISTS book_entries_entry_type_check;
ALTER TABLE public.book_entries
  ADD CONSTRAINT book_entries_entry_type_check CHECK (entry_type IN (
    'opening_balance', 'contribution', 'payout', 'loan', 'loan_repayment',
    'penalty', 'withdrawal', 'adjustment', 'merry_go_round',
    'income', 'expense', 'bank_deposit', 'bank_withdrawal', 'bank_transfer', 'investment'
  ));

ALTER TABLE public.book_entries
  ADD COLUMN IF NOT EXISTS bank_account_id UUID REFERENCES public.circle_bank_accounts (id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS counterparty_account_id UUID REFERENCES public.circle_bank_accounts (id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS category_id UUID REFERENCES public.circle_ledger_categories (id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS investment_id UUID REFERENCES public.circle_investments (id) ON DELETE SET NULL;

-- ---------------------------------------------------------------------------
-- Seed defaults for a circle
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.ensure_circle_treasury(p_jamiya_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_currency CHAR(3);
  v_accounts INT;
  v_cats INT;
  v_fines INT;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'UNAUTHENTICATED');
  END IF;
  IF NOT (
    private.is_jamiya_member(p_jamiya_id)
    OR private.is_circle_officer(p_jamiya_id)
    OR private.is_platform_admin()
  ) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'FORBIDDEN');
  END IF;

  SELECT currency INTO v_currency FROM public.jamiyas WHERE id = p_jamiya_id;
  IF v_currency IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'NOT_FOUND');
  END IF;

  INSERT INTO public.circle_bank_accounts (jamiya_id, name, account_kind, currency, balance)
  SELECT p_jamiya_id, x.name, x.kind, v_currency, 0
  FROM (VALUES
    ('Petty cash', 'petty_cash'),
    ('M-Pesa', 'mpesa'),
    ('Main bank', 'bank')
  ) AS x(name, kind)
  WHERE NOT EXISTS (
    SELECT 1 FROM public.circle_bank_accounts a
    WHERE a.jamiya_id = p_jamiya_id AND lower(a.name) = lower(x.name)
  );

  INSERT INTO public.circle_ledger_categories (jamiya_id, kind, name)
  SELECT p_jamiya_id, x.kind, x.name
  FROM (VALUES
    ('income', 'Other income'),
    ('income', 'Investment return'),
    ('expense', 'Meeting expenses'),
    ('expense', 'Transport'),
    ('expense', 'Admin / stationery'),
    ('expense', 'Project expense')
  ) AS x(kind, name)
  WHERE NOT EXISTS (
    SELECT 1 FROM public.circle_ledger_categories c
    WHERE c.jamiya_id = p_jamiya_id AND c.kind = x.kind AND lower(c.name) = lower(x.name)
  );

  INSERT INTO public.fine_categories (jamiya_id, name, default_amount, currency)
  SELECT p_jamiya_id, x.name, x.amt, v_currency
  FROM (VALUES
    ('Late to meeting', 100::numeric),
    ('Missed meeting', 200::numeric),
    ('Disorderly conduct', 100::numeric)
  ) AS x(name, amt)
  WHERE NOT EXISTS (
    SELECT 1 FROM public.fine_categories f
    WHERE f.jamiya_id = p_jamiya_id AND lower(f.name) = lower(x.name)
  );

  SELECT count(*) INTO v_accounts FROM public.circle_bank_accounts WHERE jamiya_id = p_jamiya_id;
  SELECT count(*) INTO v_cats FROM public.circle_ledger_categories WHERE jamiya_id = p_jamiya_id;
  SELECT count(*) INTO v_fines FROM public.fine_categories WHERE jamiya_id = p_jamiya_id;

  RETURN jsonb_build_object(
    'ok', true,
    'accounts', v_accounts,
    'categories', v_cats,
    'fine_categories', v_fines
  );
END;
$$;

REVOKE ALL ON FUNCTION public.ensure_circle_treasury(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.ensure_circle_treasury(UUID) TO authenticated;

-- ---------------------------------------------------------------------------
-- Record cashbook entry (deposit / withdrawal / income / expense / transfer)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.record_treasury_entry(
  p_jamiya_id UUID,
  p_entry_type TEXT,
  p_amount NUMERIC,
  p_effective_date DATE,
  p_bank_account_id UUID DEFAULT NULL,
  p_counterparty_account_id UUID DEFAULT NULL,
  p_category_id UUID DEFAULT NULL,
  p_investment_id UUID DEFAULT NULL,
  p_member_id UUID DEFAULT NULL,
  p_notes TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_currency CHAR(3);
  v_type TEXT := lower(btrim(COALESCE(p_entry_type, '')));
  v_entry UUID;
  v_bal NUMERIC;
  v_bal2 NUMERIC;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'UNAUTHENTICATED');
  END IF;
  IF NOT (private.is_circle_officer(p_jamiya_id) OR private.is_platform_admin()) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'FORBIDDEN');
  END IF;
  IF p_amount IS NULL OR p_amount <= 0 OR p_effective_date IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'INVALID_AMOUNT_OR_DATE');
  END IF;
  IF v_type NOT IN (
    'income', 'expense', 'bank_deposit', 'bank_withdrawal', 'bank_transfer',
    'investment', 'opening_balance', 'adjustment'
  ) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'INVALID_TYPE');
  END IF;

  SELECT currency INTO v_currency FROM public.jamiyas WHERE id = p_jamiya_id;
  IF v_currency IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'NOT_FOUND');
  END IF;

  IF v_type = 'bank_transfer' THEN
    IF p_bank_account_id IS NULL OR p_counterparty_account_id IS NULL
       OR p_bank_account_id = p_counterparty_account_id THEN
      RETURN jsonb_build_object('ok', false, 'error', 'TRANSFER_ACCOUNTS_REQUIRED');
    END IF;
    SELECT balance INTO v_bal FROM public.circle_bank_accounts
      WHERE id = p_bank_account_id AND jamiya_id = p_jamiya_id AND is_active FOR UPDATE;
    SELECT balance INTO v_bal2 FROM public.circle_bank_accounts
      WHERE id = p_counterparty_account_id AND jamiya_id = p_jamiya_id AND is_active FOR UPDATE;
    IF v_bal IS NULL OR v_bal2 IS NULL THEN
      RETURN jsonb_build_object('ok', false, 'error', 'ACCOUNT_NOT_FOUND');
    END IF;
    IF v_bal < p_amount THEN
      RETURN jsonb_build_object('ok', false, 'error', 'INSUFFICIENT_BALANCE');
    END IF;
    UPDATE public.circle_bank_accounts
      SET balance = balance - p_amount, updated_at = NOW() WHERE id = p_bank_account_id;
    UPDATE public.circle_bank_accounts
      SET balance = balance + p_amount, updated_at = NOW() WHERE id = p_counterparty_account_id;
  ELSIF v_type IN ('income', 'bank_deposit', 'opening_balance') THEN
    IF p_bank_account_id IS NULL THEN
      RETURN jsonb_build_object('ok', false, 'error', 'ACCOUNT_REQUIRED');
    END IF;
    SELECT balance INTO v_bal FROM public.circle_bank_accounts
      WHERE id = p_bank_account_id AND jamiya_id = p_jamiya_id AND is_active FOR UPDATE;
    IF v_bal IS NULL THEN
      RETURN jsonb_build_object('ok', false, 'error', 'ACCOUNT_NOT_FOUND');
    END IF;
    UPDATE public.circle_bank_accounts
      SET balance = balance + p_amount, updated_at = NOW() WHERE id = p_bank_account_id;
  ELSIF v_type IN ('expense', 'bank_withdrawal', 'investment') THEN
    IF p_bank_account_id IS NULL THEN
      RETURN jsonb_build_object('ok', false, 'error', 'ACCOUNT_REQUIRED');
    END IF;
    SELECT balance INTO v_bal FROM public.circle_bank_accounts
      WHERE id = p_bank_account_id AND jamiya_id = p_jamiya_id AND is_active FOR UPDATE;
    IF v_bal IS NULL THEN
      RETURN jsonb_build_object('ok', false, 'error', 'ACCOUNT_NOT_FOUND');
    END IF;
    IF v_type <> 'opening_balance' AND v_bal < p_amount THEN
      RETURN jsonb_build_object('ok', false, 'error', 'INSUFFICIENT_BALANCE');
    END IF;
    UPDATE public.circle_bank_accounts
      SET balance = balance - p_amount, updated_at = NOW() WHERE id = p_bank_account_id;
    IF v_type = 'investment' AND p_investment_id IS NOT NULL THEN
      UPDATE public.circle_investments
        SET principal = principal + p_amount,
            current_value = current_value + p_amount,
            updated_at = NOW()
      WHERE id = p_investment_id AND jamiya_id = p_jamiya_id;
    END IF;
  ELSIF v_type = 'adjustment' THEN
    IF p_bank_account_id IS NOT NULL THEN
      SELECT balance INTO v_bal FROM public.circle_bank_accounts
        WHERE id = p_bank_account_id AND jamiya_id = p_jamiya_id AND is_active FOR UPDATE;
      IF v_bal IS NULL THEN
        RETURN jsonb_build_object('ok', false, 'error', 'ACCOUNT_NOT_FOUND');
      END IF;
      -- Notes should indicate sign; positive amount credits unless notes start with -
      UPDATE public.circle_bank_accounts
        SET balance = balance + p_amount, updated_at = NOW() WHERE id = p_bank_account_id;
    END IF;
  END IF;

  INSERT INTO public.book_entries (
    jamiya_id, member_id, entry_type, amount, currency, effective_date, entered_by, notes,
    bank_account_id, counterparty_account_id, category_id, investment_id, metadata
  ) VALUES (
    p_jamiya_id, p_member_id, v_type, p_amount, v_currency, p_effective_date, v_uid,
    nullif(btrim(COALESCE(p_notes, '')), ''),
    p_bank_account_id, p_counterparty_account_id, p_category_id, p_investment_id,
    jsonb_build_object('source', 'treasury')
  )
  RETURNING id INTO v_entry;

  RETURN jsonb_build_object('ok', true, 'entry_id', v_entry);
END;
$$;

REVOKE ALL ON FUNCTION public.record_treasury_entry(
  UUID, TEXT, NUMERIC, DATE, UUID, UUID, UUID, UUID, UUID, TEXT
) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.record_treasury_entry(
  UUID, TEXT, NUMERIC, DATE, UUID, UUID, UUID, UUID, UUID, TEXT
) TO authenticated;

-- ---------------------------------------------------------------------------
-- Levy one-time fine onto member statement
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.levy_member_fine(
  p_jamiya_id UUID,
  p_member_id UUID,
  p_fine_category_id UUID,
  p_amount NUMERIC DEFAULT NULL,
  p_notes TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_user UUID;
  v_currency CHAR(3);
  v_amount NUMERIC;
  v_cat_name TEXT;
  v_pen UUID;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'UNAUTHENTICATED');
  END IF;
  IF NOT (private.is_circle_officer(p_jamiya_id) OR private.is_platform_admin()) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'FORBIDDEN');
  END IF;

  SELECT m.user_id INTO v_user
  FROM public.members m
  WHERE m.id = p_member_id AND m.jamiya_id = p_jamiya_id AND m.status IN ('active', 'suspended');
  IF v_user IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'MEMBER_NOT_FOUND');
  END IF;

  SELECT name, default_amount, currency INTO v_cat_name, v_amount, v_currency
  FROM public.fine_categories
  WHERE id = p_fine_category_id AND jamiya_id = p_jamiya_id AND is_active;
  IF v_cat_name IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'FINE_CATEGORY_NOT_FOUND');
  END IF;

  IF p_amount IS NOT NULL AND p_amount > 0 THEN
    v_amount := p_amount;
  END IF;
  IF v_amount IS NULL OR v_amount <= 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'INVALID_AMOUNT');
  END IF;

  INSERT INTO public.penalties (
    jamiya_id, member_id, user_id, kind, amount, currency, status, notes, fine_category_id
  ) VALUES (
    p_jamiya_id, p_member_id, v_user, 'ad_hoc', v_amount, COALESCE(v_currency, 'KES'), 'open',
    COALESCE(nullif(btrim(COALESCE(p_notes, '')), ''), v_cat_name),
    p_fine_category_id
  )
  RETURNING id INTO v_pen;

  INSERT INTO public.book_entries (
    jamiya_id, member_id, entry_type, amount, currency, effective_date, entered_by, notes, metadata
  ) VALUES (
    p_jamiya_id, p_member_id, 'penalty', v_amount, COALESCE(v_currency, 'KES'), CURRENT_DATE, v_uid,
    COALESCE(nullif(btrim(COALESCE(p_notes, '')), ''), v_cat_name),
    jsonb_build_object('source', 'fine_levy', 'fine_category_id', p_fine_category_id)
  );

  INSERT INTO public.notifications (user_id, type, channel, title, body, data)
  VALUES (
    v_user,
    'system'::public.notification_type,
    'in_app'::public.notification_channel,
    'Fine levied',
    format('A fine of %s was added to your statement: %s', v_amount::text, v_cat_name),
    jsonb_build_object('jamiya_id', p_jamiya_id, 'penalty_id', v_pen)
  );

  RETURN jsonb_build_object('ok', true, 'penalty_id', v_pen, 'amount', v_amount);
END;
$$;

REVOKE ALL ON FUNCTION public.levy_member_fine(UUID, UUID, UUID, NUMERIC, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.levy_member_fine(UUID, UUID, UUID, NUMERIC, TEXT) TO authenticated;

-- ---------------------------------------------------------------------------
-- Treasury snapshot (Chamasoft-style summaries)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.treasury_snapshot(p_jamiya_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_cash NUMERIC := 0;
  v_income NUMERIC := 0;
  v_expense NUMERIC := 0;
  v_fines_open NUMERIC := 0;
  v_fines_paid NUMERIC := 0;
  v_loaned NUMERIC := 0;
  v_repaid NUMERIC := 0;
  v_investments NUMERIC := 0;
  v_contrib_paid NUMERIC := 0;
  v_contrib_pending NUMERIC := 0;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'UNAUTHENTICATED');
  END IF;
  IF NOT (
    private.is_jamiya_member(p_jamiya_id)
    OR private.is_circle_officer(p_jamiya_id)
    OR private.is_platform_admin()
  ) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'FORBIDDEN');
  END IF;

  SELECT COALESCE(sum(balance), 0) INTO v_cash
  FROM public.circle_bank_accounts WHERE jamiya_id = p_jamiya_id AND is_active;

  SELECT COALESCE(sum(amount), 0) INTO v_income
  FROM public.book_entries WHERE jamiya_id = p_jamiya_id AND entry_type = 'income';
  SELECT COALESCE(sum(amount), 0) INTO v_expense
  FROM public.book_entries WHERE jamiya_id = p_jamiya_id AND entry_type = 'expense';

  SELECT COALESCE(sum(amount), 0) INTO v_fines_open
  FROM public.penalties WHERE jamiya_id = p_jamiya_id AND status = 'open';
  SELECT COALESCE(sum(amount), 0) INTO v_fines_paid
  FROM public.penalties WHERE jamiya_id = p_jamiya_id AND status = 'paid';

  SELECT COALESCE(sum(amount), 0) INTO v_loaned
  FROM public.qard_loans
  WHERE jamiya_id = p_jamiya_id
    AND status::text IN ('active', 'approved', 'defaulted');
  SELECT COALESCE(sum(amount_repaid), 0) INTO v_repaid
  FROM public.qard_loans WHERE jamiya_id = p_jamiya_id;

  SELECT COALESCE(sum(current_value), 0) INTO v_investments
  FROM public.circle_investments WHERE jamiya_id = p_jamiya_id AND status IN ('active', 'planned');

  SELECT COALESCE(sum(CASE WHEN status = 'paid' THEN amount ELSE 0 END), 0),
         COALESCE(sum(CASE WHEN status IN ('pending', 'late', 'partial') THEN amount - COALESCE(amount_paid, 0) ELSE 0 END), 0)
    INTO v_contrib_paid, v_contrib_pending
  FROM public.contributions WHERE jamiya_id = p_jamiya_id;

  RETURN jsonb_build_object(
    'ok', true,
    'cash_available', v_cash,
    'income_total', v_income,
    'expense_total', v_expense,
    'fines_open', v_fines_open,
    'fines_paid', v_fines_paid,
    'loans_disbursed', v_loaned,
    'loans_repaid', v_repaid,
    'investments_value', v_investments,
    'contributions_paid', v_contrib_paid,
    'contributions_outstanding', v_contrib_pending
  );
END;
$$;

REVOKE ALL ON FUNCTION public.treasury_snapshot(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.treasury_snapshot(UUID) TO authenticated;

-- ---------------------------------------------------------------------------
-- Member statement within a circle
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.member_circle_statement(
  p_jamiya_id UUID,
  p_member_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_member RECORD;
  v_is_self BOOLEAN;
  v_contrib JSONB;
  v_pens JSONB;
  v_loans JSONB;
  v_books JSONB;
  v_pockets JSONB;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'UNAUTHENTICATED');
  END IF;

  SELECT * INTO v_member
  FROM public.members m
  WHERE m.id = p_member_id AND m.jamiya_id = p_jamiya_id;
  IF v_member.id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'MEMBER_NOT_FOUND');
  END IF;

  v_is_self := v_member.user_id = v_uid;
  IF NOT (
    v_is_self
    OR private.is_circle_officer(p_jamiya_id)
    OR private.is_platform_admin()
  ) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'FORBIDDEN');
  END IF;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', c.id,
    'cycle', c.cycle_number,
    'amount', c.amount,
    'amount_paid', COALESCE(c.amount_paid, 0),
    'status', c.status,
    'due_date', c.due_date
  ) ORDER BY c.due_date DESC), '[]'::jsonb)
  INTO v_contrib
  FROM public.contributions c
  WHERE c.jamiya_id = p_jamiya_id AND c.member_id = p_member_id;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', p.id,
    'kind', p.kind,
    'amount', p.amount,
    'status', p.status,
    'notes', p.notes,
    'assessed_at', p.assessed_at
  ) ORDER BY p.assessed_at DESC), '[]'::jsonb)
  INTO v_pens
  FROM public.penalties p
  WHERE p.jamiya_id = p_jamiya_id AND p.member_id = p_member_id;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', q.id,
    'amount', q.amount,
    'amount_repaid', q.amount_repaid,
    'status', q.status,
    'purpose', q.purpose,
    'due_date', q.due_date
  ) ORDER BY q.created_at DESC), '[]'::jsonb)
  INTO v_loans
  FROM public.qard_loans q
  WHERE q.jamiya_id = p_jamiya_id AND q.borrower_id = v_member.user_id;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', b.id,
    'entry_type', b.entry_type,
    'amount', b.amount,
    'effective_date', b.effective_date,
    'notes', b.notes
  ) ORDER BY b.effective_date DESC), '[]'::jsonb)
  INTO v_books
  FROM public.book_entries b
  WHERE b.jamiya_id = p_jamiya_id AND b.member_id = p_member_id;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', s.id,
    'category', s.category,
    'label', s.label,
    'balance', s.balance,
    'target_amount', s.target_amount
  )), '[]'::jsonb)
  INTO v_pockets
  FROM public.savings_pockets s
  WHERE s.jamiya_id = p_jamiya_id AND s.member_id = p_member_id;

  RETURN jsonb_build_object(
    'ok', true,
    'member_id', v_member.id,
    'member_code', v_member.member_code,
    'role', v_member.role,
    'status', v_member.status,
    'contributions', v_contrib,
    'penalties', v_pens,
    'loans', v_loans,
    'book_entries', v_books,
    'savings_pockets', v_pockets
  );
END;
$$;

REVOKE ALL ON FUNCTION public.member_circle_statement(UUID, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.member_circle_statement(UUID, UUID) TO authenticated;

-- Refresh import helper with new entry types
CREATE OR REPLACE FUNCTION public.import_book_entries(
  p_jamiya_id UUID,
  p_rows JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_row JSONB;
  v_count INT := 0;
  v_type TEXT;
  v_amount NUMERIC;
  v_date DATE;
  v_member UUID;
  v_notes TEXT;
  v_currency CHAR(3);
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'UNAUTHENTICATED');
  END IF;
  IF NOT (private.is_circle_officer(p_jamiya_id) OR private.is_platform_admin()) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'FORBIDDEN');
  END IF;
  IF p_rows IS NULL OR jsonb_typeof(p_rows) <> 'array' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'INVALID_ROWS');
  END IF;

  SELECT currency INTO v_currency FROM public.jamiyas WHERE id = p_jamiya_id;

  FOR v_row IN SELECT * FROM jsonb_array_elements(p_rows)
  LOOP
    v_type := lower(btrim(COALESCE(v_row->>'entry_type', '')));
    v_amount := NULLIF(v_row->>'amount', '')::NUMERIC;
    v_date := NULLIF(v_row->>'effective_date', '')::DATE;
    v_member := NULLIF(v_row->>'member_id', '')::UUID;
    v_notes := nullif(btrim(COALESCE(v_row->>'notes', '')), '');

    IF v_type NOT IN (
      'opening_balance', 'contribution', 'payout', 'loan', 'loan_repayment',
      'penalty', 'withdrawal', 'adjustment', 'merry_go_round',
      'income', 'expense', 'bank_deposit', 'bank_withdrawal', 'bank_transfer', 'investment'
    ) THEN
      CONTINUE;
    END IF;
    IF v_amount IS NULL OR v_date IS NULL THEN
      CONTINUE;
    END IF;

    INSERT INTO public.book_entries (
      jamiya_id, member_id, entry_type, amount, currency, effective_date, entered_by, notes,
      metadata
    ) VALUES (
      p_jamiya_id, v_member, v_type, v_amount, COALESCE(v_currency, 'KES'), v_date, v_uid, v_notes,
      jsonb_build_object('source', 'csv_import')
    );
    v_count := v_count + 1;
  END LOOP;

  RETURN jsonb_build_object('ok', true, 'imported', v_count);
END;
$$;
