-- Amanah remote bootstrap for project vzpnixfqkvovbniaoudx
-- Apply via Supabase Dashboard → SQL Editor (Run)


-- ========== 20260722181533_profiles_auth_bootstrap.sql ==========

-- Phase 1.2: Auth bootstrap â€” profiles + auto-provisioning trigger
-- Full domain schema (jamiyas, contributions, etc.) lands in Phase 1.3.

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ---------------------------------------------------------------------------
-- Private schema for security-definer helpers (not exposed via Data API)
-- ---------------------------------------------------------------------------
CREATE SCHEMA IF NOT EXISTS private;

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------
CREATE TYPE public.platform_role AS ENUM (
  'member',
  'compliance_officer',
  'platform_admin',
  'super_admin'
);

CREATE TYPE public.kyc_status AS ENUM (
  'not_started',
  'pending',
  'under_review',
  'approved',
  'rejected'
);

-- ---------------------------------------------------------------------------
-- profiles
-- ---------------------------------------------------------------------------
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  email TEXT,
  full_name TEXT,
  phone TEXT,
  avatar_url TEXT,
  bio TEXT,
  country_code CHAR(2),
  platform_role public.platform_role NOT NULL DEFAULT 'member',
  kyc_status public.kyc_status NOT NULL DEFAULT 'not_started',
  profile_completed BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT profiles_email_format CHECK (
    email IS NULL OR email ~* '^[^@]+@[^@]+\.[^@]+$'
  ),
  CONSTRAINT profiles_phone_e164 CHECK (
    phone IS NULL OR phone ~ '^\+[1-9][0-9]{7,14}$'
  )
);

CREATE UNIQUE INDEX profiles_email_unique_idx
  ON public.profiles (lower(email))
  WHERE email IS NOT NULL;

CREATE UNIQUE INDEX profiles_phone_unique_idx
  ON public.profiles (phone)
  WHERE phone IS NOT NULL;

CREATE INDEX profiles_platform_role_idx ON public.profiles (platform_role);
CREATE INDEX profiles_kyc_status_idx ON public.profiles (kyc_status);

COMMENT ON TABLE public.profiles IS
  'Application profile for each auth.users row. platform_role is authoritative in DB; mirror to app_metadata for JWT claims via admin tooling only.';

-- ---------------------------------------------------------------------------
-- updated_at trigger
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION private.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE TRIGGER profiles_set_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION private.set_updated_at();

-- ---------------------------------------------------------------------------
-- Auto-create profile on signup
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION private.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_full_name TEXT;
  v_phone TEXT;
BEGIN
  v_full_name := NULLIF(TRIM(COALESCE(NEW.raw_user_meta_data ->> 'full_name', '')), '');
  v_phone := NULLIF(TRIM(COALESCE(NEW.phone, NEW.raw_user_meta_data ->> 'phone', '')), '');

  INSERT INTO public.profiles (id, email, full_name, phone, platform_role, kyc_status)
  VALUES (
    NEW.id,
    LOWER(NEW.email),
    v_full_name,
    v_phone,
    'member',
    'not_started'
  );

  -- Authoritative role claim for JWT (never store roles in user_metadata)
  UPDATE auth.users
  SET raw_app_meta_data =
    COALESCE(raw_app_meta_data, '{}'::jsonb) || jsonb_build_object('platform_role', 'member')
  WHERE id = NEW.id;

  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION private.handle_new_user();

-- ---------------------------------------------------------------------------
-- Helpers for RLS (SECURITY DEFINER, private schema)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION private.current_platform_role()
RETURNS public.platform_role
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT platform_role
  FROM public.profiles
  WHERE id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION private.is_platform_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT COALESCE(
    (SELECT platform_role IN ('platform_admin', 'super_admin')
     FROM public.profiles
     WHERE id = auth.uid()),
    FALSE
  );
$$;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "profiles_select_own"
  ON public.profiles
  FOR SELECT
  TO authenticated
  USING (id = auth.uid() OR private.is_platform_admin());

CREATE POLICY "profiles_update_own"
  ON public.profiles
  FOR UPDATE
  TO authenticated
  USING (id = auth.uid())
  WITH CHECK (
    id = auth.uid()
    AND platform_role = (SELECT p.platform_role FROM public.profiles p WHERE p.id = auth.uid())
    AND kyc_status = (SELECT p.kyc_status FROM public.profiles p WHERE p.id = auth.uid())
  );

-- Admins can update any profile (role / KYC changes)
CREATE POLICY "profiles_admin_update"
  ON public.profiles
  FOR UPDATE
  TO authenticated
  USING (private.is_platform_admin())
  WITH CHECK (private.is_platform_admin());

-- No direct INSERT/DELETE for authenticated clients â€” trigger owns inserts;
-- deletes cascade from auth.users.
REVOKE INSERT, DELETE ON public.profiles FROM authenticated, anon;
GRANT SELECT, UPDATE ON public.profiles TO authenticated;




-- ========== 20260722185603_domain_schema.sql ==========

-- Phase 1.3: Domain schema â€” Amanah ROSCA core
-- Builds on 20260722181533_profiles_auth_bootstrap.sql

-- ============================================================================
-- Enums
-- ============================================================================
CREATE TYPE public.jamiya_status AS ENUM (
  'draft',
  'open',
  'active',
  'paused',
  'completed',
  'cancelled'
);

CREATE TYPE public.membership_role AS ENUM (
  'member',
  'circle_admin'
);

CREATE TYPE public.membership_status AS ENUM (
  'invited',
  'active',
  'suspended',
  'left',
  'removed'
);

CREATE TYPE public.contribution_status AS ENUM (
  'pending',
  'paid',
  'late',
  'waived',
  'failed'
);

CREATE TYPE public.payout_status AS ENUM (
  'scheduled',
  'processing',
  'paid',
  'failed',
  'cancelled'
);

CREATE TYPE public.invitation_status AS ENUM (
  'pending',
  'accepted',
  'declined',
  'expired',
  'revoked'
);

CREATE TYPE public.transaction_type AS ENUM (
  'contribution',
  'payout',
  'wallet_top_up',
  'wallet_withdrawal',
  'fee',
  'adjustment'
);

CREATE TYPE public.transaction_status AS ENUM (
  'pending',
  'processing',
  'completed',
  'failed',
  'reversed'
);

CREATE TYPE public.notification_channel AS ENUM (
  'in_app',
  'email',
  'sms',
  'push'
);

CREATE TYPE public.notification_type AS ENUM (
  'invitation',
  'contribution_due',
  'contribution_received',
  'payout_scheduled',
  'payout_paid',
  'kyc_update',
  'system',
  'admin'
);

CREATE TYPE public.audit_action AS ENUM (
  'create',
  'update',
  'delete',
  'login',
  'logout',
  'invite',
  'join',
  'leave',
  'approve',
  'reject',
  'export',
  'role_change'
);

CREATE TYPE public.kyc_document_type AS ENUM (
  'national_id',
  'passport',
  'driving_license',
  'proof_of_address',
  'selfie',
  'other'
);

CREATE TYPE public.kyc_document_status AS ENUM (
  'uploaded',
  'under_review',
  'approved',
  'rejected'
);

-- ============================================================================
-- Tables
-- ============================================================================

CREATE TABLE public.jamiyas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  description TEXT,
  status public.jamiya_status NOT NULL DEFAULT 'draft',
  created_by UUID NOT NULL REFERENCES public.profiles (id) ON DELETE RESTRICT,
  contribution_amount NUMERIC(18, 2) NOT NULL,
  currency CHAR(3) NOT NULL DEFAULT 'KES',
  max_members INTEGER NOT NULL,
  cycle_count INTEGER NOT NULL,
  contribution_frequency_days INTEGER NOT NULL DEFAULT 30,
  current_cycle INTEGER NOT NULL DEFAULT 0,
  member_count INTEGER NOT NULL DEFAULT 0,
  start_date DATE,
  end_date DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT jamiyas_name_length CHECK (char_length(trim(name)) BETWEEN 3 AND 80),
  CONSTRAINT jamiyas_slug_format CHECK (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  CONSTRAINT jamiyas_contribution_amount_positive CHECK (contribution_amount > 0),
  CONSTRAINT jamiyas_max_members_range CHECK (max_members BETWEEN 2 AND 50),
  CONSTRAINT jamiyas_cycle_count_range CHECK (cycle_count BETWEEN 2 AND 50),
  CONSTRAINT jamiyas_frequency_positive CHECK (contribution_frequency_days BETWEEN 1 AND 365),
  CONSTRAINT jamiyas_current_cycle_range CHECK (current_cycle >= 0 AND current_cycle <= cycle_count),
  CONSTRAINT jamiyas_member_count_nonneg CHECK (member_count >= 0 AND member_count <= max_members),
  CONSTRAINT jamiyas_dates_order CHECK (end_date IS NULL OR start_date IS NULL OR end_date >= start_date)
);

CREATE UNIQUE INDEX jamiyas_slug_unique_idx ON public.jamiyas (slug);
CREATE INDEX jamiyas_status_idx ON public.jamiyas (status);
CREATE INDEX jamiyas_created_by_idx ON public.jamiyas (created_by);
CREATE INDEX jamiyas_created_at_idx ON public.jamiyas (created_at DESC);

COMMENT ON TABLE public.jamiyas IS
  'Rotating savings circle (ROSCA). member_count is maintained by triggers.';

CREATE TABLE public.members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  jamiya_id UUID NOT NULL REFERENCES public.jamiyas (id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  role public.membership_role NOT NULL DEFAULT 'member',
  status public.membership_status NOT NULL DEFAULT 'active',
  payout_position INTEGER,
  joined_at TIMESTAMPTZ,
  left_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT members_payout_position_positive CHECK (
    payout_position IS NULL OR payout_position >= 1
  ),
  CONSTRAINT members_left_after_join CHECK (
    left_at IS NULL OR joined_at IS NULL OR left_at >= joined_at
  )
);

CREATE UNIQUE INDEX members_jamiya_user_unique_idx
  ON public.members (jamiya_id, user_id);

CREATE UNIQUE INDEX members_jamiya_payout_position_unique_idx
  ON public.members (jamiya_id, payout_position)
  WHERE payout_position IS NOT NULL AND status = 'active';

CREATE INDEX members_user_id_idx ON public.members (user_id);
CREATE INDEX members_jamiya_status_idx ON public.members (jamiya_id, status);
CREATE INDEX members_jamiya_role_idx ON public.members (jamiya_id, role);

COMMENT ON TABLE public.members IS
  'Circle membership. One row per user per jamiya.';

CREATE TABLE public.invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  jamiya_id UUID NOT NULL REFERENCES public.jamiyas (id) ON DELETE CASCADE,
  invited_by UUID NOT NULL REFERENCES public.profiles (id) ON DELETE RESTRICT,
  email TEXT,
  phone TEXT,
  invitee_user_id UUID REFERENCES public.profiles (id) ON DELETE SET NULL,
  token_hash TEXT NOT NULL,
  status public.invitation_status NOT NULL DEFAULT 'pending',
  expires_at TIMESTAMPTZ NOT NULL,
  accepted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT invitations_contact_present CHECK (email IS NOT NULL OR phone IS NOT NULL),
  CONSTRAINT invitations_email_format CHECK (
    email IS NULL OR email ~* '^[^@]+@[^@]+\.[^@]+$'
  ),
  CONSTRAINT invitations_phone_e164 CHECK (
    phone IS NULL OR phone ~ '^\+[1-9][0-9]{7,14}$'
  )
);

CREATE UNIQUE INDEX invitations_token_hash_unique_idx ON public.invitations (token_hash);
CREATE INDEX invitations_jamiya_status_idx ON public.invitations (jamiya_id, status);
CREATE INDEX invitations_email_idx ON public.invitations (lower(email)) WHERE email IS NOT NULL;
CREATE INDEX invitations_invitee_idx ON public.invitations (invitee_user_id)
  WHERE invitee_user_id IS NOT NULL;

CREATE TABLE public.contributions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  jamiya_id UUID NOT NULL REFERENCES public.jamiyas (id) ON DELETE CASCADE,
  member_id UUID NOT NULL REFERENCES public.members (id) ON DELETE CASCADE,
  cycle_number INTEGER NOT NULL,
  amount NUMERIC(18, 2) NOT NULL,
  currency CHAR(3) NOT NULL,
  status public.contribution_status NOT NULL DEFAULT 'pending',
  due_date DATE NOT NULL,
  paid_at TIMESTAMPTZ,
  transaction_id UUID,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT contributions_cycle_positive CHECK (cycle_number >= 1),
  CONSTRAINT contributions_amount_positive CHECK (amount > 0)
);

