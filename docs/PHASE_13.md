# Phase 13 — Deferred items without Daraja

Ships the remaining `PHASES.md` Later items **except** live M-Pesa / Daraja.

| Step | Deliverable | Status |
|------|-------------|--------|
| 13.1 | Sadaka fee admin + Sharia policy audit trail | Complete |
| 13.2 | Tawarruq partner Edge (live API toggle + webhook) | Complete |
| 13.3 | Expo wallet / finance / officer + v1 API routes | Complete |
| 13.4 | Africa’s Talking USSD auth + shortcode docs | Complete |

## 13.1 Sadaka / Sharia fee policy

- Admin console: `/admin/sadaka`
- RPC: `set_campaign_fee_policy` + table `sharia_fee_policy_events`
- Ops flips `fee_mode`, `fee_bps`, `sharia_board_endorsed`, and campaign `status` after board sign-off (no redeploy)

## 13.2 Tawarruq partner API

Edge Function `tawarruq-partner`:

| Mode | Behaviour |
|------|-----------|
| Secrets unset | Simulated `partner_ack` (default) |
| `TAWARRUQ_PARTNER_API_URL` + `TAWARRUQ_PARTNER_API_KEY` | POST `/applications` |
| `REQUIRE_REAL_PROVIDERS=true` without secrets | Fail closed (`submit_failed`) |
| `?action=webhook` + `TAWARRUQ_WEBHOOK_SECRET` | Partner status callbacks |

```bash
npx supabase functions deploy tawarruq-partner --project-ref vzpnixfqkvovbniaoudx
npx supabase secrets set TAWARRUQ_PARTNER_API_URL=... TAWARRUQ_PARTNER_API_KEY=... TAWARRUQ_WEBHOOK_SECRET=...
```

## 13.3 Mobile parity

New `/api/v1` routes (Bearer auth):

- `GET /api/v1/wallet`, `POST /api/v1/wallet/retry`
- `GET|POST /api/v1/finance/qard|tawarruq|goals|welfare`
- `GET|POST /api/v1/circles/[id]/officer`

Expo tabs: Wallet, Finance, Officer (plus existing Home / Circles / Dues / Invites / KYC).

Top-up uses existing `PAYMENT_PROVIDER=simulated|bank` (Daraja still deferred).

## 13.4 USSD (Africa’s Talking)

Callback: `https://amanah-liart.vercel.app/api/ussd`

| Env (Vercel) | Purpose |
|--------------|---------|
| `USSD_CALLBACK_SECRET` | Required header `X-USSD-Secret` or `?secret=` when set |
| `AT_USSD_SHORTCODE` | Optional `serviceCode` match |
| `AT_USERNAME` / `AT_API_KEY` | Documented for AT console (not required by handler) |

Provision the shortcode in Africa’s Talking and point the callback URL at production. Menu already supports balance, circles, dues, help.

## Explicitly out of scope

- Live Daraja STK / B2C (`PAYMENT_PROVIDER=mpesa`)
- Partner bank OpenAPI credentials (scaffold ready)
- Actual Sharia board meeting (ops flip via `/admin/sadaka`)

## Migration

`supabase/migrations/20260806120000_phase13_deferred_non_daraja.sql`
