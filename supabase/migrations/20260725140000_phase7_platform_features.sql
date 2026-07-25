-- Phase 7: Platform features from Amanah product spec
-- Segments, custom roles, vouching, grace, meetings, sadaka, welfare,
-- qard hassan, tawarruq, fees/tips, goals, referrals, circle chat

-- ===========================================================================
-- Enums
-- ===========================================================================
DO $$ BEGIN
  ALTER TYPE public.membership_role ADD VALUE IF NOT EXISTS 'treasurer';
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TYPE public.membership_role ADD VALUE IF NOT EXISTS 'secretary';
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TYPE public.membership_role ADD VALUE IF NOT EXISTS 'chair';
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TYPE public.circle_segment AS ENUM (
  'general',
  'womens_circle',
  'boda_stage'
);

CREATE TYPE public.vouch_status AS ENUM ('pending', 'approved', 'rejected');
CREATE TYPE public.grace_request_status AS ENUM ('pending', 'approved', 'rejected', 'cancelled');
CREATE TYPE public.meeting_status AS ENUM ('scheduled', 'completed', 'cancelled');
CREATE TYPE public.campaign_status AS ENUM ('draft', 'live', 'paused', 'completed', 'cancelled');
CREATE TYPE public.welfare_claim_status AS ENUM ('pending', 'approved', 'rejected', 'paid', 'cancelled');
CREATE TYPE public.qard_status AS ENUM (
  'requested', 'approved', 'rejected', 'active', 'repaid', 'defaulted', 'cancelled'
);
CREATE TYPE public.tawarruq_status AS ENUM (
  'requested', 'submitted_to_partner', 'approved', 'rejected', 'disbursed', 'closed'
);
CREATE TYPE public.fee_mode AS ENUM ('join_fee', 'per_transaction', 'donation_addon', 'donation_deduct', 'platform_tip');

-- ===========================================================================
-- Profiles: M-Pesa linkage + national ID (manual verification via KYC)
-- ===========================================================================
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS national_id TEXT,
  ADD COLUMN IF NOT EXISTS mpesa_phone TEXT,
  ADD COLUMN IF NOT EXISTS referral_code TEXT UNIQUE;

UPDATE public.profiles
SET referral_code = upper(substr(replace(id::text, '-', ''), 1, 8))
WHERE referral_code IS NULL;

-- ===========================================================================
-- Circles: segment, grace, join fee
-- ===========================================================================
ALTER TABLE public.jamiyas
  ADD COLUMN IF NOT EXISTS segment public.circle_segment NOT NULL DEFAULT 'general',
  ADD COLUMN IF NOT EXISTS grace_period_days INT NOT NULL DEFAULT 3
    CHECK (grace_period_days BETWEEN 0 AND 30),
  ADD COLUMN IF NOT EXISTS join_fee_amount NUMERIC(14, 2) NOT NULL DEFAULT 0
    CHECK (join_fee_amount >= 0),
  ADD COLUMN IF NOT EXISTS gatekeeper_label TEXT;

-- ===========================================================================
-- Group vouching (gatekeeper)
-- ===========================================================================
CREATE TABLE public.member_vouches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  jamiya_id UUID NOT NULL REFERENCES public.jamiyas (id) ON DELETE CASCADE,
  member_id UUID NOT NULL REFERENCES public.members (id) ON DELETE CASCADE,
  voucher_user_id UUID NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  status public.vouch_status NOT NULL DEFAULT 'pending',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  decided_at TIMESTAMPTZ,
  UNIQUE (jamiya_id, member_id)
);

CREATE INDEX member_vouches_jamiya_idx ON public.member_vouches (jamiya_id, status);

ALTER TABLE public.member_vouches ENABLE ROW LEVEL SECURITY;
CREATE POLICY "vouches_select_circle"
  ON public.member_vouches FOR SELECT TO authenticated
  USING (
    private.is_jamiya_member(jamiya_id)
    OR private.is_compliance_or_admin()
  );
CREATE POLICY "vouches_insert_gatekeeper"
  ON public.member_vouches FOR INSERT TO authenticated
  WITH CHECK (
    voucher_user_id = auth.uid()
    AND (
      private.is_circle_admin(jamiya_id)
      OR EXISTS (
        SELECT 1 FROM public.members m
        WHERE m.jamiya_id = member_vouches.jamiya_id
          AND m.user_id = auth.uid()
          AND m.role::text IN ('chair', 'treasurer', 'circle_admin')
          AND m.status = 'active'
      )
    )
  );
