BEGIN;
INSERT INTO public.contributions (
  jamiya_id, member_id, cycle_number, amount, amount_paid, currency, status, due_date
) VALUES (
  '55555555-5555-5555-5555-555555555555',
  'b6481b45-32b1-44c1-a14b-95545087bb99',
  99, 20000, 20000, 'KES', 'paid', CURRENT_DATE
);
UPDATE public.jamiyas
SET challenge_kind = 'share_dividend'
WHERE id = '55555555-5555-5555-5555-555555555555';
INSERT INTO public.book_entries (
  jamiya_id, member_id, entry_type, amount, currency, effective_date, entered_by
) VALUES (
  '55555555-5555-5555-5555-555555555555',
  'b6481b45-32b1-44c1-a14b-95545087bb99',
  'contribution', 2000, 'KES', CURRENT_DATE,
  '22222222-2222-2222-2222-222222222222'
);
INSERT INTO public.circle_share_lots (
  jamiya_id, member_id, shares, unit_price, amount, currency
) VALUES (
  '55555555-5555-5555-5555-555555555555',
  'b6481b45-32b1-44c1-a14b-95545087bb99',
  1000, 100, 100000, 'KES'
);
SELECT set_config('request.jwt.claims', json_build_object('sub','22222222-2222-2222-2222-222222222222','role','authenticated')::text, true);
SET LOCAL ROLE authenticated;
SELECT public.qard_cap_for_jamiya('55555555-5555-5555-5555-555555555555');
RESET ROLE;
ROLLBACK;
