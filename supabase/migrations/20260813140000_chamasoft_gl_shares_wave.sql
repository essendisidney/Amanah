-- Chamasoft follow-on: GL-style report pack, share capital, dividend allocation,
-- and bank SMS alert scaffold (manual/import ready; auto-reconcile later).

-- ---------------------------------------------------------------------------
-- Share capital settings + holdings
-- ---------------------------------------------------------------------------
ALTER TABLE public.jamiyas
  ADD COLUMN IF NOT EXISTS share_par_value NUMERIC(14, 2) NOT NULL DEFAULT 100
    CHECK (share_par_value > 0),
  ADD COLUMN IF NOT EXISTS share_currency CHAR(3) NOT NULL DEFAULT 'KES';

CREATE TABLE IF NOT EXISTS public.circle_share_lots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  jamiya_id UUID NOT NULL REFERENCES public.jamiyas (id) ON DELETE CASCADE,
  member_id UUID NOT NULL REFERENCES public.members (id) ON DELETE CASCADE,
  shares NUMERIC(18, 4) NOT NULL CHECK (shares > 0),
  unit_price NUMERIC(14, 2) NOT NULL CHECK (unit_price > 0),
  amount NUMERIC(18, 2) NOT NULL CHECK (amount > 0),
  currency CHAR(3) NOT NULL DEFAULT 'KES',
  purchased_on DATE NOT NULL DEFAULT CURRENT_DATE,
  notes TEXT,
  recorded_by UUID REFERENCES public.profiles (id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS circle_share_lots_jamiya_idx
  ON public.circle_share_lots (jamiya_id, purchased_on DESC);
CREATE INDEX IF NOT EXISTS circle_share_lots_member_idx
  ON public.circle_share_lots (member_id);

ALTER TABLE public.circle_share_lots ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS circle_share_lots_select ON public.circle_share_lots;
CREATE POLICY circle_share_lots_select ON public.circle_share_lots
  FOR SELECT TO authenticated
  USING (
    private.is_jamiya_member(jamiya_id)
    OR private.is_circle_officer(jamiya_id)
    OR private.is_platform_admin()
  );

DROP POLICY IF EXISTS circle_share_lots_write ON public.circle_share_lots;
CREATE POLICY circle_share_lots_write ON public.circle_share_lots
  FOR INSERT TO authenticated
  WITH CHECK (private.is_circle_officer(jamiya_id) OR private.is_platform_admin());

GRANT SELECT, INSERT ON public.circle_share_lots TO authenticated;

CREATE TABLE IF NOT EXISTS public.circle_dividends (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  jamiya_id UUID NOT NULL REFERENCES public.jamiyas (id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  period_start DATE,
  period_end DATE,
  total_amount NUMERIC(18, 2) NOT NULL CHECK (total_amount > 0),
  currency CHAR(3) NOT NULL DEFAULT 'KES',
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'allocated', 'paid', 'cancelled')),
  declared_by UUID REFERENCES public.profiles (id),
  declared_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.circle_dividend_allocations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dividend_id UUID NOT NULL REFERENCES public.circle_dividends (id) ON DELETE CASCADE,
  jamiya_id UUID NOT NULL REFERENCES public.jamiyas (id) ON DELETE CASCADE,
  member_id UUID NOT NULL REFERENCES public.members (id) ON DELETE CASCADE,
  shares_basis NUMERIC(18, 4) NOT NULL DEFAULT 0,
  amount NUMERIC(18, 2) NOT NULL CHECK (amount >= 0),
  currency CHAR(3) NOT NULL DEFAULT 'KES',
  status TEXT NOT NULL DEFAULT 'allocated'
    CHECK (status IN ('allocated', 'paid', 'waived')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (dividend_id, member_id)
);

CREATE INDEX IF NOT EXISTS circle_dividends_jamiya_idx
  ON public.circle_dividends (jamiya_id, declared_at DESC);
CREATE INDEX IF NOT EXISTS circle_dividend_allocations_member_idx
  ON public.circle_dividend_allocations (member_id);

ALTER TABLE public.circle_dividends ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.circle_dividend_allocations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS circle_dividends_select ON public.circle_dividends;
CREATE POLICY circle_dividends_select ON public.circle_dividends
  FOR SELECT TO authenticated
  USING (
    private.is_jamiya_member(jamiya_id)
    OR private.is_circle_officer(jamiya_id)
    OR private.is_platform_admin()
  );

DROP POLICY IF EXISTS circle_dividends_write ON public.circle_dividends;
CREATE POLICY circle_dividends_write ON public.circle_dividends
  FOR ALL TO authenticated
  USING (private.is_circle_officer(jamiya_id) OR private.is_platform_admin())
  WITH CHECK (private.is_circle_officer(jamiya_id) OR private.is_platform_admin());

DROP POLICY IF EXISTS circle_dividend_allocations_select ON public.circle_dividend_allocations;
CREATE POLICY circle_dividend_allocations_select ON public.circle_dividend_allocations
  FOR SELECT TO authenticated
  USING (
    private.is_jamiya_member(jamiya_id)
    OR private.is_circle_officer(jamiya_id)
    OR private.is_platform_admin()
  );

DROP POLICY IF EXISTS circle_dividend_allocations_write ON public.circle_dividend_allocations;
CREATE POLICY circle_dividend_allocations_write ON public.circle_dividend_allocations
  FOR ALL TO authenticated
  USING (private.is_circle_officer(jamiya_id) OR private.is_platform_admin())
  WITH CHECK (private.is_circle_officer(jamiya_id) OR private.is_platform_admin());

GRANT SELECT, INSERT, UPDATE ON public.circle_dividends TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.circle_dividend_allocations TO authenticated;

-- ---------------------------------------------------------------------------
-- Bank SMS / statement alerts scaffold (manual import; auto-reconcile later)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.circle_bank_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  jamiya_id UUID NOT NULL REFERENCES public.jamiyas (id) ON DELETE CASCADE,
  bank_account_id UUID REFERENCES public.circle_bank_accounts (id) ON DELETE SET NULL,
  provider TEXT NOT NULL DEFAULT 'manual'
    CHECK (provider IN ('manual', 'equity', 'mpesa', 'other')),
  external_ref TEXT,
  alert_text TEXT,
  amount NUMERIC(18, 2),
  currency CHAR(3) NOT NULL DEFAULT 'KES',
  direction TEXT CHECK (direction IN ('credit', 'debit')),
  occurred_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'matched', 'ignored')),
  matched_book_entry_id UUID REFERENCES public.book_entries (id) ON DELETE SET NULL,
  created_by UUID REFERENCES public.profiles (id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS circle_bank_alerts_jamiya_status_idx
  ON public.circle_bank_alerts (jamiya_id, status, created_at DESC);

ALTER TABLE public.circle_bank_alerts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS circle_bank_alerts_select ON public.circle_bank_alerts;
CREATE POLICY circle_bank_alerts_select ON public.circle_bank_alerts
  FOR SELECT TO authenticated
  USING (private.is_circle_officer(jamiya_id) OR private.is_platform_admin());

DROP POLICY IF EXISTS circle_bank_alerts_write ON public.circle_bank_alerts;
CREATE POLICY circle_bank_alerts_write ON public.circle_bank_alerts
  FOR ALL TO authenticated
  USING (private.is_circle_officer(jamiya_id) OR private.is_platform_admin())
  WITH CHECK (private.is_circle_officer(jamiya_id) OR private.is_platform_admin());

GRANT SELECT, INSERT, UPDATE ON public.circle_bank_alerts TO authenticated;

-- ---------------------------------------------------------------------------
-- Record share purchase (optionally credits share capital via book entry)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.record_share_purchase(
  p_jamiya_id UUID,
  p_member_id UUID,
  p_shares NUMERIC,
  p_unit_price NUMERIC DEFAULT NULL,
  p_purchased_on DATE DEFAULT CURRENT_DATE,
  p_bank_account_id UUID DEFAULT NULL,
  p_notes TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_price NUMERIC;
  v_currency CHAR(3);
  v_amount NUMERIC;
  v_lot UUID;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'UNAUTHENTICATED');
  END IF;
  IF NOT (private.is_circle_officer(p_jamiya_id) OR private.is_platform_admin()) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'FORBIDDEN');
  END IF;
  IF p_shares IS NULL OR p_shares <= 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'INVALID_SHARES');
  END IF;

  SELECT share_par_value, share_currency INTO v_price, v_currency
  FROM public.jamiyas WHERE id = p_jamiya_id;
  IF v_currency IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'NOT_FOUND');
  END IF;
  IF p_unit_price IS NOT NULL AND p_unit_price > 0 THEN
    v_price := p_unit_price;
  END IF;
  v_amount := round(p_shares * v_price, 2);

  IF NOT EXISTS (
    SELECT 1 FROM public.members m
    WHERE m.id = p_member_id AND m.jamiya_id = p_jamiya_id
      AND m.status IN ('active', 'suspended')
  ) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'MEMBER_NOT_FOUND');
  END IF;

  IF p_bank_account_id IS NOT NULL THEN
    PERFORM public.record_treasury_entry(
      p_jamiya_id,
      'bank_deposit',
      v_amount,
      COALESCE(p_purchased_on, CURRENT_DATE),
      p_bank_account_id,
      NULL,
      NULL,
      NULL,
      p_member_id,
      COALESCE(p_notes, 'Share capital purchase')
    );
  END IF;

  INSERT INTO public.circle_share_lots (
    jamiya_id, member_id, shares, unit_price, amount, currency, purchased_on, notes, recorded_by
  ) VALUES (
    p_jamiya_id, p_member_id, p_shares, v_price, v_amount, v_currency,
    COALESCE(p_purchased_on, CURRENT_DATE),
    nullif(btrim(COALESCE(p_notes, '')), ''),
    v_uid
  )
  RETURNING id INTO v_lot;

  INSERT INTO public.book_entries (
    jamiya_id, member_id, entry_type, amount, currency, effective_date, entered_by, notes, metadata
  ) VALUES (
    p_jamiya_id, p_member_id, 'adjustment', v_amount, v_currency,
    COALESCE(p_purchased_on, CURRENT_DATE), v_uid,
    COALESCE(nullif(btrim(COALESCE(p_notes, '')), ''), 'Share capital'),
    jsonb_build_object('source', 'share_purchase', 'lot_id', v_lot, 'shares', p_shares)
  );

  RETURN jsonb_build_object('ok', true, 'lot_id', v_lot, 'amount', v_amount, 'shares', p_shares);
