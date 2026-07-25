# Phase 2 — Ledger & schedules

## What shipped

1. **Schedule engine** — Circle admins activate a jamiya (`activate_jamiya`) once ≥2 members are active. Creates contribution rows per member×cycle and payout rows by payout position.
2. **Wallet ledger** — SECURITY DEFINER `private.ledger_credit` / `ledger_debit`. Public RPCs: `wallet_top_up` (simulated), `pay_contribution`, `settle_payout`.
3. **UI** — Wallet top-up + transaction history; jamiya contribution calendar / payout schedule with pay & settle actions; dashboard Pay buttons.
4. **Realtime** — `notifications` on `supabase_realtime`; client toasts via `NotificationRealtime`.
5. **Edge Functions** — `reminders` (late + due reminders), `settlement` (batch via `service_settle_payout`).
6. **Admin** — CSV export for audit logs and transactions.
7. **Observability** — `apps/web/src/lib/observability.ts` structured logger + optional Sentry hook.
8. **E2E** — Playwright smoke tests under `e2e/` (root `pnpm test:e2e`).

## Security notes

- Clients never write `wallets` / `transactions` directly.
- Invite/token patterns from Phase 1 unchanged.
- `service_settle_payout` requires `auth.role() = service_role`.
