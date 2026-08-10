-- Sadaka system flow: campaign review lifecycle, disbursements, institutional adopt.

-- ---------------------------------------------------------------------------
-- Campaign status extensions (keep legacy values)
-- ---------------------------------------------------------------------------
DO $$ BEGIN
  ALTER TYPE public.campaign_status ADD VALUE IF NOT EXISTS 'pending_review';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TYPE public.campaign_status ADD VALUE IF NOT EXISTS 'rejected';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TYPE public.campaign_status ADD VALUE IF NOT EXISTS 'funded';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TYPE public.campaign_status ADD VALUE IF NOT EXISTS 'disbursed';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TYPE public.campaign_status ADD VALUE IF NOT EXISTS 'closed';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.sadaka_category AS ENUM (
    'medical',
    'funeral',
    'education',
    'business_startup',
    'emergency_disaster',
    'institutional'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.institution_type AS ENUM ('mosque', 'madrasa', 'orphanage');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  CREATE TYPE public.institution_verification_status AS ENUM (
    'pending_verification', 'verified', 'rejected'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  CREATE TYPE public.adoption_profile_status AS ENUM ('active', 'paused', 'closed');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  CREATE TYPE public.sponsorship_status AS ENUM ('active', 'paused', 'cancelled');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  CREATE TYPE public.disbursement_status AS ENUM (
    'pending', 'processing', 'paid', 'failed', 'cancelled'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ---------------------------------------------------------------------------
-- Extend charity_campaigns
-- ---------------------------------------------------------------------------
ALTER TABLE public.charity_campaigns
  ADD COLUMN IF NOT EXISTS category public.sadaka_category,
  ADD COLUMN IF NOT EXISTS beneficiary_name TEXT,
  ADD COLUMN IF NOT EXISTS beneficiary_phone TEXT,
  ADD COLUMN IF NOT EXISTS beneficiary_kyc_doc_url TEXT,
  ADD COLUMN IF NOT EXISTS rejection_reason TEXT,
  ADD COLUMN IF NOT EXISTS reviewed_by UUID REFERENCES public.profiles (id),
  ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS disbursed_amount NUMERIC(14, 2) NOT NULL DEFAULT 0
    CHECK (disbursed_amount >= 0),
  ADD COLUMN IF NOT EXISTS last_disbursed_at TIMESTAMPTZ;

DROP POLICY IF EXISTS "campaigns_public_select_live" ON public.charity_campaigns;
CREATE POLICY "campaigns_public_select_live"
  ON public.charity_campaigns FOR SELECT TO anon, authenticated
  USING (
    status IN ('live', 'funded', 'disbursed', 'closed')
    OR private.is_compliance_or_admin()
    OR created_by = auth.uid()
  );

-- ---------------------------------------------------------------------------
-- Disbursements
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.charity_disbursements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES public.charity_campaigns (id) ON DELETE CASCADE,
  amount NUMERIC(14, 2) NOT NULL CHECK (amount > 0),
  fee_deducted NUMERIC(14, 2) NOT NULL DEFAULT 0 CHECK (fee_deducted >= 0),
  net_amount NUMERIC(14, 2) NOT NULL CHECK (net_amount >= 0),
  currency CHAR(3) NOT NULL DEFAULT 'KES',
  beneficiary_phone TEXT NOT NULL,
  mpesa_b2c_id TEXT,
  status public.disbursement_status NOT NULL DEFAULT 'pending',
  approved_by UUID REFERENCES public.profiles (id),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  paid_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS charity_disbursements_campaign_idx
  ON public.charity_disbursements (campaign_id, created_at DESC);

ALTER TABLE public.charity_disbursements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS charity_disbursements_select ON public.charity_disbursements;
CREATE POLICY charity_disbursements_select ON public.charity_disbursements
  FOR SELECT TO anon, authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.charity_campaigns c
      WHERE c.id = campaign_id
        AND (
          c.status IN ('live', 'funded', 'disbursed', 'closed')
          OR private.is_compliance_or_admin()
          OR c.created_by = auth.uid()
        )
    )
  );

DROP POLICY IF EXISTS charity_disbursements_admin ON public.charity_disbursements;
CREATE POLICY charity_disbursements_admin ON public.charity_disbursements
  FOR ALL TO authenticated
  USING (private.is_compliance_or_admin())
  WITH CHECK (private.is_compliance_or_admin());

GRANT SELECT ON public.charity_disbursements TO anon, authenticated;
GRANT INSERT, UPDATE ON public.charity_disbursements TO authenticated;

-- ---------------------------------------------------------------------------
-- Institutions + adoption
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.sadaka_institutions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  type public.institution_type NOT NULL,
  registration_doc_url TEXT,
  contact_person TEXT NOT NULL,
  contact_phone TEXT,
  contact_user_id UUID REFERENCES public.profiles (id),
  verification_status public.institution_verification_status NOT NULL DEFAULT 'pending_verification',
  verified_by UUID REFERENCES public.profiles (id),
  verified_at TIMESTAMPTZ,
  rejection_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.adoption_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id UUID NOT NULL REFERENCES public.sadaka_institutions (id) ON DELETE CASCADE,
  slug TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  suggested_monthly_amount NUMERIC(14, 2) NOT NULL CHECK (suggested_monthly_amount > 0),
  currency CHAR(3) NOT NULL DEFAULT 'KES',
  fee_bps INT NOT NULL DEFAULT 250 CHECK (fee_bps BETWEEN 0 AND 2000),
  status public.adoption_profile_status NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT adoption_slug_format CHECK (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$')
);

CREATE TABLE IF NOT EXISTS public.sponsorships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  adoption_profile_id UUID NOT NULL REFERENCES public.adoption_profiles (id) ON DELETE CASCADE,
  sponsor_user_id UUID NOT NULL REFERENCES public.profiles (id),
  monthly_amount NUMERIC(14, 2) NOT NULL CHECK (monthly_amount > 0),
  currency CHAR(3) NOT NULL DEFAULT 'KES',
  status public.sponsorship_status NOT NULL DEFAULT 'active',
  next_charge_date DATE NOT NULL DEFAULT (CURRENT_DATE + 30),
  phone TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.sponsorship_charges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sponsorship_id UUID NOT NULL REFERENCES public.sponsorships (id) ON DELETE CASCADE,
  amount NUMERIC(14, 2) NOT NULL CHECK (amount > 0),
  fee_amount NUMERIC(14, 2) NOT NULL DEFAULT 0,
  currency CHAR(3) NOT NULL DEFAULT 'KES',
  payment_intent_id UUID REFERENCES public.payment_intents (id),
  status TEXT NOT NULL DEFAULT 'paid' CHECK (status IN ('pending', 'paid', 'failed')),
  charged_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.adoption_impact_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  adoption_profile_id UUID NOT NULL REFERENCES public.adoption_profiles (id) ON DELETE CASCADE,
  period_label TEXT NOT NULL,
  body TEXT NOT NULL,
  created_by UUID REFERENCES public.profiles (id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.sadaka_institutions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.adoption_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sponsorships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sponsorship_charges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.adoption_impact_reports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS institutions_select ON public.sadaka_institutions;
CREATE POLICY institutions_select ON public.sadaka_institutions FOR SELECT TO authenticated
  USING (
    contact_user_id = auth.uid()
    OR private.is_compliance_or_admin()
    OR verification_status = 'verified'
  );
DROP POLICY IF EXISTS institutions_insert ON public.sadaka_institutions;
CREATE POLICY institutions_insert ON public.sadaka_institutions FOR INSERT TO authenticated
  WITH CHECK (contact_user_id = auth.uid() OR private.is_compliance_or_admin());
DROP POLICY IF EXISTS institutions_admin ON public.sadaka_institutions;
CREATE POLICY institutions_admin ON public.sadaka_institutions FOR UPDATE TO authenticated
  USING (private.is_compliance_or_admin() OR contact_user_id = auth.uid())
  WITH CHECK (private.is_compliance_or_admin() OR contact_user_id = auth.uid());

DROP POLICY IF EXISTS adoption_public_select ON public.adoption_profiles;
CREATE POLICY adoption_public_select ON public.adoption_profiles FOR SELECT TO anon, authenticated
  USING (
    status = 'active'
    OR private.is_compliance_or_admin()
    OR EXISTS (
      SELECT 1 FROM public.sadaka_institutions i
      WHERE i.id = institution_id AND i.contact_user_id = auth.uid()
    )
  );
DROP POLICY IF EXISTS adoption_write ON public.adoption_profiles;
CREATE POLICY adoption_write ON public.adoption_profiles FOR ALL TO authenticated
  USING (
    private.is_compliance_or_admin()
    OR EXISTS (
      SELECT 1 FROM public.sadaka_institutions i
      WHERE i.id = institution_id
        AND i.contact_user_id = auth.uid()
        AND i.verification_status = 'verified'
    )
  )
  WITH CHECK (
    private.is_compliance_or_admin()
    OR EXISTS (
      SELECT 1 FROM public.sadaka_institutions i
      WHERE i.id = institution_id
        AND i.contact_user_id = auth.uid()
        AND i.verification_status = 'verified'
    )
  );

DROP POLICY IF EXISTS sponsorships_select ON public.sponsorships;
CREATE POLICY sponsorships_select ON public.sponsorships FOR SELECT TO authenticated
  USING (sponsor_user_id = auth.uid() OR private.is_compliance_or_admin());
DROP POLICY IF EXISTS sponsorships_insert ON public.sponsorships;
CREATE POLICY sponsorships_insert ON public.sponsorships FOR INSERT TO authenticated
  WITH CHECK (sponsor_user_id = auth.uid());
DROP POLICY IF EXISTS sponsorships_update ON public.sponsorships;
CREATE POLICY sponsorships_update ON public.sponsorships FOR UPDATE TO authenticated
  USING (sponsor_user_id = auth.uid() OR private.is_compliance_or_admin());

DROP POLICY IF EXISTS sponsorship_charges_select ON public.sponsorship_charges;
CREATE POLICY sponsorship_charges_select ON public.sponsorship_charges FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.sponsorships s
      WHERE s.id = sponsorship_id
        AND (s.sponsor_user_id = auth.uid() OR private.is_compliance_or_admin())
    )
  );