END;
$$;

REVOKE ALL ON FUNCTION public.record_share_purchase(UUID, UUID, NUMERIC, NUMERIC, DATE, UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.record_share_purchase(UUID, UUID, NUMERIC, NUMERIC, DATE, UUID, TEXT) TO authenticated;

-- ---------------------------------------------------------------------------
-- Declare dividend and allocate pro-rata by share holdings
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.allocate_circle_dividend(
  p_jamiya_id UUID,
  p_label TEXT,
  p_total_amount NUMERIC,
  p_period_start DATE DEFAULT NULL,
  p_period_end DATE DEFAULT NULL,
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
  v_div UUID;
  v_total_shares NUMERIC := 0;
  v_count INT := 0;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'UNAUTHENTICATED');
  END IF;
  IF NOT (private.is_circle_officer(p_jamiya_id) OR private.is_platform_admin()) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'FORBIDDEN');
  END IF;
  IF p_total_amount IS NULL OR p_total_amount <= 0 OR btrim(COALESCE(p_label, '')) = '' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'INVALID_INPUT');
  END IF;

  SELECT share_currency INTO v_currency FROM public.jamiyas WHERE id = p_jamiya_id;
  IF v_currency IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'NOT_FOUND');
  END IF;

  SELECT COALESCE(sum(shares), 0) INTO v_total_shares
  FROM public.circle_share_lots WHERE jamiya_id = p_jamiya_id;
  IF v_total_shares <= 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'NO_SHARES');
  END IF;

  INSERT INTO public.circle_dividends (
    jamiya_id, label, period_start, period_end, total_amount, currency, status, declared_by, notes
  ) VALUES (
    p_jamiya_id, btrim(p_label), p_period_start, p_period_end, p_total_amount, v_currency,
    'allocated', v_uid, nullif(btrim(COALESCE(p_notes, '')), '')
  )
  RETURNING id INTO v_div;

  INSERT INTO public.circle_dividend_allocations (
    dividend_id, jamiya_id, member_id, shares_basis, amount, currency, status
  )
  SELECT
    v_div,
    p_jamiya_id,
    s.member_id,
    s.shares,
    round((s.shares / v_total_shares) * p_total_amount, 2),
    v_currency,
    'allocated'
  FROM (
    SELECT member_id, sum(shares) AS shares
    FROM public.circle_share_lots
    WHERE jamiya_id = p_jamiya_id
    GROUP BY member_id
  ) s;

  GET DIAGNOSTICS v_count = ROW_COUNT;

  RETURN jsonb_build_object(
    'ok', true,
    'dividend_id', v_div,
    'allocations', v_count,
    'total_shares', v_total_shares
  );
