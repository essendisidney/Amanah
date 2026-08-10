# Phase 14–17 — Phone-first, Expo polish, Officer OS, Finance maturity

Continues after Phase 13 **without Daraja**.

| Wave | Focus | Status |
|------|--------|--------|
| 14 | Africa’s Talking SMS + richer USSD + cron fan-out | Complete (code) |
| 15 | Expo wallet/finance/officer already shipped in P13; finance APIs live | Complete (scaffold) |
| 16 | Officer console `/circles/[slug]/officer` | Complete |
| 17 | Auto referral wallet rewards + reminders hook | Complete |

## 14 — Phone-first

- `notify-dispatch`: SMS via Africa’s Talking (`AT_USERNAME` / `AT_API_KEY`) with Twilio fallback; `SMS_PROVIDER=auto|africastalking|twilio`
- USSD menu: Balance, Circles, Dues, **Next payout**, **Grace**, Help
- Vercel crons → `/api/cron/dispatch?job=reminders|notify|collections|tawarruq` (requires `CRON_SECRET`)

### Ops (you)

1. Set Vercel: `CRON_SECRET`, `USSD_CALLBACK_SECRET`, optional `AT_USSD_SHORTCODE`
2. Set Supabase Edge secrets: `AT_USERNAME`, `AT_API_KEY`, `AT_SMS_SHORTCODE` / `AT_SENDER_ID`, `CRON_SECRET`
3. Redeploy Edge: `notify-dispatch`, `reminders`
4. Provision AT USSD shortcode → `https://amanah-liart.vercel.app/api/ussd`

## 16 — Officer trust OS

Circle officers get `/circles/[slug]/officer`: late dues, grace decide, collection cases, vouch.

## 17 — Referral auto-reward

- RPC `reward_qualified_referrals` credits referrer wallet (KES default 50 if reward_amount=0)
- Invoked from `reminders` Edge cron
- Admin `mark_referral_rewarded` also credits wallet

## Migration

`supabase/migrations/20260806140000_phase14_17_phone_officer_referrals.sql`

## Still later

- Live Daraja STK / B2C
- AT shortcode + SMS sender ID approval (ops)
- Partner bank OpenAPI credentials
- Full Expo Router / store packaging
