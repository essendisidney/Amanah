-- Loaded by scripts/test-db.mjs before migrations. Fills in what the Supabase
-- storage-api and GoTrue services would create; `supabase start` does not need it.
ALTER TABLE storage.buckets
  ADD COLUMN IF NOT EXISTS public BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS file_size_limit BIGINT,
  ADD COLUMN IF NOT EXISTS allowed_mime_types TEXT[],
  ADD COLUMN IF NOT EXISTS avif_autodetection BOOLEAN DEFAULT FALSE;

ALTER TABLE storage.objects
  ADD COLUMN IF NOT EXISTS owner_id TEXT,
  ADD COLUMN IF NOT EXISTS version TEXT,
  ADD COLUMN IF NOT EXISTS user_metadata JSONB;

CREATE OR REPLACE FUNCTION storage.foldername(name TEXT)
RETURNS TEXT[] LANGUAGE sql IMMUTABLE AS $$
  SELECT (string_to_array(name, '/'))[1:array_length(string_to_array(name, '/'), 1) - 1]
$$;

-- GoTrue normally creates this; one migration rewrites rows in it.
CREATE TABLE IF NOT EXISTS auth.identities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  provider TEXT NOT NULL,
  provider_id TEXT NOT NULL,
  identity_data JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
GRANT ALL ON auth.identities TO postgres;

-- GoTrue adds these to auth.users; the signup trigger reads them.
ALTER TABLE auth.users
  ADD COLUMN IF NOT EXISTS phone TEXT,
  ADD COLUMN IF NOT EXISTS raw_app_meta_data JSONB,
  ADD COLUMN IF NOT EXISTS raw_user_meta_data JSONB;

-- GoTrue's current helpers read the JSON `request.jwt.claims` setting
-- (what PostgREST sets); the image ships the older single-claim versions.
CREATE OR REPLACE FUNCTION auth.uid() RETURNS UUID LANGUAGE sql STABLE AS $$
  SELECT coalesce(
    nullif(current_setting('request.jwt.claim.sub', true), ''),
    (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub')
  )::uuid
$$;

CREATE OR REPLACE FUNCTION auth.role() RETURNS TEXT LANGUAGE sql STABLE AS $$
  SELECT coalesce(
    nullif(current_setting('request.jwt.claim.role', true), ''),
    (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role')
  )::text
$$;
