-- Minutes and resolutions: a circle's written record of what it decided.
--
-- The secretary, chair or circle admin writes up the minutes of a meeting or a resolution the
-- circle adopted, optionally attaches the signed copy (PDF, photo or Word file), and publishes
-- it. Members read published records and their files; drafts are visible only to those who can
-- write them. Files live in the private 'circle-records' bucket under '<jamiya_id>/...', readable
-- only by that circle's members.

CREATE TABLE IF NOT EXISTS public.circle_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  jamiya_id UUID NOT NULL REFERENCES public.jamiyas(id) ON DELETE CASCADE,
  meeting_id UUID REFERENCES public.circle_meetings(id) ON DELETE SET NULL,
  kind TEXT NOT NULL CHECK (kind IN ('minutes', 'resolution')),
  title TEXT NOT NULL CHECK (char_length(btrim(title)) BETWEEN 3 AND 200),
  body TEXT NOT NULL DEFAULT '' CHECK (char_length(body) <= 20000),
  record_date DATE NOT NULL DEFAULT CURRENT_DATE,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published')),
  file_path TEXT,
  file_name TEXT,
  mime_type TEXT,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  published_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  published_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (file_path IS NULL OR file_path LIKE jamiya_id::text || '/%'),
  CHECK (status = 'draft' OR char_length(btrim(body)) > 0 OR file_path IS NOT NULL)
);
CREATE INDEX IF NOT EXISTS circle_records_jamiya_idx
  ON public.circle_records (jamiya_id, record_date DESC, created_at DESC);

-- Who keeps a circle's records: its secretary, chair or circle admin (as for meetings).
CREATE OR REPLACE FUNCTION private.can_keep_circle_records(p_jamiya_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.members m
    WHERE m.jamiya_id = p_jamiya_id
      AND m.user_id = auth.uid()
      AND m.status = 'active'
      AND m.role::text IN ('secretary', 'chair', 'circle_admin')
  ) OR private.is_platform_admin();
$$;

ALTER TABLE public.circle_records ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.circle_records FROM anon;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.circle_records FROM authenticated;
CREATE POLICY circle_records_select ON public.circle_records
  FOR SELECT TO authenticated
  USING (
    (status = 'published' AND (private.is_active_jamiya_member(jamiya_id) OR private.is_circle_officer(jamiya_id)))
    OR private.can_keep_circle_records(jamiya_id)
    OR private.is_compliance_or_admin()
  );

-- ---------------------------------------------------------------------------
-- Files: private bucket, one folder per circle
-- ---------------------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'circle-records', 'circle-records', false, 10485760,
  ARRAY['application/pdf', 'image/jpeg', 'image/png', 'image/webp',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document']
)
ON CONFLICT (id) DO NOTHING;

-- The circle a file in 'circle-records' belongs to (its first folder), or NULL.
CREATE OR REPLACE FUNCTION private.circle_record_folder(p_name TEXT)
RETURNS UUID
LANGUAGE sql
IMMUTABLE
SET search_path TO ''
AS $$
  SELECT CASE
    WHEN split_part(p_name, '/', 1) ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      THEN split_part(p_name, '/', 1)::uuid
  END;
$$;

CREATE POLICY circle_records_files_read ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'circle-records'
    AND (
      private.is_active_jamiya_member(private.circle_record_folder(name))
      OR private.is_circle_officer(private.circle_record_folder(name))
      OR private.is_compliance_or_admin()
    )
  );
CREATE POLICY circle_records_files_insert ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'circle-records'
    AND private.can_keep_circle_records(private.circle_record_folder(name))
  );
CREATE POLICY circle_records_files_delete ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'circle-records'
    AND private.can_keep_circle_records(private.circle_record_folder(name))
  );

