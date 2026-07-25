# Phase 4 — Withdrawals, bank rails, risk & mobile API

## What shipped

1. **Withdrawals** — `withdrawal_requests` + `request_withdrawal` / `process_withdrawal`. Wallet UI + `/admin/withdrawals`.
2. **Bank rails** — `PAYMENT_PROVIDER=bank` + Edge Function `payments-bank` (initiate/confirm; simulated fallback unless `REQUIRE_REAL_PROVIDERS=true`).
3. **Risk scoring** — `member_risk_scores` from late contributions, open disputes, failed payments. `/admin/risk` + recompute.
4. **Gates** — Withdrawals ≥ 20k need KYC; risk score ≥ 80 blocks withdrawals.
5. **Mobile-ready API** — `GET /api/v1/me`, `GET /api/v1/jamiyas`, `POST /api/v1/wallet/top-up` (session auth).

## Env

```bash
PAYMENT_PROVIDER=simulated   # simulated | mpesa | bank
REQUIRE_REAL_PROVIDERS=false # true disables simulated fallbacks
# BANK_API_KEY=
# BANK_API_URL=
```

## Native apps
Use the `/api/v1/*` JSON endpoints with Supabase Auth (email/OTP/OAuth). A dedicated React Native / Flutter client is still a separate Phase 5 deliverable.
