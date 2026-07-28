# Phase 11 — Polish (Daraja deferred)

Ships feature-doc leftovers **without** live M-Pesa Daraja credentials.

## Delivered

| Step | Item | What shipped |
|------|------|----------------|
| 11.1 | Payout cashout | `settle_payout_to_mpesa` auto-simulates B2C debit; admin `process_payout_cashout` + badges |
| 11.2 | Excel exports | SpreadsheetML `.xls` + CSV on admin audit/transactions and circle members |
| 11.3 | USSD | Phone-linked balance, circles, dues via `/api/ussd` |
| 11.4 | Tawarruq partner | Admin handoff UI, RPCs, Edge stub `tawarruq-partner` |
| 11.5 | Push scaffold | `device_push_tokens`, `register_push_token`, `/api/v1/push-token`, Expo branch in `notify-dispatch` |

## Migration

`supabase/migrations/20260727230000_phase11_polish.sql`

## Ops

```bash
# apply migration
npx supabase db push --db-url "$DATABASE_URL" --yes

# optional: redeploy notify-dispatch + tawarruq stub
npx supabase functions deploy notify-dispatch --project-ref vzpnixfqkvovbniaoudx
npx supabase functions deploy tawarruq-partner --project-ref vzpnixfqkvovbniaoudx
```

## Still deferred (Daraja last)

1. Set `MPESA_*` secrets + deploy `payments-mpesa`
2. Set `PAYMENT_PROVIDER=mpesa` on Vercel
3. Replace simulated B2C with live Daraja B2C cash-out
