-- Finance engine A–F (pragmatic): webhook inbox, chart + journal projection,
-- settlement/reconcile statuses, Qard type fix, contribution→cashbook bridge.
-- Wallet + payment_intents remain live source of truth; journal is append-only.

-- ---------------------------------------------------------------------------
-- A. Durable webhook inbox
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.webhook_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider TEXT NOT NULL,
  event_type TEXT,
  fingerprint TEXT NOT NULL,
  external_id TEXT,
  payment_intent_id UUID REFERENCES public.payment_intents (id) ON DELETE SET NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  headers JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'received'
    CHECK (status IN ('received', 'processed', 'ignored', 'failed', 'duplicate')),
  error_message TEXT,
  processed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS webhook_events_fingerprint_uidx
  ON public.webhook_events (provider, fingerprint);

CREATE INDEX IF NOT EXISTS webhook_events_status_created_idx
  ON public.webhook_events (status, created_at DESC);

CREATE INDEX IF NOT EXISTS webhook_events_intent_idx
  ON public.webhook_events (payment_intent_id)
  WHERE payment_intent_id IS NOT NULL;

ALTER TABLE public.webhook_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS webhook_events_admin_read ON public.webhook_events;
CREATE POLICY webhook_events_admin_read ON public.webhook_events
  FOR SELECT TO authenticated
  USING (private.is_platform_admin());

COMMENT ON TABLE public.webhook_events IS
  'Append-only PSP callback inbox. Deduped by (provider, fingerprint).';

-- ---------------------------------------------------------------------------
-- B. Chart of accounts (skeleton alongside wallets)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.ledger_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  domain TEXT NOT NULL
    CHECK (domain IN (
      'OPERATING', 'CONTRIBUTIONS', 'QARD', 'SADAKA', 'TAKAFUL', 'ASSET_FINANCE'
    )),
  normal_balance TEXT NOT NULL CHECK (normal_balance IN ('debit', 'credit')),
  currency CHAR(3) NOT NULL DEFAULT 'KES',
  is_active BOOLEAN NOT NULL DEFAULT true,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO public.ledger_accounts (code, name, domain, normal_balance) VALUES
  ('1000', 'PSP clearing / receivable', 'OPERATING', 'debit'),
  ('1100', 'Cash at platform', 'OPERATING', 'debit'),
  ('2000', 'Member wallet liability', 'OPERATING', 'credit'),
  ('2100', 'Platform fee income', 'OPERATING', 'credit'),
  ('3000', 'Contributions clearing', 'CONTRIBUTIONS', 'credit'),
  ('3100', 'Contributions receivable', 'CONTRIBUTIONS', 'debit'),
  ('4000', 'Qard receivable', 'QARD', 'debit'),
  ('4100', 'Qard repayments clearing', 'QARD', 'credit'),
  ('5000', 'Sadaka / charity clearing', 'SADAKA', 'credit'),
  ('6000', 'Welfare / Takaful clearing', 'TAKAFUL', 'credit'),
  ('7000', 'Asset finance clearing', 'ASSET_FINANCE', 'credit')
ON CONFLICT (code) DO NOTHING;

ALTER TABLE public.ledger_accounts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS ledger_accounts_admin_read ON public.ledger_accounts;
CREATE POLICY ledger_accounts_admin_read ON public.ledger_accounts
  FOR SELECT TO authenticated
  USING (true);

-- ---------------------------------------------------------------------------
-- C. Immutable journal (projection; wallet remains SoT)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.journal_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_type TEXT NOT NULL,
  source_id TEXT NOT NULL,
  domain TEXT NOT NULL
    CHECK (domain IN (
      'OPERATING', 'CONTRIBUTIONS', 'QARD', 'SADAKA', 'TAKAFUL', 'ASSET_FINANCE'
    )),
  description TEXT,
  currency CHAR(3) NOT NULL DEFAULT 'KES',
  payment_intent_id UUID REFERENCES public.payment_intents (id) ON DELETE SET NULL,
  jamiya_id UUID REFERENCES public.jamiyas (id) ON DELETE SET NULL,
  user_id UUID REFERENCES public.profiles (id) ON DELETE SET NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  posted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT journal_entries_source_unique UNIQUE (source_type, source_id)
);

CREATE TABLE IF NOT EXISTS public.journal_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  journal_entry_id UUID NOT NULL REFERENCES public.journal_entries (id) ON DELETE CASCADE,
  ledger_account_id UUID NOT NULL REFERENCES public.ledger_accounts (id),
  side TEXT NOT NULL CHECK (side IN ('debit', 'credit')),
  amount NUMERIC(14, 2) NOT NULL CHECK (amount > 0),
  amount_minor BIGINT NOT NULL CHECK (amount_minor > 0),
  currency CHAR(3) NOT NULL DEFAULT 'KES',
  memo TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS journal_lines_entry_idx
  ON public.journal_lines (journal_entry_id);

