# Phase 9 — Live M-Pesa (Daraja)

Wire production STK for wallet top-ups, Sadaka donations, and platform tips.

## Delivered

1. **Hardened Edge Function** `payments-mpesa`
   - Africa/Nairobi Daraja timestamps (not UTC)
   - Loads intent from DB (amount/phone/kind)
   - Kind-aware `TransactionDesc` (top-up / sadaka / tip)
   - `MPESA_TRANSACTION_TYPE` for PayBill vs Buy Goods
   - `action: "health"` readiness probe
   - `REQUIRE_REAL_PROVIDERS=true` blocks simulated STK fallback
   - Idempotent callback ack when intent already completed

2. **Web**
   - Shared `invokeMpesaStk` helper (`apps/web/src/lib/payments/mpesa.ts`)
   - Wallet + charity actions surface STK errors (no silent fire-and-forget)
   - Mobile API `POST /api/v1/wallet/top-up` triggers STK when `PAYMENT_PROVIDER=mpesa`
   - Ops: `GET /api/v1/payments/mpesa-health`
   - Cutover: Next.js no longer expects Daraja secrets locally (they belong on Edge)

## Enable sandbox / live

### 1. Deploy function

```bash
npx supabase functions deploy payments-mpesa --project-ref vzpnixfqkvovbniaoudx
```

### 2. Set Edge secrets

```bash
npx supabase secrets set \
  MPESA_CONSUMER_KEY=... \
  MPESA_CONSUMER_SECRET=... \
  MPESA_SHORTCODE=... \
  MPESA_PASSKEY=... \
  MPESA_CALLBACK_URL=https://vzpnixfqkvovbniaoudx.supabase.co/functions/v1/payments-mpesa \
  MPESA_BASE_URL=https://sandbox.safaricom.co.ke \
  MPESA_TRANSACTION_TYPE=CustomerPayBillOnline
```

For production Daraja, switch `MPESA_BASE_URL` to `https://api.safaricom.co.ke`.

### 3. Vercel (Next.js)

```bash
# Flip app to M-Pesa STK path
PAYMENT_PROVIDER=mpesa
ALLOW_SIMULATED_IN_PROD=true   # remove once Daraja secrets are live
# REQUIRE_REAL_PROVIDERS=true  # set only after sandbox STK works end-to-end
```

Redeploy web after env changes.

### 4. Smoke

1. `GET https://amanah-liart.vercel.app/api/v1/payments/mpesa-health` → `daraja_configured: true`
2. Sign in → Wallet → top-up with `+2547…` → approve STK on phone
3. Sadaka donate while signed in → same STK path
4. Confirm wallet / donation receipt after callback

Sandbox test MSISDN/PIN: use Safaricom Daraja portal credentials.

## Out of scope (later)

- STK status query polling UI
- B2C payouts for withdrawals
- Till (Buy Goods) auto-routing per merchant
