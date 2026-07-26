# Amanah go-live checklist

Production URL: https://amanah-liart.vercel.app  
Supabase project: `vzpnixfqkvovbniaoudx`

## 1. Auth URL configuration (required)

In [Supabase Dashboard](https://supabase.com/dashboard/project/vzpnixfqkvovbniaoudx/auth/url-configuration):

| Setting | Value |
|---------|--------|
| Site URL | `https://amanah-liart.vercel.app` |
| Redirect URLs | `https://amanah-liart.vercel.app/auth/callback` |
| | `http://localhost:3002/auth/callback` (local) |

Without this, login / OAuth / magic links will fail on production.

## 2. Rotate secrets (do this soon)

These were shared in chat during setup — rotate in Supabase, then update Vercel env:

1. **Database password** — Project Settings → Database → Reset password  
2. **Service role key** — Settings → API → roll/reveal new key if available  
3. Update Vercel project env: `SUPABASE_SERVICE_ROLE_KEY` (and DB URL if used for CLI)  
4. Redeploy after env changes

## 3. Live M-Pesa (Phase 9)

Full runbook: [PHASE_9.md](./PHASE_9.md).

| Env | Where | Purpose |
|-----|--------|---------|
| `PAYMENT_PROVIDER=mpesa` | Vercel | STK for wallet + sadaka + tips |
| `ALLOW_SIMULATED_IN_PROD=true` | Vercel | Until Daraja secrets are set |
| `MPESA_*` | Supabase Edge secrets | Daraja consumer/passkey/callback |
| `REQUIRE_REAL_PROVIDERS=true` | Edge + Vercel | Block simulated fallbacks |

```bash
npx supabase functions deploy payments-mpesa --project-ref vzpnixfqkvovbniaoudx
npx supabase functions deploy payments-bank --project-ref vzpnixfqkvovbniaoudx
npx supabase functions deploy notify-dispatch --project-ref vzpnixfqkvovbniaoudx
```

Health: `GET /api/v1/payments/mpesa-health`

## 4. GitHub auto-deploy

Repo currently deploys via Vercel CLI. For git-based deploys:

1. Create GitHub repo `amanah`
2. `git remote add origin git@github.com:<you>/amanah.git`
3. `git push -u origin master`
4. Vercel → Project → Settings → Git → Connect repository

## 5. Smoke test

See [SMOKE_TEST.md](./SMOKE_TEST.md).
