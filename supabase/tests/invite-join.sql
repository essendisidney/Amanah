-- Local-only invite join cases. Rolled back at the end.
BEGIN;

DO $$
DECLARE
  alice UUID := '22222222-2222-2222-2222-222222222222';
  bob UUID := '33333333-3333-3333-3333-333333333333';
  compliance UUID := '44444444-4444-4444-4444-444444444444';
  ira UUID := '66666666-6666-6666-6666-666666666666';
  circle UUID := '55555555-5555-5555-5555-555555555555';
  result JSONB;
  code TEXT;
  personal TEXT;
  link_status TEXT;
  joined_count INT;
BEGIN
  PERFORM set_config('request.jwt.claim.sub', '', true);

  result := public.ensure_circle_share_link(circle);
  IF result->>'error' IS DISTINCT FROM 'UNAUTHENTICATED' THEN
    RAISE EXCEPTION 'expected UNAUTHENTICATED, got %', result;
  END IF;

  PERFORM set_config('request.jwt.claim.sub', ira::text, true);
  PERFORM set_config('request.jwt.claims', json_build_object('sub', ira)::text, true);
  result := public.ensure_circle_share_link(circle);
  IF result->>'error' IS DISTINCT FROM 'FORBIDDEN' THEN
    RAISE EXCEPTION 'non-member should not mint a link, got %', result;
  END IF;

  PERFORM set_config('request.jwt.claim.sub', alice::text, true);
  PERFORM set_config('request.jwt.claims', json_build_object('sub', alice)::text, true);
  result := public.ensure_circle_share_link(circle);
  IF result->>'ok' IS DISTINCT FROM 'true' THEN
    RAISE EXCEPTION 'alice share link failed: %', result;
  END IF;
  code := result->>'invite_code';

  result := public.ensure_circle_share_link(circle);
  IF result->>'invite_code' IS DISTINCT FROM code THEN
    RAISE EXCEPTION 'share link was not reused: % vs %', result->>'invite_code', code;
  END IF;

  UPDATE public.jamiyas SET max_members = jamiyas.member_count WHERE id = circle;
  PERFORM set_config('request.jwt.claim.sub', ira::text, true);
  PERFORM set_config('request.jwt.claims', json_build_object('sub', ira)::text, true);
  result := public.accept_invitation(NULL, code, NULL);
  IF result->>'error' IS DISTINCT FROM 'CIRCLE_FULL' THEN
    RAISE EXCEPTION 'expected CIRCLE_FULL, got %', result;
  END IF;
  UPDATE public.jamiyas SET max_members = 6 WHERE id = circle;

  result := public.accept_invitation(NULL, code, NULL);
  IF result->>'ok' IS DISTINCT FROM 'true' OR result->>'slug' IS DISTINCT FROM 'nairobi-sisters-circle' THEN
    RAISE EXCEPTION 'ira join failed: %', result;
  END IF;

  SELECT status INTO link_status FROM public.invitations
  WHERE jamiya_id = circle AND is_share_link AND invite_code = code;
  IF link_status IS DISTINCT FROM 'pending' THEN
    RAISE EXCEPTION 'share link closed after first join: %', link_status;
  END IF;

  PERFORM set_config('request.jwt.claim.sub', compliance::text, true);
  PERFORM set_config('request.jwt.claims', json_build_object('sub', compliance)::text, true);
  result := public.decline_invitation(NULL, code);
  IF result->>'ok' IS DISTINCT FROM 'true' THEN
    RAISE EXCEPTION 'decline share link failed: %', result;
  END IF;
  SELECT status INTO link_status FROM public.invitations
  WHERE jamiya_id = circle AND is_share_link AND invite_code = code;
  IF link_status IS DISTINCT FROM 'pending' THEN
    RAISE EXCEPTION 'decline cancelled the shared link: %', link_status;
  END IF;

  result := public.accept_invitation(NULL, code, NULL);
  IF result->>'ok' IS DISTINCT FROM 'true' THEN
    RAISE EXCEPTION 'second person join failed: %', result;
  END IF;
  SELECT status INTO link_status FROM public.invitations
  WHERE jamiya_id = circle AND is_share_link AND invite_code = code;
  IF link_status IS DISTINCT FROM 'pending' THEN
    RAISE EXCEPTION 'share link closed after second join: %', link_status;
  END IF;

  PERFORM set_config('request.jwt.claim.sub', bob::text, true);
  PERFORM set_config('request.jwt.claims', json_build_object('sub', bob)::text, true);
  result := public.accept_invitation(NULL, code, NULL);
  IF result->>'already_member' IS DISTINCT FROM 'true' THEN
    RAISE EXCEPTION 'bob should already be a member, got %', result;
  END IF;
  SELECT status INTO link_status FROM public.invitations
  WHERE jamiya_id = circle AND is_share_link AND invite_code = code;
  IF link_status IS DISTINCT FROM 'pending' THEN
    RAISE EXCEPTION 'already-member closed the shared link: %', link_status;
  END IF;

  PERFORM set_config('request.jwt.claim.sub', alice::text, true);
  PERFORM set_config('request.jwt.claims', json_build_object('sub', alice)::text, true);
  personal := 'PERS' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 4);
  personal := translate(upper(personal), '01', '23');
  result := public.create_circle_invitation(
    circle, NULL, '+254700000004', NULL,
    replace(gen_random_uuid()::text, '-', ''),
    personal,
    NOW() + INTERVAL '7 days'
  );
  IF result->>'ok' IS DISTINCT FROM 'true' THEN
    RAISE EXCEPTION 'personal invite failed: %', result;
  END IF;

  PERFORM set_config('request.jwt.claim.sub', ira::text, true);
  PERFORM set_config('request.jwt.claims', json_build_object('sub', ira)::text, true);
  result := public.accept_invitation(NULL, personal, NULL);
  IF result->>'error' IS DISTINCT FROM 'WRONG_INVITEE' THEN
    RAISE EXCEPTION 'expected WRONG_INVITEE, got %', result;
  END IF;

  PERFORM set_config('request.jwt.claim.sub', compliance::text, true);
  PERFORM set_config('request.jwt.claims', json_build_object('sub', compliance)::text, true);
  result := public.accept_invitation(NULL, personal, NULL);
  IF result->>'already_member' IS DISTINCT FROM 'true' THEN
    RAISE EXCEPTION 'matching person should be already in, got %', result;
  END IF;
  SELECT status INTO link_status FROM public.invitations WHERE upper(invite_code) = personal;
  IF link_status IS DISTINCT FROM 'accepted' THEN
    RAISE EXCEPTION 'personal invite should close, got %', link_status;
  END IF;

  PERFORM set_config('request.jwt.claim.sub', alice::text, true);
  PERFORM set_config('request.jwt.claims', json_build_object('sub', alice)::text, true);
  personal := translate(upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8)), '01', '23');
  result := public.create_circle_invitation(
    circle, 'bob@jamiya.local', NULL, bob,
    replace(gen_random_uuid()::text, '-', ''),
    personal,
    NOW() - INTERVAL '1 day'
  );
  IF result->>'ok' IS DISTINCT FROM 'true' THEN
    RAISE EXCEPTION 'expired invite create failed: %', result;
  END IF;
  PERFORM set_config('request.jwt.claim.sub', bob::text, true);
  PERFORM set_config('request.jwt.claims', json_build_object('sub', bob)::text, true);
  result := public.accept_invitation(NULL, personal, NULL);
  IF result->>'error' IS DISTINCT FROM 'EXPIRED' THEN
    RAISE EXCEPTION 'expected EXPIRED, got %', result;
  END IF;

  SELECT count(*) INTO joined_count FROM public.members
  WHERE jamiya_id = circle AND status = 'active' AND user_id IN (ira, compliance);
  IF joined_count <> 2 THEN
    RAISE EXCEPTION 'expected ira and compliance joined, count %', joined_count;
  END IF;

  RAISE NOTICE 'INVITE_JOIN_OK code=%', code;
END $$;

ROLLBACK;
