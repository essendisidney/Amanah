# Chamasoft-style parity (Amanah)

Amanah already covered ROSCA cycles, Qard Hassan, welfare, meetings, elections, and phone/PWA. This wave adds the classic **investment-group treasurer** surface that Chamasoft is known for.

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
| Reports | Enhanced `/circles/[slug]/report` + `treasury_snapshot` |
| Backdating | CSV import via `import_book_entries` |
| Group communication | Existing announcements / community (SMS/WhatsApp still ops-gated) |
| E-wallet / M-Pesa | Personal wallet + simulated/Daraja path (live STK still secrets-gated) |

## Still later (not this wave)

- Full double-entry GL / formal balance sheet PDF pack
- Auto bank SMS reconciliation (Equity-style)
- Share capital / dividends products
- Play Store / EAS packaging (use Chrome PWA for Android install)

## Schema

Migration: `supabase/migrations/20260813120000_chamasoft_treasury_wave.sql`

RPCs: `ensure_circle_treasury`, `record_treasury_entry`, `levy_member_fine`, `treasury_snapshot`, `member_circle_statement`.
