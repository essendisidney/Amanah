# Phase 12 — Improve without Daraja

Closes remaining trust/ops gaps while live M-Pesa stays deferred.

## Delivered

| Step | Item | What shipped |
|------|------|----------------|
| 12.1 | Sadaka receipts | `/sadaka/receipt/[code]`, donate form feedback + fee preview + ack |
| 12.2 | Wallet intents | Pending/processing list + retry action state |
| 12.3 | Pay-ahead | Schedule UI calls `pay_contribution_ahead` for future dues |
| 12.4 | Qard | Cap preview cards + officer approve/reject via `decide_qard` |
| 12.5 | Officer strip | Late dues / grace / next payout on circle detail |
| 12.6 | Reminders | Edge enqueues email/SMS/push with daily dedupe + payout reminders |
| 12.7 | Referrals | `apply_referral`, qualify-on-paid trigger, profile UI |
| 12.8 | Phone sync | `sync_phone_from_auth` from profile |
| 12.9 | Segment + PDF | Segment badges; printable `/circles/[slug]/report` |
| 12.10 | Observability | Failed outbox + aged withdrawals (>24h) |
| 12.11 | Expo push | `expo-notifications` + device token registration |

## Migration

`supabase/migrations/20260729120000_phase12_improvements.sql`

## Ops

```bash
npx supabase db push --db-url "$DATABASE_URL" --yes
npx supabase functions deploy reminders --project-ref vzpnixfqkvovbniaoudx
npx supabase functions deploy notify-dispatch --project-ref vzpnixfqkvovbniaoudx
# schedule reminders + notify-dispatch with CRON_SECRET
```

## Still deferred

- Live Daraja STK + B2C
- Africa’s Talking shortcode
- Full mobile feature parity
- Live Tawarruq bank API + auto referral wallet payouts