CREATE INDEX IF NOT EXISTS journal_entries_intent_idx
  ON public.journal_entries (payment_intent_id)
  WHERE payment_intent_id IS NOT NULL;

ALTER TABLE public.journal_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.journal_lines ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS journal_entries_admin_read ON public.journal_entries;
CREATE POLICY journal_entries_admin_read ON public.journal_entries
  FOR SELECT TO authenticated
  USING (private.is_platform_admin());

DROP POLICY IF EXISTS journal_lines_admin_read ON public.journal_lines;
CREATE POLICY journal_lines_admin_read ON public.journal_lines
  FOR SELECT TO authenticated
  USING (private.is_platform_admin());

-- ---------------------------------------------------------------------------
-- D. Settlement / reconcile layers on intents (provider status unchanged)
-- ---------------------------------------------------------------------------
ALTER TABLE public.payment_intents
  ADD COLUMN IF NOT EXISTS settlement_status TEXT NOT NULL DEFAULT 'unsettled'
    CHECK (settlement_status IN ('unsettled', 'settled', 'disputed', 'waived')),
  ADD COLUMN IF NOT EXISTS reconcile_status TEXT NOT NULL DEFAULT 'open'
    CHECK (reconcile_status IN ('open', 'matched', 'exception', 'manual'));

CREATE INDEX IF NOT EXISTS payment_intents_reconcile_status_idx
  ON public.payment_intents (reconcile_status, created_at DESC)
  WHERE reconcile_status IN ('open', 'exception');

COMMENT ON COLUMN public.payment_intents.settlement_status IS
  'Accounting settlement layer. Distinct from provider status (pending/completed).';
COMMENT ON COLUMN public.payment_intents.reconcile_status IS
  'Ops match state vs PSP / journal. open until matched or exception.';

