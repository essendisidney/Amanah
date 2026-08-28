-- Next of kin for circle members (all challenge kinds).

CREATE TABLE IF NOT EXISTS public.member_next_of_kin (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  jamiya_id UUID NOT NULL REFERENCES public.jamiyas (id) ON DELETE CASCADE,
  member_id UUID NOT NULL REFERENCES public.members (id) ON DELETE CASCADE,
  full_name TEXT NOT NULL CHECK (char_length(trim(full_name)) BETWEEN 1 AND 120),
  phone TEXT,
  relationship TEXT NOT NULL DEFAULT 'other'
    CHECK (relationship IN (
      'spouse', 'parent', 'sibling', 'child', 'guardian', 'friend', 'other'
    )),
  notes TEXT,
  created_by UUID REFERENCES public.profiles (id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (member_id)
);

CREATE INDEX IF NOT EXISTS member_next_of_kin_jamiya_idx
  ON public.member_next_of_kin (jamiya_id);

ALTER TABLE public.member_next_of_kin ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS member_next_of_kin_select ON public.member_next_of_kin;
CREATE POLICY member_next_of_kin_select
  ON public.member_next_of_kin FOR SELECT TO authenticated
  USING (
    private.is_circle_officer(jamiya_id)
    OR private.is_platform_admin()
    OR EXISTS (
      SELECT 1 FROM public.members m
      WHERE m.id = member_id
        AND m.user_id = auth.uid()
        AND m.status = 'active'
    )
  );

GRANT SELECT ON public.member_next_of_kin TO authenticated;

CREATE OR REPLACE FUNCTION public.upsert_member_next_of_kin(
  p_jamiya_id UUID,
  p_member_id UUID,
  p_full_name TEXT,
  p_phone TEXT DEFAULT NULL,
  p_relationship TEXT DEFAULT 'other',
  p_notes TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_name TEXT := NULLIF(trim(COALESCE(p_full_name, '')), '');
  v_phone TEXT := NULLIF(trim(COALESCE(p_phone, '')), '');
  v_rel TEXT := COALESCE(NULLIF(trim(COALESCE(p_relationship, '')), ''), 'other');
  v_notes TEXT := NULLIF(trim(COALESCE(p_notes, '')), '');
  v_id UUID;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'UNAUTHENTICATED');
  END IF;

  IF NOT (
    private.is_circle_officer(p_jamiya_id)
    OR private.is_platform_admin()
    OR EXISTS (
      SELECT 1 FROM public.members m
      WHERE m.jamiya_id = p_jamiya_id
        AND m.user_id = v_uid
        AND m.status = 'active'
        AND m.role::text = 'secretary'
    )
  ) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'FORBIDDEN');
  END IF;

  IF v_name IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'NAME_REQUIRED');
  END IF;

  IF v_rel NOT IN ('spouse', 'parent', 'sibling', 'child', 'guardian', 'friend', 'other') THEN
    v_rel := 'other';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.members m
    WHERE m.id = p_member_id
      AND m.jamiya_id = p_jamiya_id
      AND m.status IN ('active', 'pending', 'suspended')
  ) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'MEMBER_NOT_FOUND');
  END IF;

  INSERT INTO public.member_next_of_kin (
    jamiya_id, member_id, full_name, phone, relationship, notes, created_by, updated_at
  ) VALUES (
    p_jamiya_id, p_member_id, v_name, v_phone, v_rel, v_notes, v_uid, NOW()
  )
  ON CONFLICT (member_id) DO UPDATE
    SET full_name = EXCLUDED.full_name,
        phone = EXCLUDED.phone,
        relationship = EXCLUDED.relationship,
        notes = EXCLUDED.notes,
        updated_at = NOW()
  RETURNING id INTO v_id;

  RETURN jsonb_build_object('ok', true, 'id', v_id);
END;
$$;

REVOKE ALL ON FUNCTION public.upsert_member_next_of_kin(UUID, UUID, TEXT, TEXT, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.upsert_member_next_of_kin(UUID, UUID, TEXT, TEXT, TEXT, TEXT) TO authenticated;

CREATE OR REPLACE FUNCTION public.delete_member_next_of_kin(
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
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'UNAUTHENTICATED');
  END IF;

  IF NOT (
    private.is_circle_officer(p_jamiya_id)
    OR private.is_platform_admin()
    OR EXISTS (
      SELECT 1 FROM public.members m
      WHERE m.jamiya_id = p_jamiya_id
        AND m.user_id = v_uid
        AND m.status = 'active'
        AND m.role::text = 'secretary'
    )
  ) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'FORBIDDEN');
  END IF;

  DELETE FROM public.member_next_of_kin
  WHERE jamiya_id = p_jamiya_id AND member_id = p_member_id;

  RETURN jsonb_build_object('ok', true);
END;
$$;

REVOKE ALL ON FUNCTION public.delete_member_next_of_kin(UUID, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.delete_member_next_of_kin(UUID, UUID) TO authenticated;
