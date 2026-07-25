# Phase 3 — Payments, delivery & disputes

## What shipped

1. **Payment intents** — `payment_intents` + `create_payment_intent` / `complete_payment_intent`. Wallet top-up uses simulated complete by default, or M-Pesa STK when `PAYMENT_PROVIDER=mpesa`.
2. **M-Pesa edge function** — `payments-mpesa` (STK + Daraja callback). Without Daraja secrets, completes as simulated.
3. **Notification outbox** — `notification_outbox` + `queue_invitation_delivery`. Edge `notify-dispatch` sends via Resend/Twilio (or no-ops when unset).
4. **Disputes** — Members open disputes on a circle; `/admin/disputes` for compliance resolve/reject. Open disputes block payout settlement.
5. **KYC payout gate** — Payouts ≥ 50,000 require recipient `kyc_status = approved`.

## Env

```bash
PAYMENT_PROVIDER=simulated   # or mpesa
# MPESA_CONSUMER_KEY=
# MPESA_CONSUMER_SECRET=
# MPESA_SHORTCODE=
# MPESA_PASSKEY=
# MPESA_CALLBACK_URL=
# MPESA_BASE_URL=https://sandbox.safaricom.co.ke
# RESEND_API_KEY=
# EMAIL_FROM=Amanah <noreply@yourdomain.com>
# TWILIO_ACCOUNT_SID=
# TWILIO_AUTH_TOKEN=
# TWILIO_FROM_NUMBER=
```

## Out of scope (later)
- Native mobile clients
- Full bank rails / multi-PSP
- Advanced ML risk scoring
