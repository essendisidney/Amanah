# Edge Functions

## Phase 2

### reminders
Marks overdue contributions late and creates in-app reminders for dues within 3 days.

### settlement
Batch-settles due payouts whose cycle contributions are complete (via `service_settle_payout`).

## Phase 3

### collections
Syncs late contributions into `collection_cases`, recomputes risk, queues outreach.

```bash
supabase functions serve collections --env-file supabase/.env.local
curl -X POST "$SUPABASE_URL/functions/v1/collections" \
  -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY"
```

### payments-mpesa
STK initiate + callback. Also B2C initiate + result callback for Sadaka Option B.

### sadaka-ops
Daily cron: claim pending campaign disbursements (B2C or sim) and queue due sponsorship STK charges.

```bash
supabase functions serve sadaka-ops --env-file supabase/.env.local
curl -X POST "$SUPABASE_URL/functions/v1/sadaka-ops" \
  -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY"
```
