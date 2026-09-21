# Production smoke test

Base URL: https://jameiyah.com  
Fallback: https://amanah-liart.vercel.app

## Automated pings

```bash
curl -sS https://jameiyah.com/api/v1/health
curl -sS https://jameiyah.com/api/v1/payments/mpesa-health
curl -sS https://jameiyah.com/api/v1/payments/orchestrator-health
curl -sS -o /dev/null -w "%{http_code}" https://jameiyah.com/
curl -sS -o /dev/null -w "%{http_code}" https://jameiyah.co.ke/
curl -sS -o /dev/null -w "%{http_code}" https://jameiyah.com/sadaka
curl -sS -o /dev/null -w "%{http_code}" https://jameiyah.com/zakat
```

Expect: health `ok: true` with `otp.taifa_key: true`, pages `200`.  
Orchestrator-health returns `ok: true` **after** Kenya payment code (phases 1–9) is deployed; until then expect `404`.

## Automated check (2026-09-21)

| Probe | Result |
|-------|--------|
| `jameiyah.com` / `.co.ke` / www | 200 |
| `/api/v1/health` | ok; `taifa_key: true`; version `7b27418` |
| `/api/v1/payments/mpesa-health` | ok; provider `paystack`; Daraja not configured |
| `/api/v1/payments/orchestrator-health` | 404 (undeployed) |

## Concurrency smoke (public)

```bash
BASE_URL=https://jameiyah.com node scripts/load-smoke.mjs
```

Expect mostly `ok` with low fail count. This does not hit authenticated contribute/wallet paths (needs session cookies).

## Manual path (15 min)

1. **Register** at `/register` with a real email you can access  
2. **Login** at `/login`  
3. **Profile** — set phone / start KYC upload  
4. **Create circle** — `/circles/new`  
5. **Wallet** — simulated top-up (≥ 100 KES)  
6. **Activate** circle (as admin) and pay a contribution  
7. **Sadaka** — `/sadaka` → open campaign → donate (≥ 10 KES) while signed in  
8. **Support** — `/support` tip (platform, not charity)  
9. **Finance** — `/finance/qard` request (needs membership + history); `/finance/invest` for multi-circle projects  
10. **Community** — `/circles/<slug>/community` send a chat message  
11. **Admin** (if compliance role) — `/admin/observability`, `/admin/sadaka` fee policy
12. **USSD** (optional) — `curl -X POST .../api/ussd` with form fields (see below)

## USSD smoke (Africa’s Talking shape)

```bash
curl -sS -X POST 'https://jameiyah.com/api/ussd' \
  -H 'Content-Type: application/x-www-form-urlencoded' \
  -H "X-USSD-Secret: $USSD_CALLBACK_SECRET" \
  --data-urlencode 'sessionId=test-1' \
  --data-urlencode 'phoneNumber=+254712345678' \
  --data-urlencode 'text=' \
  --data-urlencode 'serviceCode=*123#'
```

Expect plain text starting with `CON` or `END`.

## Failures to watch

| Symptom | Likely cause |
|---------|----------------|
| Redirect loop / OAuth fail | Auth Site URL not set to `https://jameiyah.com` |
| Top-up / donate fails with provider error | `PAYMENT_PROVIDER` / secrets |
| Orchestrator-health 404 | Kenya payment code not deployed yet |
| Empty sadaka list | Phase 7 migration not applied / no live campaign |
| API 401 on mobile | Wrong `EXPO_PUBLIC_*` keys or API base URL |