-- ---------------------------------------------------------------------------
-- F. Qard repay transaction type (fix misleading 'contribution')
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum e
    JOIN pg_type t ON e.enumtypid = t.oid
    WHERE t.typname = 'transaction_type' AND e.enumlabel = 'qard_repayment'
  ) THEN
    ALTER TYPE public.transaction_type ADD VALUE 'qard_repayment';
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- Helpers: account lookup + balanced journal post
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION private.ledger_account_id(p_code TEXT)
RETURNS UUID
LANGUAGE sql
STABLE
SET search_path = ''
AS $$
  SELECT id FROM public.ledger_accounts WHERE code = p_code AND is_active LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION private.post_balanced_journal(
  p_source_type TEXT,
  p_source_id TEXT,
  p_domain TEXT,
  p_description TEXT,
  p_currency CHAR(3),
  p_debit_code TEXT,
  p_credit_code TEXT,
  p_amount NUMERIC,
  p_payment_intent_id UUID DEFAULT NULL,
  p_jamiya_id UUID DEFAULT NULL,
  p_user_id UUID DEFAULT NULL,
  p_metadata JSONB DEFAULT '{}'::jsonb
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_entry UUID;
  v_debit UUID;
  v_credit UUID;
  v_minor BIGINT;
BEGIN
  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'INVALID_JOURNAL_AMOUNT';
  END IF;

  SELECT id INTO v_entry
  FROM public.journal_entries
  WHERE source_type = p_source_type AND source_id = p_source_id;
  IF FOUND THEN
    RETURN v_entry;
  END IF;

  v_debit := private.ledger_account_id(p_debit_code);
  v_credit := private.ledger_account_id(p_credit_code);
  IF v_debit IS NULL OR v_credit IS NULL THEN
    RAISE EXCEPTION 'LEDGER_ACCOUNT_MISSING';
  END IF;

  v_minor := round(p_amount * 100)::bigint;

  INSERT INTO public.journal_entries (
    source_type, source_id, domain, description, currency,
    payment_intent_id, jamiya_id, user_id, metadata
  ) VALUES (
    p_source_type, p_source_id, p_domain, p_description, p_currency,
    p_payment_intent_id, p_jamiya_id, p_user_id, coalesce(p_metadata, '{}'::jsonb)
  )
  RETURNING id INTO v_entry;

  INSERT INTO public.journal_lines (
    journal_entry_id, ledger_account_id, side, amount, amount_minor, currency, memo
  ) VALUES
    (v_entry, v_debit, 'debit', p_amount, v_minor, p_currency, p_description),
    (v_entry, v_credit, 'credit', p_amount, v_minor, p_currency, p_description);

  RETURN v_entry;
EXCEPTION
  WHEN unique_violation THEN
    SELECT id INTO v_entry
    FROM public.journal_entries
    WHERE source_type = p_source_type AND source_id = p_source_id;
    RETURN v_entry;
END;
$$;

CREATE OR REPLACE FUNCTION private.post_journal_for_payment_intent(p_intent_id UUID)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_intent public.payment_intents%ROWTYPE;
  v_kind TEXT;
  v_domain TEXT;
  v_debit TEXT;
  v_credit TEXT;
  v_desc TEXT;
  v_jamiya UUID;
  v_entry UUID;
BEGIN
  SELECT * INTO v_intent FROM public.payment_intents WHERE id = p_intent_id;
  IF NOT FOUND THEN
    RETURN NULL;
  END IF;
  IF v_intent.status <> 'completed' THEN
    RETURN NULL;
  END IF;

  v_kind := coalesce(v_intent.metadata->>'kind', 'wallet_top_up');
  v_jamiya := nullif(v_intent.metadata->>'jamiya_id', '')::uuid;
  IF v_jamiya IS NULL AND (v_intent.metadata->>'contribution_id') IS NOT NULL THEN
    SELECT jamiya_id INTO v_jamiya
    FROM public.contributions
    WHERE id = (v_intent.metadata->>'contribution_id')::uuid;
  END IF;

  CASE v_kind
    WHEN 'contribution' THEN
      v_domain := 'CONTRIBUTIONS';
      v_debit := '1000';
      v_credit := '3000';
      v_desc := 'Contribution collection';
    WHEN 'sadaka' THEN
      v_domain := 'SADAKA';
      v_debit := '1000';
      v_credit := '5000';
      v_desc := 'Sadaka donation';
    WHEN 'sponsorship' THEN
      v_domain := 'TAKAFUL';
      v_debit := '1000';
      v_credit := '6000';
      v_desc := 'Sponsorship charge';
    WHEN 'platform_tip' THEN
      v_domain := 'OPERATING';
      v_debit := '1000';
      v_credit := '2100';
      v_desc := 'Platform tip';
    ELSE
      v_domain := 'OPERATING';
      v_debit := '1000';
      v_credit := '2000';
      v_desc := 'Wallet top-up';
  END CASE;

  v_entry := private.post_balanced_journal(
    'payment_intent',
    v_intent.id::text,
    v_domain,
    v_desc,
    v_intent.currency,
    v_debit,
    v_credit,
    v_intent.amount,
    v_intent.id,
    v_jamiya,
    v_intent.user_id,
    jsonb_build_object('kind', v_kind) || coalesce(v_intent.metadata, '{}'::jsonb)
  );

  RETURN v_entry;
END;
$$;

-- Bridge: STK/wallet contribution → circle cashbook (idempotent)
CREATE OR REPLACE FUNCTION private.bridge_contribution_to_cashbook(
  p_contribution_id UUID,
  p_amount NUMERIC,
  p_payment_intent_id UUID DEFAULT NULL,
  p_transaction_id UUID DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_c public.contributions%ROWTYPE;
  v_member public.members%ROWTYPE;
  v_bank UUID;
  v_entry UUID;
  v_key TEXT;
BEGIN
  IF p_contribution_id IS NULL OR p_amount IS NULL OR p_amount <= 0 THEN
    RETURN NULL;
  END IF;

  SELECT * INTO v_c FROM public.contributions WHERE id = p_contribution_id;
  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  SELECT * INTO v_member FROM public.members WHERE id = v_c.member_id;

  v_key := coalesce(
    'payment_intent:' || p_payment_intent_id::text,
    'transaction:' || p_transaction_id::text,
    'contribution:' || p_contribution_id::text
  );

  IF EXISTS (
    SELECT 1 FROM public.book_entries b
    WHERE b.jamiya_id = v_c.jamiya_id
      AND b.entry_type = 'contribution'
      AND (
        b.metadata->>'bridge_key' = v_key
        OR (p_payment_intent_id IS NOT NULL AND b.metadata->>'payment_intent_id' = p_payment_intent_id::text)
      )
  ) THEN
    SELECT id INTO v_entry FROM public.book_entries b
    WHERE b.jamiya_id = v_c.jamiya_id
      AND b.entry_type = 'contribution'
      AND (
        b.metadata->>'bridge_key' = v_key
        OR (p_payment_intent_id IS NOT NULL AND b.metadata->>'payment_intent_id' = p_payment_intent_id::text)
      )
    LIMIT 1;
    RETURN v_entry;
  END IF;

  -- Prefer M-Pesa cashbook account when present
  SELECT id INTO v_bank
  FROM public.circle_bank_accounts
  WHERE jamiya_id = v_c.jamiya_id AND is_active AND account_kind = 'mpesa'
  ORDER BY created_at
  LIMIT 1;

  IF v_bank IS NULL THEN
    SELECT id INTO v_bank
    FROM public.circle_bank_accounts
    WHERE jamiya_id = v_c.jamiya_id AND is_active
    ORDER BY created_at
    LIMIT 1;
  END IF;

  IF v_bank IS NOT NULL THEN
    UPDATE public.circle_bank_accounts
    SET balance = balance + p_amount, updated_at = NOW()
    WHERE id = v_bank;
  END IF;

  INSERT INTO public.book_entries (
    jamiya_id, member_id, entry_type, amount, currency, effective_date,
    entered_by, notes, bank_account_id, metadata
  ) VALUES (
    v_c.jamiya_id,
    v_c.member_id,
    'contribution',
    p_amount,
    v_c.currency,
    CURRENT_DATE,
    v_member.user_id,
    'Auto: contribution payment bridge',
    v_bank,
    jsonb_build_object(
      'bridge_key', v_key,
      'contribution_id', p_contribution_id,
      'payment_intent_id', p_payment_intent_id,
      'transaction_id', p_transaction_id,
      'source', 'finance_bridge'
    )
  )
  RETURNING id INTO v_entry;

  RETURN v_entry;
EXCEPTION
  WHEN OTHERS THEN
    -- Never fail the payment path on cashbook bridge
    RETURN NULL;
END;
$$;

-- ---------------------------------------------------------------------------
-- Patch complete_payment_intent: journal + settlement flags + cashbook bridge
-- (Keeps existing wallet / sidecar behaviour; adds projection side-effects.)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.complete_payment_intent(
  p_intent_id UUID,
  p_provider_reference TEXT DEFAULT NULL,
  p_checkout_request_id TEXT DEFAULT NULL,
  p_metadata JSONB DEFAULT '{}'::jsonb
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_intent public.payment_intents%ROWTYPE;
  v_tx UUID;
  v_kind TEXT;
  v_tip_id UUID;
BEGIN
  IF coalesce(auth.role(), '') NOT IN ('service_role', 'authenticated') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'FORBIDDEN');
  END IF;

  SELECT * INTO v_intent FROM public.payment_intents WHERE id = p_intent_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'NOT_FOUND');
  END IF;

  IF v_intent.status = 'completed' THEN
    PERFORM private.post_journal_for_payment_intent(v_intent.id);
    RETURN jsonb_build_object(
      'ok', true,
      'already_completed', true,
      'transaction_id', v_intent.transaction_id
    );
  END IF;

  IF v_intent.status NOT IN ('pending', 'processing') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'NOT_COMPLETABLE');
  END IF;

  IF auth.role() = 'authenticated' THEN
    IF auth.uid() IS DISTINCT FROM v_intent.user_id OR v_intent.provider <> 'simulated' THEN
      RETURN jsonb_build_object('ok', false, 'error', 'FORBIDDEN');
    END IF;
  END IF;

  v_kind := coalesce(v_intent.metadata->>'kind', 'wallet_top_up');

  IF v_kind = 'contribution' THEN
    DECLARE
      v_contribution_id UUID := nullif(v_intent.metadata->>'contribution_id', '')::uuid;
      v_c public.contributions%ROWTYPE;
      v_member public.members%ROWTYPE;
      v_j public.jamiyas%ROWTYPE;
      v_remaining NUMERIC;
      v_pay NUMERIC;
      v_new_paid NUMERIC;
      v_new_status public.contribution_status;
      v_credit_tx UUID;
      v_debit_tx UUID;
      v_fee NUMERIC;
    BEGIN
      IF v_contribution_id IS NULL OR v_intent.user_id IS NULL THEN
        RETURN jsonb_build_object('ok', false, 'error', 'CONTRIBUTION_REQUIRED');
      END IF;

      SELECT * INTO v_c FROM public.contributions WHERE id = v_contribution_id FOR UPDATE;
      IF NOT FOUND THEN
        RETURN jsonb_build_object('ok', false, 'error', 'NOT_FOUND');
      END IF;

      IF v_c.status NOT IN ('pending', 'late', 'partial') THEN
        RETURN jsonb_build_object('ok', false, 'error', 'NOT_PAYABLE');
      END IF;

      SELECT * INTO v_member FROM public.members WHERE id = v_c.member_id;
      IF v_member.user_id IS DISTINCT FROM v_intent.user_id THEN
        RETURN jsonb_build_object('ok', false, 'error', 'FORBIDDEN');
      END IF;

      IF v_c.currency IS DISTINCT FROM v_intent.currency THEN
        RETURN jsonb_build_object('ok', false, 'error', 'CURRENCY_MISMATCH');
      END IF;

      v_remaining := v_c.amount - coalesce(v_c.amount_paid, 0);
      IF v_remaining <= 0 THEN
        RETURN jsonb_build_object('ok', false, 'error', 'ALREADY_PAID');
      END IF;

      v_pay := LEAST(v_intent.amount, v_remaining);

      v_credit_tx := private.ledger_credit(
        v_intent.user_id,
        v_intent.currency,
        v_intent.amount,
        'wallet_top_up',
        NULL,
        coalesce(p_provider_reference, 'payment_intent:' || v_intent.id::text),
        'payment_intent:' || v_intent.id::text,
        jsonb_build_object(
          'payment_intent_id', v_intent.id,
          'provider', v_intent.provider,
          'kind', 'contribution'
        ) || coalesce(p_metadata, '{}'::jsonb)
      );

      v_debit_tx := private.ledger_debit(
        v_intent.user_id,
        v_c.currency,
        v_pay,
        'contribution',
        v_c.jamiya_id,
        'contribution:' || v_c.id::text || ':' || v_intent.id::text,
        'pay_contribution_stk:' || v_intent.id::text,
        jsonb_build_object(
          'contribution_id', v_c.id,
          'cycle', v_c.cycle_number,
          'payment_intent_id', v_intent.id,
          'amount', v_pay
        )
      );

      v_new_paid := coalesce(v_c.amount_paid, 0) + v_pay;
      IF v_new_paid >= v_c.amount THEN
        v_new_status := 'paid';
      ELSE
        v_new_status := 'partial';
      END IF;

      UPDATE public.contributions
      SET
        amount_paid = v_new_paid,
        status = v_new_status,
        paid_at = CASE WHEN v_new_status = 'paid' THEN NOW() ELSE paid_at END,
        transaction_id = v_debit_tx,
        updated_at = NOW()
      WHERE id = v_c.id;

      INSERT INTO public.contribution_payments (
        contribution_id, transaction_id, amount, currency, created_by, payment_method, notes
      ) VALUES (
        v_c.id,
        v_debit_tx,
        v_pay,
        v_c.currency,
        v_intent.user_id,
        'external',
        'STK via payment_intent ' || v_intent.id::text
      );

      IF v_new_status = 'paid' THEN
        SELECT * INTO v_j FROM public.jamiyas WHERE id = v_c.jamiya_id;
        v_fee := coalesce(v_j.transaction_fee_amount, 0);
        IF v_fee > 0 AND NOT EXISTS (
          SELECT 1 FROM public.transactions t
          WHERE t.user_id = v_intent.user_id
            AND t.reference = 'contrib_fee:' || v_c.id::text
            AND t.status = 'completed'
        ) THEN
          BEGIN
            PERFORM private.ledger_debit(
              v_intent.user_id,
              v_j.currency,
              v_fee,
              'fee'::public.transaction_type,
              v_j.id,
              'contrib_fee:' || v_c.id::text,
              v_c.id::text,
              jsonb_build_object('kind', 'contribution_fee', 'contribution_id', v_c.id)
            );
          EXCEPTION WHEN OTHERS THEN
            NULL;
          END;
        END IF;
      END IF;

      UPDATE public.payment_intents
      SET
        status = 'completed',
        provider_reference = coalesce(p_provider_reference, provider_reference),
        checkout_request_id = coalesce(p_checkout_request_id, checkout_request_id),
        transaction_id = v_credit_tx,
        completed_at = NOW(),
        settlement_status = 'unsettled',
        reconcile_status = 'open',
        metadata = metadata || coalesce(p_metadata, '{}'::jsonb) ||
          jsonb_build_object(
            'contribution_id', v_c.id,
            'debit_transaction_id', v_debit_tx,
            'contribution_status', v_new_status,
            'jamiya_id', v_c.jamiya_id
          ),
        updated_at = NOW()
      WHERE id = v_intent.id;

      PERFORM private.bridge_contribution_to_cashbook(
        v_c.id, v_pay, v_intent.id, v_debit_tx
      );
      PERFORM private.post_journal_for_payment_intent(v_intent.id);

      INSERT INTO public.notifications (user_id, type, channel, title, body, data)
      VALUES (
        v_intent.user_id,
        'system',
        'in_app',
        CASE WHEN v_new_status = 'paid' THEN 'Contribution paid' ELSE 'Partial contribution paid' END,
        'Cycle ' || v_c.cycle_number || ': ' || v_pay::text || ' ' || v_c.currency
          || ' paid (' || v_new_paid::text || '/' || v_c.amount::text || ').',
        jsonb_build_object(
          'jamiya_id', v_c.jamiya_id,
          'contribution_id', v_c.id,
          'payment_intent_id', v_intent.id,
          'status', v_new_status
        )
      );

      INSERT INTO public.notifications (user_id, type, channel, title, body, data)
      SELECT
        m.user_id,
        'contribution_received',
        'in_app',
        CASE WHEN v_new_status = 'paid' THEN 'Contribution fully paid' ELSE 'Partial contribution received' END,
        'Cycle ' || v_c.cycle_number || ': ' || v_pay::text || ' ' || v_c.currency
          || ' paid (' || v_new_paid::text || '/' || v_c.amount::text || ').',
        jsonb_build_object(
          'jamiya_id', v_c.jamiya_id,
          'contribution_id', v_c.id,
          'amount', v_pay,
          'amount_paid', v_new_paid,
          'status', v_new_status
        )
      FROM public.members m
      WHERE m.jamiya_id = v_c.jamiya_id
        AND m.role = 'circle_admin'
        AND m.status = 'active';

      RETURN jsonb_build_object(
        'ok', true,
        'kind', 'contribution',
        'contribution_id', v_c.id,
        'transaction_id', v_credit_tx,
        'debit_transaction_id', v_debit_tx,
        'status', v_new_status,
        'amount_paid', v_new_paid
      );
    END;
  END IF;

  IF v_kind = 'sponsorship' THEN
    DECLARE
      v_charge_id UUID := nullif(v_intent.metadata->>'charge_id', '')::uuid;
      v_sponsorship_id UUID := nullif(v_intent.metadata->>'sponsorship_id', '')::uuid;
    BEGIN
      IF v_charge_id IS NOT NULL THEN
        UPDATE public.sponsorship_charges
        SET status = 'paid', charged_at = NOW()
        WHERE id = v_charge_id AND status IN ('pending', 'failed');
      END IF;
      IF v_sponsorship_id IS NOT NULL THEN
        UPDATE public.sponsorships
        SET next_charge_date = CURRENT_DATE + 30,
            updated_at = NOW()
        WHERE id = v_sponsorship_id AND status = 'active';
      END IF;

      UPDATE public.payment_intents
      SET
        status = 'completed',
        provider_reference = coalesce(p_provider_reference, provider_reference),
        checkout_request_id = coalesce(p_checkout_request_id, checkout_request_id),
        completed_at = NOW(),
        settlement_status = 'unsettled',
        reconcile_status = 'open',
        metadata = metadata || coalesce(p_metadata, '{}'::jsonb),
        updated_at = NOW()
      WHERE id = v_intent.id;

      PERFORM private.post_journal_for_payment_intent(v_intent.id);

      IF v_intent.user_id IS NOT NULL THEN
        INSERT INTO public.notifications (user_id, type, channel, title, body, data)
        VALUES (
          v_intent.user_id, 'system', 'in_app',
          'Sponsorship payment received',
          'JazakAllah khair. Your monthly sponsorship of ' ||
            v_intent.amount::text || ' ' || v_intent.currency || ' was recorded.',
          jsonb_build_object(
            'sponsorship_id', v_sponsorship_id,
            'charge_id', v_charge_id
          )
        );
      END IF;

      RETURN jsonb_build_object(
        'ok', true,
        'kind', 'sponsorship',
        'charge_id', v_charge_id,
        'sponsorship_id', v_sponsorship_id
      );
    END;
  END IF;

  IF v_kind = 'sadaka' THEN
    IF v_intent.metadata->>'campaign_id' IS NULL THEN
      RETURN jsonb_build_object('ok', false, 'error', 'CAMPAIGN_REQUIRED');
    END IF;

    DECLARE
      v_c public.charity_campaigns%ROWTYPE;
      v_fee NUMERIC := 0;
      v_net NUMERIC;
      v_receipt TEXT;
      v_donation_id UUID;
      v_campaign_id UUID := (v_intent.metadata->>'campaign_id')::uuid;
    BEGIN
      SELECT * INTO v_c FROM public.charity_campaigns WHERE id = v_campaign_id FOR UPDATE;
      IF NOT FOUND OR v_c.status <> 'live' THEN
        RETURN jsonb_build_object('ok', false, 'error', 'CAMPAIGN_UNAVAILABLE');
      END IF;

      IF v_c.fee_mode = 'donation_addon' THEN
        v_fee := round(v_intent.amount * v_c.fee_bps / 10000.0, 2);
        v_net := v_intent.amount;
      ELSIF v_c.fee_mode = 'donation_deduct' THEN
        v_fee := round(v_intent.amount * v_c.fee_bps / 10000.0, 2);
        v_net := v_intent.amount - v_fee;
      ELSE
        v_net := v_intent.amount;
      END IF;

      v_receipt := 'AMA-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 10));

      INSERT INTO public.charity_donations (
        campaign_id, donor_user_id, donor_name, donor_phone, donor_email,
        amount, fee_amount, currency, receipt_code, is_anonymous, payment_intent_id
      ) VALUES (
        v_campaign_id, v_intent.user_id,
        v_intent.metadata->>'donor_name',
        coalesce(v_intent.phone, v_intent.metadata->>'donor_phone'),
        v_intent.metadata->>'donor_email',
        v_net, v_fee, v_c.currency, v_receipt,
        coalesce((v_intent.metadata->>'is_anonymous')::boolean, false),
        v_intent.id
      ) RETURNING id INTO v_donation_id;

      UPDATE public.charity_campaigns
      SET raised_amount = raised_amount + v_net
      WHERE id = v_campaign_id;

      UPDATE public.payment_intents
      SET
        status = 'completed',
        provider_reference = coalesce(p_provider_reference, provider_reference),
        checkout_request_id = coalesce(p_checkout_request_id, checkout_request_id),
        completed_at = NOW(),
        settlement_status = 'unsettled',
        reconcile_status = 'open',
        metadata = metadata || coalesce(p_metadata, '{}'::jsonb) ||
          jsonb_build_object('donation_id', v_donation_id, 'receipt_code', v_receipt),
        updated_at = NOW()
      WHERE id = v_intent.id;

      PERFORM private.post_journal_for_payment_intent(v_intent.id);

      IF v_intent.user_id IS NOT NULL THEN
        INSERT INTO public.notifications (user_id, type, channel, title, body, data)
        VALUES (
          v_intent.user_id, 'system', 'in_app',
          'Donation receipt ' || v_receipt,
          'JazakAllah khair. Your gift of ' || v_net || ' ' || v_c.currency ||
            ' to ' || v_c.title || ' was recorded.',
          jsonb_build_object('donation_id', v_donation_id, 'receipt', v_receipt)
        );
      END IF;

      RETURN jsonb_build_object(
        'ok', true,
        'kind', 'sadaka',
        'donation_id', v_donation_id,
        'receipt_code', v_receipt
      );
    END;
  END IF;

  IF v_kind = 'platform_tip' THEN
    INSERT INTO public.platform_tips (user_id, amount, currency, phone, payment_intent_id)
    VALUES (v_intent.user_id, v_intent.amount, v_intent.currency, v_intent.phone, v_intent.id)
    RETURNING id INTO v_tip_id;

    UPDATE public.payment_intents
    SET
      status = 'completed',
      provider_reference = coalesce(p_provider_reference, provider_reference),
      checkout_request_id = coalesce(p_checkout_request_id, checkout_request_id),
      completed_at = NOW(),
      settlement_status = 'unsettled',
      reconcile_status = 'open',
      metadata = metadata || coalesce(p_metadata, '{}'::jsonb) || jsonb_build_object('tip_id', v_tip_id),
      updated_at = NOW()
    WHERE id = v_intent.id;

    PERFORM private.post_journal_for_payment_intent(v_intent.id);

    RETURN jsonb_build_object('ok', true, 'kind', 'platform_tip', 'tip_id', v_tip_id);
  END IF;

  v_tx := private.ledger_credit(
    v_intent.user_id,
    v_intent.currency,
    v_intent.amount,
    'wallet_top_up',
    NULL,
    coalesce(p_provider_reference, 'payment_intent:' || v_intent.id::text),
    'payment_intent:' || v_intent.id::text,
    jsonb_build_object(
      'payment_intent_id', v_intent.id,
      'provider', v_intent.provider
    ) || coalesce(p_metadata, '{}'::jsonb)
  );

  UPDATE public.payment_intents
  SET
    status = 'completed',
    provider_reference = coalesce(p_provider_reference, provider_reference),
    checkout_request_id = coalesce(p_checkout_request_id, checkout_request_id),
    transaction_id = v_tx,
    completed_at = NOW(),
    settlement_status = 'unsettled',
    reconcile_status = 'open',
    metadata = metadata || coalesce(p_metadata, '{}'::jsonb),
    updated_at = NOW()
  WHERE id = v_intent.id;

  PERFORM private.post_journal_for_payment_intent(v_intent.id);

  INSERT INTO public.notifications (user_id, type, channel, title, body, data)
  VALUES (
    v_intent.user_id,
    'system',
    'in_app',
    'Wallet topped up',
    'Your wallet was credited after a successful payment.',
    jsonb_build_object('payment_intent_id', v_intent.id, 'transaction_id', v_tx)
  );

  RETURN jsonb_build_object('ok', true, 'transaction_id', v_tx);
