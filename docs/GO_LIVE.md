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

## 3. Optional live rails

| Env | Purpose |
|-----|---------|
| `PAYMENT_PROVIDER=mpesa` | STK for wallet + sadaka + tips |
| `MPESA_*` secrets on Edge Function `payments-mpesa` | Daraja |
| `BANK_API_URL` / `BANK_API_KEY` on `payments-bank` | Live bank |
| `REQUIRE_REAL_PROVIDERS=true` | Block simulated fallbacks |

```bash
npx supabase functions deploy payments-mpesa
npx supabase functions deploy payments-bank
npx supabase functions deploy notify-dispatch
```

## 4. GitHub auto-deploy

Repo currently deploys via Vercel CLI. For git-based deploys:

1. Create GitHub repo `amanah`
2. `git remote add origin git@github.com:<you>/amanah.git`
3. `git push -u origin master`
4. Vercel → Project → Settings → Git → Connect repository

## 5. Smoke test

See [SMOKE_TEST.md](./SMOKE_TEST.md).
