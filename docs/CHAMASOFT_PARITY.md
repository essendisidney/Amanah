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
| Group communication | Existing announcements / community (SMS/WhatsApp still ops-gated) |
| E-wallet / M-Pesa | Personal wallet + simulated/Daraja path (live STK still secrets-gated) |
| Android app install | Chrome PWA primary; Expo `eas.json` scaffold for APK/AAB |

## Still later

- Provider webhooks / SMS gateway parsers for bank alerts
- Audited PDF templates (beyond browser print)
- EAS project id + Play Console submit credentials
- Live Daraja STK / AT shortcode (ops secrets)

## Schema

- `supabase/migrations/20260813120000_chamasoft_treasury_wave.sql`
- `supabase/migrations/20260813140000_chamasoft_gl_shares_wave.sql`
- `supabase/migrations/20260813160000_chamasoft_settle_match_wave.sql`

RPCs include: `pay_circle_dividend`, `match_bank_alerts`, `set_bank_alert_status`, `circle_journal`.
