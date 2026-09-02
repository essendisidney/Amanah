# Wave 5 — Bank rails (before live M-Pesa)

Officer-facing bank SMS reconciliation + ops health. Live `BANK_API_*` PSP credentials and Daraja remain separate cutovers.

## Shipped

| Item | Detail |
|------|--------|
| Smart SMS paste | Treasury → paste one/many Kenya bank SMS; auto-parse amount, direction, provider, ref |
| Providers | `equity`, `mpesa`, `kcb`, `coop`, `absa`, `ncba`, `stanbic`, `manual`, `other` |
| Ingest + dedupe | Uses `ingest_bank_alert` (duplicate by `external_ref`) |
| Auto-match | Existing **Auto-match pending alerts** (±3 days cashbook) |
| Bank health | `GET /api/v1/payments/bank-health` + admin Observability rows |
| Edge health | `payments-bank` accepts `{ "action": "health" }` |
| Officer playbook | First-week checklist + Treasury / NOK links per circle type |

## Ops

```bash
# Apply migration
# supabase/migrations/20260902120000_bank_alert_providers_wave5.sql

# Redeploy bank Edge (health action)
npx supabase functions deploy payments-bank --project-ref vzpnixfqkvovbniaoudx

# Optional webhook for machine ingest
# Vercel: BANK_ALERT_WEBHOOK_SECRET=...
# POST /api/webhooks/bank-alerts  with header x-amanah-webhook-secret
```

## Not in this wave

- Live `BANK_API_URL` / `BANK_API_KEY` PSP (still simulated fallback until set)
- `PAYMENT_PROVIDER=bank` production cutover
- Live Daraja / M-Pesa (last, after bank)
