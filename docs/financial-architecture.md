# Financial architecture (Jameiyah)

**Source of truth today:** `wallets` + `private.ledger_credit` / `ledger_debit` + `payment_intents` (via `complete_payment_intent`).  
**Projection (append-only):** `ledger_accounts` + `journal_entries` / `journal_lines`.  
**Circle ops books:** `book_entries` (cashbook) — bridged from contribution settlements.  
**Providers move money; Jameiyah records truth.** Adapters live under `apps/web/src/lib/payments/`; features must not call PSPs directly (see [PAYMENTS_ORCHESTRATOR.md](./PAYMENTS_ORCHESTRATOR.md)).

## Money flow

```
Feature (wallet, dues, Qard, Sadaka)
        ↓
collectPayment / disbursePayment / getPaymentStatus
        ↓
Adapter (simulated | intasend | tendepay | daraja | paystack | …)
        ↓
payment_intents
        ↓
webhook_events (inbox, fingerprint dedupe)  ──┐
reconcile cron / getPaymentStatus              │
        ↓                                      │
complete_payment_intent                        │
        ├─→ wallets / transactions (live SoT)  │
        ├─→ domain sidecars (contributions,    │
        │     qard, sadaka, …)                 │
        ├─→ journal_* (balanced projection)    │
        └─→ book_entries (contribution bridge) ←┘
```

## Status layers

| Layer | Where | Meaning |
|-------|--------|---------|
| Provider / intent | `payment_intents.status` | pending → processing → completed / failed |
| Settlement | `payment_intents.settlement_status` | unsettled \| settled \| disputed \| waived |
| Reconcile | `payment_intents.reconcile_status` | open \| matched \| exception \| manual |

**completed ≠ settled ≠ matched.** Webhooks and daily reconcile set `matched` + `settled` after a successful complete. Flagged polls set `exception` (Admin → Finance).

## Domains (chart)

Seeded in `ledger_accounts.domain`:

- `OPERATING` — PSP clearing, wallet liability, fees  
- `CONTRIBUTIONS` — dues clearing  
- `QARD` — receivable / repayments  
- `SADAKA` — charity clearing  
- `TAKAFUL` — welfare / sponsorship clearing  
- `ASSET_FINANCE` — reserved  

Journal posts are **idempotent** on `(source_type, source_id)` (e.g. `payment_intent` + intent UUID).

## Webhooks

- Table: `webhook_events` — unique `(provider, fingerprint)`  
- RPCs: `ingest_webhook_event`, `finalize_webhook_event`  
- IntaSend: challenge **required** when `INTASEND_WEBHOOK_CHALLENGE` is set; optional `INTASEND_WEBHOOK_SECRET` for signature header  
- Routes also verify IntaSend status via `getPaymentStatus` before settling when an invoice id is present  

## Qard

`repay_qard` posts `transaction_type = qard_repayment` (not `contribution`) and a QARD journal pair.

## Admin

| Route | Role |
|-------|------|
| `/admin` | Ops inbox (KYC, money out, disputes…) |
| `/admin/finance` | MuM KPIs, exceptions, journal feed |
| `/admin/finance/reconcile` | Stuck intents + run reconcile |
| `/admin/finance/journal` | Append-only journal browser (debits/credits) |
| `/admin/finance/refunds` | Queue refunds (never edits posted lines) |
| `/admin/architecture` | How the finance stack is built (layers + status maps) |

Balances are not editable from admin UI — corrections via reverse journal only.

## Status machine

App: `lib/finance/state-machine.ts`. DB: `private.assert_*_transition` + hardened `mark_payment_intent_reconciled`. After every successful complete, `mirrorSettlementAfterComplete` writes `settlements` + `provider_transactions`.

## Deferred (roadmap toward full engine)

Still ahead of full DE SoT cutover: maker-checker policy engine, contribution/sadaka sidecar reverse on refund, live Co-op/KCB adapters, broader automated finance suite.

**Shipped foundations:** settlements/refunds/provider_transactions, amount_minor, state machine, complete/cancel refund with reverse journal + wallet debit for top-ups, Admin Finance + Reconcile + Journal + Refunds + Architecture; member wallet “Ledger posts”; [payment-provider-integration.md](./payment-provider-integration.md).