END;
$$;

REVOKE ALL ON FUNCTION public.complete_payment_intent(UUID, TEXT, TEXT, JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.complete_payment_intent(UUID, TEXT, TEXT, JSONB) TO authenticated, service_role;

-- Mark matched after successful reconcile helper
CREATE OR REPLACE FUNCTION public.mark_payment_intent_reconciled(
  p_intent_id UUID,
  p_settled BOOLEAN DEFAULT true
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF coalesce(auth.role(), '') NOT IN ('service_role', 'authenticated') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'FORBIDDEN');
  END IF;
  IF auth.role() = 'authenticated' AND NOT private.is_platform_admin() THEN
    RETURN jsonb_build_object('ok', false, 'error', 'FORBIDDEN');
  END IF;

  UPDATE public.payment_intents
  SET
    settlement_status = CASE WHEN p_settled THEN 'settled' ELSE settlement_status END,
    reconcile_status = 'matched',
    updated_at = NOW()
  WHERE id = p_intent_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'NOT_FOUND');
  END IF;
  RETURN jsonb_build_object('ok', true);
END;
$$;

REVOKE ALL ON FUNCTION public.mark_payment_intent_reconciled(UUID, BOOLEAN) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.mark_payment_intent_reconciled(UUID, BOOLEAN) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.mark_payment_intent_exception(
  p_intent_id UUID,
  p_note TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NOT private.is_platform_admin() AND coalesce(auth.role(), '') <> 'service_role' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'FORBIDDEN');
  END IF;

  UPDATE public.payment_intents
  SET
    reconcile_status = 'exception',
    metadata = metadata || jsonb_build_object(
      'reconcile_exception_note', coalesce(p_note, 'flagged'),
      'reconcile_exception_at', NOW()
    ),
    updated_at = NOW()
  WHERE id = p_intent_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'NOT_FOUND');
  END IF;
  RETURN jsonb_build_object('ok', true);
