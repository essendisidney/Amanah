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

### payments-bank
Bank initiate/confirm stub. Completes as simulated without `BANK_*` unless `REQUIRE_REAL_PROVIDERS=true`.

```bash
supabase functions serve payments-bank --env-file supabase/.env.local
```
