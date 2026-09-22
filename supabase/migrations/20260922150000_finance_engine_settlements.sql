-- Finance engine Phase 2–3 foundations: settlements, refunds, amount_minor,
-- provider_transactions mirror. Wallet remains live SoT until cutover.

CREATE TABLE IF NOT EXISTS public.settlements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_intent_id UUID REFERENCES public.payment_intents (id) ON DELETE SET NULL,
  provider TEXT NOT NULL,
  provider_reference TEXT,
  amount NUMERIC(14, 2) NOT NULL CHECK (amount > 0),
  amount_minor BIGINT NOT NULL CHECK (amount_minor > 0),
  currency CHAR(3) NOT NULL DEFAULT 'KES',
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'settled', 'failed', 'disputed')),
  settled_at TIMESTAMPTZ,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS settlements_provider_ref_uidx
  ON public.settlements (provider, provider_reference)
  WHERE provider_reference IS NOT NULL;

CREATE INDEX IF NOT EXISTS settlements_intent_idx
  ON public.settlements (payment_intent_id)
  WHERE payment_intent_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS settlements_status_idx
  ON public.settlements (status, created_at DESC);

ALTER TABLE public.settlements ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS settlements_admin_read ON public.settlements;
CREATE POLICY settlements_admin_read ON public.settlements
  FOR SELECT TO authenticated
  USING (private.is_platform_admin());

CREATE TABLE IF NOT EXISTS public.refunds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_intent_id UUID REFERENCES public.payment_intents (id) ON DELETE SET NULL,
  journal_entry_id UUID REFERENCES public.journal_entries (id) ON DELETE SET NULL,
  amount NUMERIC(14, 2) NOT NULL CHECK (amount > 0),
  amount_minor BIGINT NOT NULL CHECK (amount_minor > 0),
  currency CHAR(3) NOT NULL DEFAULT 'KES',
  reason TEXT,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'cancelled')),
  provider_reference TEXT,
  created_by UUID REFERENCES public.profiles (id) ON DELETE SET NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

ALTER TABLE public.refunds ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS refunds_admin_read ON public.refunds;
CREATE POLICY refunds_admin_read ON public.refunds
  FOR SELECT TO authenticated
  USING (private.is_platform_admin());

CREATE TABLE IF NOT EXISTS public.provider_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider TEXT NOT NULL,
  provider_reference TEXT NOT NULL,
  payment_intent_id UUID REFERENCES public.payment_intents (id) ON DELETE SET NULL,
  direction TEXT NOT NULL CHECK (direction IN ('collection', 'disbursement')),
  amount NUMERIC(14, 2) NOT NULL CHECK (amount > 0),
  amount_minor BIGINT NOT NULL CHECK (amount_minor > 0),
  currency CHAR(3) NOT NULL DEFAULT 'KES',
  status TEXT NOT NULL DEFAULT 'unknown',
  raw JSONB NOT NULL DEFAULT '{}'::jsonb,
  observed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT provider_transactions_unique UNIQUE (provider, provider_reference)
);

ALTER TABLE public.provider_transactions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS provider_transactions_admin_read ON public.provider_transactions;
CREATE POLICY provider_transactions_admin_read ON public.provider_transactions
  FOR SELECT TO authenticated
  USING (private.is_platform_admin());

ALTER TABLE public.payment_intents
  ADD COLUMN IF NOT EXISTS amount_minor BIGINT;

UPDATE public.payment_intents
SET amount_minor = round(amount * 100)::bigint
WHERE amount_minor IS NULL;

COMMENT ON TABLE public.settlements IS
  'Provider/bank settlement layer. Distinct from payment_intents.status and reconcile_status.';
COMMENT ON TABLE public.refunds IS
  'Refund requests; money movement must reverse via journal, never edit posted lines.';
COMMENT ON TABLE public.provider_transactions IS
  'Observed PSP transaction snapshots for reconcile matching.';