CREATE POLICY "vouches_update_gatekeeper"
  ON public.member_vouches FOR UPDATE TO authenticated
  USING (
    private.is_circle_admin(jamiya_id)
    OR EXISTS (
      SELECT 1 FROM public.members m
      WHERE m.jamiya_id = member_vouches.jamiya_id
        AND m.user_id = auth.uid()
        AND m.role::text IN ('chair', 'treasurer', 'circle_admin')
        AND m.status = 'active'
    )
  );
GRANT SELECT, INSERT, UPDATE ON public.member_vouches TO authenticated;

-- ===========================================================================
-- Grace period requests
-- ===========================================================================
CREATE TABLE public.grace_period_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  jamiya_id UUID NOT NULL REFERENCES public.jamiyas (id) ON DELETE CASCADE,
  contribution_id UUID NOT NULL REFERENCES public.contributions (id) ON DELETE CASCADE,
  requester_id UUID NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  requested_days INT NOT NULL CHECK (requested_days BETWEEN 1 AND 14),
  reason TEXT,
  status public.grace_request_status NOT NULL DEFAULT 'pending',
  decided_by UUID REFERENCES public.profiles (id) ON DELETE SET NULL,
  new_due_date DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  decided_at TIMESTAMPTZ
);

CREATE INDEX grace_requests_jamiya_idx ON public.grace_period_requests (jamiya_id, status);

ALTER TABLE public.grace_period_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "grace_select"
  ON public.grace_period_requests FOR SELECT TO authenticated
  USING (
    requester_id = auth.uid()
    OR private.is_circle_admin(jamiya_id)
    OR private.is_compliance_or_admin()
  );
CREATE POLICY "grace_insert_own"
  ON public.grace_period_requests FOR INSERT TO authenticated
  WITH CHECK (requester_id = auth.uid() AND private.is_active_jamiya_member(jamiya_id));
CREATE POLICY "grace_update_admin"
  ON public.grace_period_requests FOR UPDATE TO authenticated
  USING (private.is_circle_admin(jamiya_id) OR private.is_compliance_or_admin());
GRANT SELECT, INSERT, UPDATE ON public.grace_period_requests TO authenticated;

