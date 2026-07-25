# Production smoke test

Base URL: https://amanah-liart.vercel.app

## Automated pings

```bash
curl -sS https://amanah-liart.vercel.app/api/v1/health
curl -sS -o /dev/null -w "%{http_code}" https://amanah-liart.vercel.app/
curl -sS -o /dev/null -w "%{http_code}" https://amanah-liart.vercel.app/sadaka
curl -sS -o /dev/null -w "%{http_code}" https://amanah-liart.vercel.app/zakat
```

Expect: health `ok: true`, pages `200`.

## Manual path (15 min)

1. **Register** at `/register` with a real email you can access  
2. **Login** at `/login`  
3. **Profile** — set phone / start KYC upload  
4. **Create circle** — `/jamiyas/new`  
5. **Wallet** — simulated top-up (≥ 100 KES)  
6. **Activate** circle (as admin) and pay a contribution  
7. **Sadaka** — `/sadaka` → open campaign → donate (≥ 10 KES) while signed in  
8. **Support** — `/support` tip (platform, not charity)  
9. **Finance** — `/finance/qard` request (needs membership + history)  
10. **Community** — `/jamiyas/<slug>/community` send a chat message  
11. **Admin** (if compliance role) — `/admin/observability`

## Failures to watch

| Symptom | Likely cause |
|---------|----------------|
| Redirect loop / OAuth fail | Auth Site URL not set to Vercel domain |
| Top-up / donate fails with provider error | `PAYMENT_PROVIDER` / secrets |
| Empty sadaka list | Phase 7 migration not applied / no live campaign |
| API 401 on mobile | Wrong `EXPO_PUBLIC_*` keys or API base URL |
