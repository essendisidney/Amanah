# Phase 6 — Mobile parity, bank PSP, playbooks & observability

## Deliverables

1. **Collections playbooks** — `collection_playbooks` / `collection_playbook_steps` / `collection_case_actions`; `run_collection_playbook` RPC; admin `/admin/playbooks`; “Run playbook step” on cases.
2. **Live bank PSP** — `bank_transfer_jobs`; enhanced `payments-bank` Edge Function calls `BANK_API_URL/transfers` when `BANK_API_KEY` is set; simulated fallback unless `REQUIRE_REAL_PROVIDERS=true`.
3. **Mobile API parity**
   - `GET /api/v1/invitations`
   - `POST /api/v1/invitations/respond`
   - `GET|POST /api/v1/kyc`
   - `GET|POST /api/v1/withdrawals`
   - `GET /api/v1/health`
4. **Expo app** — tabs for Home, Circles, Dues (pay), Invites, KYC status.
5. **Observability** — `/admin/observability` ops snapshot + health endpoint; Sentry hook remains via `NEXT_PUBLIC_SENTRY_DSN`.

## Migration

`supabase/migrations/20260725120000_phase6_playbooks_bank_psp.sql`

```bash
npx supabase db push --db-url "$DATABASE_URL"
```

## Edge Function

```bash
npx supabase functions deploy payments-bank
# Secrets: BANK_API_URL, BANK_API_KEY, REQUIRE_REAL_PROVIDERS
```

## Mobile

See `apps/mobile/README.md`.
