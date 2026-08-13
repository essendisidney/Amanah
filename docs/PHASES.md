# Phase roadmap

## Phase 1 — Complete
## Phase 2 — Complete
## Phase 3 — Complete
## Phase 4 — Complete

## Phase 5 — Collections, mobile scaffold & production cutover

| Step | Deliverable | Status |
|------|-------------|--------|
| 5.1 | Collection cases + sync from late contributions | Complete |
| 5.2 | Admin collections console | Complete |
| 5.3 | `collections` Edge Function (sync + outreach queue) | Complete |
| 5.4 | Expanded `/api/v1` + Bearer auth for mobile | Complete |
| 5.5 | Expo mobile scaffold (`apps/mobile`) | Complete |
| 5.6 | Production simulated-payment cutover helpers | Complete |

See `docs/PHASE_5.md`.

## Phase 6 — Mobile parity, bank PSP, playbooks & observability

| Step | Deliverable | Status |
|------|-------------|--------|
| 6.1 | Collections playbooks + run-step RPC | Complete |
| 6.2 | Bank transfer jobs + live `payments-bank` | Complete |
| 6.3 | Mobile API: invites, KYC, withdrawals, health | Complete |
| 6.4 | Expo feature tabs (circles, dues, invites, KYC) | Complete |
| 6.5 | Admin playbooks + observability dashboard | Complete |

See `docs/PHASE_6.md`.

## Phase 7 — Community finance and giving

| Step | Deliverable | Status |
|------|-------------|--------|
| 7.1 | Public Sadaka campaigns, donation fees, and platform support tips | Complete |
| 7.2 | Zakat calculator and Africa's Talking-style USSD menu stub | Complete |
| 7.3 | Finance hub: Qard Hassan, Tawarruq, savings goals, welfare overview | Complete |
| 7.4 | Circle member CSV export and extended officer roles | Complete |
| 7.5 | Circle chat, meetings, grace requests, vouching schema | Complete |
| 7.6 | Segments, M-Pesa linkage field, referrals, USSD sessions | Complete |

See `docs/PHASE_7.md`.

## Fee policy note
Sadaka default = **donation_addon** (100% of gift to cause; fee disclosed on top). Pending Sharia board sign-off — switchable per campaign to `donation_deduct`.

## Phase 8 — Charity payment intents

| Step | Deliverable | Status |
|------|-------------|--------|
| 8.1 | `create_payment_intent` metadata + min amount for sadaka/tips | Complete |
| 8.2 | `complete_payment_intent` fulfills sadaka / platform tip (no wallet credit) | Complete |
| 8.3 | Web donate/tip actions → intent + simulated complete or M-Pesa STK | Complete |
| 8.4 | Go-live + smoke-test docs | Complete |

See `docs/PHASE_8.md`, `docs/GO_LIVE.md`, `docs/SMOKE_TEST.md`.

## Phase 9 — Live M-Pesa (Daraja)

| Step | Deliverable | Status |
|------|-------------|--------|
| 9.1 | Harden `payments-mpesa` (Nairobi TS, intent load, health, real-mode) | Complete |
| 9.2 | Shared STK helper + wallet/sadaka/API error surfacing | Complete |
| 9.3 | Ops health route + Phase 9 runbook | Complete |
| 9.4 | Edge deploy + Daraja secrets in project | Needs credentials |

See `docs/PHASE_9.md`.

## Phase 10 — Feature-doc gap closures

| Step | Deliverable | Status |
|------|-------------|--------|
| 10.1 | Live Daraja secrets + Edge redeploy | Needs credentials |
| 10.2 | Welfare contribute / claim / decide UI | Complete |
| 10.3 | Settle payout → M-Pesa withdrawal queue | Complete |
| 10.4 | Vouching + officer role UI + M-Pesa link | Complete |
| 10.5 | Circle join/tx fees + payment intent retry | Complete |

See `docs/PHASE_10.md`.

## Phase 11 — Polish (Daraja deferred)

| Step | Deliverable | Status |
|------|-------------|--------|
| 11.1 | Auto-sim payout cashout + admin queue | Complete |
| 11.2 | Excel + CSV exports (admin + circle) | Complete |
| 11.3 | Richer USSD (balance / circles / dues) | Complete |
| 11.4 | Tawarruq partner handoff + worker stub | Complete |
| 11.5 | Push token scaffold + Expo dispatch | Complete |

