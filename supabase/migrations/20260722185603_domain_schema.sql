-- Phase 1.3: Domain schema — Jamiya ROSCA core
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

-- Deferred FKs from contributions/payouts → transactions
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

-- No direct wallet inserts/updates from clients — trigger owns default wallet;
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
