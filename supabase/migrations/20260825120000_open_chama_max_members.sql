-- Allow open chamas with a higher member ceiling.
-- App currently treats blank max as openMaxMembers (50) until this is applied;
-- after apply, raise packages/shared openMaxMembers/maxMembers to 500.
ALTER TABLE public.jamiyas
  DROP CONSTRAINT IF EXISTS jamiyas_max_members_range;

ALTER TABLE public.jamiyas
  ADD CONSTRAINT jamiyas_max_members_range
  CHECK (max_members BETWEEN 2 AND 500);