See `docs/PHASE_11.md`.

## Phase 12 — Improve without Daraja

| Step | Deliverable | Status |
|------|-------------|--------|
| 12.1 | Sadaka receipts + fee disclosure UX | Complete |
| 12.2 | Wallet pending intents + retry feedback | Complete |
| 12.3 | Pay-ahead + Qard decide + officer strip | Complete |
| 12.4 | Multi-channel reminders + payout reminders | Complete |
| 12.5 | Referrals + phone sync | Complete |
| 12.6 | Segment badges + printable PDF report | Complete |
| 12.7 | Observability aged/failed + Expo push register | Complete |

See `docs/PHASE_12.md`.

## Phase 13 — Deferred without Daraja

| Step | Deliverable | Status |
|------|-------------|--------|
| 13.1 | Sadaka fee admin + Sharia policy audit | Complete |
| 13.2 | Tawarruq partner Edge API + webhook | Complete |
| 13.3 | Expo wallet / finance / officer + v1 APIs | Complete |
| 13.4 | Africa’s Talking USSD auth + shortcode docs | Complete |

See `docs/PHASE_13.md`.

## Phase 14–17 — Phone-first + officer + referrals

| Step | Deliverable | Status |
|------|-------------|--------|
| 14 | AT SMS + richer USSD + Vercel cron fan-out | Complete |
| 15 | Expo parity (shipped with Phase 13 APIs) | Complete |
| 16 | Officer console `/circles/[slug]/officer` | Complete |
| 17 | Auto referral wallet rewards | Complete |

See `docs/PHASE_14.md`.

## Chamasoft-style treasury (2026-08)

| Step | Deliverable | Status |
|------|-------------|--------|
| T1 | Circle bank/cash accounts + income/expense categories | Complete |
| T2 | Cashbook RPC + treasury UI `/circles/[slug]/treasury` | Complete |
| T3 | Fine categories + levy onto member statement | Complete |
| T4 | Investments/projects tracking | Complete |
| T5 | Member statement + report pack summaries | Complete |
| T6 | CSV backdating import UI | Complete |

See `docs/CHAMASOFT_PARITY.md`.

## Chamasoft GL + shares (2026-08)

| Step | Deliverable | Status |
|------|-------------|--------|
| G1 | `circle_gl_pack` income / cash flow / balance sheet on report | Complete |
| G2 | Share capital lots + par value | Complete |
| G3 | Pro‑rata dividend allocation | Complete |
| G4 | Bank SMS alert queue scaffold | Complete |
| G5 | Expo `eas.json` Android preview/production profiles | Complete |

## Chamasoft settle + match (2026-08)

| Step | Deliverable | Status |
|------|-------------|--------|
| S1 | Pay dividends to member wallets from circle cash | Complete |
| S2 | Auto-match bank alerts to cashbook | Complete |
| S3 | Debit/credit journal view | Complete |

## Chamasoft invoices + bank webhooks (2026-08)

| Step | Deliverable | Status |
|------|-------------|--------|
| I1 | Contribution invoices + remind RPC + `/circles/[slug]/invoices` | Complete |
| I2 | Bank alert webhook (`/api/webhooks/bank-alerts`) + SMS parsers | Complete |
| I3 | `ingest_bank_alert` for service_role / officers | Complete |

## Paystack (2026-08)

| Step | Deliverable | Status |
|------|-------------|--------|
| P1 | `payment_provider` enum + `PAYSTACK_SECRET_KEY` Checkout init | Complete |
| P2 | Webhook + browser callback → `complete_payment_intent` | Complete |
| P3 | Wire wallet / API v1 / charity when `PAYMENT_PROVIDER=paystack` | Complete |

See `docs/PAYSTACK.md`. Set Vercel secrets to go live.

## Later
- Live Daraja STK + B2C cash-out (secrets + Edge deploy)
- Partner bank OpenAPI credentials for live Tawarruq (scaffold ready)
- Sharia board meeting → flip endorsement in `/admin/sadaka`
- Production Africa’s Talking shortcode + SMS sender ID (ops)
- Expo Router + EAS project id / Play submit credentials
- Carrier-specific SMS adapters; audited PDF templates
- Paystack live keys + dashboard webhook (ops)