END;
$$;

REVOKE ALL ON FUNCTION public.allocate_circle_dividend(UUID, TEXT, NUMERIC, DATE, DATE, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.allocate_circle_dividend(UUID, TEXT, NUMERIC, DATE, DATE, TEXT) TO authenticated;

-- ---------------------------------------------------------------------------
-- GL-style pack: income statement, cash flow, balance sheet snapshot
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.circle_gl_pack(p_jamiya_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_currency CHAR(3);
  v_cash NUMERIC := 0;
  v_investments NUMERIC := 0;
  v_loans_out NUMERIC := 0;
  v_income NUMERIC := 0;
  v_expense NUMERIC := 0;
  v_share_capital NUMERIC := 0;
  v_fines_open NUMERIC := 0;
  v_contrib_paid NUMERIC := 0;
  v_deposits NUMERIC := 0;
  v_withdrawals NUMERIC := 0;
  v_income_by_cat JSONB := '[]'::jsonb;
  v_expense_by_cat JSONB := '[]'::jsonb;
  v_share_by_member JSONB := '[]'::jsonb;
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

  SELECT COALESCE(sum(balance), 0) INTO v_cash
  FROM public.circle_bank_accounts WHERE jamiya_id = p_jamiya_id AND is_active;

  SELECT COALESCE(sum(current_value), 0) INTO v_investments
  FROM public.circle_investments WHERE jamiya_id = p_jamiya_id AND status IN ('active', 'planned');

  SELECT COALESCE(sum(GREATEST(amount - COALESCE(amount_repaid, 0), 0)), 0) INTO v_loans_out
  FROM public.qard_loans
  WHERE jamiya_id = p_jamiya_id AND status::text IN ('active', 'approved', 'defaulted');

  SELECT COALESCE(sum(amount), 0) INTO v_income
  FROM public.book_entries WHERE jamiya_id = p_jamiya_id AND entry_type = 'income';
  SELECT COALESCE(sum(amount), 0) INTO v_expense
  FROM public.book_entries WHERE jamiya_id = p_jamiya_id AND entry_type = 'expense';

  SELECT COALESCE(sum(amount), 0) INTO v_share_capital
  FROM public.circle_share_lots WHERE jamiya_id = p_jamiya_id;

  SELECT COALESCE(sum(amount), 0) INTO v_fines_open
  FROM public.penalties WHERE jamiya_id = p_jamiya_id AND status = 'open';

  SELECT COALESCE(sum(CASE WHEN status = 'paid' THEN amount ELSE 0 END), 0) INTO v_contrib_paid
  FROM public.contributions WHERE jamiya_id = p_jamiya_id;

  SELECT COALESCE(sum(amount), 0) INTO v_deposits
  FROM public.book_entries
  WHERE jamiya_id = p_jamiya_id AND entry_type IN ('bank_deposit', 'opening_balance', 'income');
  SELECT COALESCE(sum(amount), 0) INTO v_withdrawals
  FROM public.book_entries
  WHERE jamiya_id = p_jamiya_id AND entry_type IN ('bank_withdrawal', 'expense', 'investment');

  SELECT COALESCE(jsonb_agg(jsonb_build_object('category', label, 'amount', amt) ORDER BY amt DESC), '[]'::jsonb)
  INTO v_income_by_cat
  FROM (
    SELECT COALESCE(c.name, 'Uncategorised') AS label, sum(b.amount) AS amt
    FROM public.book_entries b
    LEFT JOIN public.circle_ledger_categories c ON c.id = b.category_id
    WHERE b.jamiya_id = p_jamiya_id AND b.entry_type = 'income'
    GROUP BY 1
  ) x;

  SELECT COALESCE(jsonb_agg(jsonb_build_object('category', label, 'amount', amt) ORDER BY amt DESC), '[]'::jsonb)
  INTO v_expense_by_cat
  FROM (
    SELECT COALESCE(c.name, 'Uncategorised') AS label, sum(b.amount) AS amt
    FROM public.book_entries b
    LEFT JOIN public.circle_ledger_categories c ON c.id = b.category_id
    WHERE b.jamiya_id = p_jamiya_id AND b.entry_type = 'expense'
    GROUP BY 1
  ) x;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'member_id', member_id,
    'shares', shares,
    'amount', amount
  ) ORDER BY shares DESC), '[]'::jsonb)
  INTO v_share_by_member
  FROM (
    SELECT member_id, sum(shares) AS shares, sum(amount) AS amount
    FROM public.circle_share_lots
    WHERE jamiya_id = p_jamiya_id
    GROUP BY member_id
  ) s;

  RETURN jsonb_build_object(
    'ok', true,
    'currency', v_currency,
    'income_statement', jsonb_build_object(
      'income_total', v_income,
      'expense_total', v_expense,
      'surplus', v_income - v_expense,
      'income_by_category', v_income_by_cat,
      'expense_by_category', v_expense_by_cat,
      'contributions_paid', v_contrib_paid
    ),
    'cash_flow', jsonb_build_object(
      'inflows', v_deposits,
      'outflows', v_withdrawals,
      'net', v_deposits - v_withdrawals,
      'closing_cash', v_cash
    ),
    'balance_sheet', jsonb_build_object(
      'assets', jsonb_build_object(
        'cash', v_cash,
        'investments', v_investments,
        'loans_outstanding', v_loans_out,
        'total', v_cash + v_investments + v_loans_out
      ),
      'equity_liabilities', jsonb_build_object(
        'share_capital', v_share_capital,
        'open_fines_receivable_memo', v_fines_open,
        'retained_surplus', v_income - v_expense,
        'total', v_share_capital + (v_income - v_expense)
      )
    ),
    'share_register', v_share_by_member
  );
END;
$$;

REVOKE ALL ON FUNCTION public.circle_gl_pack(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.circle_gl_pack(UUID) TO authenticated;
