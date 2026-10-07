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

## Circle fees

A circle's `transaction_fee_amount` is due once a contribution is fully paid, whatever the payment path (M-Pesa via `complete_payment_intent`, wallet via `pay_contribution` / `pay_contribution_ahead`, or the web app's `charge_contribution_fee`). All of them call `private.charge_circle_fee`, which debits the fee if the wallet's spendable balance (available minus pending withdrawals) covers it, and otherwise records it in `fees_owed` and notifies the member. `private.collect_fees_owed` takes owed fees, oldest first, after money comes in through `complete_payment_intent` and before `request_withdrawal`. Collected fees post Dr 2000 / Cr 2120 like any other fee. Admins see and manage owed fees at `/admin/finance/fees-owed` (`admin_fees_owed_overview`, `admin_collect_fees_owed`, `admin_waive_fee_owed`). A waived fee is never collected.

## Contribution overpayments

An STK payment larger than what is owed posts the full receipt (Dr 1000 / Cr 3000) plus a `contribution_change` entry for the extra that stayed in the wallet (Dr 3000 / Cr 2000), linked to the same intent. Posted by `post_journal_for_payment_intent`, so it also covers backfills.

## Qard

`repay_qard` posts `transaction_type = qard_repayment` (not `contribution`) and a QARD journal pair (Dr 4100 / Cr 4000). The wallet side is posted as a wallet movement (below), so 4100 nets to zero and a repayment reads Dr 2000 / Cr 4000. A disbursement from `decide_qard` posts Dr 4000 / Cr 2000.

## Wallet movements

Wallet credits and debits that are not payments, dues or fees post from the `wallet_movement_journal` trigger on `transactions` (`private.post_journal_for_wallet_movement`, `source_type = 'wallet_movement'`, one entry per transaction). Migration `20261007120000` backfilled history.

| `metadata.kind` | Wallet | Journal | From |
|---|---|---|---|
| `welfare_contribution` | debit | Dr 2000 / Cr 6000 | `contribute_to_welfare` |
| `welfare_claim` | credit | Dr 6000 / Cr 2000 | `decide_welfare_claim` |
| `pocket_deposit` | debit | Dr 2000 / Cr 3000 | `move_savings_pocket` |
| `pocket_withdraw` | credit | Dr 3000 / Cr 2000 | `move_savings_pocket` |
| `circle_dividend` | credit | Dr 3000 / Cr 2000 | `pay_circle_dividend` |
| (payout with `payout_id`) | credit | Dr 3000 / Cr 2000 | `settle_payout`, `service_settle_payout` |
| `qard_disbursement` | credit | Dr 4000 / Cr 2000 | `decide_qard` |
| `qard_repayment` | debit | Dr 2000 / Cr 4100 | `repay_qard` |

A new wallet path with a kind not in this table posts nothing; add it to `private.wallet_movement_accounts` or journal it in its own function.

## Admin

| Route | Role |
|-------|------|
| `/admin` | Ops inbox (KYC, money out, disputes…) |
| `/admin/finance` | MuM KPIs, exceptions, journal feed |
| `/admin/finance/reconcile` | Stuck intents + run reconcile |
| `/admin/finance/intents/[id]` | Case file: intent + webhooks + journal + settlements + refunds |
| `/admin/finance/journal` | Append-only journal browser (debits/credits) |
| `/admin/finance/accounts` | Chart of accounts + journal totals |
| `/admin/finance/settlements` | PSP settlements mirror + backfill / dispute |
| `/admin/finance/integrity` | Wallet vs journal 2000 delta + backfill missing posts |
| `/admin/finance/refunds` | Queue / complete refunds (never edits posted lines) |
| `/admin/finance/fees-owed` | Circle fees members owe: collect now, or waive with a reason (member notified, audit-logged) |
| `/admin/finance/approvals` | Maker–checker for large refunds (+ withdrawals) |
| `/admin/architecture` | How the finance stack is built (layers + status maps) |

Balances are not editable from admin UI — corrections via reverse journal only.

## Refunds

`request_refund` caps the total of pending, in-flight and completed refunds on a payment at what is refundable: for a contribution, the amount applied to dues (any overpayment change is already in the wallet); for sadaka, the donation that reached the cause; for sponsorship, the charge; otherwise the payment amount. `complete_refund` re-checks under a lock on the intent (`AMOUNT_EXCEEDS_REFUNDABLE`).

| Kind | Money goes | Journal |
|------|-----------|---------|
| contribution | member wallet | Dr 3000 / Cr 2000 |
| sadaka | member wallet | Dr 5000 / Cr 2000 (amount credited) |
| sponsorship | member wallet | Dr 6000 / Cr 2000 (amount credited) |
| wallet_top_up | out of wallet, back to payer | Dr 2000 / Cr 1000 |
| platform_tip | back to payer | Dr 2100 / Cr 1000 |

A sadaka or sponsorship reversal that has already run fails with `ALREADY_REFUNDED` instead of posting a journal with no money behind it. Unknown `metadata.kind` values fail with `UNSUPPORTED_KIND`.

Refunds completed before 2026-10-06 credited 1000 for wallet refunds; migration `20261006120000` posts `refund_wallet_fix` / `refund_overpost_fix` corrections. It cannot undo money already over-refunded. To list payments refunded beyond what was refundable (run as `postgres`):

```sql
SELECT p.id, p.metadata->>'kind' AS kind, p.amount AS paid,
       private.refundable_amount(p) AS refundable,
       sum(r.amount) - private.refundable_amount(p) AS over_refunded
FROM public.payment_intents p
JOIN public.refunds r ON r.payment_intent_id = p.id AND r.status = 'completed'
WHERE coalesce(p.metadata->>'kind', 'wallet_top_up') IN ('contribution', 'wallet_top_up', 'platform_tip')
GROUP BY p.id
HAVING sum(r.amount) > private.refundable_amount(p);
```

## Money-out (withdrawals)

Completed `withdrawal_requests` debit wallet SoT via `process_withdrawal`, then post journal **Dr 2000 / Cr 1100** (`source_type = withdrawal_request`). Disbursement settlements are mirrored with `direction = disbursement` (no `payment_intent`). Backfill from Integrity if historical rows lack journals.

## Status machine

App: `lib/finance/state-machine.ts`. DB: `private.assert_*_transition` + hardened `mark_payment_intent_reconciled`. After every successful complete, `mirrorSettlementAfterComplete` writes `settlements` + `provider_transactions`.

## Deferred (roadmap toward full engine)

Still ahead of full DE SoT cutover: live Co-op/KCB credentials + webhooks, broader automated finance suite, journal-as-SoT cutover. Settlement ops queue + integrity counts are live.

**Shipped foundations:** settlements/refunds/provider_transactions, amount_minor, state machine, complete/cancel refund with reverse journal + sidecars, refund maker–checker, Co-op/KCB bank adapter scaffold, Admin Finance resolve (match/manual/waive); [payment-provider-integration.md](./payment-provider-integration.md).