CREATE UNIQUE INDEX contributions_member_cycle_unique_idx
  ON public.contributions (member_id, cycle_number);

CREATE INDEX contributions_jamiya_cycle_idx ON public.contributions (jamiya_id, cycle_number);
CREATE INDEX contributions_status_due_idx ON public.contributions (status, due_date);
CREATE INDEX contributions_member_id_idx ON public.contributions (member_id);

CREATE TABLE public.payouts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  jamiya_id UUID NOT NULL REFERENCES public.jamiyas (id) ON DELETE CASCADE,
  member_id UUID NOT NULL REFERENCES public.members (id) ON DELETE CASCADE,
  cycle_number INTEGER NOT NULL,
  amount NUMERIC(18, 2) NOT NULL,
  currency CHAR(3) NOT NULL,
  status public.payout_status NOT NULL DEFAULT 'scheduled',
  scheduled_date DATE NOT NULL,
  paid_at TIMESTAMPTZ,
  transaction_id UUID,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT payouts_cycle_positive CHECK (cycle_number >= 1),
  CONSTRAINT payouts_amount_positive CHECK (amount > 0)
);

CREATE UNIQUE INDEX payouts_jamiya_cycle_unique_idx
  ON public.payouts (jamiya_id, cycle_number);

CREATE UNIQUE INDEX payouts_member_cycle_unique_idx
  ON public.payouts (member_id, cycle_number);

CREATE INDEX payouts_status_scheduled_idx ON public.payouts (status, scheduled_date);
CREATE INDEX payouts_member_id_idx ON public.payouts (member_id);

CREATE TABLE public.wallets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  currency CHAR(3) NOT NULL DEFAULT 'KES',
  balance NUMERIC(18, 2) NOT NULL DEFAULT 0,
  available_balance NUMERIC(18, 2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT wallets_balance_nonneg CHECK (balance >= 0),
  CONSTRAINT wallets_available_nonneg CHECK (available_balance >= 0),
  CONSTRAINT wallets_available_lte_balance CHECK (available_balance <= balance)
);

CREATE UNIQUE INDEX wallets_user_currency_unique_idx ON public.wallets (user_id, currency);
CREATE INDEX wallets_user_id_idx ON public.wallets (user_id);

CREATE TABLE public.transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_id UUID NOT NULL REFERENCES public.wallets (id) ON DELETE RESTRICT,
  user_id UUID NOT NULL REFERENCES public.profiles (id) ON DELETE RESTRICT,
  jamiya_id UUID REFERENCES public.jamiyas (id) ON DELETE SET NULL,
  type public.transaction_type NOT NULL,
  status public.transaction_status NOT NULL DEFAULT 'pending',
  amount NUMERIC(18, 2) NOT NULL,
  currency CHAR(3) NOT NULL,
  direction TEXT NOT NULL,
  reference TEXT,
  idempotency_key TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  processed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT transactions_amount_positive CHECK (amount > 0),
  CONSTRAINT transactions_direction_check CHECK (direction IN ('debit', 'credit'))
);

CREATE UNIQUE INDEX transactions_idempotency_unique_idx
  ON public.transactions (idempotency_key)
  WHERE idempotency_key IS NOT NULL;

CREATE INDEX transactions_wallet_created_idx ON public.transactions (wallet_id, created_at DESC);
CREATE INDEX transactions_user_created_idx ON public.transactions (user_id, created_at DESC);
CREATE INDEX transactions_jamiya_idx ON public.transactions (jamiya_id) WHERE jamiya_id IS NOT NULL;
CREATE INDEX transactions_status_idx ON public.transactions (status);

-- Deferred FKs from contributions/payouts â†’ transactions
ALTER TABLE public.contributions
  ADD CONSTRAINT contributions_transaction_id_fkey
  FOREIGN KEY (transaction_id) REFERENCES public.transactions (id) ON DELETE SET NULL;

ALTER TABLE public.payouts
  ADD CONSTRAINT payouts_transaction_id_fkey
  FOREIGN KEY (transaction_id) REFERENCES public.transactions (id) ON DELETE SET NULL;

CREATE TABLE public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  type public.notification_type NOT NULL,
  channel public.notification_channel NOT NULL DEFAULT 'in_app',
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT notifications_title_length CHECK (char_length(trim(title)) BETWEEN 1 AND 200),
  CONSTRAINT notifications_body_length CHECK (char_length(trim(body)) BETWEEN 1 AND 2000)
);

CREATE INDEX notifications_user_created_idx ON public.notifications (user_id, created_at DESC);
CREATE INDEX notifications_user_unread_idx ON public.notifications (user_id)
  WHERE read_at IS NULL;

CREATE TABLE public.kyc_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  document_type public.kyc_document_type NOT NULL,
  status public.kyc_document_status NOT NULL DEFAULT 'uploaded',
  storage_path TEXT NOT NULL,
  file_name TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  file_size_bytes INTEGER NOT NULL,
  reviewed_by UUID REFERENCES public.profiles (id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  rejection_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT kyc_documents_file_size_positive CHECK (file_size_bytes > 0),
  CONSTRAINT kyc_documents_storage_path_not_empty CHECK (char_length(trim(storage_path)) > 0)
);

CREATE INDEX kyc_documents_user_idx ON public.kyc_documents (user_id);
CREATE INDEX kyc_documents_status_idx ON public.kyc_documents (status);
CREATE INDEX kyc_documents_reviewed_by_idx ON public.kyc_documents (reviewed_by)
  WHERE reviewed_by IS NOT NULL;

CREATE TABLE public.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id UUID REFERENCES public.profiles (id) ON DELETE SET NULL,
  action public.audit_action NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id UUID,
  jamiya_id UUID REFERENCES public.jamiyas (id) ON DELETE SET NULL,
  ip_address INET,
  user_agent TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT audit_logs_entity_type_not_empty CHECK (char_length(trim(entity_type)) > 0)
);

CREATE INDEX audit_logs_created_at_idx ON public.audit_logs (created_at DESC);
CREATE INDEX audit_logs_actor_idx ON public.audit_logs (actor_id) WHERE actor_id IS NOT NULL;
CREATE INDEX audit_logs_entity_idx ON public.audit_logs (entity_type, entity_id);
CREATE INDEX audit_logs_jamiya_idx ON public.audit_logs (jamiya_id) WHERE jamiya_id IS NOT NULL;

-- ============================================================================
-- RLS helper functions (private schema)
-- ============================================================================

CREATE OR REPLACE FUNCTION private.is_compliance_or_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT COALESCE(
    (
      SELECT platform_role IN (
        'compliance_officer',
        'platform_admin',
        'super_admin'
      )
      FROM public.profiles
      WHERE id = auth.uid()
    ),
    FALSE
  );
$$;

CREATE OR REPLACE FUNCTION private.is_jamiya_member(p_jamiya_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.members m
    WHERE m.jamiya_id = p_jamiya_id
      AND m.user_id = auth.uid()
      AND m.status IN ('active', 'invited')
  );
$$;

CREATE OR REPLACE FUNCTION private.is_active_jamiya_member(p_jamiya_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.members m
    WHERE m.jamiya_id = p_jamiya_id
      AND m.user_id = auth.uid()
      AND m.status = 'active'
  );
$$;

CREATE OR REPLACE FUNCTION private.is_circle_admin(p_jamiya_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.members m
    WHERE m.jamiya_id = p_jamiya_id
      AND m.user_id = auth.uid()
      AND m.role = 'circle_admin'
      AND m.status = 'active'
  )
  OR private.is_platform_admin();
$$;

CREATE OR REPLACE FUNCTION private.member_belongs_to_user(p_member_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.members m
    WHERE m.id = p_member_id
      AND m.user_id = auth.uid()
  );
$$;

CREATE OR REPLACE FUNCTION private.wallet_belongs_to_user(p_wallet_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.wallets w
    WHERE w.id = p_wallet_id
      AND w.user_id = auth.uid()
  );
$$;

-- ============================================================================
-- Triggers
-- ============================================================================

CREATE TRIGGER jamiyas_set_updated_at
  BEFORE UPDATE ON public.jamiyas
  FOR EACH ROW
  EXECUTE FUNCTION private.set_updated_at();

CREATE TRIGGER members_set_updated_at
  BEFORE UPDATE ON public.members
  FOR EACH ROW
  EXECUTE FUNCTION private.set_updated_at();

CREATE TRIGGER invitations_set_updated_at
  BEFORE UPDATE ON public.invitations
  FOR EACH ROW
  EXECUTE FUNCTION private.set_updated_at();

CREATE TRIGGER contributions_set_updated_at
  BEFORE UPDATE ON public.contributions
  FOR EACH ROW
  EXECUTE FUNCTION private.set_updated_at();

CREATE TRIGGER payouts_set_updated_at
  BEFORE UPDATE ON public.payouts
  FOR EACH ROW
  EXECUTE FUNCTION private.set_updated_at();

CREATE TRIGGER wallets_set_updated_at
  BEFORE UPDATE ON public.wallets
  FOR EACH ROW
  EXECUTE FUNCTION private.set_updated_at();

CREATE TRIGGER transactions_set_updated_at
  BEFORE UPDATE ON public.transactions
  FOR EACH ROW
  EXECUTE FUNCTION private.set_updated_at();

CREATE TRIGGER kyc_documents_set_updated_at
  BEFORE UPDATE ON public.kyc_documents
  FOR EACH ROW
  EXECUTE FUNCTION private.set_updated_at();

-- Auto-create default KES wallet when profile is created
CREATE OR REPLACE FUNCTION private.handle_new_profile_wallet()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.wallets (user_id, currency, balance, available_balance)
  VALUES (NEW.id, 'KES', 0, 0)
  ON CONFLICT (user_id, currency) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_profile_created_wallet
  AFTER INSERT ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION private.handle_new_profile_wallet();

-- Maintain jamiyas.member_count for active members
CREATE OR REPLACE FUNCTION private.sync_jamiya_member_count()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_jamiya_id UUID;
BEGIN
  v_jamiya_id := COALESCE(NEW.jamiya_id, OLD.jamiya_id);

  UPDATE public.jamiyas j
  SET member_count = (
    SELECT COUNT(*)::INTEGER
    FROM public.members m
    WHERE m.jamiya_id = v_jamiya_id
      AND m.status = 'active'
  ),
  updated_at = NOW()
  WHERE j.id = v_jamiya_id;

  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE TRIGGER members_sync_count_ins
  AFTER INSERT ON public.members
  FOR EACH ROW
  EXECUTE FUNCTION private.sync_jamiya_member_count();

CREATE TRIGGER members_sync_count_upd
  AFTER UPDATE OF status, jamiya_id ON public.members
  FOR EACH ROW
  EXECUTE FUNCTION private.sync_jamiya_member_count();

CREATE TRIGGER members_sync_count_del
  AFTER DELETE ON public.members
  FOR EACH ROW
  EXECUTE FUNCTION private.sync_jamiya_member_count();

-- When a jamiya is created, add creator as circle_admin member
CREATE OR REPLACE FUNCTION private.handle_jamiya_created()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.members (
    jamiya_id,
    user_id,
    role,
    status,
    payout_position,
    joined_at
  )
  VALUES (
    NEW.id,
    NEW.created_by,
    'circle_admin',
    'active',
    1,
    NOW()
  );

  RETURN NEW;
END;
$$;

CREATE TRIGGER on_jamiya_created_add_admin
  AFTER INSERT ON public.jamiyas
  FOR EACH ROW
  EXECUTE FUNCTION private.handle_jamiya_created();

