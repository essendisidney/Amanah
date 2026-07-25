-- Local / staging seed only. Do NOT use production PII.
-- Creates deterministic demo users for local Auth (`supabase db reset`).

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

DO $$
DECLARE
  admin_id UUID := '11111111-1111-1111-1111-111111111111';
  alice_id UUID := '22222222-2222-2222-2222-222222222222';
  bob_id UUID := '33333333-3333-3333-3333-333333333333';
  compliance_id UUID := '44444444-4444-4444-4444-444444444444';
  jamiya_id UUID := '55555555-5555-5555-5555-555555555555';
  encrypted_pw TEXT := crypt('Password1!', gen_salt('bf'));
BEGIN
  INSERT INTO auth.users (
    instance_id,
    id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    raw_app_meta_data,
    raw_user_meta_data,
    created_at,
    updated_at
  )
  VALUES
    (
      '00000000-0000-0000-0000-000000000000',
      admin_id,
      'authenticated',
      'authenticated',
      'admin@jamiya.local',
      encrypted_pw,
      NOW(),
      '{"provider":"email","providers":["email"],"platform_role":"super_admin"}'::jsonb,
      '{"full_name":"Super Admin"}'::jsonb,
      NOW(),
      NOW()
    ),
    (
      '00000000-0000-0000-0000-000000000000',
      alice_id,
      'authenticated',
      'authenticated',
      'alice@jamiya.local',
      encrypted_pw,
      NOW(),
      '{"provider":"email","providers":["email"],"platform_role":"member"}'::jsonb,
      '{"full_name":"Alice Wanjiku"}'::jsonb,
      NOW(),
      NOW()
    ),
    (
      '00000000-0000-0000-0000-000000000000',
      bob_id,
      'authenticated',
      'authenticated',
      'bob@jamiya.local',
      encrypted_pw,
      NOW(),
      '{"provider":"email","providers":["email"],"platform_role":"member"}'::jsonb,
      '{"full_name":"Bob Otieno"}'::jsonb,
      NOW(),
      NOW()
    ),
    (
      '00000000-0000-0000-0000-000000000000',
      compliance_id,
      'authenticated',
      'authenticated',
      'compliance@jamiya.local',
      encrypted_pw,
      NOW(),
      '{"provider":"email","providers":["email"],"platform_role":"compliance_officer"}'::jsonb,
      '{"full_name":"Compliance Officer"}'::jsonb,
      NOW(),
      NOW()
    )
  ON CONFLICT (id) DO NOTHING;

  -- Email identities (skip if already present for provider/user)
  IF NOT EXISTS (
    SELECT 1 FROM auth.identities WHERE user_id = admin_id AND provider = 'email'
  ) THEN
    INSERT INTO auth.identities (
      id,
      user_id,
      identity_data,
      provider,
      provider_id,
      last_sign_in_at,
      created_at,
      updated_at
    ) VALUES (
      gen_random_uuid(),
      admin_id,
      format('{"sub":"%s","email":"admin@jamiya.local"}', admin_id)::jsonb,
      'email',
      admin_id::text,
      NOW(),
      NOW(),
      NOW()
    );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM auth.identities WHERE user_id = alice_id AND provider = 'email'
  ) THEN
    INSERT INTO auth.identities (
      id,
      user_id,
      identity_data,
      provider,
      provider_id,
      last_sign_in_at,
      created_at,
      updated_at
    ) VALUES (
      gen_random_uuid(),
      alice_id,
      format('{"sub":"%s","email":"alice@jamiya.local"}', alice_id)::jsonb,
      'email',
      alice_id::text,
      NOW(),
      NOW(),
      NOW()
    );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM auth.identities WHERE user_id = bob_id AND provider = 'email'
  ) THEN
    INSERT INTO auth.identities (
      id,
      user_id,
      identity_data,
      provider,
      provider_id,
      last_sign_in_at,
      created_at,
      updated_at
    ) VALUES (
      gen_random_uuid(),
      bob_id,
      format('{"sub":"%s","email":"bob@jamiya.local"}', bob_id)::jsonb,
      'email',
      bob_id::text,
      NOW(),
      NOW(),
      NOW()
    );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM auth.identities WHERE user_id = compliance_id AND provider = 'email'
  ) THEN
    INSERT INTO auth.identities (
      id,
      user_id,
      identity_data,
      provider,
      provider_id,
      last_sign_in_at,
      created_at,
      updated_at
    ) VALUES (
      gen_random_uuid(),
      compliance_id,
      format('{"sub":"%s","email":"compliance@jamiya.local"}', compliance_id)::jsonb,
      'email',
      compliance_id::text,
      NOW(),
      NOW(),
      NOW()
    );
  END IF;

  UPDATE public.profiles
  SET
    platform_role = 'super_admin',
    profile_completed = TRUE,
    full_name = COALESCE(full_name, 'Super Admin'),
    email = 'admin@jamiya.local'
  WHERE id = admin_id;

  UPDATE public.profiles
  SET
    platform_role = 'compliance_officer',
    profile_completed = TRUE,
    full_name = COALESCE(full_name, 'Compliance Officer'),
    email = 'compliance@jamiya.local'
  WHERE id = compliance_id;

  UPDATE public.profiles
  SET
    profile_completed = TRUE,
    full_name = COALESCE(full_name, 'Alice Wanjiku'),
    email = 'alice@jamiya.local',
    country_code = 'KE'
  WHERE id = alice_id;

  UPDATE public.profiles
  SET
    profile_completed = TRUE,
    full_name = COALESCE(full_name, 'Bob Otieno'),
    email = 'bob@jamiya.local',
    country_code = 'KE'
  WHERE id = bob_id;

  INSERT INTO public.jamiyas (
    id,
    name,
    slug,
    description,
    status,
    created_by,
    contribution_amount,
    currency,
    max_members,
    cycle_count,
    contribution_frequency_days,
    start_date
  )
  VALUES (
    jamiya_id,
    'Nairobi Sisters Circle',
    'nairobi-sisters-circle',
    'A Shariah-compliant rotating savings circle for community members in Nairobi.',
    'open',
    alice_id,
    5000.00,
    'KES',
    6,
    6,
    30,
    CURRENT_DATE + 7
  )
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.members (
    jamiya_id,
    user_id,
    role,
    status,
    payout_position,
    joined_at
  )
  VALUES (
    jamiya_id,
    bob_id,
    'member',
    'active',
    2,
    NOW()
  )
  ON CONFLICT (jamiya_id, user_id) DO NOTHING;

  IF NOT EXISTS (
    SELECT 1
    FROM public.notifications
    WHERE user_id = alice_id
      AND title = 'Welcome to Amanah'
  ) THEN
    INSERT INTO public.notifications (user_id, type, channel, title, body, data)
    VALUES (
      alice_id,
      'system',
      'in_app',
      'Welcome to Amanah',
      'Your demo circle is ready. Invite members and set the payout order.',
      jsonb_build_object('jamiya_id', jamiya_id)
    );
  END IF;
END $$;
