-- Local only. Rolls back. Proves a second request cannot use money already waiting on an admin.
BEGIN;

UPDATE public.wallets
SET balance = 500, available_balance = 500
WHERE user_id = '22222222-2222-2222-2222-222222222222'
  AND currency = 'KES';

SELECT set_config(
  'request.jwt.claims',
  json_build_object(
    'sub', '22222222-2222-2222-2222-222222222222',
    'role', 'authenticated'
  )::text,
  true
);
SET LOCAL ROLE authenticated;

SELECT public.request_withdrawal(400, 'KES', 'mpesa', '+254700000002', NULL, NULL, NULL) AS first_request;
SELECT public.request_withdrawal(200, 'KES', 'mpesa', '+254700000002', NULL, NULL, NULL) AS over_reserve;
SELECT public.request_withdrawal(100, 'KES', 'mpesa', '+254700000002', NULL, NULL, NULL) AS rest_of_wallet;

RESET ROLE;
ROLLBACK;