-- Generic audit writer (callable from app / future triggers)
CREATE OR REPLACE FUNCTION private.write_audit_log(
  p_action public.audit_action,
  p_entity_type TEXT,
  p_entity_id UUID DEFAULT NULL,
  p_jamiya_id UUID DEFAULT NULL,
  p_metadata JSONB DEFAULT '{}'::jsonb
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_id UUID;
BEGIN
  INSERT INTO public.audit_logs (
    actor_id,
    action,
    entity_type,
    entity_id,
    jamiya_id,
    metadata
  )
  VALUES (
    auth.uid(),
    p_action,
    p_entity_type,
    p_entity_id,
    p_jamiya_id,
    COALESCE(p_metadata, '{}'::jsonb)
  )
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

-- ============================================================================
-- Row Level Security
-- ============================================================================

ALTER TABLE public.jamiyas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contributions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payouts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kyc_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- jamiyas
CREATE POLICY "jamiyas_select_member_or_admin"
  ON public.jamiyas FOR SELECT TO authenticated
  USING (
    private.is_platform_admin()
    OR created_by = auth.uid()
    OR private.is_jamiya_member(id)
    OR status IN ('open', 'active')
  );

CREATE POLICY "jamiyas_insert_authenticated"
  ON public.jamiyas FOR INSERT TO authenticated
  WITH CHECK (created_by = auth.uid());

CREATE POLICY "jamiyas_update_circle_admin"
  ON public.jamiyas FOR UPDATE TO authenticated
  USING (private.is_circle_admin(id))
  WITH CHECK (private.is_circle_admin(id));

CREATE POLICY "jamiyas_delete_platform_admin"
  ON public.jamiyas FOR DELETE TO authenticated
  USING (private.is_platform_admin());

-- members
CREATE POLICY "members_select_jamiya_visibility"
  ON public.members FOR SELECT TO authenticated
  USING (
    private.is_platform_admin()
    OR user_id = auth.uid()
    OR private.is_jamiya_member(jamiya_id)
  );

CREATE POLICY "members_insert_circle_admin"
  ON public.members FOR INSERT TO authenticated
  WITH CHECK (
    private.is_circle_admin(jamiya_id)
    OR (
      user_id = auth.uid()
      AND role = 'member'
      AND status IN ('active', 'invited')
    )
  );

CREATE POLICY "members_update_circle_admin_or_self"
  ON public.members FOR UPDATE TO authenticated
  USING (
    private.is_circle_admin(jamiya_id)
    OR user_id = auth.uid()
  )
  WITH CHECK (
    private.is_circle_admin(jamiya_id)
    OR (
      user_id = auth.uid()
      AND role = (SELECT m.role FROM public.members m WHERE m.id = id)
    )
  );

CREATE POLICY "members_delete_platform_admin"
  ON public.members FOR DELETE TO authenticated
  USING (private.is_platform_admin());

-- invitations
CREATE POLICY "invitations_select"
  ON public.invitations FOR SELECT TO authenticated
  USING (
    private.is_circle_admin(jamiya_id)
    OR invited_by = auth.uid()
    OR invitee_user_id = auth.uid()
    OR private.is_platform_admin()
  );

CREATE POLICY "invitations_insert_circle_admin"
  ON public.invitations FOR INSERT TO authenticated
  WITH CHECK (
    private.is_circle_admin(jamiya_id)
    AND invited_by = auth.uid()
  );

CREATE POLICY "invitations_update_admin_or_invitee"
  ON public.invitations FOR UPDATE TO authenticated
  USING (
    private.is_circle_admin(jamiya_id)
    OR invitee_user_id = auth.uid()
  )
  WITH CHECK (
    private.is_circle_admin(jamiya_id)
    OR invitee_user_id = auth.uid()
  );

-- contributions
CREATE POLICY "contributions_select"
  ON public.contributions FOR SELECT TO authenticated
  USING (
    private.is_platform_admin()
    OR private.is_jamiya_member(jamiya_id)
  );

CREATE POLICY "contributions_insert_circle_admin"
  ON public.contributions FOR INSERT TO authenticated
  WITH CHECK (private.is_circle_admin(jamiya_id));

CREATE POLICY "contributions_update_admin_or_owner"
  ON public.contributions FOR UPDATE TO authenticated
  USING (
    private.is_circle_admin(jamiya_id)
    OR private.member_belongs_to_user(member_id)
    OR private.is_platform_admin()
  )
  WITH CHECK (
    private.is_circle_admin(jamiya_id)
    OR private.member_belongs_to_user(member_id)
    OR private.is_platform_admin()
  );

-- payouts
CREATE POLICY "payouts_select"
  ON public.payouts FOR SELECT TO authenticated
  USING (
    private.is_platform_admin()
    OR private.is_jamiya_member(jamiya_id)
  );

CREATE POLICY "payouts_insert_circle_admin"
  ON public.payouts FOR INSERT TO authenticated
  WITH CHECK (private.is_circle_admin(jamiya_id) OR private.is_platform_admin());

CREATE POLICY "payouts_update_admin"
  ON public.payouts FOR UPDATE TO authenticated
  USING (private.is_circle_admin(jamiya_id) OR private.is_platform_admin())
  WITH CHECK (private.is_circle_admin(jamiya_id) OR private.is_platform_admin());

-- wallets
CREATE POLICY "wallets_select_own"
  ON public.wallets FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR private.is_platform_admin());

-- No direct wallet inserts/updates from clients â€” trigger owns default wallet;
-- balance mutations go through SECURITY DEFINER ledger functions / service role.
REVOKE INSERT, UPDATE, DELETE ON public.wallets FROM authenticated, anon;
GRANT SELECT ON public.wallets TO authenticated;

-- transactions (read own; writes via service role / SECURITY DEFINER ledger fns)
CREATE POLICY "transactions_select_own"
  ON public.transactions FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR private.wallet_belongs_to_user(wallet_id)
    OR private.is_platform_admin()
  );

CREATE POLICY "transactions_update_platform_admin"
  ON public.transactions FOR UPDATE TO authenticated
  USING (private.is_platform_admin())
  WITH CHECK (private.is_platform_admin());

REVOKE INSERT, DELETE ON public.transactions FROM authenticated, anon;
GRANT SELECT, UPDATE ON public.transactions TO authenticated;
-- notifications
CREATE POLICY "notifications_select_own"
  ON public.notifications FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR private.is_platform_admin());

CREATE POLICY "notifications_update_own"
  ON public.notifications FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "notifications_insert_system_or_admin"
  ON public.notifications FOR INSERT TO authenticated
  WITH CHECK (
    private.is_platform_admin()
    OR user_id = auth.uid()
  );

CREATE POLICY "notifications_delete_own"
  ON public.notifications FOR DELETE TO authenticated
  USING (user_id = auth.uid() OR private.is_platform_admin());

-- kyc_documents
CREATE POLICY "kyc_documents_select"
  ON public.kyc_documents FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR private.is_compliance_or_admin()
  );

CREATE POLICY "kyc_documents_insert_own"
  ON public.kyc_documents FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "kyc_documents_update_compliance"
  ON public.kyc_documents FOR UPDATE TO authenticated
  USING (
    user_id = auth.uid()
    OR private.is_compliance_or_admin()
  )
  WITH CHECK (
    (
      user_id = auth.uid()
      AND status = 'uploaded'
    )
    OR private.is_compliance_or_admin()
  );

-- audit_logs: insert via private.write_audit_log / service role; readable by admins
CREATE POLICY "audit_logs_select_admin"
  ON public.audit_logs FOR SELECT TO authenticated
  USING (private.is_compliance_or_admin());

CREATE POLICY "audit_logs_insert_authenticated"
  ON public.audit_logs FOR INSERT TO authenticated
  WITH CHECK (actor_id = auth.uid() OR actor_id IS NULL);

REVOKE UPDATE, DELETE ON public.audit_logs FROM authenticated, anon;
GRANT SELECT, INSERT ON public.audit_logs TO authenticated;

-- Table grants
GRANT SELECT, INSERT, UPDATE, DELETE ON public.jamiyas TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.members TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.invitations TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.contributions TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.payouts TO authenticated;
GRANT SELECT, UPDATE ON public.transactions TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.notifications TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.kyc_documents TO authenticated;

-- ============================================================================
-- Storage: KYC documents bucket
-- ============================================================================

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'kyc-documents',
  'kyc-documents',
  FALSE,
  10485760,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
)
ON CONFLICT (id) DO UPDATE
SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Paths: {user_id}/{document_id}/{filename}
CREATE POLICY "kyc_storage_select_own_or_compliance"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'kyc-documents'
    AND (
      (storage.foldername(name))[1] = auth.uid()::text
      OR private.is_compliance_or_admin()
    )
  );

CREATE POLICY "kyc_storage_insert_own"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'kyc-documents'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "kyc_storage_update_own"
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'kyc-documents'
    AND (storage.foldername(name))[1] = auth.uid()::text
  )
  WITH CHECK (
    bucket_id = 'kyc-documents'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "kyc_storage_delete_own_or_admin"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'kyc-documents'
    AND (
      (storage.foldername(name))[1] = auth.uid()::text
      OR private.is_platform_admin()
    )
  );




-- ========== 20260722193602_invitation_accept_rpc.sql ==========

-- Phase 1.6: Invitation accept/decline RPCs
-- Token hashing is performed in the application (SHA-256 hex). RPCs take token_hash.

CREATE OR REPLACE FUNCTION private.preview_invitation(p_token_hash TEXT)
RETURNS TABLE (
  invitation_id UUID,
  jamiya_id UUID,
  jamiya_name TEXT,
  jamiya_slug TEXT,
  status public.invitation_status,
  email TEXT,
  phone TEXT,
  expires_at TIMESTAMPTZ,
  invited_by_name TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  RETURN QUERY
  SELECT
    i.id,
    i.jamiya_id,
    j.name,
    j.slug,
    i.status,
    i.email,
    i.phone,
    i.expires_at,
    p.full_name
  FROM public.invitations i
  JOIN public.jamiyas j ON j.id = i.jamiya_id
  JOIN public.profiles p ON p.id = i.invited_by
  WHERE i.token_hash = p_token_hash;
END;
$$;

CREATE OR REPLACE FUNCTION private.accept_invitation(p_token_hash TEXT)
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
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'UNAUTHENTICATED');
  END IF;

  SELECT * INTO v_inv
  FROM public.invitations
  WHERE token_hash = p_token_hash
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

  SELECT COALESCE(MAX(payout_position), 0) + 1
  INTO v_next_position
  FROM public.members
  WHERE jamiya_id = v_inv.jamiya_id;

  INSERT INTO public.members (
    jamiya_id, user_id, role, status, payout_position, joined_at
  )
  VALUES (
    v_inv.jamiya_id, v_uid, 'member', 'active', v_next_position, NOW()
  )
  ON CONFLICT (jamiya_id, user_id) DO UPDATE
  SET
    status = 'active',
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
    jsonb_build_object('member_id', v_member_id, 'slug', v_jamiya.slug)
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
    'member_id', v_member_id
  );
END;
$$;

CREATE OR REPLACE FUNCTION private.decline_invitation(p_token_hash TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_inv public.invitations%ROWTYPE;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'UNAUTHENTICATED');
  END IF;

  SELECT * INTO v_inv
  FROM public.invitations
  WHERE token_hash = p_token_hash
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'NOT_FOUND');
  END IF;

  IF v_inv.status <> 'pending' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'NOT_PENDING');
  END IF;

  UPDATE public.invitations
  SET
    status = 'declined',
    invitee_user_id = COALESCE(invitee_user_id, v_uid),
    updated_at = NOW()
  WHERE id = v_inv.id;

  INSERT INTO public.audit_logs (actor_id, action, entity_type, entity_id, jamiya_id, metadata)
  VALUES (v_uid, 'reject', 'invitation', v_inv.id, v_inv.jamiya_id, '{}'::jsonb);

  RETURN jsonb_build_object('ok', true);
END;
$$;

