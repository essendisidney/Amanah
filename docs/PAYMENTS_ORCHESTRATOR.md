# Payment orchestrator

Jameiyah features must not call IntaSend / Paystack / Daraja SDKs directly.

```
Feature (wallet, dues, loans)
        ↓
collectPayment() / disbursePayment() / getPaymentStatus()
        ↓
Adapter (simulated | paystack | mpesa/Daraja | intasend | tendepay)
        ↓
payment_intents + ledger RPCs (source of truth)
```

## Env

| Variable | Purpose |
|----------|---------|
| `PAYMENT_PROVIDER` | Default: `simulated` \| `paystack` \| `mpesa` \| `intasend` \| `tendepay` \| `bank` |
| `PAYMENT_COLLECT_PROVIDER` | Optional override for collections only |
| `PAYMENT_DISBURSE_PROVIDER` | Optional override for B2C |
| `PAYMENT_FAILOVER_COLLECT` | Optional failover PSP on retriable collect failure (default: Daraja when primary is IntaSend/TendePay/Paystack) |
| `PAYMENT_FAILOVER_DISBURSE` | Optional failover for B2C |
| `DARAJA_READY` | Set `false` to disable Daraja adapter even if Supabase is linked |
| `INTASEND_*` | IntaSend STK + B2C |
| `TENDEPAY_API_KEY` | TendePay API key (required for bake-off) |
| `TENDEPAY_API_BASE` | Optional API host (defaults sandbox/live) |
| `TENDEPAY_TEST` | `true` (sandbox) or `false` (live) |
| `TENDEPAY_STK_PATH` / `TENDEPAY_DISBURSE_PATH` / `TENDEPAY_STATUS_PATH` | Override provisional paths |

Webhooks: `POST /api/webhooks/intasend`, `POST /api/webhooks/tendepay`  
Health: `GET /api/v1/payments/orchestrator-health` (includes `bakeOff` block)

## Phase map

0. **Ops (partial)** — Domains + Taifa green on `jameiyah.com`; Auth Site URL + secrets rotation still manual; **web deploy of phases 1–9 still pending** (see [PHASE_0.md](./PHASE_0.md))
1. **Done** — orchestrator + adapters + wallet top-up  
2. **Done** — Contribution Pay now → STK → due PAID  
3. **Done** — Disburse via `disbursePayment`  
4. **Done** — Maker-checker + verified beneficiaries  
5. **Done** — TendePay adapter bake-off (wired; compare vs IntaSend in staging)  
6. **Done** — Daily reconcile (poll aged intents + processing withdrawals)
7. **Done** — Treasury B2B (Paybill / Till / bank) behind dual approval
8. **Done** — Daraja primary/failover (STK query + wallet B2C + orchestrator failover)
9. **Done** — Circle projects usable + statement visibility + multi-chama invest hub

> Schema for phases 1–9 is applied on Supabase. App routes (orchestrator-health, IntaSend/TendePay webhooks, etc.) ship when this branch is committed and deployed.

### Circle projects (Phase 9)

- Officers create/fund/update via Treasury **Circle projects** (`createInvestmentAction` / `update_circle_investment`)
- Funding goes through `record_treasury_entry` so cashbook stays true
- `member_circle_statement` includes `circle_investments` + `circle_investments_value` (planned/active)
- Member statement page + PDF show circle projects; `/finance/invest` lists projects across all memberships (pools stay per-circle)

### Daraja (Phase 8)

- Edge `payments-mpesa`: `stk_query` for reconcile; `b2c_payment` kind=`withdrawal` for wallet cashouts (charity still default)
- B2C callback settles `withdrawal_requests` or charity rows
- Orchestrator failover: IntaSend/TendePay/Paystack collect → Daraja on retriable failure; override with `PAYMENT_FAILOVER_COLLECT` / `PAYMENT_FAILOVER_DISBURSE`
- Disable adapter with `DARAJA_READY=false`

### Treasury B2B (Phase 7)

- Tables: `circle_payout_destinations`, `treasury_payout_requests`
- Flow: Treasury **Pay supplier** → `request_treasury_payout` → dual approval (if enabled) → `disbursePayment(mpesa_b2b)` via IntaSend → webhook / `complete_treasury_payout` → cashbook expense
- Bank destinations settle in cashbook (simulated rail until bank API is live)
- Officer second-approve on `/circles/[slug]/officer` triggers live send

### Daily reconcile

- Job: `GET /api/cron/dispatch?job=reconcile-payments` (Vercel cron 05:00 UTC)
- Also on `job=all`; admin **Run now** on `/admin/observability`
- Writes `reconcile_runs` + `reconcile_run_items`; settles via `complete_payment_intent` / withdrawal complete helpers
- Flags still-open or missing-ref items for admin review

### TendePay bake-off

1. Set `TENDEPAY_API_KEY` (+ optional `TENDEPAY_API_BASE` once TendePay issues docs/credentials).  
2. Staging A: `PAYMENT_PROVIDER=intasend` — one wallet top-up STK + one withdrawal B2C.  
3. Staging B: `PAYMENT_PROVIDER=tendepay` — same two flows.  
4. Compare: STK time-to-prompt, B2C settlement latency, webhook reliability, fees.  
5. Keep Daraja as fallback collect when Edge is healthy.  

Paths default to `/v1/payments/stk-push`, `/v1/payments/b2c`, `/v1/payments/status` and are overridable — TendePay’s public API surface is not fully documented yet.

### Contribution STK

- UI → `payContributionStkAction` / API `{ method: "stk" }`
- Settlement: intent `kind: contribution`

### Disburse (B2C)

- `runWithdrawalDisbursement` → `disbursePayment` → `process_withdrawal`
- Circle payout M-Pesa + admin withdrawals/cashouts

### Maker-checker + beneficiaries

- `user_payout_destinations`; locked M-Pesa withdraw; dual-approval destination UX
