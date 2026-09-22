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

Scaffold is live: `lib/payments/adapters/bank-rails.ts` (`coop` / `kcb` / `bank`) + orchestrator registration.

1. Set env (`COOP_BANK_*` / `KCB_BANK_*` or shared `BANK_API_*`) and Edge `payments-bank`.
2. Optional: `PAYMENT_PROVIDER=coop|kcb|bank`, `BANK_RAIL=coop|kcb`.
3. **Webhook** — `POST /api/webhooks/bank` (secret: `BANK_WEBHOOK_SECRET` or fallback `BANK_ALERT_WEBHOOK_SECRET`). Body: `{ status, reference, intent_id, rail?: "coop"|"kcb" }`.
4. Keep secrets server-side only.
5. Tests — see `src/lib/finance/bank-rails.test.ts`.

Until bank credentials are set, adapters return `*_BANK_NOT_CONFIGURED` (set `BANK_ALLOW_SIMULATED=true` only for local smoke).

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