CREATE OR REPLACE FUNCTION public.preview_invitation(p_token_hash TEXT)
RETURNS TABLE (
  invitation_id UUID,
  jamiya_id UUID,
  jamiya_name TEXT,
  jamiya_slug TEXT,
  status public.invitation_status,
  email TEXT,
  phone TEXT,
  expires_at TIMESTAMPTZ,
  invited_by_name TEXT
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT * FROM private.preview_invitation(p_token_hash);
$$;

CREATE OR REPLACE FUNCTION public.accept_invitation(p_token_hash TEXT)
RETURNS JSONB
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT private.accept_invitation(p_token_hash);
$$;

CREATE OR REPLACE FUNCTION public.decline_invitation(p_token_hash TEXT)
RETURNS JSONB
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT private.decline_invitation(p_token_hash);
$$;

REVOKE ALL ON FUNCTION public.preview_invitation(TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.accept_invitation(TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.decline_invitation(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.preview_invitation(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.accept_invitation(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.decline_invitation(TEXT) TO authenticated;

CREATE POLICY "invitations_select_email_match"
  ON public.invitations
  FOR SELECT
  TO authenticated
  USING (
    email IS NOT NULL
    AND lower(email) = lower((SELECT p.email FROM public.profiles p WHERE p.id = auth.uid()))
  );

-- Auto-move KYC status to pending when a document is uploaded
CREATE OR REPLACE FUNCTION private.on_kyc_document_uploaded()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  UPDATE public.profiles
  SET
    kyc_status = 'pending',
    updated_at = NOW()
  WHERE id = NEW.user_id
    AND kyc_status IN ('not_started', 'rejected');
  RETURN NEW;
END;
$$;

CREATE TRIGGER kyc_documents_set_profile_pending
  AFTER INSERT ON public.kyc_documents
  FOR EACH ROW
  EXECUTE FUNCTION private.on_kyc_document_uploaded();

-- Compliance/admin KYC review (bypasses profiles self-update restrictions)
CREATE OR REPLACE FUNCTION private.review_kyc_document(
  p_document_id UUID,
  p_decision public.kyc_document_status,
  p_reason TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_doc public.kyc_documents%ROWTYPE;
BEGIN
  IF v_uid IS NULL OR NOT private.is_compliance_or_admin() THEN
    RETURN jsonb_build_object('ok', false, 'error', 'FORBIDDEN');
  END IF;

  IF p_decision NOT IN ('approved', 'rejected') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'INVALID_DECISION');
  END IF;

  SELECT * INTO v_doc FROM public.kyc_documents WHERE id = p_document_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'NOT_FOUND');
  END IF;

  UPDATE public.kyc_documents
  SET
    status = p_decision,
    reviewed_by = v_uid,
    reviewed_at = NOW(),
    rejection_reason = CASE WHEN p_decision = 'rejected' THEN COALESCE(p_reason, 'Rejected') ELSE NULL END,
    updated_at = NOW()
  WHERE id = p_document_id;

  UPDATE public.profiles
  SET
    kyc_status = CASE WHEN p_decision = 'approved' THEN 'approved'::public.kyc_status ELSE 'rejected'::public.kyc_status END,
    updated_at = NOW()
  WHERE id = v_doc.user_id;

  INSERT INTO public.notifications (user_id, type, channel, title, body, data)
  VALUES (
    v_doc.user_id,
    'kyc_update',
    'in_app',
    CASE WHEN p_decision = 'approved' THEN 'KYC approved' ELSE 'KYC rejected' END,
    CASE
      WHEN p_decision = 'approved' THEN 'Your identity documents were approved.'
      ELSE 'Your identity documents were rejected' || CASE WHEN p_reason IS NULL OR p_reason = '' THEN '.' ELSE ': ' || p_reason END
    END,
    jsonb_build_object('document_id', p_document_id, 'decision', p_decision)
  );

  INSERT INTO public.audit_logs (actor_id, action, entity_type, entity_id, metadata)
  VALUES (
    v_uid,
    CASE WHEN p_decision = 'approved' THEN 'approve'::public.audit_action ELSE 'reject'::public.audit_action END,
    'kyc_document',
    p_document_id,
    jsonb_build_object('decision', p_decision, 'reason', p_reason)
  );

  RETURN jsonb_build_object('ok', true);
END;
$$;

CREATE OR REPLACE FUNCTION public.review_kyc_document(
  p_document_id UUID,
  p_decision public.kyc_document_status,
  p_reason TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT private.review_kyc_document(p_document_id, p_decision, p_reason);
$$;

REVOKE ALL ON FUNCTION public.review_kyc_document(UUID, public.kyc_document_status, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.review_kyc_document(UUID, public.kyc_document_status, TEXT) TO authenticated;




-- ========== 20260722212848_phase2_ledger_and_schedules.sql ==========

-- Phase 2: Ledger mutations, schedule generation, settlement, late marking
-- Wallet writes remain locked to SECURITY DEFINER functions only.

-- ---------------------------------------------------------------------------
-- Ledger: credit wallet (top-up / payout)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION private.ledger_credit(
  p_user_id UUID,
  p_currency CHAR(3),
  p_amount NUMERIC,
  p_type public.transaction_type,
  p_jamiya_id UUID DEFAULT NULL,
  p_reference TEXT DEFAULT NULL,
  p_idempotency_key TEXT DEFAULT NULL,
  p_metadata JSONB DEFAULT '{}'::jsonb
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_wallet public.wallets%ROWTYPE;
  v_tx_id UUID;
BEGIN
  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'INVALID_AMOUNT';
  END IF;

  IF p_idempotency_key IS NOT NULL THEN
    SELECT id INTO v_tx_id FROM public.transactions WHERE idempotency_key = p_idempotency_key;
    IF FOUND THEN
      RETURN v_tx_id;
    END IF;
  END IF;

  SELECT * INTO v_wallet
  FROM public.wallets
  WHERE user_id = p_user_id AND currency = p_currency
  FOR UPDATE;

  IF NOT FOUND THEN
    INSERT INTO public.wallets (user_id, currency, balance, available_balance)
    VALUES (p_user_id, p_currency, 0, 0)
    RETURNING * INTO v_wallet;
  END IF;

  UPDATE public.wallets
  SET
    balance = balance + p_amount,
    available_balance = available_balance + p_amount,
    updated_at = NOW()
  WHERE id = v_wallet.id;

  INSERT INTO public.transactions (
    wallet_id, user_id, jamiya_id, type, status, amount, currency,
    direction, reference, idempotency_key, metadata, processed_at
  )
  VALUES (
    v_wallet.id, p_user_id, p_jamiya_id, p_type, 'completed', p_amount, p_currency,
    'credit', p_reference, p_idempotency_key, COALESCE(p_metadata, '{}'::jsonb), NOW()
  )
  RETURNING id INTO v_tx_id;

  RETURN v_tx_id;
END;
$$;

CREATE OR REPLACE FUNCTION private.ledger_debit(
  p_user_id UUID,
  p_currency CHAR(3),
  p_amount NUMERIC,
  p_type public.transaction_type,
  p_jamiya_id UUID DEFAULT NULL,
  p_reference TEXT DEFAULT NULL,
  p_idempotency_key TEXT DEFAULT NULL,
  p_metadata JSONB DEFAULT '{}'::jsonb
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_wallet public.wallets%ROWTYPE;
  v_tx_id UUID;
BEGIN
  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'INVALID_AMOUNT';
  END IF;

  IF p_idempotency_key IS NOT NULL THEN
    SELECT id INTO v_tx_id FROM public.transactions WHERE idempotency_key = p_idempotency_key;
    IF FOUND THEN
      RETURN v_tx_id;
    END IF;
  END IF;

  SELECT * INTO v_wallet
  FROM public.wallets
  WHERE user_id = p_user_id AND currency = p_currency
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'WALLET_NOT_FOUND';
  END IF;

  IF v_wallet.available_balance < p_amount THEN
    RAISE EXCEPTION 'INSUFFICIENT_FUNDS';
  END IF;

  UPDATE public.wallets
  SET
    balance = balance - p_amount,
    available_balance = available_balance - p_amount,
    updated_at = NOW()
  WHERE id = v_wallet.id;

  INSERT INTO public.transactions (
    wallet_id, user_id, jamiya_id, type, status, amount, currency,
    direction, reference, idempotency_key, metadata, processed_at
  )
  VALUES (
    v_wallet.id, p_user_id, p_jamiya_id, p_type, 'completed', p_amount, p_currency,
    'debit', p_reference, p_idempotency_key, COALESCE(p_metadata, '{}'::jsonb), NOW()
  )
  RETURNING id INTO v_tx_id;

  RETURN v_tx_id;
END;
$$;

-- ---------------------------------------------------------------------------
-- Public: wallet top-up (simulated funding for Phase 2)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.wallet_top_up(
  p_amount NUMERIC,
  p_currency CHAR(3) DEFAULT 'KES',
  p_idempotency_key TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_tx UUID;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'UNAUTHENTICATED');
  END IF;
  IF p_amount IS NULL OR p_amount < 100 OR p_amount > 10000000 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'INVALID_AMOUNT');
  END IF;

  v_tx := private.ledger_credit(
    v_uid, p_currency, p_amount, 'wallet_top_up', NULL,
    'top_up', p_idempotency_key, jsonb_build_object('source', 'simulated')
  );

  INSERT INTO public.audit_logs (actor_id, action, entity_type, entity_id, metadata)
  VALUES (v_uid, 'create', 'transaction', v_tx, jsonb_build_object('type', 'wallet_top_up', 'amount', p_amount));

  RETURN jsonb_build_object('ok', true, 'transaction_id', v_tx);
END;
$$;

-- ---------------------------------------------------------------------------
-- Generate contribution + payout schedules and activate circle
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.activate_jamiya(p_jamiya_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_jamiya public.jamiyas%ROWTYPE;
  v_member RECORD;
  v_cycle INT;
  v_due DATE;
  v_start DATE;
  v_contrib_count INT := 0;
  v_payout_count INT := 0;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'UNAUTHENTICATED');
  END IF;

  IF NOT private.is_circle_admin(p_jamiya_id) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'FORBIDDEN');
  END IF;

  SELECT * INTO v_jamiya FROM public.jamiyas WHERE id = p_jamiya_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'NOT_FOUND');
  END IF;

  IF v_jamiya.status = 'active' THEN
    RETURN jsonb_build_object('ok', true, 'already_active', true);
  END IF;

  IF v_jamiya.member_count < 2 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'NOT_ENOUGH_MEMBERS');
  END IF;

  -- Ensure every active member has a payout position
  v_cycle := 1;
  FOR v_member IN
    SELECT * FROM public.members
    WHERE jamiya_id = p_jamiya_id AND status = 'active'
    ORDER BY payout_position NULLS LAST, created_at
  LOOP
    IF v_member.payout_position IS NULL THEN
      UPDATE public.members SET payout_position = v_cycle, updated_at = NOW()
      WHERE id = v_member.id;
    END IF;
    v_cycle := v_cycle + 1;
  END LOOP;

  v_start := COALESCE(v_jamiya.start_date, CURRENT_DATE);

  -- Contributions: one per active member per cycle (1..cycle_count)
  FOR v_cycle IN 1..v_jamiya.cycle_count LOOP
    v_due := v_start + ((v_cycle - 1) * v_jamiya.contribution_frequency_days);

    FOR v_member IN
      SELECT * FROM public.members
      WHERE jamiya_id = p_jamiya_id AND status = 'active'
    LOOP
      INSERT INTO public.contributions (
        jamiya_id, member_id, cycle_number, amount, currency, status, due_date
      )
      VALUES (
        p_jamiya_id, v_member.id, v_cycle, v_jamiya.contribution_amount,
        v_jamiya.currency, 'pending', v_due
      )
      ON CONFLICT (member_id, cycle_number) DO NOTHING;
      v_contrib_count := v_contrib_count + 1;
    END LOOP;
  END LOOP;

  -- Payouts: one recipient per cycle by payout_position
  FOR v_member IN
    SELECT * FROM public.members
    WHERE jamiya_id = p_jamiya_id AND status = 'active' AND payout_position IS NOT NULL
    ORDER BY payout_position
  LOOP
    IF v_member.payout_position > v_jamiya.cycle_count THEN
      CONTINUE;
    END IF;
    v_due := v_start + ((v_member.payout_position - 1) * v_jamiya.contribution_frequency_days);
    INSERT INTO public.payouts (
      jamiya_id, member_id, cycle_number, amount, currency, status, scheduled_date
    )
    VALUES (
      p_jamiya_id,
      v_member.id,
      v_member.payout_position,
      v_jamiya.contribution_amount * v_jamiya.member_count,
      v_jamiya.currency,
      'scheduled',
      v_due
    )
    ON CONFLICT (jamiya_id, cycle_number) DO NOTHING;
    v_payout_count := v_payout_count + 1;
  END LOOP;

  UPDATE public.jamiyas
  SET status = 'active', current_cycle = 1, start_date = v_start, updated_at = NOW()
  WHERE id = p_jamiya_id;

  INSERT INTO public.audit_logs (actor_id, action, entity_type, entity_id, jamiya_id, metadata)
  VALUES (
    v_uid, 'update', 'jamiya', p_jamiya_id, p_jamiya_id,
    jsonb_build_object('activated', true, 'contributions', v_contrib_count, 'payouts', v_payout_count)
  );

  INSERT INTO public.notifications (user_id, type, channel, title, body, data)
  SELECT
    m.user_id,
    'system',
    'in_app',
    'Circle activated',
    v_jamiya.name || ' is now active. Contributions are on the schedule.',
    jsonb_build_object('jamiya_id', p_jamiya_id, 'slug', v_jamiya.slug)
  FROM public.members m
  WHERE m.jamiya_id = p_jamiya_id AND m.status = 'active';

  RETURN jsonb_build_object(
    'ok', true,
    'contributions_created', v_contrib_count,
    'payouts_created', v_payout_count
  );
END;
$$;

-- ---------------------------------------------------------------------------
-- Pay a contribution from the caller's wallet
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.pay_contribution(p_contribution_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_c public.contributions%ROWTYPE;
  v_member public.members%ROWTYPE;
  v_tx UUID;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'UNAUTHENTICATED');
  END IF;

  SELECT * INTO v_c FROM public.contributions WHERE id = p_contribution_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'NOT_FOUND');
  END IF;

  IF v_c.status NOT IN ('pending', 'late') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'NOT_PAYABLE');
  END IF;

  SELECT * INTO v_member FROM public.members WHERE id = v_c.member_id;
  IF v_member.user_id <> v_uid THEN
    RETURN jsonb_build_object('ok', false, 'error', 'FORBIDDEN');
  END IF;

  BEGIN
    v_tx := private.ledger_debit(
      v_uid, v_c.currency, v_c.amount, 'contribution', v_c.jamiya_id,
      'contribution:' || v_c.id::text,
      'pay_contribution:' || v_c.id::text,
      jsonb_build_object('contribution_id', v_c.id, 'cycle', v_c.cycle_number)
    );
  EXCEPTION
    WHEN OTHERS THEN
      IF SQLERRM = 'INSUFFICIENT_FUNDS' THEN
        RETURN jsonb_build_object('ok', false, 'error', 'INSUFFICIENT_FUNDS');
      END IF;
      RAISE;
  END;

  UPDATE public.contributions
  SET status = 'paid', paid_at = NOW(), transaction_id = v_tx, updated_at = NOW()
  WHERE id = v_c.id;

  INSERT INTO public.notifications (user_id, type, channel, title, body, data)
  SELECT
    m.user_id,
    'contribution_received',
    'in_app',
    'Contribution received',
    'A member paid cycle ' || v_c.cycle_number || ' contribution.',
    jsonb_build_object('jamiya_id', v_c.jamiya_id, 'contribution_id', v_c.id)
  FROM public.members m
  WHERE m.jamiya_id = v_c.jamiya_id
    AND m.role = 'circle_admin'
    AND m.status = 'active';

  RETURN jsonb_build_object('ok', true, 'transaction_id', v_tx);
END;
$$;

-- ---------------------------------------------------------------------------
-- Settle a payout when all contributions for that cycle are paid
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
  v_unpaid INT;
  v_tx UUID;
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

  SELECT COUNT(*) INTO v_unpaid
  FROM public.contributions
  WHERE jamiya_id = v_p.jamiya_id
    AND cycle_number = v_p.cycle_number
    AND status NOT IN ('paid', 'waived');

  IF v_unpaid > 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'CYCLE_INCOMPLETE', 'unpaid', v_unpaid);
  END IF;

  SELECT * INTO v_member FROM public.members WHERE id = v_p.member_id;

  UPDATE public.payouts SET status = 'processing', updated_at = NOW() WHERE id = v_p.id;

  v_tx := private.ledger_credit(
    v_member.user_id, v_p.currency, v_p.amount, 'payout', v_p.jamiya_id,
    'payout:' || v_p.id::text,
    'settle_payout:' || v_p.id::text,
    jsonb_build_object('payout_id', v_p.id, 'cycle', v_p.cycle_number)
  );

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
    jsonb_build_object('payout_id', v_p.id, 'jamiya_id', v_p.jamiya_id)
  );

  INSERT INTO public.audit_logs (actor_id, action, entity_type, entity_id, jamiya_id, metadata)
  VALUES (v_uid, 'approve', 'payout', v_p.id, v_p.jamiya_id, jsonb_build_object('transaction_id', v_tx));

  RETURN jsonb_build_object('ok', true, 'transaction_id', v_tx);
END;
$$;

-- ---------------------------------------------------------------------------
-- Mark overdue contributions as late (callable by edge/cron / admins)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.mark_late_contributions()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_count INT;
BEGIN
  UPDATE public.contributions
  SET status = 'late', updated_at = NOW()
  WHERE status = 'pending'
    AND due_date < CURRENT_DATE;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN jsonb_build_object('ok', true, 'updated', v_count);
END;
$$;

-- ---------------------------------------------------------------------------
-- Service-role settle (for Edge Function batch settlement; no auth.uid())
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.service_settle_payout(p_payout_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_p public.payouts%ROWTYPE;
  v_member public.members%ROWTYPE;
  v_unpaid INT;
  v_tx UUID;
BEGIN
  -- Only callable with service_role JWT (auth.role() = service_role)
  IF coalesce(auth.role(), '') <> 'service_role' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'FORBIDDEN');
  END IF;

  SELECT * INTO v_p FROM public.payouts WHERE id = p_payout_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'NOT_FOUND');
  END IF;

  IF v_p.status NOT IN ('scheduled', 'processing') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'NOT_SETTLEABLE');
  END IF;

  SELECT COUNT(*) INTO v_unpaid
  FROM public.contributions
  WHERE jamiya_id = v_p.jamiya_id
    AND cycle_number = v_p.cycle_number
    AND status NOT IN ('paid', 'waived');

  IF v_unpaid > 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'CYCLE_INCOMPLETE', 'unpaid', v_unpaid);
  END IF;

  SELECT * INTO v_member FROM public.members WHERE id = v_p.member_id;

  UPDATE public.payouts SET status = 'processing', updated_at = NOW() WHERE id = v_p.id;

  v_tx := private.ledger_credit(
    v_member.user_id, v_p.currency, v_p.amount, 'payout', v_p.jamiya_id,
    'payout:' || v_p.id::text,
    'settle_payout:' || v_p.id::text,
    jsonb_build_object('payout_id', v_p.id, 'cycle', v_p.cycle_number, 'source', 'service')
  );

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
    jsonb_build_object('payout_id', v_p.id, 'jamiya_id', v_p.jamiya_id)
  );

  INSERT INTO public.audit_logs (actor_id, action, entity_type, entity_id, jamiya_id, metadata)
  VALUES (NULL, 'approve', 'payout', v_p.id, v_p.jamiya_id, jsonb_build_object('transaction_id', v_tx, 'source', 'service'));

  RETURN jsonb_build_object('ok', true, 'transaction_id', v_tx);
