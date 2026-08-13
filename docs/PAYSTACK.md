# Paystack payments

Amanah can take wallet top-ups (and charity/tips when `PAYMENT_PROVIDER=paystack`) via [Paystack Checkout](https://paystack.com/docs/payments/accept-payments/).

## Flow

1. Create `payment_intent` with provider `paystack`
2. `POST /transaction/initialize` → redirect user to `authorization_url`
3. Settle via:
   - Browser return: `GET /api/payments/paystack/callback?reference=…`
   - Webhook: `POST /api/webhooks/paystack` (`charge.success`, HMAC `x-paystack-signature`)
4. Service role calls `complete_payment_intent` (existing ledger / sadaka fulfillment)

## Env (Vercel Production + Preview)

| Variable | Where |
|----------|--------|
| `PAYMENT_PROVIDER=paystack` | Vercel |
| `PAYSTACK_SECRET_KEY` | Vercel (test `sk_test_…` or live `sk_live_…`) |
| `NEXT_PUBLIC_APP_URL` | `https://amanah-liart.vercel.app` |
| `SUPABASE_SERVICE_ROLE_KEY` | already required |

## Paystack dashboard

1. Settings → API Keys → copy **Secret key**
2. Settings → Webhooks → URL  
   `https://amanah-liart.vercel.app/api/webhooks/paystack`
3. Enable `charge.success`

## Local / test

```bash
# apps/web/.env.local
PAYMENT_PROVIDER=paystack
PAYSTACK_SECRET_KEY=sk_test_xxx
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

Use Paystack test cards / test mobile money from their docs. Amounts are sent in subunits (KES × 100).

## Schema

`supabase/migrations/20260813190000_paystack_payment_provider.sql` adds enum value `paystack`.