-- ===========================================================================
-- Meetings
-- ===========================================================================
CREATE TABLE public.circle_meetings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  jamiya_id UUID NOT NULL REFERENCES public.jamiyas (id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  location TEXT,
  starts_at TIMESTAMPTZ NOT NULL,
  ends_at TIMESTAMPTZ,
  notes TEXT,
  status public.meeting_status NOT NULL DEFAULT 'scheduled',
  created_by UUID NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX circle_meetings_jamiya_idx ON public.circle_meetings (jamiya_id, starts_at);

ALTER TABLE public.circle_meetings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "meetings_select_member"
  ON public.circle_meetings FOR SELECT TO authenticated
  USING (private.is_jamiya_member(jamiya_id) OR private.is_compliance_or_admin());
CREATE POLICY "meetings_write_admin"
  ON public.circle_meetings FOR ALL TO authenticated
  USING (
    private.is_circle_admin(jamiya_id)
    OR EXISTS (
      SELECT 1 FROM public.members m
      WHERE m.jamiya_id = circle_meetings.jamiya_id
        AND m.user_id = auth.uid()
        AND m.role::text IN ('secretary', 'chair', 'circle_admin')
        AND m.status = 'active'
    )
  )
  WITH CHECK (
    private.is_circle_admin(jamiya_id)
    OR EXISTS (
      SELECT 1 FROM public.members m
      WHERE m.jamiya_id = circle_meetings.jamiya_id
        AND m.user_id = auth.uid()
        AND m.role::text IN ('secretary', 'chair', 'circle_admin')
        AND m.status = 'active'
    )
  );
GRANT SELECT, INSERT, UPDATE, DELETE ON public.circle_meetings TO authenticated;

-- ===========================================================================
-- Sadaka / charity (public campaigns)
-- Fee model default: donation_addon — full gift reaches cause; fee charged on top
-- ===========================================================================
CREATE TABLE public.charity_campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  summary TEXT NOT NULL,
  description TEXT,
  goal_amount NUMERIC(14, 2) NOT NULL CHECK (goal_amount > 0),
  raised_amount NUMERIC(14, 2) NOT NULL DEFAULT 0 CHECK (raised_amount >= 0),
  currency CHAR(3) NOT NULL DEFAULT 'KES',
  status public.campaign_status NOT NULL DEFAULT 'draft',
  sharia_board_endorsed BOOLEAN NOT NULL DEFAULT true,
  fee_mode public.fee_mode NOT NULL DEFAULT 'donation_addon',
  fee_bps INT NOT NULL DEFAULT 250 CHECK (fee_bps BETWEEN 0 AND 2000),
  cover_image_url TEXT,
  created_by UUID REFERENCES public.profiles (id) ON DELETE SET NULL,
  starts_at TIMESTAMPTZ,
  ends_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT charity_slug_format CHECK (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$')
);

CREATE TABLE public.charity_donations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES public.charity_campaigns (id) ON DELETE CASCADE,
  donor_user_id UUID REFERENCES public.profiles (id) ON DELETE SET NULL,
  donor_name TEXT,
  donor_phone TEXT,
  donor_email TEXT,
  amount NUMERIC(14, 2) NOT NULL CHECK (amount > 0),
  fee_amount NUMERIC(14, 2) NOT NULL DEFAULT 0 CHECK (fee_amount >= 0),
  currency CHAR(3) NOT NULL DEFAULT 'KES',
  payment_intent_id UUID REFERENCES public.payment_intents (id) ON DELETE SET NULL,
  receipt_code TEXT NOT NULL UNIQUE,
  is_anonymous BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX charity_donations_campaign_idx ON public.charity_donations (campaign_id, created_at DESC);

CREATE TRIGGER charity_campaigns_set_updated_at
  BEFORE UPDATE ON public.charity_campaigns
  FOR EACH ROW EXECUTE FUNCTION private.set_updated_at();

ALTER TABLE public.charity_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.charity_donations ENABLE ROW LEVEL SECURITY;

-- Public read for live campaigns (anon + authenticated)
CREATE POLICY "campaigns_public_select_live"
  ON public.charity_campaigns FOR SELECT TO anon, authenticated
  USING (status = 'live' OR private.is_compliance_or_admin() OR created_by = auth.uid());

CREATE POLICY "campaigns_admin_write"
  ON public.charity_campaigns FOR ALL TO authenticated
  USING (private.is_compliance_or_admin() OR created_by = auth.uid())
  WITH CHECK (private.is_compliance_or_admin() OR created_by = auth.uid());

CREATE POLICY "donations_select"
  ON public.charity_donations FOR SELECT TO authenticated
  USING (
    donor_user_id = auth.uid()
    OR private.is_compliance_or_admin()
  );
-- Inserts via SECURITY DEFINER RPC only
REVOKE INSERT, UPDATE, DELETE ON public.charity_donations FROM authenticated, anon;
GRANT SELECT ON public.charity_donations TO authenticated;
GRANT SELECT ON public.charity_campaigns TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.charity_campaigns TO authenticated;

-- ===========================================================================
-- Welfare fund
-- ===========================================================================
CREATE TABLE public.welfare_funds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  jamiya_id UUID NOT NULL UNIQUE REFERENCES public.jamiyas (id) ON DELETE CASCADE,
  balance NUMERIC(14, 2) NOT NULL DEFAULT 0 CHECK (balance >= 0),
  currency CHAR(3) NOT NULL DEFAULT 'KES',
  contribution_amount NUMERIC(14, 2) NOT NULL DEFAULT 0 CHECK (contribution_amount >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE public.welfare_claims (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fund_id UUID NOT NULL REFERENCES public.welfare_funds (id) ON DELETE CASCADE,
  jamiya_id UUID NOT NULL REFERENCES public.jamiyas (id) ON DELETE CASCADE,
  claimant_id UUID NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  claim_type TEXT NOT NULL CHECK (claim_type IN ('medical', 'funeral', 'accident', 'other')),
  amount NUMERIC(14, 2) NOT NULL CHECK (amount > 0),
  currency CHAR(3) NOT NULL DEFAULT 'KES',
  reason TEXT NOT NULL,
  status public.welfare_claim_status NOT NULL DEFAULT 'pending',
  decided_by UUID REFERENCES public.profiles (id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  decided_at TIMESTAMPTZ
);

CREATE TRIGGER welfare_funds_set_updated_at
  BEFORE UPDATE ON public.welfare_funds
  FOR EACH ROW EXECUTE FUNCTION private.set_updated_at();

ALTER TABLE public.welfare_funds ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.welfare_claims ENABLE ROW LEVEL SECURITY;

CREATE POLICY "welfare_funds_select"
  ON public.welfare_funds FOR SELECT TO authenticated
  USING (private.is_jamiya_member(jamiya_id) OR private.is_compliance_or_admin());
CREATE POLICY "welfare_claims_select"
  ON public.welfare_claims FOR SELECT TO authenticated
  USING (
    claimant_id = auth.uid()
    OR private.is_circle_admin(jamiya_id)
    OR private.is_compliance_or_admin()
  );
CREATE POLICY "welfare_claims_insert"
  ON public.welfare_claims FOR INSERT TO authenticated
  WITH CHECK (claimant_id = auth.uid() AND private.is_active_jamiya_member(jamiya_id));
CREATE POLICY "welfare_claims_update_admin"
  ON public.welfare_claims FOR UPDATE TO authenticated
  USING (
    private.is_circle_admin(jamiya_id)
    OR EXISTS (
      SELECT 1 FROM public.members m
      WHERE m.jamiya_id = welfare_claims.jamiya_id
        AND m.user_id = auth.uid()
        AND m.role::text IN ('treasurer', 'chair', 'circle_admin')
        AND m.status = 'active'
    )
  );
GRANT SELECT ON public.welfare_funds TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.welfare_claims TO authenticated;

-- ===========================================================================
-- Qard Hassan
-- ===========================================================================
CREATE TABLE public.qard_loans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  jamiya_id UUID NOT NULL REFERENCES public.jamiyas (id) ON DELETE CASCADE,
  borrower_id UUID NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  amount NUMERIC(14, 2) NOT NULL CHECK (amount > 0),
  currency CHAR(3) NOT NULL DEFAULT 'KES',
  purpose TEXT NOT NULL,
  status public.qard_status NOT NULL DEFAULT 'requested',
  approved_by UUID REFERENCES public.profiles (id) ON DELETE SET NULL,
  installment_count INT NOT NULL DEFAULT 4 CHECK (installment_count BETWEEN 1 AND 24),
  amount_repaid NUMERIC(14, 2) NOT NULL DEFAULT 0 CHECK (amount_repaid >= 0),
  due_date DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  decided_at TIMESTAMPTZ
);

CREATE TABLE public.qard_repayments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  loan_id UUID NOT NULL REFERENCES public.qard_loans (id) ON DELETE CASCADE,
  amount NUMERIC(14, 2) NOT NULL CHECK (amount > 0),
  currency CHAR(3) NOT NULL DEFAULT 'KES',
  paid_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE
);

CREATE INDEX qard_loans_jamiya_idx ON public.qard_loans (jamiya_id, status);

ALTER TABLE public.qard_loans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.qard_repayments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "qard_select"
  ON public.qard_loans FOR SELECT TO authenticated
  USING (
    borrower_id = auth.uid()
    OR private.is_circle_admin(jamiya_id)
    OR private.is_compliance_or_admin()
  );
CREATE POLICY "qard_insert"
  ON public.qard_loans FOR INSERT TO authenticated
  WITH CHECK (borrower_id = auth.uid() AND private.is_active_jamiya_member(jamiya_id));
CREATE POLICY "qard_update_admin"
  ON public.qard_loans FOR UPDATE TO authenticated
  USING (
    private.is_circle_admin(jamiya_id)
    OR EXISTS (
      SELECT 1 FROM public.members m
      WHERE m.jamiya_id = qard_loans.jamiya_id
        AND m.user_id = auth.uid()
        AND m.role::text IN ('treasurer', 'chair', 'circle_admin')
        AND m.status = 'active'
    )
  );
CREATE POLICY "qard_repay_select"
  ON public.qard_repayments FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.qard_loans l
      WHERE l.id = loan_id
        AND (
          l.borrower_id = auth.uid()
          OR private.is_circle_admin(l.jamiya_id)
          OR private.is_compliance_or_admin()
        )
    )
  );