END;
$$;

-- ---------------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------------
REVOKE ALL ON FUNCTION public.wallet_top_up(NUMERIC, CHAR, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.activate_jamiya(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.pay_contribution(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.settle_payout(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.mark_late_contributions() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.service_settle_payout(UUID) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.wallet_top_up(NUMERIC, CHAR, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.activate_jamiya(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.pay_contribution(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.settle_payout(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.mark_late_contributions() TO authenticated;
GRANT EXECUTE ON FUNCTION public.mark_late_contributions() TO service_role;
GRANT EXECUTE ON FUNCTION public.service_settle_payout(UUID) TO service_role;

-- Realtime for notifications (idempotent)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'notifications'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
  END IF;
END $$;




-- ========== 20260723122359_phase3_payments_notify_disputes.sql ==========

-- Phase 3: Payment intents (M-Pesa), notification outbox, disputes, KYC payout gate

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------
CREATE TYPE public.payment_provider AS ENUM ('simulated', 'mpesa', 'bank');
CREATE TYPE public.payment_intent_status AS ENUM (
  'pending',
  'processing',
  'completed',
  'failed',
  'cancelled',
  'expired'
);
CREATE TYPE public.delivery_status AS ENUM (
  'pending',
  'processing',
  'sent',
  'failed',
  'skipped'
);
CREATE TYPE public.dispute_status AS ENUM (
  'open',
  'under_review',
  'resolved',
  'rejected',
  'cancelled'
);
CREATE TYPE public.dispute_type AS ENUM (
  'missed_contribution',
  'payout_delay',
  'incorrect_amount',
  'membership',
  'other'
);

-- ---------------------------------------------------------------------------
-- payment_intents
-- ---------------------------------------------------------------------------
CREATE TABLE public.payment_intents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  provider public.payment_provider NOT NULL DEFAULT 'simulated',
  status public.payment_intent_status NOT NULL DEFAULT 'pending',
  amount NUMERIC(14, 2) NOT NULL CHECK (amount > 0),
  currency CHAR(3) NOT NULL DEFAULT 'KES',
  phone TEXT,
  provider_reference TEXT,
  checkout_request_id TEXT,
  merchant_request_id TEXT,
  transaction_id UUID REFERENCES public.transactions (id) ON DELETE SET NULL,
  idempotency_key TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  error_message TEXT,
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '15 minutes'),
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX payment_intents_idempotency_unique_idx
  ON public.payment_intents (idempotency_key)
  WHERE idempotency_key IS NOT NULL;

CREATE INDEX payment_intents_user_created_idx
  ON public.payment_intents (user_id, created_at DESC);

CREATE INDEX payment_intents_provider_ref_idx
  ON public.payment_intents (provider_reference)
  WHERE provider_reference IS NOT NULL;

CREATE INDEX payment_intents_checkout_idx
  ON public.payment_intents (checkout_request_id)
  WHERE checkout_request_id IS NOT NULL;

CREATE TRIGGER payment_intents_set_updated_at
  BEFORE UPDATE ON public.payment_intents
  FOR EACH ROW EXECUTE FUNCTION private.set_updated_at();

ALTER TABLE public.payment_intents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "payment_intents_select_own"
  ON public.payment_intents FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR private.is_compliance_or_admin());

CREATE POLICY "payment_intents_insert_own"
  ON public.payment_intents FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

-- Updates via SECURITY DEFINER / service role only
REVOKE UPDATE, DELETE ON public.payment_intents FROM authenticated, anon;
GRANT SELECT, INSERT ON public.payment_intents TO authenticated;

-- ---------------------------------------------------------------------------
-- notification_outbox (email/sms delivery queue)
-- ---------------------------------------------------------------------------
CREATE TABLE public.notification_outbox (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  notification_id UUID REFERENCES public.notifications (id) ON DELETE SET NULL,
  user_id UUID REFERENCES public.profiles (id) ON DELETE SET NULL,
  channel public.notification_channel NOT NULL,
  recipient TEXT NOT NULL,
  subject TEXT,
  body TEXT NOT NULL,
  status public.delivery_status NOT NULL DEFAULT 'pending',
  attempts INT NOT NULL DEFAULT 0,
  last_error TEXT,
  scheduled_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  sent_at TIMESTAMPTZ,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT notification_outbox_channel_delivery CHECK (channel IN ('email', 'sms'))
);

CREATE INDEX notification_outbox_pending_idx
  ON public.notification_outbox (status, scheduled_at)
  WHERE status IN ('pending', 'failed');

CREATE TRIGGER notification_outbox_set_updated_at
  BEFORE UPDATE ON public.notification_outbox
  FOR EACH ROW EXECUTE FUNCTION private.set_updated_at();

ALTER TABLE public.notification_outbox ENABLE ROW LEVEL SECURITY;

CREATE POLICY "notification_outbox_select_admin"
  ON public.notification_outbox FOR SELECT TO authenticated
  USING (private.is_compliance_or_admin());

REVOKE INSERT, UPDATE, DELETE ON public.notification_outbox FROM authenticated, anon;
GRANT SELECT ON public.notification_outbox TO authenticated;

-- ---------------------------------------------------------------------------
-- disputes
-- ---------------------------------------------------------------------------
CREATE TABLE public.disputes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  jamiya_id UUID NOT NULL REFERENCES public.jamiyas (id) ON DELETE CASCADE,
  opened_by UUID NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  against_user_id UUID REFERENCES public.profiles (id) ON DELETE SET NULL,
  type public.dispute_type NOT NULL DEFAULT 'other',
  status public.dispute_status NOT NULL DEFAULT 'open',
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  resolution_notes TEXT,
  resolved_by UUID REFERENCES public.profiles (id) ON DELETE SET NULL,
  resolved_at TIMESTAMPTZ,
  risk_score INT NOT NULL DEFAULT 0 CHECK (risk_score BETWEEN 0 AND 100),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT disputes_title_length CHECK (char_length(trim(title)) BETWEEN 3 AND 200),
  CONSTRAINT disputes_description_length CHECK (char_length(trim(description)) BETWEEN 10 AND 4000)
);

CREATE INDEX disputes_jamiya_status_idx ON public.disputes (jamiya_id, status);
CREATE INDEX disputes_opened_by_idx ON public.disputes (opened_by);
CREATE INDEX disputes_status_created_idx ON public.disputes (status, created_at DESC);

CREATE TRIGGER disputes_set_updated_at
  BEFORE UPDATE ON public.disputes
  FOR EACH ROW EXECUTE FUNCTION private.set_updated_at();

ALTER TABLE public.disputes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "disputes_select_member_or_admin"
  ON public.disputes FOR SELECT TO authenticated
  USING (
    private.is_compliance_or_admin()
    OR opened_by = auth.uid()
    OR private.is_active_jamiya_member(jamiya_id)
  );

CREATE POLICY "disputes_insert_member"
  ON public.disputes FOR INSERT TO authenticated
  WITH CHECK (
    opened_by = auth.uid()
    AND private.is_active_jamiya_member(jamiya_id)
  );

CREATE POLICY "disputes_update_admin"
  ON public.disputes FOR UPDATE TO authenticated
  USING (private.is_compliance_or_admin())
  WITH CHECK (private.is_compliance_or_admin());

GRANT SELECT, INSERT ON public.disputes TO authenticated;
GRANT UPDATE ON public.disputes TO authenticated;

-- ---------------------------------------------------------------------------
-- Helper: enqueue email/sms outbox row
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION private.enqueue_delivery(
  p_channel public.notification_channel,
  p_recipient TEXT,
  p_subject TEXT,
  p_body TEXT,
  p_user_id UUID DEFAULT NULL,
  p_notification_id UUID DEFAULT NULL,
  p_metadata JSONB DEFAULT '{}'::jsonb
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_id UUID;
BEGIN
  IF p_channel NOT IN ('email', 'sms') THEN
    RAISE EXCEPTION 'INVALID_CHANNEL';
  END IF;
  IF p_recipient IS NULL OR length(trim(p_recipient)) = 0 THEN
    RETURN NULL;
  END IF;

  INSERT INTO public.notification_outbox (
    notification_id, user_id, channel, recipient, subject, body, metadata
  )
  VALUES (
    p_notification_id, p_user_id, p_channel, trim(p_recipient),
    p_subject, p_body, COALESCE(p_metadata, '{}'::jsonb)
  )
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

-- ---------------------------------------------------------------------------
-- Create payment intent (M-Pesa STK or simulated)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.create_payment_intent(
  p_amount NUMERIC,
  p_currency CHAR(3) DEFAULT 'KES',
  p_phone TEXT DEFAULT NULL,
  p_provider public.payment_provider DEFAULT 'simulated',
  p_idempotency_key TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_intent public.payment_intents%ROWTYPE;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'UNAUTHENTICATED');
  END IF;
  IF p_amount IS NULL OR p_amount < 100 OR p_amount > 10000000 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'INVALID_AMOUNT');
  END IF;
  IF p_provider = 'mpesa' AND (p_phone IS NULL OR p_phone !~ '^\+[1-9]\d{7,14}$') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'PHONE_REQUIRED');
  END IF;

  IF p_idempotency_key IS NOT NULL THEN
    SELECT * INTO v_intent FROM public.payment_intents WHERE idempotency_key = p_idempotency_key;
    IF FOUND THEN
      RETURN jsonb_build_object(
        'ok', true,
        'intent_id', v_intent.id,
        'status', v_intent.status,
        'provider', v_intent.provider,
        'amount', v_intent.amount,
        'currency', v_intent.currency,
        'idempotent', true
      );
    END IF;
  END IF;

  INSERT INTO public.payment_intents (
    user_id, provider, status, amount, currency, phone, idempotency_key, metadata
  )
  VALUES (
    v_uid, p_provider, 'pending', p_amount, p_currency, p_phone, p_idempotency_key,
    jsonb_build_object('initiated_at', NOW())
  )
  RETURNING * INTO v_intent;

  INSERT INTO public.audit_logs (actor_id, action, entity_type, entity_id, metadata)
  VALUES (
    v_uid, 'create', 'payment_intent', v_intent.id,
    jsonb_build_object('provider', p_provider, 'amount', p_amount)
  );

  RETURN jsonb_build_object(
    'ok', true,
    'intent_id', v_intent.id,
    'status', v_intent.status,
    'provider', v_intent.provider,
    'amount', v_intent.amount,
    'currency', v_intent.currency
  );
END;
$$;

-- ---------------------------------------------------------------------------
-- Complete payment intent (service role / webhook) â†’ ledger credit
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
BEGIN
  IF coalesce(auth.role(), '') NOT IN ('service_role', 'authenticated') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'FORBIDDEN');
  END IF;

  -- Members may complete only their own simulated intents; service_role any
  SELECT * INTO v_intent FROM public.payment_intents WHERE id = p_intent_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'NOT_FOUND');
  END IF;

  IF v_intent.status = 'completed' THEN
    RETURN jsonb_build_object('ok', true, 'already_completed', true, 'transaction_id', v_intent.transaction_id);
  END IF;

  IF v_intent.status NOT IN ('pending', 'processing') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'NOT_COMPLETABLE');
  END IF;

  IF auth.role() = 'authenticated' THEN
    IF auth.uid() IS DISTINCT FROM v_intent.user_id OR v_intent.provider <> 'simulated' THEN
      RETURN jsonb_build_object('ok', false, 'error', 'FORBIDDEN');
    END IF;
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
    metadata = metadata || coalesce(p_metadata, '{}'::jsonb),
    updated_at = NOW()
  WHERE id = v_intent.id;

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

CREATE OR REPLACE FUNCTION public.fail_payment_intent(
  p_intent_id UUID,
  p_error_message TEXT DEFAULT 'Payment failed'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_intent public.payment_intents%ROWTYPE;
BEGIN
  IF coalesce(auth.role(), '') <> 'service_role' AND auth.uid() IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'UNAUTHENTICATED');
  END IF;

  SELECT * INTO v_intent FROM public.payment_intents WHERE id = p_intent_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'NOT_FOUND');
  END IF;

  IF v_intent.status = 'completed' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'ALREADY_COMPLETED');
  END IF;

  UPDATE public.payment_intents
  SET status = 'failed', error_message = p_error_message, updated_at = NOW()
  WHERE id = v_intent.id;

  RETURN jsonb_build_object('ok', true);
