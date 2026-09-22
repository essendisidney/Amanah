# Adding a payment provider

Jameiyah’s money path is:

```
Feature → collectPayment / disbursePayment / getPaymentStatus
        → Payment orchestrator (lib/payments/orchestrator.ts)
        → Provider Registry / adapter
        → IntaSend | TendePay | Daraja | Paystack | simulated | …
        → payment_intents + wallet ledger RPCs (+ journal projection)
```

**Do not** call IntaSend/KCB/Co-op SDKs from feature code or Circle pages.

## Steps to add e.g. KCB or Co-op

1. **Adapter** — implement the same shape as existing adapters under `apps/web/src/lib/payments/adapters/`:
   - `collect` / STK or redirect
   - `disburse` (if supported)
   - `getStatus`
   - webhook verification helper (HMAC / signature / challenge)
2. **Register** in the orchestrator / provider registry (`PAYMENT_PROVIDER`, optional collect/disburse overrides).
3. **Webhook** — `POST /api/webhooks/<provider>` that:
   - verifies authenticity
   - `ingest_webhook_event` (fingerprint)
   - calls `complete_payment_intent` / fail / withdrawal complete
   - `mark_payment_intent_reconciled` on success
4. **Env** — sandbox vs production secrets only in Vercel/server env. Never in the browser.
5. **Tests** — duplicate webhook, failed collect, status poll settle.

## What stays provider-agnostic

- `payment_intents` (internal id / status)
- `wallets` / `private.ledger_*` (live balances today)
- `journal_entries` / `journal_lines` (append-only audit projection)
- `settlements` / `provider_transactions` / `reconcile_*` (ops matching)
- Admin Finance + Reconcile queue

Provider-specific fields belong in adapter `raw` metadata / `provider_transactions.raw`, not in core account codes.

## Capabilities flags

Configure per provider (env or future DB config):

| Flag | Meaning |
|------|---------|
| collection | STK / card collect |
| disbursement | B2C / bank payout |
| b2b | Paybill / Till |
| sandbox | Non-live money |

See also [financial-architecture.md](./financial-architecture.md) and [PAYMENTS_ORCHESTRATOR.md](./PAYMENTS_ORCHESTRATOR.md).
