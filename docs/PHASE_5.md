# Phase 5 — Collections, mobile scaffold & production cutover

## What shipped

1. **Collections** — `collection_cases` from late contributions; `sync_collection_cases` / `update_collection_case`; `/admin/collections`; Edge Function `collections`.
2. **Mobile API** — Bearer + cookie auth via `createApiClient`:
   - `GET /api/v1/me`
   - `GET /api/v1/circles`
   - `GET /api/v1/contributions` · `POST /api/v1/contributions/pay`
   - `POST /api/v1/wallet/top-up`
   - `GET /api/v1/notifications`
   - `GET /api/v1/collections`
3. **Expo scaffold** — `apps/mobile` signs in with Supabase and loads `/api/v1/me`.
4. **Production cutover** — `shouldBlockSimulatedPayments()` / `REQUIRE_REAL_PROVIDERS` (+ auto-block in production unless `ALLOW_SIMULATED_IN_PROD=true`).

## Cron

```bash
curl -X POST "$SUPABASE_URL/functions/v1/collections" \
  -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY"
```

## Mobile

See `apps/mobile/README.md`.