END;
$$;

-- ---------------------------------------------------------------------------
-- Mark payment processing + store STK ids (service)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.mark_payment_intent_processing(
  p_intent_id UUID,
  p_checkout_request_id TEXT DEFAULT NULL,
  p_merchant_request_id TEXT DEFAULT NULL,
  p_provider_reference TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF coalesce(auth.role(), '') <> 'service_role' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'FORBIDDEN');
  END IF;

  UPDATE public.payment_intents
  SET
    status = 'processing',
    checkout_request_id = coalesce(p_checkout_request_id, checkout_request_id),
    merchant_request_id = coalesce(p_merchant_request_id, merchant_request_id),
    provider_reference = coalesce(p_provider_reference, provider_reference),
    updated_at = NOW()
  WHERE id = p_intent_id
    AND status IN ('pending', 'processing');

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'NOT_FOUND');
  END IF;

  RETURN jsonb_build_object('ok', true);
END;
$$;

-- ---------------------------------------------------------------------------
-- KYC gate on settle_payout (recipient must be approved or exempt)
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
  v_unpaid INT;
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

  SELECT COUNT(*) INTO v_unpaid
  FROM public.contributions
  WHERE jamiya_id = v_p.jamiya_id
    AND cycle_number = v_p.cycle_number
    AND status NOT IN ('paid', 'waived');

  IF v_unpaid > 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'CYCLE_INCOMPLETE', 'unpaid', v_unpaid);
  END IF;

  SELECT * INTO v_member FROM public.members WHERE id = v_p.member_id;

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

  v_tx := private.ledger_credit(
    v_member.user_id, v_p.currency, v_p.amount, 'payout', v_p.jamiya_id,
    'payout:' || v_p.id::text,
    'settle_payout:' || v_p.id::text,
    jsonb_build_object('payout_id', v_p.id, 'cycle', v_p.cycle_number)
  );

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
    jsonb_build_object('payout_id', v_p.id, 'jamiya_id', v_p.jamiya_id)
  );

  INSERT INTO public.audit_logs (actor_id, action, entity_type, entity_id, jamiya_id, metadata)
  VALUES (v_uid, 'approve', 'payout', v_p.id, v_p.jamiya_id, jsonb_build_object('transaction_id', v_tx));

  RETURN jsonb_build_object('ok', true, 'transaction_id', v_tx);
END;
$$;

-- ---------------------------------------------------------------------------
-- Resolve dispute (compliance+)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.resolve_dispute(
  p_dispute_id UUID,
  p_status public.dispute_status,
  p_resolution_notes TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid UUID := auth.uid();
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'UNAUTHENTICATED');
  END IF;
  IF NOT private.is_compliance_or_admin() THEN
    RETURN jsonb_build_object('ok', false, 'error', 'FORBIDDEN');
  END IF;
  IF p_status NOT IN ('resolved', 'rejected', 'under_review') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'INVALID_STATUS');
  END IF;

  UPDATE public.disputes
  SET
    status = p_status,
    resolution_notes = coalesce(p_resolution_notes, resolution_notes),
    resolved_by = CASE WHEN p_status IN ('resolved', 'rejected') THEN v_uid ELSE resolved_by END,
    resolved_at = CASE WHEN p_status IN ('resolved', 'rejected') THEN NOW() ELSE resolved_at END,
    updated_at = NOW()
  WHERE id = p_dispute_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'NOT_FOUND');
  END IF;

  INSERT INTO public.audit_logs (actor_id, action, entity_type, entity_id, metadata)
  VALUES (
    v_uid,
    CASE WHEN p_status = 'rejected' THEN 'reject'::public.audit_action ELSE 'approve'::public.audit_action END,
    'dispute',
    p_dispute_id,
    jsonb_build_object('status', p_status)
  );

  RETURN jsonb_build_object('ok', true);
END;
$$;

-- ---------------------------------------------------------------------------
-- Claim pending outbox rows (service)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.claim_notification_outbox(p_limit INT DEFAULT 50)
RETURNS SETOF public.notification_outbox
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF coalesce(auth.role(), '') <> 'service_role' THEN
    RAISE EXCEPTION 'FORBIDDEN';
  END IF;

  RETURN QUERY
  WITH picked AS (
    SELECT id
    FROM public.notification_outbox
    WHERE status IN ('pending', 'failed')
      AND scheduled_at <= NOW()
      AND attempts < 5
    ORDER BY scheduled_at
    LIMIT GREATEST(p_limit, 1)
    FOR UPDATE SKIP LOCKED
  )
  UPDATE public.notification_outbox o
  SET status = 'processing', attempts = attempts + 1, updated_at = NOW()
  FROM picked
  WHERE o.id = picked.id
  RETURNING o.*;
END;
$$;