-- ---------------------------------------------------------------------------
-- Writing, publishing and deleting
-- ---------------------------------------------------------------------------
-- Create a record, or update a draft (p_record_id). Files are uploaded first, into
-- '<jamiya_id>/...'; pass p_file_path NULL to keep the current file.
CREATE OR REPLACE FUNCTION public.save_circle_record(
  p_jamiya_id UUID,
  p_kind TEXT,
  p_title TEXT,
  p_body TEXT,
  p_record_date DATE DEFAULT NULL,
  p_meeting_id UUID DEFAULT NULL,
  p_file_path TEXT DEFAULT NULL,
  p_file_name TEXT DEFAULT NULL,
  p_mime_type TEXT DEFAULT NULL,
  p_record_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_r public.circle_records%ROWTYPE;
  v_id UUID;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'UNAUTHENTICATED');
  END IF;
  IF NOT private.can_keep_circle_records(p_jamiya_id) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'FORBIDDEN');
  END IF;
  IF p_kind IS NULL OR p_kind NOT IN ('minutes', 'resolution')
     OR p_title IS NULL OR char_length(btrim(p_title)) NOT BETWEEN 3 AND 200
     OR char_length(coalesce(p_body, '')) > 20000
     OR (p_file_path IS NOT NULL AND (p_file_path NOT LIKE p_jamiya_id::text || '/%' OR p_file_path LIKE '%..%'))
     OR (p_record_date IS NOT NULL AND p_record_date > CURRENT_DATE + 1) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'INVALID');
  END IF;
  IF p_meeting_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.circle_meetings WHERE id = p_meeting_id AND jamiya_id = p_jamiya_id
  ) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'INVALID');
  END IF;

  IF p_record_id IS NULL THEN
    INSERT INTO public.circle_records (
      jamiya_id, meeting_id, kind, title, body, record_date, file_path, file_name, mime_type, created_by
    ) VALUES (
      p_jamiya_id, p_meeting_id, p_kind, btrim(p_title), coalesce(p_body, ''),
      coalesce(p_record_date, CURRENT_DATE), p_file_path, left(p_file_name, 200), left(p_mime_type, 120), v_uid
    )
    RETURNING id INTO v_id;
  ELSE
    SELECT * INTO v_r FROM public.circle_records WHERE id = p_record_id AND jamiya_id = p_jamiya_id FOR UPDATE;
    IF NOT FOUND THEN
      RETURN jsonb_build_object('ok', false, 'error', 'NOT_FOUND');
    END IF;
    IF v_r.status <> 'draft' THEN
      RETURN jsonb_build_object('ok', false, 'error', 'ALREADY_PUBLISHED');
    END IF;
    UPDATE public.circle_records
    SET kind = p_kind, title = btrim(p_title), body = coalesce(p_body, ''),
        record_date = coalesce(p_record_date, record_date), meeting_id = p_meeting_id,
        file_path = coalesce(p_file_path, file_path),
        file_name = CASE WHEN p_file_path IS NULL THEN file_name ELSE left(p_file_name, 200) END,
        mime_type = CASE WHEN p_file_path IS NULL THEN mime_type ELSE left(p_mime_type, 120) END,
        updated_at = NOW()
    WHERE id = p_record_id;
    v_id := p_record_id;
  END IF;

  RETURN jsonb_build_object('ok', true, 'record_id', v_id, 'replaced_file',
    CASE WHEN p_record_id IS NOT NULL AND p_file_path IS NOT NULL THEN v_r.file_path END);
END;
$$;

-- Publish a draft: members can then read it, and are told.
CREATE OR REPLACE FUNCTION public.publish_circle_record(p_record_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_r public.circle_records%ROWTYPE;
  v_slug TEXT;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'UNAUTHENTICATED');
  END IF;
  SELECT * INTO v_r FROM public.circle_records WHERE id = p_record_id FOR UPDATE;
  IF NOT FOUND OR NOT private.can_keep_circle_records(v_r.jamiya_id) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'NOT_FOUND');
  END IF;
  IF v_r.status = 'published' THEN
    RETURN jsonb_build_object('ok', true, 'unchanged', true);
  END IF;
  IF char_length(btrim(v_r.body)) = 0 AND v_r.file_path IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'EMPTY');
  END IF;

  UPDATE public.circle_records
  SET status = 'published', published_by = v_uid, published_at = NOW(), updated_at = NOW()
  WHERE id = p_record_id;

  SELECT slug INTO v_slug FROM public.jamiyas WHERE id = v_r.jamiya_id;
  PERFORM private.notify_circle_members(
    v_r.jamiya_id,
    CASE WHEN v_r.kind = 'minutes' THEN 'Minutes posted' ELSE 'Resolution posted' END,
    v_r.title,
    jsonb_build_object('kind', 'circle_record', 'jamiya_id', v_r.jamiya_id, 'record_id', v_r.id, 'slug', v_slug,
                       'href', '/circles/' || v_slug || '/records')
  );
  INSERT INTO public.audit_logs (actor_id, action, entity_type, entity_id, jamiya_id, metadata)
  VALUES (v_uid, 'update', 'circle_record', v_r.id, v_r.jamiya_id,
          jsonb_build_object('event', 'circle.record_published', 'kind', v_r.kind));
  RETURN jsonb_build_object('ok', true);
END;
$$;

-- Delete a draft. Published records stay: they are the circle's record. Returns the file path
-- so the caller can remove the file.
CREATE OR REPLACE FUNCTION public.delete_circle_record(p_record_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  v_r public.circle_records%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'UNAUTHENTICATED');
  END IF;
  SELECT * INTO v_r FROM public.circle_records WHERE id = p_record_id FOR UPDATE;
  IF NOT FOUND OR NOT private.can_keep_circle_records(v_r.jamiya_id) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'NOT_FOUND');
  END IF;
  IF v_r.status <> 'draft' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'ALREADY_PUBLISHED');
  END IF;
  DELETE FROM public.circle_records WHERE id = p_record_id;
  RETURN jsonb_build_object('ok', true, 'file_path', v_r.file_path);
END;
$$;

REVOKE ALL ON FUNCTION private.can_keep_circle_records(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.can_keep_circle_records(UUID) TO authenticated;
REVOKE ALL ON FUNCTION private.circle_record_folder(TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.circle_record_folder(TEXT) TO authenticated;
REVOKE ALL ON FUNCTION public.save_circle_record(UUID, TEXT, TEXT, TEXT, DATE, UUID, TEXT, TEXT, TEXT, UUID) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.publish_circle_record(UUID) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.delete_circle_record(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.save_circle_record(UUID, TEXT, TEXT, TEXT, DATE, UUID, TEXT, TEXT, TEXT, UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.publish_circle_record(UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.delete_circle_record(UUID) TO authenticated, service_role;
