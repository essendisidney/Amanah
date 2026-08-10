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
- Till (Buy Goods) auto-routing per merchant

## B2C (Sadaka Option B beneficiary payout)

Auto-disburse queues a `charity_disbursements` row when a campaign hits its goal.
Daily cron `job=sadaka` → Edge `sadaka-ops` → `payments-mpesa` `action: b2c_payment`.

### Extra Edge secrets (B2C)

```bash
npx supabase secrets set \
  MPESA_B2C_INITIATOR=... \
  MPESA_B2C_SECURITY_CREDENTIAL=... \
  MPESA_B2C_RESULT_URL=https://vzpnixfqkvovbniaoudx.supabase.co/functions/v1/payments-mpesa \
  MPESA_B2C_TIMEOUT_URL=https://vzpnixfqkvovbniaoudx.supabase.co/functions/v1/payments-mpesa \
  MPESA_B2C_COMMAND_ID=BusinessPayment
```

Deploy both functions:

```bash
npx supabase functions deploy payments-mpesa --project-ref vzpnixfqkvovbniaoudx
npx supabase functions deploy sadaka-ops --project-ref vzpnixfqkvovbniaoudx
```

Without B2C secrets, `sadaka-ops` completes disbursements as **simulated** (pilot-safe).
Set `REQUIRE_REAL_PROVIDERS=true` only after live B2C works in sandbox.

### Custody

- `custody_mode=amanah_pass_through` (default) — Option B short hold + auto B2C
- `custody_mode=psp_subaccount` — Option A reserved; Amanah will not auto-disburse from float

### Sponsorship renewals

Same `sadaka-ops` cron calls `queue_due_sponsorship_charges` and initiates STK when a phone is on file.