END;
$$;

REVOKE ALL ON FUNCTION public.mark_payment_intent_exception(UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.mark_payment_intent_exception(UUID, TEXT) TO authenticated, service_role;

-- Inbox insert (service role / SECURITY DEFINER for webhooks)
CREATE OR REPLACE FUNCTION public.ingest_webhook_event(
  p_provider TEXT,
  p_fingerprint TEXT,
  p_payload JSONB,
  p_event_type TEXT DEFAULT NULL,
  p_external_id TEXT DEFAULT NULL,
  p_payment_intent_id UUID DEFAULT NULL,
  p_headers JSONB DEFAULT '{}'::jsonb
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_id UUID;
BEGIN
  INSERT INTO public.webhook_events (
    provider, fingerprint, payload, event_type, external_id,
    payment_intent_id, headers, status
  ) VALUES (
    p_provider, p_fingerprint, coalesce(p_payload, '{}'::jsonb), p_event_type,
    p_external_id, p_payment_intent_id, coalesce(p_headers, '{}'::jsonb), 'received'
  )
  RETURNING id INTO v_id;

  RETURN jsonb_build_object('ok', true, 'id', v_id, 'duplicate', false);
EXCEPTION
  WHEN unique_violation THEN
    SELECT id INTO v_id
    FROM public.webhook_events
    WHERE provider = p_provider AND fingerprint = p_fingerprint;
    UPDATE public.webhook_events
    SET status = CASE WHEN status = 'processed' THEN status ELSE 'duplicate' END
    WHERE id = v_id AND status = 'received';
    RETURN jsonb_build_object('ok', true, 'id', v_id, 'duplicate', true);
END;
$$;

REVOKE ALL ON FUNCTION public.ingest_webhook_event(TEXT, TEXT, JSONB, TEXT, TEXT, UUID, JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.ingest_webhook_event(TEXT, TEXT, JSONB, TEXT, TEXT, UUID, JSONB) TO service_role;

CREATE OR REPLACE FUNCTION public.finalize_webhook_event(
  p_event_id UUID,
  p_status TEXT,
  p_error TEXT DEFAULT NULL,
  p_payment_intent_id UUID DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  UPDATE public.webhook_events
  SET
    status = p_status,
    error_message = p_error,
    payment_intent_id = coalesce(p_payment_intent_id, payment_intent_id),
    processed_at = NOW()
  WHERE id = p_event_id;
END;
$$;

REVOKE ALL ON FUNCTION public.finalize_webhook_event(UUID, TEXT, TEXT, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.finalize_webhook_event(UUID, TEXT, TEXT, UUID) TO service_role;

-- Safety net: always project journal + contribution cashbook on complete
-- (idempotent with explicit PERFORM calls inside complete_payment_intent).
CREATE OR REPLACE FUNCTION private.trg_payment_intent_completed()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_contrib UUID;
  v_pay NUMERIC;
BEGIN
  IF NEW.status = 'completed' AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM NEW.status) THEN
    PERFORM private.post_journal_for_payment_intent(NEW.id);

    IF coalesce(NEW.metadata->>'kind', '') = 'contribution' THEN
      v_contrib := nullif(NEW.metadata->>'contribution_id', '')::uuid;
      IF v_contrib IS NOT NULL THEN
        SELECT amount INTO v_pay
        FROM public.contribution_payments
        WHERE contribution_id = v_contrib
          AND (
            notes ILIKE '%' || NEW.id::text || '%'
            OR transaction_id IS NOT DISTINCT FROM coalesce(
              nullif(NEW.metadata->>'debit_transaction_id', '')::uuid,
              NEW.transaction_id
            )
          )
        ORDER BY created_at DESC
        LIMIT 1;
        v_pay := coalesce(v_pay, NEW.amount);
        PERFORM private.bridge_contribution_to_cashbook(
          v_contrib,
          v_pay,
          NEW.id,
          coalesce(nullif(NEW.metadata->>'debit_transaction_id', '')::uuid, NEW.transaction_id)
        );
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS payment_intents_completed_finance ON public.payment_intents;
CREATE TRIGGER payment_intents_completed_finance
  AFTER INSERT OR UPDATE OF status ON public.payment_intents
  FOR EACH ROW
  EXECUTE FUNCTION private.trg_payment_intent_completed();

