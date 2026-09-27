BEGIN;
SELECT set_config('request.jwt.claims', json_build_object('sub','22222222-2222-2222-2222-222222222222','role','authenticated')::text, true);
SET LOCAL ROLE authenticated;
SELECT public.my_facility_qualification();
SELECT public.qard_cap_for_jamiya('55555555-5555-5555-5555-555555555555');
SELECT public.submit_jameiyah_tawarruq(1000, 'Test room gate', NULL, 1000, 6, true, NULL);
RESET ROLE;
ROLLBACK;
