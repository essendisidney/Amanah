# Domains — jameiyah.com & jameiyah.co.ke

Production app currently: `https://amanah-liart.vercel.app` (Vercel project **amanah**).

## Goal

| Domain | Role |
|--------|------|
| `jameiyah.com` | Primary global site |
| `www.jameiyah.com` | Redirect → apex |
| `jameiyah.co.ke` | Kenya site (same app) |
| `www.jameiyah.co.ke` | Redirect → apex `.co.ke` |

Both domains serve the same Next.js app (marketing `/` + product).

## 1. Add domains in Vercel

From the monorepo root (project already linked):

```bash
npx vercel domains add jameiyah.com
npx vercel domains add www.jameiyah.com
npx vercel domains add jameiyah.co.ke
npx vercel domains add www.jameiyah.co.ke
```

Or: Vercel Dashboard → Project **amanah** → Settings → Domains → Add.

Assign each domain to **Production**.

## 2. DNS at your registrar

### If using Vercel nameservers
Point the domain’s NS records to the nameservers Vercel shows after you add the domain.

### Current registrar DNS (host-ww.net)

Both domains currently use nameservers:
- `ns1.host-ww.net` … `ns4.host-ww.net`

Keep those NS records. At the DNS panel for each domain, add:

| Host | Type | Value |
|------|------|-------|
| `@` (apex) | A | `76.76.21.21` |
| `www` | A | `76.76.21.21` |

(Or CNAME `www` → `cname.vercel-dns.com` if your panel prefers CNAME for www.)

SSL certificates issue automatically after DNS points at Vercel.

## 3. App env after domains go live

`NEXT_PUBLIC_APP_URL=https://jameiyah.com` is set on Vercel (production + preview).

Redeploy after DNS A records point to `76.76.21.21` so SSL can issue.

### Supabase Auth (dashboard — MCP has no auth-URL API)

Project **Amanah** (`vzpnixfqkvovbniaoudx`) → Authentication → URL Configuration:

- **Site URL:** `https://jameiyah.com`
- **Redirect URLs** (add all):
  - `https://jameiyah.com/**`
  - `https://www.jameiyah.com/**`
  - `https://jameiyah.co.ke/**`
  - `https://www.jameiyah.co.ke/**`
  - `https://amanah-liart.vercel.app/**`
  - `https://amanah-liart.vercel.app/auth/callback`
  - `https://jameiyah.com/auth/callback`
  - `https://jameiyah.co.ke/auth/callback`

Or via Management API (needs `SUPABASE_ACCESS_TOKEN`):

```bash
curl -X PATCH "https://api.supabase.com/v1/projects/vzpnixfqkvovbniaoudx/config/auth" \
  -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"site_url":"https://jameiyah.com","uri_allow_list":"https://jameiyah.com/**,https://www.jameiyah.com/**,https://jameiyah.co.ke/**,https://www.jameiyah.co.ke/**,https://amanah-liart.vercel.app/**"}'
```

## 4. SSL

Vercel issues certificates automatically once DNS A records resolve to `76.76.21.21`.
Until then, `issue_cert` fails (domain not reachable). After you add the A records, wait a few minutes and open:
- https://jameiyah.com
- https://jameiyah.co.ke

## 5. Optional: redirect `.co.ke` ↔ `.com`
