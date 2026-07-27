# Phase 10 — Feature-doc gap closures

Closes the highest-value leftovers from `Amanah_Platform_Features`.

## Delivered

| Step | Item | What shipped |
|------|------|----------------|
| 1 | Live Daraja | Still needs your sandbox secrets + Edge deploy (code path ready from Phase 9) |
| 2 | Welfare | `/finance/welfare` — create fund, contribute, file claim, approve/pay |
| 3 | Payout → M-Pesa | `settle_payout_to_mpesa` + schedule UI “Settle → M-Pesa queue” |
| 4 | Vouching + roles | Member list role picker + vouch/reject; profile M-Pesa link |
| 5 | Fees + retry | Create-circle join/tx fees + segment; charge on join/pay; wallet failed-intent retry |

## Migration

`supabase/migrations/20260727220000_phase10_gap_closures.sql`

## Ops

```bash
# apply migration (pooler / linked)
npx supabase db push --db-url "$DATABASE_URL" --yes

# still needed for live STK
npx supabase functions deploy payments-mpesa --project-ref vzpnixfqkvovbniaoudx
# + set MPESA_* secrets, PAYMENT_PROVIDER=mpesa on Vercel
```
