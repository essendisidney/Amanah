# Chamasoft-style parity (Amanah)

Amanah already covered ROSCA cycles, Qard Hassan, welfare, meetings, elections, and phone/PWA. These waves add the classic **investment-group treasurer** surface that Chamasoft is known for.

## Mapped modules

| Chamasoft | Amanah |
|-----------|--------|
| Transactions / online treasurer | `/circles/[slug]/treasury` cashbook (`record_treasury_entry`) |
| Bank account management | `circle_bank_accounts` (bank / M-Pesa / petty cash) |
| Income & expense management | `circle_ledger_categories` + income/expense entries |
| Member fining | `fine_categories` + `levy_member_fine` → `penalties` |
| Group investments / projects | `circle_investments` |
| Membership + personal records | Existing members + `/circles/[slug]/statement` |
| Loans | Existing Qard Hassan (+ kafala) |
| Reports (income / cash flow / balance sheet) | `/circles/[slug]/report` + `circle_gl_pack` (print → PDF) |
| Share capital / dividends | `/circles/[slug]/shares` + `record_share_purchase` / `allocate_circle_dividend` |
| Backdating | CSV import via `import_book_entries` |
| Bank SMS reconcile | `circle_bank_alerts` + `match_bank_alerts` (amount/direction/date) |
| Dividend payout | `pay_circle_dividend` credits member wallets from circle cash |
| Journal / double-entry view | `/circles/[slug]/journal` via `circle_journal` |
| Member invoices / reminders | `/circles/[slug]/invoices` + `issue_contribution_invoices` / `remind_contribution_invoices` |
| Bank SMS webhook ingest | `POST /api/webhooks/bank-alerts` + `parseBankSms` → `ingest_bank_alert` |
| Group communication | Announcements + `remind_contribution_invoices` → SMS/WhatsApp outbox (`notify-dispatch`) |
| E-wallet / M-Pesa | Personal wallet + simulated/Daraja path (live STK still secrets-gated) |
| Android app install | Chrome PWA primary; Expo `eas.json` scaffold for APK/AAB |
| Dual approval | Circle dual-approval settings + `dual_approval_requests` for payouts/Qard; platform withdrawals |
| Group SaaS pricing | `/pricing` + `platform_plans` / `circle_subscriptions` (Free / Starter / Pro) |
| Member statements | Branded print statements + loan/savings book summaries on statement/report |

## Still later

- More carrier/gateway-specific SMS adapters beyond current Kenya bank set
- EAS project id + Play Console submit credentials
- Live Daraja STK / AT shortcode (ops secrets)

## Schema

- `supabase/migrations/20260813120000_chamasoft_treasury_wave.sql`
- `supabase/migrations/20260813140000_chamasoft_gl_shares_wave.sql`
- `supabase/migrations/20260813160000_chamasoft_settle_match_wave.sql`
- `supabase/migrations/20260813180000_chamasoft_invoices_webhooks_wave.sql`
- `supabase/migrations/20260813200000_ops_gap_close_wave.sql`

RPCs include: `pay_circle_dividend`, `match_bank_alerts`, `set_bank_alert_status`, `circle_journal`, `issue_contribution_invoices`, `remind_contribution_invoices`, `ingest_bank_alert`, `propose_process_withdrawal`, `propose_settle_payout`, `propose_decide_qard`, `confirm_dual_approval`, `set_circle_plan`, `get_circle_plan`.
