# Phase 0 — Lock the rails (ops)

Kenya payment build order put **ops** first. Code phases 1–9 can sit local until this is green.

## Status (checked 2026-09-21)

| Check | Status | Evidence |
|-------|--------|----------|
| Domains live | **Green** | `jameiyah.com`, `www`, `jameiyah.co.ke`, `www` verified on Vercel project **amanah**; HTTP 200 |
| `NEXT_PUBLIC_APP_URL` | **Green** | Set on Vercel (preview plain `https://jameiyah.com`; production present) |
| Taifa SMS key | **Green** | `GET /api/v1/health` → `otp.taifa_key: true`; `TAIFA_API_KEY` / `TAIFA_SENDER_ID` on production |
| Supabase project | **Green** | `vzpnixfqkvovbniaoudx` `ACTIVE_HEALTHY` |
| Prod app revision | **Behind** | Health `version: 7b27418` — Kenya payment phases 1–9 are **local uncommitted** |
| Orchestrator health | **Missing on prod** | `GET /api/v1/payments/orchestrator-health` → 404 until ship |
| Daraja secrets | **Not configured** | `mpesa-health`: `daraja_configured: false`; provider=`paystack` |
| Auth Site URL | **Manual confirm** | Dashboard must use Site URL `https://jameiyah.com` + redirect allow-list (see `DOMAINS.md`) |
| Secrets rotation | **Manual** | DB password / service role shared in past chats — rotate when ready |

## Ship order (this phase)

1. Confirm Supabase Auth URL config (`DOMAINS.md` §3).
2. Commit + push Kenya payment work (phases 1–9) when you say **commit**.
3. `npx vercel deploy --prod` (or Git-connected deploy) when you say **deploy**.
4. `npx supabase functions deploy payments-mpesa --project-ref vzpnixfqkvovbniaoudx` (needs CLI login / access token).
5. Re-run smoke: [SMOKE_TEST.md](./SMOKE_TEST.md) — expect orchestrator-health `ok: true`.
6. Optional: rotate DB password + service role; update Vercel; redeploy.

Do **not** flip `REQUIRE_REAL_PROVIDERS=true` or remove `ALLOW_SIMULATED_IN_PROD` until Daraja/`PAYMENT_PROVIDER` cutover is intentional.