DROP POLICY IF EXISTS impact_public_select ON public.adoption_impact_reports;
CREATE POLICY impact_public_select ON public.adoption_impact_reports FOR SELECT TO anon, authenticated
  USING (true);
DROP POLICY IF EXISTS impact_write ON public.adoption_impact_reports;
CREATE POLICY impact_write ON public.adoption_impact_reports FOR INSERT TO authenticated
  WITH CHECK (
    private.is_compliance_or_admin()
    OR EXISTS (
      SELECT 1 FROM public.adoption_profiles ap
      JOIN public.sadaka_institutions i ON i.id = ap.institution_id
      WHERE ap.id = adoption_profile_id AND i.contact_user_id = auth.uid()
    )
  );

GRANT SELECT, INSERT, UPDATE ON public.sadaka_institutions TO authenticated;
GRANT SELECT ON public.sadaka_institutions TO anon;

DROP POLICY IF EXISTS institutions_select_anon ON public.sadaka_institutions;
CREATE POLICY institutions_select_anon ON public.sadaka_institutions FOR SELECT TO anon
  USING (verification_status = 'verified');
GRANT SELECT, INSERT, UPDATE ON public.adoption_profiles TO authenticated;
GRANT SELECT ON public.adoption_profiles TO anon;
GRANT SELECT, INSERT, UPDATE ON public.sponsorships TO authenticated;
GRANT SELECT ON public.sponsorship_charges TO authenticated;
GRANT SELECT, INSERT ON public.adoption_impact_reports TO authenticated;
GRANT SELECT ON public.adoption_impact_reports TO anon;
