# Phase 8 — Charity & tip payments

Wire Sadaka donations and platform tips through `payment_intents` so paid gifts do not credit the wallet.

## Delivered

- Migration `20260725150000_phase8_charity_payments.sql`
  - `create_payment_intent(..., p_metadata)` — kinds `sadaka` | `platform_tip` | default wallet top-up; min KES 10 for charity/tip
  - `complete_payment_intent` — inserts `charity_donations` / `platform_tips` and marks intent completed (service role or simulated authenticated)
- Web: `apps/web/src/features/charity/actions.ts`
  - Signed-in: create intent → simulated complete or M-Pesa STK via `payments-mpesa`
  - Guest / unsigned: soft fallback to `record_charity_donation` / `record_platform_tip` (ledger-only, no STK)

## Ops

- Default `PAYMENT_PROVIDER=simulated` for staging
- Production live rails: see `docs/GO_LIVE.md`
- Auth Site URL must be the Vercel domain before login smoke tests
