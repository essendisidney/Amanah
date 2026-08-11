-- Faith / seasonal savings categories for attraction & marketing
DO $$
DECLARE
  v_con TEXT;
BEGIN
  SELECT c.conname INTO v_con
  FROM pg_constraint c
  JOIN pg_class t ON t.oid = c.conrelid
  JOIN pg_namespace n ON n.oid = t.relnamespace
  WHERE n.nspname = 'public'
    AND t.relname = 'savings_pockets'
    AND c.contype = 'c'
    AND pg_get_constraintdef(c.oid) ILIKE '%category%';

  IF v_con IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.savings_pockets DROP CONSTRAINT %I', v_con);
  END IF;
END $$;

ALTER TABLE public.savings_pockets
  ADD CONSTRAINT savings_pockets_category_check
  CHECK (category IN (
    'regular',
    'emergency',
    'school',
    'holiday',
    'investment',
    'goal',
    'hajj',
    'umrah',
    'udhiyah'
  ));