GRANT SELECT, INSERT, UPDATE ON public.qard_loans TO authenticated;
GRANT SELECT, INSERT ON public.qard_repayments TO authenticated;

-- ===========================================================================
-- Tawarruq (partner bank handoff)
-- ===========================================================================
CREATE TABLE public.tawarruq_applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  jamiya_id UUID REFERENCES public.jamiyas (id) ON DELETE SET NULL,
  amount NUMERIC(14, 2) NOT NULL CHECK (amount > 0),
  currency CHAR(3) NOT NULL DEFAULT 'KES',
  purpose TEXT NOT NULL,
  status public.tawarruq_status NOT NULL DEFAULT 'requested',
  partner_reference TEXT,
  partner_status TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER tawarruq_set_updated_at
  BEFORE UPDATE ON public.tawarruq_applications
  FOR EACH ROW EXECUTE FUNCTION private.set_updated_at();

ALTER TABLE public.tawarruq_applications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tawarruq_select_own"
  ON public.tawarruq_applications FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR private.is_compliance_or_admin());
CREATE POLICY "tawarruq_insert_own"
  ON public.tawarruq_applications FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());
CREATE POLICY "tawarruq_update_admin"
  ON public.tawarruq_applications FOR UPDATE TO authenticated
  USING (private.is_compliance_or_admin());
