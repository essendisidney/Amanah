# Deploy payments-mpesa (one-time auth)

Hardened service-role auth is on `master`. Deploy requires a Supabase access token.

```powershell
npx supabase login
npx supabase functions deploy payments-mpesa --project-ref vzpnixfqkvovbniaoudx
```

Then check: https://amanah-liart.vercel.app/api/v1/payments/mpesa-health

While `PAYMENT_PROVIDER=paystack`, wallet top-ups do not need Daraja. Flip to `mpesa` only after this deploy succeeds and `daraja_configured` is true.