CREATE OR REPLACE FUNCTION public.mark_outbox_sent(p_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF coalesce(auth.role(), '') <> 'service_role' THEN
    RAISE EXCEPTION 'FORBIDDEN';
  END IF;
  UPDATE public.notification_outbox
  SET status = 'sent', sent_at = NOW(), updated_at = NOW()
  WHERE id = p_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.mark_outbox_failed(p_id UUID, p_error TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF coalesce(auth.role(), '') <> 'service_role' THEN
    RAISE EXCEPTION 'FORBIDDEN';
  END IF;
  UPDATE public.notification_outbox
  SET
    status = CASE WHEN attempts >= 5 THEN 'failed' ELSE 'pending' END,
    last_error = p_error,
    scheduled_at = NOW() + (INTERVAL '2 minutes' * attempts),
    updated_at = NOW()
  WHERE id = p_id;
END;
$$;

-- ---------------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------------
REVOKE ALL ON FUNCTION public.create_payment_intent(NUMERIC, CHAR, TEXT, public.payment_provider, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.complete_payment_intent(UUID, TEXT, TEXT, JSONB) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.fail_payment_intent(UUID, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.mark_payment_intent_processing(UUID, TEXT, TEXT, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.resolve_dispute(UUID, public.dispute_status, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.claim_notification_outbox(INT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.mark_outbox_sent(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.mark_outbox_failed(UUID, TEXT) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.create_payment_intent(NUMERIC, CHAR, TEXT, public.payment_provider, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.complete_payment_intent(UUID, TEXT, TEXT, JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION public.complete_payment_intent(UUID, TEXT, TEXT, JSONB) TO service_role;
GRANT EXECUTE ON FUNCTION public.fail_payment_intent(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.fail_payment_intent(UUID, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.mark_payment_intent_processing(UUID, TEXT, TEXT, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.resolve_dispute(UUID, public.dispute_status, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.claim_notification_outbox(INT) TO service_role;
GRANT EXECUTE ON FUNCTION public.mark_outbox_sent(UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.mark_outbox_failed(UUID, TEXT) TO service_role;

-- ---------------------------------------------------------------------------
-- Queue invite delivery (email and/or SMS)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.queue_invitation_delivery(
  p_invitation_id UUID,
  p_invite_url TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_inv public.invitations%ROWTYPE;
  v_name TEXT;
  v_queued INT := 0;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'UNAUTHENTICATED');
  END IF;

  SELECT * INTO v_inv FROM public.invitations WHERE id = p_invitation_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'NOT_FOUND');
  END IF;

  IF NOT private.is_circle_admin(v_inv.jamiya_id) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'FORBIDDEN');
  END IF;

  SELECT name INTO v_name FROM public.jamiyas WHERE id = v_inv.jamiya_id;

  IF v_inv.email IS NOT NULL THEN
    PERFORM private.enqueue_delivery(
      'email',
      v_inv.email,
      'You are invited to join ' || coalesce(v_name, 'a circle'),
      'You have been invited to join ' || coalesce(v_name, 'a savings circle on Amanah') ||
        '. Open this link to accept: ' || p_invite_url,
      v_inv.invitee_user_id,
      NULL,
      jsonb_build_object('invitation_id', v_inv.id, 'kind', 'invitation')
    );
    v_queued := v_queued + 1;
  END IF;

  IF v_inv.phone IS NOT NULL THEN
    PERFORM private.enqueue_delivery(
      'sms',
      v_inv.phone,
      NULL,
      'Amanah invite: join ' || coalesce(v_name, 'a circle') || ' â€” ' || p_invite_url,
      v_inv.invitee_user_id,
      NULL,
      jsonb_build_object('invitation_id', v_inv.id, 'kind', 'invitation')
    );
    v_queued := v_queued + 1;
  END IF;

  RETURN jsonb_build_object('ok', true, 'queued', v_queued);
END;
$$;

REVOKE ALL ON FUNCTION public.queue_invitation_delivery(UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.queue_invitation_delivery(UUID, TEXT) TO authenticated;

-- ---------------------------------------------------------------------------
-- Service settle with Phase 3 KYC + open-dispute gates
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.service_settle_payout(p_payout_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_p public.payouts%ROWTYPE;
  v_member public.members%ROWTYPE;
  v_unpaid INT;
  v_tx UUID;
  v_kyc TEXT;
  v_open_disputes INT;
BEGIN
  IF coalesce(auth.role(), '') <> 'service_role' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'FORBIDDEN');
  END IF;

  SELECT * INTO v_p FROM public.payouts WHERE id = p_payout_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'NOT_FOUND');
  END IF;

  IF v_p.status NOT IN ('scheduled', 'processing') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'NOT_SETTLEABLE');
  END IF;

  SELECT COUNT(*) INTO v_unpaid
  FROM public.contributions
  WHERE jamiya_id = v_p.jamiya_id
    AND cycle_number = v_p.cycle_number
    AND status NOT IN ('paid', 'waived');

  IF v_unpaid > 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'CYCLE_INCOMPLETE', 'unpaid', v_unpaid);
  END IF;

  SELECT * INTO v_member FROM public.members WHERE id = v_p.member_id;

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

  v_tx := private.ledger_credit(
    v_member.user_id, v_p.currency, v_p.amount, 'payout', v_p.jamiya_id,
    'payout:' || v_p.id::text,
    'settle_payout:' || v_p.id::text,
    jsonb_build_object('payout_id', v_p.id, 'cycle', v_p.cycle_number, 'source', 'service')
  );

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
    jsonb_build_object('payout_id', v_p.id, 'jamiya_id', v_p.jamiya_id)
  );

  INSERT INTO public.audit_logs (actor_id, action, entity_type, entity_id, jamiya_id, metadata)
  VALUES (NULL, 'approve', 'payout', v_p.id, v_p.jamiya_id, jsonb_build_object('transaction_id', v_tx, 'source', 'service'));

  RETURN jsonb_build_object('ok', true, 'transaction_id', v_tx);
END;
$$;




-- ========== 20260723210000_phase4_withdrawals_risk_bank.sql ==========

-- Phase 4: Withdrawals, bank rails, member risk scores, collections hooks

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------
CREATE TYPE public.withdrawal_status AS ENUM (
  'pending',
  'processing',
  'completed',
  'failed',
  'cancelled'
);

CREATE TYPE public.risk_band AS ENUM ('low', 'medium', 'high', 'critical');

-- ---------------------------------------------------------------------------
-- withdrawal_requests
-- ---------------------------------------------------------------------------
CREATE TABLE public.withdrawal_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  amount NUMERIC(14, 2) NOT NULL CHECK (amount > 0),
  currency CHAR(3) NOT NULL DEFAULT 'KES',
  status public.withdrawal_status NOT NULL DEFAULT 'pending',
  destination_type TEXT NOT NULL DEFAULT 'mpesa'
    CHECK (destination_type IN ('mpesa', 'bank')),
  destination_phone TEXT,
  bank_name TEXT,
  bank_account_name TEXT,
  bank_account_number TEXT,
  transaction_id UUID REFERENCES public.transactions (id) ON DELETE SET NULL,
  provider_reference TEXT,
  error_message TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  processed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX withdrawal_requests_user_created_idx
  ON public.withdrawal_requests (user_id, created_at DESC);
CREATE INDEX withdrawal_requests_status_idx
  ON public.withdrawal_requests (status, created_at DESC);

CREATE TRIGGER withdrawal_requests_set_updated_at
  BEFORE UPDATE ON public.withdrawal_requests
  FOR EACH ROW EXECUTE FUNCTION private.set_updated_at();

ALTER TABLE public.withdrawal_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "withdrawal_requests_select_own"
  ON public.withdrawal_requests FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR private.is_compliance_or_admin());

CREATE POLICY "withdrawal_requests_insert_own"
  ON public.withdrawal_requests FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

REVOKE UPDATE, DELETE ON public.withdrawal_requests FROM authenticated, anon;
GRANT SELECT, INSERT ON public.withdrawal_requests TO authenticated;

-- ---------------------------------------------------------------------------
-- member_risk_scores
-- ---------------------------------------------------------------------------
CREATE TABLE public.member_risk_scores (
  user_id UUID PRIMARY KEY REFERENCES public.profiles (id) ON DELETE CASCADE,
  score INT NOT NULL DEFAULT 0 CHECK (score BETWEEN 0 AND 100),
  band public.risk_band NOT NULL DEFAULT 'low',
  late_contributions INT NOT NULL DEFAULT 0,
  open_disputes INT NOT NULL DEFAULT 0,
  failed_payments INT NOT NULL DEFAULT 0,
  factors JSONB NOT NULL DEFAULT '{}'::jsonb,
  computed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX member_risk_scores_band_idx ON public.member_risk_scores (band, score DESC);

CREATE TRIGGER member_risk_scores_set_updated_at
  BEFORE UPDATE ON public.member_risk_scores
  FOR EACH ROW EXECUTE FUNCTION private.set_updated_at();

ALTER TABLE public.member_risk_scores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "member_risk_scores_select"
  ON public.member_risk_scores FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR private.is_compliance_or_admin());

REVOKE INSERT, UPDATE, DELETE ON public.member_risk_scores FROM authenticated, anon;
GRANT SELECT ON public.member_risk_scores TO authenticated;

-- ---------------------------------------------------------------------------
-- Request wallet withdrawal (holds funds via ledger debit when approved/processed)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.request_withdrawal(
  p_amount NUMERIC,
  p_currency CHAR(3) DEFAULT 'KES',
  p_destination_type TEXT DEFAULT 'mpesa',
  p_destination_phone TEXT DEFAULT NULL,
  p_bank_name TEXT DEFAULT NULL,
  p_bank_account_name TEXT DEFAULT NULL,
  p_bank_account_number TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_req public.withdrawal_requests%ROWTYPE;
  v_kyc TEXT;
  v_risk INT := 0;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'UNAUTHENTICATED');
  END IF;
  IF p_amount IS NULL OR p_amount < 100 OR p_amount > 5000000 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'INVALID_AMOUNT');
  END IF;
  IF p_destination_type NOT IN ('mpesa', 'bank') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'INVALID_DESTINATION');
  END IF;
  IF p_destination_type = 'mpesa' AND (p_destination_phone IS NULL OR p_destination_phone !~ '^\+[1-9]\d{7,14}$') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'PHONE_REQUIRED');
  END IF;
  IF p_destination_type = 'bank' AND (
    p_bank_name IS NULL OR p_bank_account_number IS NULL OR p_bank_account_name IS NULL
  ) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'BANK_DETAILS_REQUIRED');
  END IF;

  SELECT kyc_status INTO v_kyc FROM public.profiles WHERE id = v_uid;
  IF v_kyc IS DISTINCT FROM 'approved' AND p_amount >= 20000 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'KYC_REQUIRED', 'kyc_status', v_kyc);
  END IF;

  SELECT score INTO v_risk FROM public.member_risk_scores WHERE user_id = v_uid;
  IF coalesce(v_risk, 0) >= 80 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'RISK_BLOCKED', 'score', v_risk);
  END IF;

  INSERT INTO public.withdrawal_requests (
    user_id, amount, currency, status, destination_type,
    destination_phone, bank_name, bank_account_name, bank_account_number
  )
  VALUES (
    v_uid, p_amount, p_currency, 'pending', p_destination_type,
    p_destination_phone, p_bank_name, p_bank_account_name, p_bank_account_number
  )
  RETURNING * INTO v_req;

  INSERT INTO public.audit_logs (actor_id, action, entity_type, entity_id, metadata)
  VALUES (
    v_uid, 'create', 'withdrawal_request', v_req.id,
    jsonb_build_object('amount', p_amount, 'destination_type', p_destination_type)
  );

  INSERT INTO public.notifications (user_id, type, channel, title, body, data)
  VALUES (
    v_uid, 'system', 'in_app', 'Withdrawal requested',
    'Your withdrawal request is pending processing.',
    jsonb_build_object('withdrawal_id', v_req.id)
  );

  RETURN jsonb_build_object('ok', true, 'withdrawal_id', v_req.id, 'status', v_req.status);
END;
$$;

-- ---------------------------------------------------------------------------
-- Process withdrawal (service or admin): debit wallet + mark completed
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.process_withdrawal(
  p_withdrawal_id UUID,
  p_approve BOOLEAN DEFAULT TRUE,
  p_provider_reference TEXT DEFAULT NULL,
  p_error_message TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_req public.withdrawal_requests%ROWTYPE;
  v_tx UUID;
BEGIN
  IF coalesce(auth.role(), '') <> 'service_role' AND NOT private.is_compliance_or_admin() THEN
    RETURN jsonb_build_object('ok', false, 'error', 'FORBIDDEN');
  END IF;

  SELECT * INTO v_req FROM public.withdrawal_requests WHERE id = p_withdrawal_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'NOT_FOUND');
  END IF;
  IF v_req.status NOT IN ('pending', 'processing') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'NOT_PROCESSABLE');
  END IF;

  IF NOT p_approve THEN
    UPDATE public.withdrawal_requests
    SET status = 'cancelled', error_message = coalesce(p_error_message, 'Cancelled'), updated_at = NOW()
    WHERE id = v_req.id;
    RETURN jsonb_build_object('ok', true, 'status', 'cancelled');
  END IF;

  BEGIN
    v_tx := private.ledger_debit(
      v_req.user_id, v_req.currency, v_req.amount, 'wallet_withdrawal', NULL,
      coalesce(p_provider_reference, 'withdrawal:' || v_req.id::text),
      'withdrawal:' || v_req.id::text,
      jsonb_build_object('withdrawal_id', v_req.id, 'destination_type', v_req.destination_type)
    );
  EXCEPTION
    WHEN OTHERS THEN
      IF SQLERRM = 'INSUFFICIENT_FUNDS' THEN
        UPDATE public.withdrawal_requests
        SET status = 'failed', error_message = 'INSUFFICIENT_FUNDS', updated_at = NOW()
        WHERE id = v_req.id;
        RETURN jsonb_build_object('ok', false, 'error', 'INSUFFICIENT_FUNDS');
      END IF;
      RAISE;
  END;

  UPDATE public.withdrawal_requests
  SET
    status = 'completed',
    transaction_id = v_tx,
    provider_reference = coalesce(p_provider_reference, provider_reference),
    processed_at = NOW(),
    updated_at = NOW()
  WHERE id = v_req.id;

  INSERT INTO public.notifications (user_id, type, channel, title, body, data)
  VALUES (
    v_req.user_id, 'system', 'in_app', 'Withdrawal completed',
    'Funds have been sent to your destination.',
    jsonb_build_object('withdrawal_id', v_req.id, 'transaction_id', v_tx)
  );

  INSERT INTO public.audit_logs (actor_id, action, entity_type, entity_id, metadata)
  VALUES (
    v_uid, 'approve', 'withdrawal_request', v_req.id,
    jsonb_build_object('transaction_id', v_tx)
  );

  RETURN jsonb_build_object('ok', true, 'transaction_id', v_tx, 'status', 'completed');
END;
$$;

-- ---------------------------------------------------------------------------
-- Recompute risk score for a member
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.recompute_member_risk(p_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_late INT := 0;
  v_disputes INT := 0;
  v_failed_pay INT := 0;
  v_score INT := 0;
  v_band public.risk_band;
BEGIN
  IF auth.uid() IS NULL AND coalesce(auth.role(), '') <> 'service_role' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'UNAUTHENTICATED');
  END IF;

  IF coalesce(auth.role(), '') <> 'service_role'
     AND auth.uid() IS DISTINCT FROM p_user_id
     AND NOT private.is_compliance_or_admin() THEN
    RETURN jsonb_build_object('ok', false, 'error', 'FORBIDDEN');
  END IF;

  SELECT COUNT(*) INTO v_late
  FROM public.contributions c
  JOIN public.members m ON m.id = c.member_id
  WHERE m.user_id = p_user_id AND c.status = 'late';

  SELECT COUNT(*) INTO v_disputes
  FROM public.disputes
  WHERE (opened_by = p_user_id OR against_user_id = p_user_id)
    AND status IN ('open', 'under_review');

  SELECT COUNT(*) INTO v_failed_pay
  FROM public.payment_intents
  WHERE user_id = p_user_id AND status = 'failed';

  v_score := LEAST(
    100,
    (v_late * 12) + (v_disputes * 18) + (v_failed_pay * 10)
  );

  v_band := CASE
    WHEN v_score >= 80 THEN 'critical'::public.risk_band
    WHEN v_score >= 55 THEN 'high'::public.risk_band
    WHEN v_score >= 30 THEN 'medium'::public.risk_band
    ELSE 'low'::public.risk_band
  END;

  INSERT INTO public.member_risk_scores (
    user_id, score, band, late_contributions, open_disputes, failed_payments, factors, computed_at
  )
  VALUES (
    p_user_id, v_score, v_band, v_late, v_disputes, v_failed_pay,
    jsonb_build_object(
      'late_contributions', v_late,
      'open_disputes', v_disputes,
      'failed_payments', v_failed_pay
    ),
    NOW()
  )
  ON CONFLICT (user_id) DO UPDATE SET
    score = EXCLUDED.score,
    band = EXCLUDED.band,
    late_contributions = EXCLUDED.late_contributions,
    open_disputes = EXCLUDED.open_disputes,
    failed_payments = EXCLUDED.failed_payments,
    factors = EXCLUDED.factors,
    computed_at = NOW(),
    updated_at = NOW();

  RETURN jsonb_build_object('ok', true, 'score', v_score, 'band', v_band);
END;
$$;

CREATE OR REPLACE FUNCTION public.recompute_all_member_risk()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid UUID;
  v_count INT := 0;
BEGIN
  IF coalesce(auth.role(), '') <> 'service_role' AND NOT private.is_compliance_or_admin() THEN
    RETURN jsonb_build_object('ok', false, 'error', 'FORBIDDEN');
  END IF;

  FOR v_uid IN SELECT id FROM public.profiles LOOP
    PERFORM public.recompute_member_risk(v_uid);
    v_count := v_count + 1;
  END LOOP;

  RETURN jsonb_build_object('ok', true, 'updated', v_count);
END;
$$;

-- ---------------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------------
REVOKE ALL ON FUNCTION public.request_withdrawal(NUMERIC, CHAR, TEXT, TEXT, TEXT, TEXT, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.process_withdrawal(UUID, BOOLEAN, TEXT, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.recompute_member_risk(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.recompute_all_member_risk() FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.request_withdrawal(NUMERIC, CHAR, TEXT, TEXT, TEXT, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.process_withdrawal(UUID, BOOLEAN, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.process_withdrawal(UUID, BOOLEAN, TEXT, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.recompute_member_risk(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.recompute_member_risk(UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.recompute_all_member_risk() TO authenticated;
GRANT EXECUTE ON FUNCTION public.recompute_all_member_risk() TO service_role;




-- ========== 20260723210902_phase5_collections_delinquency.sql ==========

-- Phase 5: Collections / delinquency automation

CREATE TYPE public.collection_status AS ENUM (
  'open',
  'contacted',
  'promised',
  'partially_paid',
  'resolved',
  'written_off',
  'cancelled'
);

CREATE TYPE public.collection_severity AS ENUM (
  'watch',
  'overdue',
  'severe',
  'critical'
);

CREATE TABLE public.collection_cases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  jamiya_id UUID NOT NULL REFERENCES public.jamiyas (id) ON DELETE CASCADE,
  member_id UUID NOT NULL REFERENCES public.members (id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  contribution_id UUID REFERENCES public.contributions (id) ON DELETE SET NULL,
  status public.collection_status NOT NULL DEFAULT 'open',
  severity public.collection_severity NOT NULL DEFAULT 'overdue',
  amount_due NUMERIC(14, 2) NOT NULL CHECK (amount_due > 0),
  currency CHAR(3) NOT NULL DEFAULT 'KES',
  days_overdue INT NOT NULL DEFAULT 0,
  contact_attempts INT NOT NULL DEFAULT 0,
  last_contacted_at TIMESTAMPTZ,
  promised_pay_date DATE,
  notes TEXT,
  assigned_to UUID REFERENCES public.profiles (id) ON DELETE SET NULL,
  resolved_at TIMESTAMPTZ,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX collection_cases_open_contribution_unique_idx
  ON public.collection_cases (contribution_id)
  WHERE contribution_id IS NOT NULL
    AND status IN ('open', 'contacted', 'promised', 'partially_paid');

CREATE INDEX collection_cases_status_severity_idx
  ON public.collection_cases (status, severity, days_overdue DESC);

CREATE INDEX collection_cases_jamiya_idx ON public.collection_cases (jamiya_id, status);
CREATE INDEX collection_cases_user_idx ON public.collection_cases (user_id);

CREATE TRIGGER collection_cases_set_updated_at
  BEFORE UPDATE ON public.collection_cases
  FOR EACH ROW EXECUTE FUNCTION private.set_updated_at();

ALTER TABLE public.collection_cases ENABLE ROW LEVEL SECURITY;

CREATE POLICY "collection_cases_select"
  ON public.collection_cases FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR private.is_circle_admin(jamiya_id)
    OR private.is_compliance_or_admin()
  );

CREATE POLICY "collection_cases_update_admin"
  ON public.collection_cases FOR UPDATE TO authenticated
  USING (private.is_compliance_or_admin() OR private.is_circle_admin(jamiya_id))
  WITH CHECK (private.is_compliance_or_admin() OR private.is_circle_admin(jamiya_id));

REVOKE INSERT, DELETE ON public.collection_cases FROM authenticated, anon;
GRANT SELECT, UPDATE ON public.collection_cases TO authenticated;

CREATE OR REPLACE FUNCTION public.sync_collection_cases()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_row RECORD;
  v_opened INT := 0;
  v_resolved INT := 0;
  v_severity public.collection_severity;
  v_days INT;
  v_exists UUID;
BEGIN
  IF coalesce(auth.role(), '') <> 'service_role' AND NOT private.is_compliance_or_admin() THEN
    RETURN jsonb_build_object('ok', false, 'error', 'FORBIDDEN');
  END IF;

  PERFORM public.mark_late_contributions();

  FOR v_row IN
    SELECT
      c.id AS contribution_id,
      c.jamiya_id,
      c.member_id,
      m.user_id,
      c.amount,
      c.currency,
      GREATEST(0, (CURRENT_DATE - c.due_date)) AS days_overdue
    FROM public.contributions c
    JOIN public.members m ON m.id = c.member_id
    WHERE c.status = 'late'
  LOOP
    v_days := v_row.days_overdue;
    v_severity := CASE
      WHEN v_days >= 30 THEN 'critical'::public.collection_severity
      WHEN v_days >= 14 THEN 'severe'::public.collection_severity
      WHEN v_days >= 7 THEN 'overdue'::public.collection_severity
      ELSE 'watch'::public.collection_severity
    END;

    SELECT id INTO v_exists
    FROM public.collection_cases
    WHERE contribution_id = v_row.contribution_id
      AND status IN ('open', 'contacted', 'promised', 'partially_paid')
    LIMIT 1;

    IF v_exists IS NULL THEN
      INSERT INTO public.collection_cases (
        jamiya_id, member_id, user_id, contribution_id,
        status, severity, amount_due, currency, days_overdue
      )
      VALUES (
        v_row.jamiya_id, v_row.member_id, v_row.user_id, v_row.contribution_id,
        'open', v_severity, v_row.amount, v_row.currency, v_days
      );
      v_opened := v_opened + 1;
    ELSE
      UPDATE public.collection_cases
      SET
        days_overdue = v_days,
        severity = v_severity,
        amount_due = v_row.amount,
        updated_at = NOW()
      WHERE id = v_exists;
    END IF;
  END LOOP;

  UPDATE public.collection_cases cc
  SET status = 'resolved', resolved_at = NOW(), updated_at = NOW()
  FROM public.contributions c
  WHERE cc.contribution_id = c.id
    AND c.status IN ('paid', 'waived')
    AND cc.status IN ('open', 'contacted', 'promised', 'partially_paid');

  GET DIAGNOSTICS v_resolved = ROW_COUNT;

  RETURN jsonb_build_object('ok', true, 'opened', v_opened, 'resolved', v_resolved);
END;
$$;

CREATE OR REPLACE FUNCTION public.update_collection_case(
  p_case_id UUID,
  p_status public.collection_status,
  p_notes TEXT DEFAULT NULL,
  p_promised_pay_date DATE DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_case public.collection_cases%ROWTYPE;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'UNAUTHENTICATED');
  END IF;

  SELECT * INTO v_case FROM public.collection_cases WHERE id = p_case_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'NOT_FOUND');
  END IF;

  IF NOT (private.is_compliance_or_admin() OR private.is_circle_admin(v_case.jamiya_id)) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'FORBIDDEN');
  END IF;

  UPDATE public.collection_cases
  SET
    status = p_status,
    notes = coalesce(p_notes, notes),
    promised_pay_date = coalesce(p_promised_pay_date, promised_pay_date),
    contact_attempts = CASE
      WHEN p_status IN ('contacted', 'promised') THEN contact_attempts + 1
      ELSE contact_attempts
    END,
    last_contacted_at = CASE
      WHEN p_status IN ('contacted', 'promised') THEN NOW()
      ELSE last_contacted_at
    END,
    assigned_to = coalesce(assigned_to, v_uid),
    resolved_at = CASE
      WHEN p_status IN ('resolved', 'written_off', 'cancelled') THEN NOW()
      ELSE resolved_at
    END,
    updated_at = NOW()
  WHERE id = p_case_id;

  INSERT INTO public.audit_logs (actor_id, action, entity_type, entity_id, jamiya_id, metadata)
  VALUES (
    v_uid, 'update', 'collection_case', p_case_id, v_case.jamiya_id,
    jsonb_build_object('status', p_status)
  );

  RETURN jsonb_build_object('ok', true);
END;
$$;

REVOKE ALL ON FUNCTION public.sync_collection_cases() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.update_collection_case(UUID, public.collection_status, TEXT, DATE) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.sync_collection_cases() TO authenticated;
GRANT EXECUTE ON FUNCTION public.sync_collection_cases() TO service_role;
GRANT EXECUTE ON FUNCTION public.update_collection_case(UUID, public.collection_status, TEXT, DATE) TO authenticated;

GRANT SELECT, INSERT, UPDATE ON public.collection_cases TO service_role;
GRANT SELECT, INSERT, UPDATE ON public.notification_outbox TO service_role;