GRANT SELECT, INSERT ON public.tawarruq_applications TO authenticated;
GRANT UPDATE ON public.tawarruq_applications TO authenticated;

-- ===========================================================================
-- Engagement: savings goals, referrals, circle chat
-- ===========================================================================
CREATE TABLE public.savings_goals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  target_amount NUMERIC(14, 2) NOT NULL CHECK (target_amount > 0),
  saved_amount NUMERIC(14, 2) NOT NULL DEFAULT 0 CHECK (saved_amount >= 0),
  currency CHAR(3) NOT NULL DEFAULT 'KES',
  target_date DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE public.referrals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_id UUID NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  referee_id UUID NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  reward_amount NUMERIC(14, 2) NOT NULL DEFAULT 0,
  currency CHAR(3) NOT NULL DEFAULT 'KES',
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'qualified', 'rewarded', 'cancelled')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (referee_id)
);

CREATE TABLE public.circle_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  jamiya_id UUID NOT NULL REFERENCES public.jamiyas (id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  body TEXT NOT NULL CHECK (char_length(trim(body)) BETWEEN 1 AND 2000),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX circle_messages_jamiya_idx ON public.circle_messages (jamiya_id, created_at DESC);

ALTER TABLE public.savings_goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.referrals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.circle_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "goals_own" ON public.savings_goals FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "referrals_select" ON public.referrals FOR SELECT TO authenticated
  USING (referrer_id = auth.uid() OR referee_id = auth.uid() OR private.is_compliance_or_admin());
CREATE POLICY "referrals_insert" ON public.referrals FOR INSERT TO authenticated
  WITH CHECK (referee_id = auth.uid());
CREATE POLICY "chat_select" ON public.circle_messages FOR SELECT TO authenticated
  USING (private.is_jamiya_member(jamiya_id));
CREATE POLICY "chat_insert" ON public.circle_messages FOR INSERT TO authenticated
  WITH CHECK (sender_id = auth.uid() AND private.is_active_jamiya_member(jamiya_id));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.savings_goals TO authenticated;
GRANT SELECT, INSERT ON public.referrals TO authenticated;
GRANT SELECT, INSERT ON public.circle_messages TO authenticated;

-- ===========================================================================
-- Platform tips (separate from sadaka)
-- ===========================================================================
CREATE TABLE public.platform_tips (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles (id) ON DELETE SET NULL,
  amount NUMERIC(14, 2) NOT NULL CHECK (amount > 0),
  currency CHAR(3) NOT NULL DEFAULT 'KES',
  phone TEXT,
  payment_intent_id UUID REFERENCES public.payment_intents (id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.platform_tips ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tips_select_own" ON public.platform_tips FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR private.is_compliance_or_admin());
GRANT SELECT ON public.platform_tips TO authenticated;

-- ===========================================================================
-- USSD sessions (Africa's Talking style)
-- ===========================================================================
CREATE TABLE public.ussd_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id TEXT NOT NULL UNIQUE,
  phone TEXT NOT NULL,
  user_id UUID REFERENCES public.profiles (id) ON DELETE SET NULL,
  menu_state TEXT NOT NULL DEFAULT 'home',
  last_input TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER ussd_sessions_set_updated_at
  BEFORE UPDATE ON public.ussd_sessions
  FOR EACH ROW EXECUTE FUNCTION private.set_updated_at();

ALTER TABLE public.ussd_sessions ENABLE ROW LEVEL SECURITY;
-- service role only for USSD
REVOKE ALL ON public.ussd_sessions FROM authenticated, anon;
GRANT ALL ON public.ussd_sessions TO service_role;
